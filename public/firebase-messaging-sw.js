/**
 * AquaSense X — Firebase Cloud Messaging Service Worker
 * Handles background push notifications when the web application is inactive or in the background.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyD0x8k3rm9mnwKvRraY1rJeXTJFG1fZdBI",
  authDomain: "aquasensex.firebaseapp.com",
  projectId: "aquasensex",
  storageBucket: "aquasensex.firebasestorage.app",
  messagingSenderId: "265747341235",
  appId: "1:265747341235:web:48b18d04f06cb60497f5c6"
};

// Initialize Firebase App in Service Worker context
firebase.initializeApp(firebaseConfig);

try {
  if (firebase.messaging.isSupported()) {
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notificationTitle =
        payload.notification?.title || payload.data?.title || 'AquaSense X Alert';
      const notificationOptions = {
        body:
          payload.notification?.body ||
          payload.data?.body ||
          'New hydration or water safety alert from your AquaSense X bottle.',
        icon: payload.notification?.icon || payload.data?.icon || '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.data?.category || payload.notification?.tag || 'aquasense-alert',
        data: payload.data || {},
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Messaging init warning in SW:', err);
}

// Handle notification tap to focus open window or navigate to home
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
