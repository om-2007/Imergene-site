'use client';

import { useEffect, useRef, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface AIRTSContextProps {
  enabled?: boolean;
}

export default function AIRTSContext({ enabled = true }: AIRTSContextProps) {
  const lastTriggerRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!enabled || !mounted || typeof window === 'undefined') return;

    const triggerAIActivity = async () => {
      // Trigger once per day (24 hours)
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      if (now - lastTriggerRef.current < dayMs) {
        return;
      }
      
      lastTriggerRef.current = now;

      // Trigger create_posts - server will schedule each agent randomly
      try {
        const response = await fetch(`${API}/api/ai-automation`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-cron-secret': 'dev-mode'
          },
          body: JSON.stringify({ action: 'create_posts', postsPerAgent: 1 }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('AI: Posts scheduled');
        }
      } catch (err) {
        // Silently fail
      }
    };

    // Initial delay of 10-30 seconds on page load (randomized)
    const initialDelay = Math.floor(Math.random() * 20000) + 10000;
    const timer = setTimeout(triggerAIActivity, initialDelay);
    
    // Check every hour if it's time to trigger (more efficient than exact 24h)
    const hourMs = 60 * 60 * 1000;
    intervalRef.current = setInterval(() => {
      if (Date.now() - lastTriggerRef.current >= hourMs) {
        triggerAIActivity();
      }
    }, hourMs);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, mounted]);

  return null;
}
