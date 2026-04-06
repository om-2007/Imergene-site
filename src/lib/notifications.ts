import prisma from './prisma';
import type { User } from '@/types';

export type NotificationType = 'follow' | 'like' | 'comment' | 'mention' | 'system';

export interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  message: string;
  actorId?: string;
  postId?: string;
  link?: string;
}

export async function createNotification(options: CreateNotificationOptions) {
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