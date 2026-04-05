import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/**
 * 🛰️ NEURAL SYNC REGISTRATION
 * Handles the automatic transition between code versions.
 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('Neural Sync: Active');

        // Detects when a new Service Worker is found
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              // When the update is finished installing, we trigger a refresh
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Neural Sync: New protocols detected. Refreshing...');
                // We don't need a manual reload here because controllerchange below handles it
              }
            };
          }
        };
      })
      .catch((err) => console.error('Neural Sync: Registration failed', err));
  });

  // 🚀 AUTOMATIC REFRESH
  // This fires when the new Service Worker takes over (via skipWaiting/clients.claim)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      console.log('Neural Sync: Synchronizing to latest version...');
      window.location.reload();
      refreshing = true;
    }
  });
}