---
name: ui-verify
description: Проверить UI-правку matrix-react в настоящем браузере — поднять dev-сервер, открыть приложение через Windows-браузер и подтвердить поведение в Playwright MCP (снапшот, клик, консоль, скриншот). Использовать, когда менялись компоненты, вёрстка, тема или связка со Redux и нужен факт, а не догадка.
whenToUse: Правка в src/components, src/containers, src/reducers, theme.js или mock/ — перед ответом пользователю.
---

# Проверка UI-правки в браузере

Спорное поведение подтверждается наблюдением в реальном Chrome, а не рассуждением по коду.
Проверка = dev-сервер + окно браузера Windows + снапшот/скриншот и консоль.

## Шаги

1. Поднять dev-сервер (managed background job, порт 3000 из `vite.config.js`):

```bash
npm run dev
curl -sf -o /dev/null http://localhost:3000/ && echo ready
```

2. Открыть приложение для человека — инструментом `win_open_url` на `http://localhost:3000`
   (Vite слушает `0.0.0.0`, из WSL тот же порт, что и в браузере Windows).

3. Действовать в браузере через Playwright MCP. Схемы ленивые: сначала активировать сервер
   (`mcp__router__search_and_activate`, serverName `browser`), затем вызывать
   `mcp__browser__browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`,
   `browser_console_messages`, `browser_network_requests`, `browser_take_screenshot`.

4. Смотреть именно то, что затронуто правкой:

- авторизация: mock API из `mock/vite-mock-api.js`, тумблер `AuthPad` и состояние сессии Matrix;
- список комнат и выбранная комната: таймлайн приходит из сервиса (`getRoomMessages`), в Redux
  лежит только UI-индекс;
- `localStorage` — ключи из `constants/storage.js`; для чистого состояния удалить их и перезагрузить
  страницу;
- dev-сборка включает `redux-logger`: по логу действий проверяются порядок dispatch и
  namespace-инвариант (`AUTHCTL_` не диспатчит `MTRXCTL_`, мост — только в `AuthContainer`).

5. Отчёт: URL, шаги воспроизведения, что наблюдалось, ошибки консоли и сети. Для визуальной правки —
   `browser_take_screenshot` плюс ссылка для человека через `win_open_url`.

6. Убрать за собой: закрыть окно Chrome (профиль Playwright постоянный, иначе следующая сессия не
   запустит браузер) и остановить job dev-сервера.

## Признаки проблемы

- ошибки в `browser_console_messages` (в том числе React warnings о ключах и PropTypes);
- 4xx/5xx в `browser_network_requests` — сверить с mock-роутами;
- снапшот доступности не содержит ожидаемого элемента или содержит лишний;
- сервер поднялся, но страница пустая — проверить, что dev-job действительно жив, а не упал.
