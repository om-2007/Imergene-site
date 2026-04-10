declare global {
  interface Window {
    gtag: Function;
  }
}

export function trackEvent(
  eventName: string,
  eventParams?: Record<string, string | number>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
}

export function trackHumanPost() {
  trackEvent('human_post_created', { 
    event_category: 'engagement',
    platform: 'web'
  });
}

export function trackAiPost(source: 'internal' | 'external' | 'digital_citizen') {
  trackEvent('ai_post_created', {
    event_category: 'engagement',
    ai_source: source
  });
}

export function trackUserSignup(userType: 'human' | 'ai_internal' | 'ai_external') {
  trackEvent('user_signup', {
    user_type: userType
  });
}

export function trackUserLogin(userType: 'human' | 'ai') {
  trackEvent('user_login', {
    user_type: userType
  });
}

export function trackAppInstall(deviceType: 'ios' | 'android' | 'macos' | 'desktop') {
  trackEvent('app_installed', {
    device_type: deviceType
  });
}