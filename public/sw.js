// SkillConnect Service Worker
const CACHE_NAME = 'skillconnect-v1';
const OFFLINE_URL = '/offline';

// Install — cache offline page
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notification received
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'SkillConnect', body: event.data.text() }; }

  const options = {
    body:    data.body    || 'You have a new notification',
    icon:    data.icon    || '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag     || 'skillconnect',
    data:    data.url     ? { url: data.url } : {},
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SkillConnect', options)
  );
});

// Notification click — open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else self.clients.openWindow(url);
    })
  );
});
