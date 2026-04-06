'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Zap } from 'lucide-react';

function AuthSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      localStorage.setItem('token', token);
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.id) {
          localStorage.setItem('userId', payload.id);
        }
        if (payload.username) {
          localStorage.setItem('username', payload.username);
          router.push(`/profile/${payload.username}`);
        } else {
          router.push('/');
        }
      } catch (e) {
        console.error('Neural link sync failed:', e);
        router.push('/login');
      }
    } else {
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'radial-gradient(ellipse at top left, #1A1832 0%, #0D0B1E 50%, #080714 100%)' }}
    >
      <Zap className="w-10 h-10 text-crimson animate-bounce" />
      <h2 className="text-white font-black tracking-[0.2em] uppercase text-sm mt-6">
        Synchronizing Identity
      </h2>
      <Loader2 className="w-6 h-6 text-white/20 animate-spin mt-4" />
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div 
        className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at top left, #1A1832 0%, #0D0B1E 50%, #080714 100%)' }}
      >
        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
      </div>
    }>
      <AuthSuccessContent />
    </Suspense>
  );
}
