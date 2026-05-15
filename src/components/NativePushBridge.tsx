'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getPlatformName, isNativeApp } from '@/lib/platform';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const CHANNEL_ID = 'imergene-main';

export default function NativePushBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!authToken) {
      return;
    }

    let registrationListener: { remove: () => Promise<void> } | undefined;
    let registrationErrorListener: { remove: () => Promise<void> } | undefined;
    let receivedListener: { remove: () => Promise<void> } | undefined;
    let actionListener: { remove: () => Promise<void> } | undefined;

    const saveNativeToken = async (nativeToken: string) => {
      await fetch(`${API}/api/device-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: nativeToken,
          platform: `${getPlatformName()}-app`,
        }),
      });
    };

    const showForegroundNotification = async (notification: PushNotificationSchema) => {
      const title = notification.title || 'Imergene';
      const body = notification.body || '';

      if (!title && !body) {
        return;
      }

      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title,
              body,
              channelId: CHANNEL_ID,
              extra: notification.data,
            },
          ],
        });
      } catch (err) {
        console.error('[NativePush] Local notification failed:', err);
      }
    };

    const openNotificationTarget = (notification: ActionPerformed['notification']) => {
      const link = notification.data?.link;
      if (typeof link === 'string' && link.startsWith('/')) {
        router.push(link);
        return;
      }

      const postId = notification.data?.postId;
      if (typeof postId === 'string' && postId) {
        router.push(`/post/${postId}`);
        return;
      }

      router.push('/');
    };

    const registerNativePush = async () => {
      try {
        await PushNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'Imergene notifications',
          description: 'Updates from Imergene',
          importance: 5,
          visibility: 1,
          sound: 'default',
        });
      } catch {
        // channel may already exist
      }

      await LocalNotifications.requestPermissions();

      const permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') {
        console.log('[NativePush] Push permission not granted');
        return;
      }

      registrationListener = await PushNotifications.addListener('registration', async (token: Token) => {
        await saveNativeToken(token.value);
      });

      registrationErrorListener = await PushNotifications.addListener('registrationError', (error) => {
        console.error('[NativePush] Registration error:', error);
      });

      receivedListener = await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        window.dispatchEvent(new CustomEvent('imergene:push-received', { detail: notification }));
        await showForegroundNotification(notification);
      });

      actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        window.dispatchEvent(new CustomEvent('imergene:push-opened', { detail: notification }));
        openNotificationTarget(notification.notification);
      });

      await PushNotifications.register();
    };

    registerNativePush();

    return () => {
      registrationListener?.remove().catch(() => {});
      registrationErrorListener?.remove().catch(() => {});
      receivedListener?.remove().catch(() => {});
      actionListener?.remove().catch(() => {});
    };
  }, [router]);

  return null;
}
