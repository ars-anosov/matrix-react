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

## Инструменты DSH (плагины)

Профиль DSH `web` уже содержит плагины окружения — инструменты доступны сразу, доустанавливать
ничего не нужно. Проверить инструмент в сессии дешевле, чем писать обходной путь.

- **Skill `archify`** (`@tt-a1i/archify-dsh`) — интерактивные HTML-диаграммы (architecture,
  workflow, sequence, dataflow, lifecycle) с тёмной/светлой темой и экспортом. Загружать через
  инструмент `skill`, когда схему просят как артефакт; результат — в `docs/archify/` рядом
  с `matrix-react-architecture.*`. Готовые HTML/JSON не править вручную — только перегенерация.
- **`dsh-mermaid`** — рендерит fenced-блоки с языком `mermaid` в ответах DSH Web (SVG, зум,
  полный экран, экспорт). Диаграммы в ответе давать Mermaid-блоком, а не ASCII-артом; образец —
  `docs/STATE.md`.
- **`win_open_url`** (`dsh-wsl-browser`) — открывает `http(s)` URL в браузере Windows. Показывать
  результат так: dev-сервер `http://localhost:3000`, DSH Web `http://127.0.0.1:3080`, страницы из
  `docs/`.
- **`mcp__browser__*`** — Playwright MCP (`mcp-playwright`): настоящий Chrome на Windows — переходы,
  снапшот доступности, клики и ввод, консоль, сетевые запросы, скриншоты, трассировка. Схемы
  инструментов выдаются по требованию: в начале сессии виден только
  `mcp__router__search_and_activate`; сначала активировать сервер, затем вызывать
  `mcp__browser__browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`,
  `browser_console_messages`, `browser_network_requests`, `browser_take_screenshot`. Профиль
  браузера постоянный (логин в Matrix сохраняется), поэтому второе окно с тем же профилем не
  запустится — закрыть окно от прошлой сессии.

**Archify `visual-check`** — `validate` и `deliver` идут из WSL с `--repo-root .`, а
`visual-check` из WSL возвращает exit 2 (ищет только Linux-Chrome и не транслирует пути), хотя
Chrome на Windows есть. Запускать его Windows-Node'ом по UNC, обязательно с форвард-слэшами — с
бэкслешами cmd.exe искажает путь:

```bash
REPO=/home/ars/_git/matrix-react
SKILL=$HOME/.dsh/profiles/web/node_modules/@tt-a1i/archify-dsh/skills/archify
cd /mnt/c && cmd.exe /c "node //wsl.localhost/Ubuntu$SKILL/bin/archify.mjs visual-check \
//wsl.localhost/Ubuntu$REPO/docs/archify/matrix-react-architecture.html --json"
```

Скриншоты не побайтово детерминированы: повторный прогон на том же HTML может перезаписать PNG —
это не признак расхождения, сверяйте `artifact.sha256` в `visual-check.json`.

UI-правку проверять в браузере: поднять `npm run dev`, открыть через `win_open_url`, а спорное
поведение проверять через Playwright MCP (клик → снапшот/скриншот/консоль), а не догадками.

Смежные инструменты окружения (dsh-wsl-kit): `win_launch` (приложения Windows), `wsl_clipboard`
(буфер обмена Windows), `path_convert` (пути WSL ↔ Windows), `net_doctor` (proxy, DNS, сеть WSL) —
использовать их вместо ручных вызовов PowerShell/`cmd.exe`.

## Структура

```
src/
├── components/   # UI: MtrxReg, MtrxPad, MtrxRoom(List), MtrxDeviceVerification, AuthAd/AuthAdInfo/AuthIco/AuthPad, MenuAppBar, …
├── containers/   # связка со store: MtrxContainer, MtrxPadContainer, AuthContainer, MenuAppContainer
├── actions/      # thunk-actions; utils/ — kyError.js, matrixError.js
├── reducers/     # *Rdcr, rootReducer.js, authTimeoutMiddleware.js
├── services/     # matrixClient, matrixSdk, matrixRooms, matrixClientStore, adAuth
├── store/        # configureStore
├── constants/    # redux.js (action types), storage.js (ключи localStorage), ui.js (UI-лимиты)
└── main.jsx, App.jsx, theme.js
mock/             # mock API для dev (vite plugin)
public/           # статика: img/, sounds/, sw.js
img/              # скриншоты компонентов для README
docs/             # документация и GitHub Pages (ars-anosov.github.io/matrix-react):
                  # index.html (лендинг), STATE.md (Mermaid-схемы), archify/ (генерация skill'ом
                  # archify, исключён из Biome)
dist/             # результат npm run build — вручную не править
```

## Архитектура Matrix

- Вся логика Matrix — в `src/services/`; `matrixClient.js` отвечает за MatrixClient, sync,
  crypto/store, токены и lifecycle сессии.
- matrix-js-sdk — единственный источник истины: комнаты, таймлайн, сообщения и участники хранятся
  в SDK и не дублируются в Redux. Redux держит только лёгкий UI-индекс: `roomIds`,
  `selectedRoomId`, `roomsMeta` и при необходимости счётчики. Сообщения активной комнаты читаются
  из сервиса по требованию (`getRoomMeta`, `getRoomMessages`) и в стор не сериализуются.
- Список комнат обновляется дельтами (INITIALIZE / PUT / DELETE одного `roomId`), без полной
  перезаписи массива на каждое событие SDK.
- Компоненты React не импортируют `matrix-js-sdk`, не читают Matrix session storage и не вызывают
  Matrix API напрямую.
- Actions только валидируют UI-ввод, вызывают сервисы и преобразуют результат в actions;
  reducers не содержат Matrix-логики.
- Namespace-инвариант: thunk-и `AUTHCTL_` не диспатчат `MTRXCTL_` (и наоборот). Мост
  к сервисам (`AUTHCTL_` ↔ `MTRXCTL_`) — только в контейнере `AuthContainer`. Тумблер `AuthPad`
  отражает состояние сессии Matrix: откл — авто-авторизация данными AD; зелёный (`status ===
  "success"`) и красный (`authLost` — принудительный logout сервером / 401) — сброс сессии
  (`handleRegClear` → `logoutMatrix`), после сброса тумблер возвращается в исходное состояние.
- Новая Matrix-функция — сначала в сервис, наружу узкий доменный API вместо SDK-объектов.
  `createClient`, `startClient`, `whoami`, `logout`, работу с токенами и обработку событий
  не дублировать.

## Соглашения кода

- **React:** функциональные компоненты, `PropTypes` для публичных props; презентация — в
  `components/`, связка со store — в `containers/`; UI — только Material UI.
- **Redux:** action types — константы в `constants/redux.js` (префиксы `MTRXCTL_`, `AUTHCTL_`);
  reducers `mtrxControlRdcr` / `authControlRdcr`; actions `mtrxControlActions` /
  `authControlActions`; в контейнерах — `useSelector`, `bindActionCreators` + `useMemo`.
- **Прочее:** ключи `localStorage` — в `constants/storage.js`; запросы через `ky`.
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
