---
name: ui-verify
description: Проверить UI-правку matrix-react в настоящем браузере — поднять dev-сервер, открыть приложение в Linux-Chromium внутри WSL через .dsh/bin/browser (Playwright CLI) и подтвердить поведение снапшотом, кликом, консолью и скриншотом. Использовать, когда менялись компоненты, вёрстка, тема или связка со Redux и нужен факт, а не догадка.
whenToUse: Правка в src/components, src/containers, src/reducers, theme.js или mock/ — перед ответом пользователю.
---

# Проверка UI-правки в браузере

Проверка = dev-сервер + Linux-Chromium в WSL: снапшот, клик, консоль, скриншот. Браузер
хостовой Windows для этого не используется — человек смотрит приложение сам через `win_open_url`.

## Окружение

Запускать браузер только обёрткой `.dsh/bin/browser` (Playwright CLI, headless): она уводит
`HOME` и `XDG_CACHE_HOME` в `.playwright/cache`, иначе песочница DSH не даёт Chrome создать
профиль, а демон CLI падает на `mkdir ~/.cache/ms-playwright/daemon`. Настройки — в
`.playwright/cli.config.json` (chromium, viewport 1280×800, `console.level: warning`, вывод в
`.playwright/cache/output`), браузеры — в общем кэше `~/.cache/ms-playwright` (только чтение).
Вызывать `playwright-cli` напрямую не нужно.

Если браузер падает с `error while loading shared libraries`, не хватает системных библиотек
Chromium:

```bash
sudo apt-get install -y libnss3 libnspr4 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libxrender1 libasound2t64
```

Если браузера нет: `npm i -g @playwright/cli@latest && playwright-cli install-browser chrome-for-testing`.

## Шаги

1. Поднять dev-сервер (managed background job, порт 3000 из `vite.config.js`) и дождаться ответа:

```bash
npm run dev
curl -sf -o /dev/null http://localhost:3000/ && echo ready
```

2. Открыть приложение человеку — инструментом `win_open_url` на `http://localhost:3000`.

3. **Весь сценарий проверки выполнять одной командой в одном вызове `bash`.** Демон CLI живёт
   только внутри вызова: между вызовами сессия теряется и следующая команда ответит
   `Browser 'default' is not open`. Шаги соединяются в одну цепочку:

```bash
.dsh/bin/browser open http://localhost:3000
.dsh/bin/browser click e21
.dsh/bin/browser console warning
.dsh/bin/browser screenshot
.dsh/bin/browser close
```

Режим только headless: `--headed` падает с «Looks like you launched a headed browser without
having a XServer running» (у песочницы приватный `/tmp`, X-сокет недоступен).

4. Экономить контекст — снапшот не читать целиком:

```bash
.dsh/bin/browser snapshot --depth=4          # частичное дерево
.dsh/bin/browser find "Отправить"            # точечный поиск с контекстом
.dsh/bin/browser console error               # только ошибки
.dsh/bin/browser localstorage-list
```

5. Смотреть именно то, что затронуто правкой:

- авторизация: mock API из `mock/vite-mock-api.js`, тумблер `AuthPad` и состояние сессии Matrix;
- список комнат и выбранная комната: таймлайн приходит из сервиса (`getRoomMessages`), в Redux
  лежит только UI-индекс;
- `localStorage` — ключи из `constants/storage.js`; для чистого состояния удалить их
  (`.dsh/bin/browser localstorage-delete <ключ>`) и перезагрузить страницу;
- dev-сборка включает `redux-logger`: по логу действий проверяются порядок dispatch и
  namespace-инвариант (`AUTHCTL_` не диспатчит `MTRXCTL_`, мост — только в `AuthContainer`);
- меню `MenuAppBar` — модальный drawer: пока он открыт, остальное приложение уходит в
  `aria-hidden`, поэтому `snapshot`, `find` и роль-локаторы его не видят — закрывать `Escape`
  (или ChevronLeft), прежде чем искать что-то вне меню;
- `snapshot` и роль-локаторы отражают настоящие состояния MUI: кнопка «Войти в систему»
  отдаётся как `disabled`, пока не заполнены `Логин` и `Пароль`, — состояния сверять `run-code`,
  а не глазами по скриншоту.

6. Отчёт: URL, шаги воспроизведения, что наблюдалось, ошибки консоли и сети. Для визуальной
   правки — скриншот из `.playwright/cache/output/` (показать через `read_image`) плюс ссылка
   для человека через `win_open_url`.

7. Убрать за собой: `.dsh/bin/browser close` и остановить job dev-сервера.

## Признаки проблемы

- ошибки в `console error` (в том числе React warnings о ключах и PropTypes);
- 4xx/5xx в `.dsh/bin/browser requests` — сверить с mock-роутами;
- снапшот доступности не содержит ожидаемого элемента или содержит лишний;
- `snapshot` не содержит формы или панели, хотя они видны на скриншоте — открыт drawer меню
  (`aria-hidden`), закрыть `Escape`;
- `Browser 'default' is not open` — шаги разнесены по разным вызовам, а не собраны в один;
- сервер поднялся, но страница пустая — проверить, что dev-job действительно жив, а не упал.
