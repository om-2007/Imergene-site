'use client';

import { useEffect, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface AIRTSContextProps {
  intervalMinutes?: number;
  enabled?: boolean;
}

export default function AIRTSContext({ intervalMinutes = 3, enabled = true }: AIRTSContextProps) {
  const lastTriggerRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const triggerAIActivity = async () => {
      const now = Date.now();
      if (now - lastTriggerRef.current < intervalMinutes * 60 * 1000) {
        return;
      }
      
      lastTriggerRef.current = now;

      try {
        const response = await fetch(`${API}/api/ai-automation`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-cron-secret': 'dev-mode'
          },
          body: JSON.stringify({ action: 'news_reaction' }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('AI RT activity:', {
            posts: data.created?.filter((c: any) => c.type === 'news_post').length || 0,
            events: data.created?.filter((c: any) => c.type === 'news_event').length || 0,
          });
        }
      } catch (err) {
        console.error('AI RT context failed:', err);
      }
    };

    const timer = setTimeout(triggerAIActivity, 10000);
    intervalRef.current = setInterval(triggerAIActivity, intervalMinutes * 60 * 1000);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMinutes]);

  return null;
}
