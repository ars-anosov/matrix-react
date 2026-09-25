# AGENTS.md — matrix-react

React SPA для Matrix на `matrix-js-sdk`. Общаться, документировать и комментировать по-русски.
Это единственный источник правил проекта: `CLAUDE.md`, Copilot и Cursor лишь ссылаются на него.
Общие правила среды DSH — в `~/.dsh/AGENTS.md`; специфика проверки UI — в навыке `ui-verify`.

## Стек и команды

Node.js 24, Vite 8, React 19, Material UI 9 + Emotion, Redux 5, `matrix-js-sdk`, `ky`.
Только JavaScript (`.js`/`.jsx`), форматирование — Biome (`biome.json`).

- `npm run dev` — Vite на порту 3000; `npm run build` — сборка в `dist`;
  `npm run serve` — preview на 4173.
- `npm run lint` — lint; `npm run check` и `npm run format` **перезаписывают файлы**.
- `npm run deploy` / `npm run deploy:rsync` — выкладка на боевой сервер с `rsync --delete`.
  Запускать **только по явному запросу**; параметры — в `deploy.sh`.

## Архитектурные границы

- Вся Matrix-логика — в `src/services/` (`matrixClient`, `matrixRooms`, `matrixMedia` и др.).
  Клиент, sync, crypto, сессия и токены управляются `matrixClient.js`; эту логику не дублировать.
  Новые Matrix-функции сначала оформлять как узкий доменный API сервиса, без SDK-объектов в UI.
- `matrix-js-sdk` — источник истины для комнат, участников и сообщений. Redux хранит только
  UI-индекс (`roomIds`, `selectedRoomId`, `roomsMeta`): список обновляется дельтами; сообщения
  активной комнаты читаются/отслеживаются через сервис. Приглашения входят в индекс и идут первыми;
  `m.space` не имеет таймлайна и composer и стоит в конце списка.
- Создание/вход/выход из комнаты, отправка сообщений, отметка прочитанного и вложения — через
  `matrixRooms`. Загрузка, скачивание, шифрование и кэш медиа — в `matrixMedia`; компоненты не
  работают с `mxc`, Matrix API и SDK напрямую. Непрочитанное считает SDK, не Redux.
- `components/` — презентация; `containers/` — связка со store; `actions/` вызывают сервисы и
  преобразуют ошибки, `reducers/` остаются чистыми. `PropTypes` — для публичных props, UI — MUI.
  `localStorage` и HTTP-запросы через `ky` — только в `services/`; ключи — в `constants/storage.js`.
  Начальные данные из сервисов готовит `store/preloadedState.js`, а не reducers или middleware.
- Action types — в `constants/redux.js`. Thunk-и `AUTHCTL_` и `MTRXCTL_` не диспатчат чужой
  namespace: мост между ними только в `AuthContainer`. Он владеет формами авторизации и
  `AuthLinks`, а `MtrxContainer` — регистрацией Matrix и чатом. Без активной сессии стартовый
  экран показывает только `AuthLinks`; AD-сессия открывает `AuthPad`, Matrix-сессия — чат.

## Соглашения

- React: функциональные компоненты, `PropTypes`; презентация — `components/`, связка со store —
  `containers/` (`useSelector`, `bindActionCreators` + `useMemo`). UI — только MUI.
- Biome: 2 пробела, без Tab, двойные кавычки; с автоформатом не спорить.
- Внешние библиотеки (matrix-js-sdk): перед использованием незнакомого метода сверяться с
  официальной документацией и давать в ответе ссылку на неё; API по памяти не выдумывать.

## Работа агента

1. Senior FullStack-разработчик; минимальный необходимый diff — не расширять объём без запроса.
2. Проверять результат соразмерно изменению: сначала diff, затем при необходимости
   `npx biome check src/` и `npm run build`. Браузер — только для поведения, каскада/брейкпоинтов
   или ошибок рантайма; порядок и обёртка `.dsh/bin/browser` — в навыке `ui-verify`.
3. Русский язык в документации, комментариях и ответах.
4. Диаграммы-артефакты создавать навыком `archify` в `docs/archify/`, не редактируя готовые
   HTML/JSON вручную. Mermaid — только короткий повтор первичной диаграммы с комментариями для
   человека: новых фактов и более подробных потоков в нём нет, факт сначала попадает в archify-спеку.
5. При смене соглашений править этот файл; адаптеры не дублируют правила.

Ориентир для UX — [Cinny](https://github.com/cinnyapp/cinny): перенимать принципы, не код,
ассеты и фирменный дизайн.
