# AGENTS.md — matrix-react

React-компоненты и SPA для Matrix на [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk).
Язык общения, документации и комментариев — русский.

Единственный источник правил для AI-агентов. `CLAUDE.md`,
`.github/copilot-instructions.md` и `.cursor/rules/project.mdc` — тонкие адаптеры на этот
документ, правила в них не дублировать.

## Стек и команды

Node.js 24, Vite 8, React 19, Material UI 9 + Emotion, Redux 5 (react-redux, redux-thunk,
redux-logger, react-router-dom), matrix-js-sdk, ky. JavaScript (`.js` / `.jsx`), без TypeScript.
Формат — Biome (`biome.json`).

```bash
npm install
npm run dev      # dev-сервер, http://0.0.0.0:3000
npm run build    # сборка в dist
npm run serve    # preview собранного dist, порт 4173
npm run lint     # biome lint .
npm run format   # biome format --write .
npm run check    # biome check --write .
npm run deploy   # build + выкладка dist на прод по rsync (deploy.sh) — только по явному запросу
```

`npm run deploy` (и `deploy:rsync` без сборки) идут на боевой сервер с `rsync --delete` —
параметры в `deploy.sh` (`DEPLOY_USER` / `DEPLOY_HOST` / `DEPLOY_PATH`).

## Инструменты и среда (DSH)

Профиль DSH `web` уже содержит плагины окружения — инструменты доступны сразу, доустанавливать
ничего не нужно. Общие для машины правила (WSL ↔ Windows, Mermaid, archify) — в user-global
`~/.dsh/AGENTS.md`; повторяемые процедуры — навыками в `.dsh/skills/`. Здесь только специфика
репозитория:

- **Диаграммы-артефакты** — skill `archify`, результат в `docs/archify/`; готовые HTML/JSON
  только перегенерацией, проверка — навык `archify-visual-check`. В git остаются лишь
  `*.visual-check.2048x1320.light.png` (превью для README) и receipt `*.visual-check.json`,
  остальные скриншоты и contact sheet — временные (перечислены в `.gitignore`).
- **Диаграммы в ответе** — Mermaid-блоком, а не ASCII-артом; образец — `docs/STATE.md`.
- **Проверка UI** — `npm run dev` (порт 3000): человеку открывать `win_open_url`
  (`http://localhost:3000`), агенту — Linux-Chromium в WSL обёрткой `.dsh/bin/browser`
  (Playwright CLI); пошаговый порядок — навык `ui-verify`. Настройки Playwright лежат в
  репозитории: `.playwright/cli.config.json` — chromium, viewport 1280×800, уровень `warning`,
  вывод в `.playwright/cache/output`. Рантайм-состояние демона — в игнорируемом
  `.playwright/cache/`. Обёртка обязательна: она уводит `HOME` и `XDG_CACHE_HOME` внутрь
  проекта, иначе песочница DSH не даёт Chrome записать профиль. Браузеры — в
  `~/.cache/ms-playwright`; весь сценарий проверки выполняется одной цепочкой команд в одном
  вызове `bash` (демон CLI не переживает вызов), режим только headless. MCP-сервер браузера
  на Windows в профиле отключён.

## Структура

```
src/
├── components/   # UI: MtrxReg, MtrxPad, MtrxRoom(List), MtrxDeviceVerification, MtrxIco, MtrxInfo,
│                 #     AuthAd/AuthAdInfo/AuthIco/AuthPad, MenuAppBar
├── containers/   # связка со store: MtrxContainer, MtrxPadContainer, AuthContainer, MenuAppContainer
├── actions/      # thunk-actions; utils/ — kyError.js, matrixError.js
├── reducers/     # *Rdcr, rootReducer.js, authTimeoutMiddleware.js
├── services/     # matrixClient, matrixSdk, matrixRooms, matrixClientStore, adAuth
├── store/        # configureStore, preloadedState.js (сид из сервисов)
├── constants/    # redux.js (action types), storage.js (ключи localStorage), ui.js (UI-лимиты)
└── main.jsx, App.jsx, Copyright.jsx, theme.js
mock/             # mock API для dev (vite plugin, apply: "serve")
public/           # статика: img/, sounds/, sw.js
img/              # скриншоты компонентов для README
docs/             # документация и GitHub Pages (ars-anosov.github.io/matrix-react):
                  # index.html (лендинг), STATE.md (Mermaid-схемы), archify/ (генерация skill'ом
                  # archify, исключён из Biome)
dist/             # результат npm run build — вручную не править
.github/          # CI (workflows/ci.yml: npm ci + build) и адаптер copilot-instructions.md
.dsh/             # навыки агента (skills/ui-verify) и обёртка bin/browser
.playwright/      # конфиг Playwright CLI (cli.config.json); cache/ — рантайм, в git не хранится
```

## Архитектура Matrix

- Вся логика Matrix — в `src/services/`; `matrixClient.js` отвечает за MatrixClient, sync,
  crypto/store, токены и lifecycle сессии.
- matrix-js-sdk — единственный источник истины: комнаты, таймлайн, сообщения и участники хранятся
  в SDK и не дублируются в Redux. Redux держит только лёгкий UI-индекс: `roomIds`,
  `selectedRoomId`, `roomsMeta` и при необходимости счётчики. Метаданные и сообщения активной
  комнаты читаются из сервиса по требованию (`getRoomMeta`, `getRoomMessages` / `watchRoomMessages`)
  и в стор не сериализуются.
- Список комнат обновляется дельтами (INITIALIZE / PUT / DELETE одного `roomId`), без полной
  перезаписи массива на каждое событие SDK.
- Компоненты React не импортируют `matrix-js-sdk`, не читают Matrix session storage и не вызывают
  Matrix API напрямую.
- Компоненты и контейнеры получают из сервисов только узкий доменный API, без SDK-объектов:
  `AuthAd` → `adAuth.getStoredAdLogin` (предзаполнение логина), `MtrxPadContainer` →
  `matrixRooms.watchRoomMessages` (подписка на сообщения активной комнаты).
- Весь `localStorage` и все HTTP-запросы (`ky`) — только в `src/services/`; ключи — в
  `constants/storage.js`. Actions вызывают доменный API сервиса и преобразуют ошибки через
  `actions/utils/kyError.js`. Сервисы со стором сводит только слой стора: `store/preloadedState.js`
  собирает сид (`uriAdAuth` ← `getStoredAdAuthUri`) и отдаёт его в `configureStore`, который
  передаёт срез в `createStore` как `preloadedState`; там же инжектятся зависимости
  `authTimeoutMiddleware` (проверка срока и сброс AD-сессии). Reducers и middleware сервисов
  не импортируют и остаются чистыми.
- Actions только валидируют UI-ввод, вызывают сервисы и преобразуют результат в actions;
  reducers не содержат Matrix-логики.
- Namespace-инвариант: thunk-и `AUTHCTL_` не диспатчат `MTRXCTL_` (и наоборот). Мост
  к сервисам (`AUTHCTL_` ↔ `MTRXCTL_`) — только в контейнере `AuthContainer`. Тумблер `AuthPad`
  отражает состояние сессии Matrix: откл — авто-авторизация данными AD; зелёный (`status ===
  "success"`) и красный (`status === "error"` — неудачная авторизация, `authLost` — принудительный
  logout сервером / 401) — сброс сессии (`handleRegClear` → `logoutMatrix`), после сброса тумблер
  возвращается в исходное состояние.
- Новая Matrix-функция — сначала в сервис, наружу узкий доменный API вместо SDK-объектов.
  `createClient`, `startClient`, `whoami`, `logout`, работу с токенами и обработку событий
  не дублировать.

## Соглашения кода

- **React:** функциональные компоненты, `PropTypes` для публичных props; презентация — в
  `components/`, связка со store — в `containers/`; UI — только Material UI.
- **Redux:** action types — константы в `constants/redux.js` (префиксы `MTRXCTL_`, `AUTHCTL_`);
  reducers `mtrxControlRdcr` / `authControlRdcr`; actions `mtrxControlActions` /
  `authControlActions`; в контейнерах — `useSelector`, `bindActionCreators` + `useMemo`.
  `initialState` у `authControlRdcr` экспортируется и остаётся чистым (без чтения сервисов):
  из него `store/preloadedState.js` собирает срез для `preloadedState`.
- **Прочее:** ключи `localStorage` — в `constants/storage.js`; HTTP-запросы (`ky`) и `localStorage` —
  только в `services/`; ошибки API — `actions/utils/kyError.js` (там же разбирается `HTTPError` из ky).
- **Внешние библиотеки:** перед использованием незнакомого метода API сначала сверяться с
  официальной документацией, а при объяснении и в ответе давать ссылку на раздел документации
  этого метода. Ссылки — только на официальные источники стека: matrix-js-sdk.

## Эталон интерфейса

[Cinny](https://github.com/cinnyapp/cinny) — референс UX и структуры чат-клиента: простой,
элегантный, современный интерфейс с ясной визуальной иерархией. Перенимать принципы, но не
копировать код, ассеты и фирменный дизайн; реализовывать средствами текущего стека,
TypeScript-архитектуру Cinny не переносить без явного запроса.

## Правила для агента

1. Действовать как senior FullStack-разработчик.
2. Держать минимальный необходимый diff, не расширять объём правок без запроса.
3. Для критичных изменений указывать риски и шаги проверки.
4. Не добавлять TypeScript, тесты, CI, зависимости и инфраструктуру без явного запроса.
5. `dist` вручную не редактировать — только через `npm run build`.
6. Документация, комментарии и ответы — на русском.
7. Формат — по Biome: отступ 2 пробела, только пробелы, без табов; с автоформатом не спорить.
8. Для каждого использованного метода внешних библиотек давать ссылку на официальную
   документацию этого метода; не выдумывать API по памяти, а сверяться с источником.
