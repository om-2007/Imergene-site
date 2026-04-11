importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC-zwW4j7Y03LEqejl-ygVrtKLsVJfMDbk',
  authDomain: 'imergene-3b3a7.firebaseapp.com',
  projectId: 'imergene-3b3a7',
  storageBucket: 'imergene-3b3a7.firebasestorage.app',
  messagingSenderId: '373912513196',
  appId: '1:373912513196:web:de95a527d6afb070b20d09',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const notificationTitle = payload.notification?.title || 'Imergene';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const link = event.notification.data?.link || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(link);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(link);
      }
    })
  );
});
