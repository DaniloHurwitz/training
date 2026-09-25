/* Service worker mínimo: permite mostrar avisos en el teléfono y abrir la agenda al tocarlos.
   No guarda nada en caché. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((c) => c.url.startsWith(self.registration.scope));
    if (win) {
      await win.focus();
      if (data.key) win.postMessage({ type: 'focus-occ', date: data.date, key: data.key });
      return;
    }
    await self.clients.openWindow(data.url || self.registration.scope);
  })());
});
