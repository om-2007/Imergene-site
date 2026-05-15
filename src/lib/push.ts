import jwt from 'jsonwebtoken';
import prisma from './prisma';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL;
const FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
const FIREBASE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIREBASE_FCM_URL = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;
const FIREBASE_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/cloud-platform';

function ensureFirebaseConfig() {
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.error('[Push] Firebase config missing');
    throw new Error('Firebase not configured');
  }
}

async function getFirebaseAccessToken(): Promise<string> {
  ensureFirebaseConfig();

  const now = Math.floor(Date.now() / 1000);
  const jwtPayload = {
    iss: FIREBASE_CLIENT_EMAIL,
    scope: FIREBASE_SCOPE,
    aud: FIREBASE_OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const signedJwt = jwt.sign(jwtPayload, FIREBASE_PRIVATE_KEY, {
    algorithm: 'RS256',
  });

  const response = await fetch(FIREBASE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Failed to obtain Firebase access token: ${JSON.stringify(data)}`);
  }

  return data.access_token as string;
}

export interface FirebasePushPayload {
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
}

export async function sendFirebasePushToToken(token: string, payload: FirebasePushPayload) {
  return sendFirebasePushToPlatformToken(token, payload, 'web');
}

export async function sendFirebasePushToPlatformToken(
  token: string,
  payload: FirebasePushPayload,
  platform: string
) {
  if (!token) {
    return;
  }

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.log('[Push] Firebase not configured - skipping');
    return;
  }

  const accessToken = await getFirebaseAccessToken();
  const isWeb = platform === 'web';
  const isNativeApp = platform.endsWith('-app') || platform === 'android' || platform === 'ios';
  const message = {
    message: {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      ...(isWeb ? {
        webpush: {
          fcmOptions: {
            link: payload.link || '/',
          },
          notification: {
            title: payload.title,
            body: payload.body,
          },
        },
      } : {}),
      ...(isNativeApp ? {
        android: {
          priority: 'high',
          notification: {
            channelId: 'imergene-main',
            clickAction: 'OPEN_IMERGENE_NOTIFICATION',
          },
        },
      } : {}),
      data: {
        ...(payload.data || {}),
        link: payload.link || '/',
      },
    },
  };

  const response = await fetch(FIREBASE_FCM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Firebase send failed: ${response.status} ${errorPayload}`);
  }
}

export async function sendUserPushNotification(userId: string, payload: FirebasePushPayload) {
  console.log('[Push] sendUserPushNotification called for user:', userId, 'payload:', payload);
  
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    return;
  }

  const tokens = await prisma.deviceToken.findMany({
    where: { userId },
    select: { token: true, platform: true },
    take: 10,
  });

  if (tokens.length === 0) {
    return;
  }

  for (const device of tokens) {
    try {
      await sendFirebasePushToPlatformToken(device.token, payload, device.platform || 'web');
    } catch (error) {
      console.error('[Push] Failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('UNREGISTERED') || message.includes('registration-token-not-registered')) {
        await prisma.deviceToken.deleteMany({
          where: { token: device.token },
        }).catch(() => {});
      }
    }
  }
}

export const sendWebPushNotification = sendUserPushNotification;
