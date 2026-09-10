# AGENTS.md — matrix-react

**Проект:** ReactJS-компоненты на базе [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)
**Язык общения, документации и комментариев:** русский

Единственный источник правил для AI-агентов. Файлы инструментов — тонкие адаптеры на этот
документ (`CLAUDE.md`, `.github/copilot-instructions.md`, `.cursor/rules/project.mdc`);
правила здесь, в адаптерах — ничего не дублировать.

## Назначение

Библиотека/демо React-компонентов для работы с Matrix. Рабочее приложение — SPA в корне проекта,
готовая сборка — `dist`.

| Компонент | Назначение |
|-----------|------------|
| `MtrxReg.jsx` | Регистрация и вход в Matrix |
| `MtrxPad.jsx` | Чат-панель Matrix |
| `MtrxRoom.jsx`, `MtrxRoomList.jsx` | Комната и список комнат |
| `MtrxDeviceVerification.jsx` | Верификация устройства (шифрование) |
| `AuthAd.jsx` | Авторизация через внешний AD-сервис (POST, JSON: `ad_login`, `ad_cn`, `ad_title`, `ad_department`) |
| `AuthAdInfo.jsx`, `AuthIco.jsx`, `MtrxIco.jsx`, `MtrxInfo.jsx` | Вспомогательные элементы |
| `MenuAppBar.jsx` | Верхнее меню приложения |

## Структура

```
src/
├── components/   # UI-компоненты (MtrxReg, MtrxPad, AuthAd, …)
├── containers/   # Redux-контейнеры (MtrxContainer, MtrxPadContainer, MenuAppContainer)
├── actions/      # thunk-actions; utils/ — kyError.js, matrixError.js
├── reducers/     # *Rdcr, rootReducer.js, authTimeoutMiddleware.js
├── services/     # вся логика Matrix (matrixClient, matrixSdk, matrixRooms, matrixClientStore)
├── store/        # configureStore
├── constants/    # redux.js (action types), storage.js (ключи localStorage)
└── main.jsx, App.jsx, theme.js
mock/             # mock API для dev (vite plugin)
public/           # статика: img/, sounds/, sw.js
dist/             # результат npm run build — вручную не править
```

## Стек и команды

Node.js 24 (`.devcontainer/devcontainer.json`), Vite 8, React 19, Material UI 9 + Emotion,
Redux 5 (redux-thunk, redux-logger, react-redux, react-router-dom), matrix-js-sdk, ky.
Язык — JavaScript (`.jsx` / `.js`), без TypeScript. Формат — Biome (`biome.json`).

```bash
npm install
npm run dev      # dev-сервер, http://0.0.0.0:3000
npm run build    # сборка в dist
npm run serve    # preview, порт 4173
npm run lint     # biome lint .
```

## Архитектура Matrix

- Вся логика Matrix располагается в `src/services/` (директория называется `services`, не `srvices`).
- `matrixClient.js` отвечает за MatrixClient, sync, crypto/store, токены, session lifecycle.
- matrix-js-sdk — единственный источник истины для данных Matrix: комнаты, таймлайн, сообщения
  и члены хранятся в SDK и не дублируются в Redux.
- Redux хранит только лёгкий индекс для UI: `roomIds`, `selectedRoomId`, метаданные списка
  (`roomsMeta`) и при необходимости счётчики. Полные комнаты и сообщения — не в стор.
- Сообщения и таймлайн читаются из сервиса по требованию для активной комнаты
  (`getRoomMeta`, `getRoomMessages`), не сериализуются в стор.
- Список комнат обновляется дельтами (INITIALIZE / PUT / DELETE одного `roomId`),
  а не полной перезаписью массива на каждое событие SDK.
- Компоненты React не импортируют `matrix-js-sdk`, не читают Matrix session storage
  и не вызывают Matrix API напрямую.
- Redux actions только валидируют UI-ввод, вызывают методы сервисов и преобразуют результат
  в actions; reducers не содержат Matrix-логики.
- Новую Matrix-функцию сначала добавлять в подходящий сервис; наружу экспортировать узкий
  доменный API вместо SDK-объектов.
- Не дублировать `createClient`, `startClient`, `whoami`, `logout`, работу с токенами,
  обработку Matrix-событий и низкоуровневую логику SDK.

## Соглашения кода

- **React:** функциональные компоненты, `PropTypes` для публичных props; презентация — в
  `components/`, связка со store — в `containers/`; UI — только Material UI.
- **Redux:** action types — константы в `constants/redux.js` (префиксы `MTRXCTL_`, `AUTHCTL_`);
  reducers `mtrxControlRdcr`, `authControlRdcr`; actions `mtrxControlActions`, `authControlActions`;
  в контейнерах — `useSelector`, `bindActionCreators` + `useMemo`.
- **Прочее:** ключи `localStorage` — в `constants/storage.js`; запросы через `ky`, ошибки HTTP —
  `actions/utils/kyError.js`; Vite `base: './'` — сохранять относительные пути для статического
  деплоя из `dist`.

## Эталон интерфейса

Референс Matrix UX и структуры чат-клиента — [Cinny](https://github.com/cinnyapp/cinny).

- Ориентир: простой, элегантный, безопасный и современный интерфейс для ежедневной переписки,
  с ясной визуальной иерархией.
- Перенимать принципы взаимодействия и визуальной иерархии, но не копировать код, ассеты
  или фирменный дизайн напрямую.
- Реализовывать средствами текущего стека; TypeScript-архитектуру Cinny не переносить
  без явного запроса.

## Правила для агента

1. Действовать как senior FullStack-разработчик.
2. Не расширять объём правок без запроса — минимальный необходимый diff.
3. Для критичных изменений указывать риски и шаги проверки.
4. Не добавлять TypeScript, тесты, CI, новые зависимости и инфраструктуру без явного запроса.
5. Не редактировать `dist` вручную — только через `npm run build`.
6. Сохранять русский язык в документации, комментариях и ответах.
7. Формат — по Biome: отступ 2 пробела, только `Space`, символы `Tab` не добавлять;
   с автоформатом не спорить.
