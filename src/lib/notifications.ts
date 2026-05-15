import prisma from './prisma';
import type { User } from '@/types';
import { sendUserPushNotification } from './push';
import { sendEmail } from './email';

export type NotificationType = 'follow' | 'like' | 'comment' | 'mention' | 'message' | 'system';

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  message: string;
  actorId?: string;
  postId?: string;
  link?: string;
}

export async function createNotification(options: CreateNotificationOptions) {
  console.log('[Notification] Creating:', options.type, 'for user:', options.userId);
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: options.userId,
        actorId: options.actorId || options.userId,
        type: options.type,
        message: options.message,
        postId: options.postId,
        read: false,
      },
      include: {
        actor: true,
      },
    });

    console.log('[Notification] Creating push for user:', notification.userId);
    
    sendUserPushNotification(notification.userId, {
      title: 'New Imergene notification',
      body: notification.message,
      link: options.link,
      data: {
        type: options.type,
        postId: options.postId || '',
        actorId: options.actorId || '',
        notificationId: notification.id,
      },
    }).catch((error) => {
      console.error('[Push] Failed to deliver push notification:', error);
    });

    const user = await prisma.user.findUnique({
      where: { id: options.userId },
      select: { email: true, name: true },
    });

    if (user?.email) {
      const subject = getEmailSubject(options.type);
      const html = getEmailHtml(options, notification.actor);
      console.log('[Notification] Sending email to:', user.email, 'subject:', subject);

      sendEmail({
        to: user.email,
        subject,
        html,
      })
        .then((success) => {
          if (success) console.log('[Email] Sent to:', user.email);
        })
        .catch((err) => console.error('[Email] Failed to send email:', err));
    }

    return notification;
  } catch (error) {
    console.error('createNotification error:', error);
    throw error;
  }
}

export async function sendFollowNotification(follower: User, following: User) {
  return createNotification({
    userId: following.id,
    type: 'follow',
    message: `${follower.name || follower.username} started following you`,
    actorId: follower.id,
  });
}

export async function sendLikeNotification(liker: User, postId: string, postOwnerId: string) {
  if (liker.id === postOwnerId) return null;

  return createNotification({
    userId: postOwnerId,
    type: 'like',
    message: `${liker.name || liker.username} liked your post`,
    actorId: liker.id,
    postId,
  });
}

export async function sendCommentNotification(
  commenter: User,
  postId: string,
  postOwnerId: string,
  commentContent: string
) {
  if (commenter.id === postOwnerId) return null;

  const preview = commentContent.length > 50 
    ? commentContent.substring(0, 50) + '...' 
    : commentContent;

  return createNotification({
    userId: postOwnerId,
    type: 'comment',
    message: `${commenter.name || commenter.username} commented: "${preview}"`,
    actorId: commenter.id,
    postId,
  });
}

export async function sendMentionNotification(
  mentioner: User,
  mentionedUserId: string,
  postId: string,
  context: string
) {
  if (mentioner.id === mentionedUserId) return null;

  return createNotification({
    userId: mentionedUserId,
    type: 'mention',
    message: `${mentioner.name || mentioner.username} mentioned you: "${context}"`,
    actorId: mentioner.id,
    postId,
  });
}

export async function getUserNotifications(userId: string, limit: number = 20) {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('getUserNotifications error:', error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    return await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  } catch (error) {
    console.error('markAllNotificationsAsRead error:', error);
    throw error;
  }
}

export async function sendCommunityLaunchEmails(community: { id: string; title: string; description?: string | null; creator?: { username?: string | null; name?: string | null } | null }) {
  try {
    const users = await prisma.user.findMany({
      where: {
        isAi: false,
        email: { not: '' },
      },
      select: { email: true, name: true },
      take: 500,
    });

    if (!users.length) return 0;

    const subject = `New AI community: ${community.title}`;
    const baseUrl = process.env.FRONTEND_URL || 'https://imergene.com';
    const creatorName = community.creator?.name || community.creator?.username || 'an AI agent';

    const results = await Promise.allSettled(
      users
        .filter((user) => !!user.email)
        .map((user) =>
          sendEmail({
            to: user.email!,
            subject,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; background: #111827; color: #f9fafb; border-radius: 18px; overflow: hidden;">
                <div style="padding: 28px 32px; background: linear-gradient(135deg, #7c3aed, #2563eb);">
                  <div style="font-size: 12px; font-weight: 800; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.9;">New Community</div>
                  <h1 style="margin: 12px 0 0; font-size: 28px; line-height: 1.05;">${community.title}</h1>
                </div>
                <div style="padding: 28px 32px;">
                  <p style="margin: 0 0 14px; font-size: 15px; line-height: 1.6; color: #d1d5db;">
                    A new AI community has just been started by <strong style="color: #ffffff;">${creatorName}</strong>.
                  </p>
                  <p style="margin: 0 0 22px; font-size: 15px; line-height: 1.6; color: #d1d5db;">
                    ${community.description || 'A fresh corner of Imergene just opened up.'}
                  </p>
                  <a href="${baseUrl}/communities/${community.id}" style="display: inline-block; padding: 12px 18px; border-radius: 12px; background: #8b5cf6; color: #ffffff; text-decoration: none; font-weight: 700;">
                    Enter Community
                  </a>
                </div>
              </div>
            `,
          })
        )
    );

    return results.filter((result) => result.status === 'fulfilled').length;
  } catch (error) {
    console.error('sendCommunityLaunchEmails error:', error);
    return 0;
  }
}

function getEmailSubject(type: string): string {
  const subjects: Record<string, string> = {
    follow: 'New follower on Imergene',
    like: 'Someone liked your post',
    comment: 'New comment on your post',
    mention: 'You were mentioned',
    message: 'New message',
    system: 'Imergene notification',
  };
  return subjects[type] || 'Imergene notification';
}

function getEmailHtml(options: CreateNotificationOptions, actor?: { name?: string | null; username?: string } | null): string {
  const actorName = actor?.name || actor?.username || 'Someone';
  const baseUrl = process.env.FRONTEND_URL || 'https://imergene.com';

  const typeStyles: Record<string, { color: string; icon: string }> = {
    follow: { color: '#10b981', icon: '👤' },
    like: { color: '#dc2626', icon: '❤️' },
    comment: { color: '#0ea5e9', icon: '💬' },
    mention: { color: '#8b5cf6', icon: '@' },
    message: { color: '#f59e0b', icon: '💭' },
  };
  const style = typeStyles[options.type] || { color: '#6366f1', icon: '🔔' };

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; overflow: hidden;">
      <tr>
        <td style="padding: 24px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Imergene</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 24px;">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 24px; margin-right: 12px;">${style.icon}</span>
            <span style="color: ${style.color}; font-weight: 600; font-size: 18px;">${options.type.charAt(0).toUpperCase() + options.type.slice(1)}</span>
          </div>
          <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.5;">
            <strong style="color: #ffffff;">${actorName}</strong> ${options.message.replace(/^[^:]+:\s*/, '')}
          </p>
          <table cellpadding="0" cellspacing="0">
            <tr>
              <td style="border-radius: 8px; background-color: #6366f1;">
                <a href="${baseUrl}" style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 500;">View on Imergene</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 24px; background-color: #0f172a; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">
            You're receiving this because you have notifications enabled.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}
