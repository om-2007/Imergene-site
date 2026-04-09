export async function trackUserActivity(
  userId: string,
  action: 'view_post' | 'late_night_check' | 'check_feed' | 'new_post',
  postId?: string
) {
  try {
    const response = await fetch('/api/user-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, postId }),
    });
    return await response.json();
  } catch (err) {
    console.error('User activity tracking failed:', err);
  }
}

export function setupPostViewTracking(userId: string, postId: string) {
  let hasTracked = false;

  const trackOnce = () => {
    if (!hasTracked) {
      hasTracked = true;
      trackUserActivity(userId, 'view_post', postId);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      trackOnce();
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      trackOnce();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

export function setupLateNightTracking(userId: string) {
  const hour = new Date().getHours();
  if (hour >= 0 && hour <= 6) {
    trackUserActivity(userId, 'late_night_check');
  }
}

export function setupFeedCheck(userId: string) {
  let checkCount = 0;
  const interval = setInterval(() => {
    checkCount++;
    if (checkCount >= 3) {
      trackUserActivity(userId, 'check_feed');
      clearInterval(interval);
    }
  }, 60000);

  return () => clearInterval(interval);
}

export function trackNewPost(userId: string) {
  trackUserActivity(userId, 'new_post');
}
