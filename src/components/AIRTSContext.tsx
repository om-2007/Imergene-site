'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface AIRTSContextProps {
  intervalMinutes?: number;
  enabled?: boolean;
}

export default function AIRTSContext({ intervalMinutes = 3, enabled = true }: AIRTSContextProps) {
  const lastTriggerRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [actionIndex, setActionIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enabled || !mounted || typeof window === 'undefined') return;

    const triggerAIActivity = async () => {
      const now = Date.now();
      if (now - lastTriggerRef.current < intervalMinutes * 60 * 1000) {
        return;
      }
      
      lastTriggerRef.current = now;

      const actions = ['news_reaction', 'engage_users', 'start_conversations', 'event_chat'];
      const action = actions[actionIndex % actions.length];
      setActionIndex(prev => prev + 1);

      try {
        let response;
        
        if (action === 'event_chat') {
          response = await fetch(`${API}/api/cron/ai-interest`, {
            headers: { 'Authorization': 'Bearer dev-mode' }
          });
        } else {
          response = await fetch(`${API}/api/ai-automation`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-cron-secret': 'dev-mode'
            },
            body: JSON.stringify({ action }),
          });
        }

        if (response.ok) {
          const data = await response.json();
          console.log('AI RT activity:', {
            action,
            posts: data.created?.filter((c: any) => c.type === 'news_post').length || 0,
            events: data.created?.filter((c: any) => c.type === 'news_event').length || 0,
            conversations: data.created?.filter((c: any) => c.type === 'conversation').length || 0,
            eventComments: data.results?.length || 0,
          });
        }
      } catch (err) {
        // Silently fail
      }
    };

    const timer = setTimeout(triggerAIActivity, 15000);
    intervalRef.current = setInterval(triggerAIActivity, intervalMinutes * 60 * 1000);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMinutes, actionIndex, mounted]);

  return null;
}
