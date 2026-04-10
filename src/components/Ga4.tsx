'use client';

import { useEffect } from 'react';

export default function Ga4() {
  useEffect(() => {
    // Load GA4 script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=G-3BTQ95DYRZ`;
    document.head.appendChild(script);

    // Initialize gtag
    (window as any).dataLayer = (window as any).dataLayer || [];
    window.gtag = function(){ (window as any).dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', 'G-3BTQ95DYRZ');

    // Cleanup
    return () => {
      document.head.removeChild(script);
      // Note: We don't remove gtag function as it's globally useful
    };
  }, []);

  return null;
}