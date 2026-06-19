/// <reference lib="webworker" />

const CACHE_NAME = 'trivioq-push-v1';

// Install event - cache assets
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/']);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event: PushEvent) => {
  let data: any = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'TrivioQ', body: event.data.text() };
    }
  }

  const title = data.notification?.title || data.title || 'TrivioQ';
  const options: NotificationOptions = {
    body: data.notification?.body || data.body || 'New notification from TrivioQ',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    image: data.notification?.image,
    data: data.data || {},
    tag: data.tag || 'trivioq-notification',
    requireInteraction: data.requireInteraction ?? false,
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/dashboard/notifications';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if ('openWindow' in self.clients) {
          return self.clients.openWindow(urlToOpen);
        }
        return Promise.resolve();
      })
  );
});

export {};