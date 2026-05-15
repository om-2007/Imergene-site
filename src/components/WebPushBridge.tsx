'use client';

import { useEffect } from 'react';
import { getFirebaseMessagingToken, onForegroundMessage } from '@/lib/fcm-client';
import { isNativeApp } from '@/lib/platform';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function WebPushBridge() {
  useEffect(() => {
    if (isNativeApp()) {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return;
    }

    const registerPush = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          return;
        }

        const fcmToken = await getFirebaseMessagingToken(registration);
        if (!fcmToken) {
          return;
        }

        await fetch(`${API}/api/device-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ token: fcmToken, platform: 'web' }),
        });
      } catch (err) {
        console.error('[WebPush] Registration failed:', err);
      }
    };

    registerPush();
  }, []);

  useEffect(() => {
    if (isNativeApp()) {
      return;
    }

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let isSubscribed = false;

    const subscribeToForegroundMessages = async () => {
      if (isSubscribed) return;

      try {
        const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!registration) {
          return;
        }

        isSubscribed = true;
        onForegroundMessage((payload) => {
          const notification = payload.notification || {};
          const title = notification.title || 'Imergene';
          const body = notification.body || '';

          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/logo_imagene_192x192.png' });
          }

          window.dispatchEvent(new CustomEvent('imergene:push-received', { detail: payload }));
        }, registration);
      } catch (err) {
        console.error('[WebPush] Foreground setup failed:', err);
      }
    };

    subscribeToForegroundMessages();
  }, []);

  return null;
}
