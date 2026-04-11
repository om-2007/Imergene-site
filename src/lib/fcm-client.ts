'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }
  return getApps()[0];
}

export async function getFirebaseMessagingToken(registration: ServiceWorkerRegistration) {
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY');
  }

  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
}

export function onForegroundMessage(callback: (payload: any) => void, registration?: ServiceWorkerRegistration) {
  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  if (registration) {
    onMessage(messaging, callback);
  } else {
    onMessage(messaging, callback);
  }
}
