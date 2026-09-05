# CLAUDE.md — matrix-react

**Проект:** ReactJS-компоненты на базе [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)
**Язык общения, документации и комментариев:** русский

Файл — основной источник правил для AI-агентов. Дублирующие инструкции для других
инструментов: `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, `.codex/codex.md`.
При изменении соглашений синхронизировать их с этим файлом.

---

## Назначение

Библиотека/демо React-компонентов для работы с Matrix. Рабочее приложение — SPA в `mtrx/`,
готовая сборка — `mtrx/dist`.

### Ключевые компоненты

| Компонент | Назначение |
|-----------|------------|
| `MtrxReg.jsx` | Регистрация и вход в Matrix |
| `MtrxPad.jsx` | Чат-панель Matrix |
| `AuthAd.jsx` | Авторизация через внешний AD-сервис (POST, JSON: `ad_login`, `ad_cn`, `ad_title`, `ad_department`) |
| `AuthAdInfo.jsx`, `AuthIco.jsx` | Вспомогательные элементы авторизации |
| `MenuAppBar.jsx` | Верхнее меню приложения |

---

## Структура репозитория

```
matrix-react/
├── mtrx/                 # рабочее приложение (Vite + React)
│   ├── src/
│   │   ├── components/   # UI-компоненты (MtrxReg, MtrxPad, AuthAd, …)
│   │   ├── containers/   # Redux-контейнеры (MtrxContainer, MenuAppContainer)
│   │   ├── actions/      # Redux actions (thunk)
│   │   ├── reducers/     # Redux reducers (*Rdcr)
│   │   ├── services/     # вся логика Matrix (matrixClient.js, matrixSdk.js)
│   │   ├── store/        # configureStore
│   │   ├── constants/    # action types, storage keys
│   │   └── theme.js      # тема MUI
│   ├── mock/             # mock API для dev (vite plugin)
│   ├── dist/             # результат npm run build
│   └── package.json
├── tools/                # заметки по Node.js, Vite, MUI
└── img/                  # скриншоты для README
```

---

## Стек

- **Runtime:** Node.js 24 (см. `.devcontainer/devcontainer.json`)
- **Сборка:** Vite 8, `@vitejs/plugin-react`
- **UI:** React 19, Material UI 9 (`@mui/material`, `@mui/icons-material`), Emotion
- **Состояние:** Redux 5, redux-thunk, redux-logger, react-redux, react-router-dom
- **Matrix:** matrix-js-sdk
- **HTTP:** ky
- **Язык:** JavaScript (`.jsx` / `.js`), без TypeScript

---

## Команды

```bash
cd mtrx
npm install
npm run dev      # dev-сервер, http://0.0.0.0:3000
npm run build    # сборка в mtrx/dist
npm run serve    # preview, порт 4173
```

---

## Архитектура Matrix

- Вся логика Matrix располагается в `mtrx/src/services/` (директория называется `services`, не `srvices`).
- `matrixClient.js` отвечает за MatrixClient, sync, crypto/store, токены, session lifecycle.
- Компоненты React не импортируют `matrix-js-sdk`, не читают Matrix session storage
  и не вызывают Matrix API напрямую.
- Redux actions только валидируют UI-ввод, вызывают методы сервисов и преобразуют результат
  в Redux actions. Reducers не содержат Matrix-логики.
- Новую Matrix-функцию сначала добавлять в подходящий сервис; наружу экспортировать небольшой
  доменный API вместо SDK-объектов.
- Не дублировать `createClient`, `startClient`, `whoami`, `logout`, работу с токенами
  или обработку Matrix-событий в компонентах и actions.
- Не дублировать низкоуровневую логику SDK.

---

## Соглашения кода

### React

- Функциональные компоненты, `PropTypes` для публичных props.
- Презентационные компоненты — в `components/`, подключённые к store — в `containers/`.
- UI — только Material UI.

### Redux

- Action types — константы в `constants/redux.js` (префиксы `MTRXCTL_`, `AUTHCTL_`).
- Reducers: `mtrxControlRdcr`, `authControlRdcr`; actions: `mtrxControlActions`, `authControlActions`.
- В контейнерах: `useSelector`, `bindActionCreators` + `useMemo`.

### Прочее

- Ключи `localStorage` — в `constants/storage.js`.
- Ошибки HTTP — `actions/utils/kyError.js`; запросы — через `ky`.
- Vite `base: './'` — сохранять относительные пути для статического деплоя из `dist`.

---

## Эталон интерфейса

- Референс Matrix UX и структуры чат-клиента — [Cinny](https://github.com/cinnyapp/cinny).
- Ориентир: простой, элегантный, безопасный и современный интерфейс для ежедневной переписки,
  с ясной визуальной иерархией.
- Перенимать принципы взаимодействия и визуальной иерархии, но не копировать код, ассеты
  или фирменный дизайн напрямую.
- Реализовывать средствами текущего стека (JavaScript, React, MUI, Redux, matrix-js-sdk);
  TypeScript-архитектуру Cinny не переносить без явного запроса.

---

## Стиль оформления

- Отступ — `2` пробела.
- Для отступов использовать только символы `Space`; символы табуляции `Tab` в код не добавлять.
- Комментарии и документация — на русском, кратко и по делу.

---

## Правила для агента

1. Действовать как senior FullStack-разработчик.
2. Не расширять объём правок без запроса — минимальный необходимый диff.
3. Для критичных изменений указывать риски и шаги проверки.
4. Не добавлять TypeScript, тесты, CI, новые зависимости и инфраструктуру без явного запроса.
5. Не редактировать `mtrx/dist` вручную — только через `npm run build`.
6. Сохранять русский язык в документации, комментариях и ответах.
