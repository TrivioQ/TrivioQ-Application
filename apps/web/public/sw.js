// Web push service worker. Served as-is from /public, so this must stay plain
// JavaScript (no TypeScript syntax).

const CACHE_NAME = 'trivioq-push-v2';

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['/'])));
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((cacheNames) => Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))));
});

// Push event - show the notification. No action buttons: tapping the
// notification itself takes the user where it points.
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'TrivioQ', body: event.data.text() };
    }
  }

  const title = (data.notification && data.notification.title) || data.title || 'TrivioQ';
  const options = {
    body: (data.notification && data.notification.body) || data.body || 'New notification from TrivioQ',
    icon: '/logo.png',
    badge: '/favicon.png',
    data: data.data || {},
    tag: data.tag || 'trivioq-notification',
    requireInteraction: data.requireInteraction ?? false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Where a notification should take the user: drops open the dashboard, where
// the active question drop lives.
function urlForData(data) {
  if (!data) return '/dashboard/notifications';
  if (data.url) return data.url;
  if (data.dropId || data.screen === 'home') return '/dashboard';
  if (data.screen === 'leaderboard') return '/leaderboard';
  return '/dashboard/notifications';
}

// Notification click event - focus an open tab or open a new one
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(urlForData(event.notification.data), self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => client.url.startsWith(self.location.origin) && 'navigate' in client);
      if (existing) {
        // navigate() rejects for tabs this worker doesn't control; fall back to a new tab.
        return existing
          .navigate(urlToOpen)
          .then((c) => (c ? c.focus() : self.clients.openWindow(urlToOpen)))
          .catch(() => self.clients.openWindow(urlToOpen));
      }
      return self.clients.openWindow(urlToOpen);
    }),
  );
});
