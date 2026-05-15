'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { isNativeApp } from '@/lib/platform';

function persistToken(token: string, router: ReturnType<typeof useRouter>) {
  localStorage.setItem('token', token);

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.id) {
      localStorage.setItem('userId', payload.id);
    }
    if (payload.username) {
      localStorage.setItem('username', payload.username);
      router.push(`/profile/${payload.username}`);
      return;
    }
  } catch (error) {
    console.error('[NativeAuth] Failed to parse token:', error);
  }

  router.push('/');
}

export default function NativeAuthBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) {
      return;
    }

    let listener: { remove: () => Promise<void> } | undefined;

    const attachListener = async () => {
      listener = await App.addListener('appUrlOpen', async ({ url }) => {
        if (!url) {
          return;
        }

        if (url.startsWith('in.imergene.app://auth-success')) {
          try {
            const parsed = new URL(url);
            const token = parsed.searchParams.get('token');
            if (!token) {
              router.push('/login');
              return;
            }

            await Browser.close().catch(() => {});
            persistToken(token, router);
          } catch (error) {
            console.error('[NativeAuth] Deep link handling failed:', error);
            router.push('/login');
          }
        }
      });
    };

    attachListener();

    return () => {
      listener?.remove().catch(() => {});
    };
  }, [router]);

  return null;
}
