self.addEventListener('install', (event) => {
  self.skipWaiting(); // Принудительно активирует новый воркер
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim()); // Сразу берет управление текущей вкладкой
});


// 1. Слушаем событие клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Закрываем уведомление

  // Фокусируемся на вкладке нашего приложения
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Если вкладка уже открыта, переводим на неё фокус
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      // Если вкладка была закрыта, открываем её заново (укажите ваш url)
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// 2. Слушаем системные сообщения из React-приложения (опционально, если нужно закрывать пуш из кода)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'close-notification') {
    self.registration.getNotifications({ tag: event.data.tag }).then((notifications) => {
      notifications.forEach(notification => notification.close());
    });
  }
});
