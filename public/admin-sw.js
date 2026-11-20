/* SportyLive Admin — push notification service worker.
 * Deliberately minimal: no fetch/caching so it never interferes with the app.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'SportyLive Admin', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'SportyLive Admin';
  const options = {
    body: data.body || 'New activity in the control center.',
    icon: '/admin-push-icon.svg',
    badge: '/admin-push-icon.svg',
    tag: data.tag || 'sportylive-admin',
    renotify: true,
    requireInteraction: data.kind === 'error',
    data: { url: data.url || '/admin', kind: data.kind || 'event' },
    vibrate: data.kind === 'error' ? [120, 60, 120] : [80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/admin';

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if (client.url.includes('/admin')) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
            } catch {
              /* focus is enough */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
