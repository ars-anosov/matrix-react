# Инструкции для GitHub Copilot — синхронизировано с CLAUDE.md

Репозиторий **matrix-react** — ReactJS-компоненты на базе [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk).

## Где код

- Основное приложение: корень проекта (SPA)
- Исходники: `src/`
- Сборка: `npm run build` → `dist`

## Компоненты Matrix

- `MtrxReg` — регистрация и вход
- `MtrxPad` — чат-панель
- `AuthAd` — интеграция с AD-авторизацией

## Технологии

React 19, Vite 8, Material UI 9, Redux (thunk), matrix-js-sdk, ky.  
Проект на **JavaScript** — не предлагать миграцию на TypeScript без запроса.

## Архитектура Matrix

- Вся логика Matrix располагается в `src/services/` (директория называется `services`, не `srvices`).
- `matrixClient.js` отвечает за MatrixClient, sync, crypto/store, токены, session lifecycle.
- matrix-js-sdk — единственный источник истины для данных Matrix: комнаты, таймлайн, сообщения и члены хранятся в SDK и не дублируются в Redux.
- Redux хранит только лёгкий индекс, необходимый для UI: список `roomId`, выбранную комнату, метаданные списка (name/avatar) и при необходимости счётчики. Полные комнаты и сообщения в Redux не кладутся.
- Сообщения и таймлайн читаются из сервиса по требованию для активной комнаты (`getRoomMeta`, `getRoomMessages`), не сериализуются в стор.
- Подписки на события SDK строятся по дельтам (INITIALIZE / PUT / DELETE одного `roomId`), а не полным перечитыванием списка.
- Компоненты React не импортируют `matrix-js-sdk`, не читают Matrix session storage и не вызывают Matrix API напрямую.
- Redux actions только валидируют UI-ввод, вызывают методы сервисов и преобразуют результат в Redux actions. Reducers не содержат Matrix-логики.
- Новую Matrix-функцию сначала добавлять в подходящий сервис; наружу экспортировать небольшой доменный API вместо SDK-объектов.
- Не дублировать `createClient`, `startClient`, `whoami`, `logout`, работу с токенами или обработку Matrix-событий в компонентах/actions.

## Соглашения кода

### React
- Функциональные компоненты, `PropTypes` для публичных props.
- Презентация — `components/`, контейнеры со store — `containers/`.
- UI — только Material UI (`@mui/material`, `@mui/icons-material`).

### Redux
- Action types — `constants/redux.js` (префиксы `MTRXCTL_`, `AUTHCTL_`).
- Reducers: `*Rdcr` (`mtrxControlRdcr`, `authControlRdcr`).
- В контейнерах: `useSelector`, `bindActionCreators` + `useMemo`.
- Redux — только view-model и UI-состояние. Данные Matrix (комнаты/сообщения) в сторе не хранить — только лёгкий индекс: `roomIds`, `selectedRoomId`, метаданные списка (`roomsMeta`).
- Список комнат обновлять дельтами (INITIALIZE/PUT/DELETE одного `roomId`), не перезаписывать весь массив на каждое событие SDK.

### Прочее
- `localStorage`-ключи — `constants/storage.js`.
- HTTP: `ky`, ошибки — `actions/utils/kyError.js`.
- Vite `base: './'` для статического деплоя из `dist`.

## Эталон интерфейса

- Использовать [Cinny](https://github.com/cinnyapp/cinny) как референс для Matrix UX и структуры чат-клиента.
- Ориентироваться на простой, элегантный, безопасный и современный интерфейс для ежедневной переписки.
- Перенимать принципы взаимодействия и визуальной иерархии, но не копировать код, ассеты или фирменный дизайн напрямую.
- Сохранять текущий стек проекта: JavaScript, React, MUI, Redux и matrix-js-sdk; не предлагать перенос TypeScript-архитектуры Cinny без запроса.

## Стиль оформления

- Документация и комментарии — на русском
- Redux: action types в `constants/redux.js`, reducers с суффиксом `Rdcr`
- Минимальный объём правок; не добавлять зависимости и инфраструктуру без запроса

## Отступы

- Использовать отступ `2` пробела.
- Для отступов использовать только символы `Space`, символы табуляции `Tab` в код не добавлять.