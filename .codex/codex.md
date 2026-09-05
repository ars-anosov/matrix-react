# CODEX — matrix-react

**Проект:** ReactJS-компоненты на базе [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)  
**Язык общения и документации:** русский

---

## Назначение

Библиотека/демо React-компонентов для работы с Matrix. Основной код — SPA в `mtrx/`, готовая сборка — `mtrx/dist`.

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
│   │   ├── components/   # UI-компоненты
│   │   ├── containers/   # Redux-контейнеры
│   │   ├── actions/      # Redux actions
│   │   ├── reducers/     # Redux reducers
│   │   ├── services/     # вся логика Matrix (matrixClient.js, matrixSdk.js)
│   │   ├── store/        # store
│   │   └── constants/    # константы
│   ├── mock/             # mock API (vite plugin)
│   ├── dist/             # результат npm run build
│   └── package.json
├── tools/                # заметки по Node.js, Vite, MUI
└── img/                  # скриншоты для README
```

---

## Стек

- **Runtime:** Node.js 24 (см. `.devcontainer/devcontainer.json`)
- **Сборка:** Vite 8, `@vitejs/plugin-react`
- **UI:** React 19, Material UI 9, Emotion
- **Состояние:** Redux 5, redux-thunk, redux-logger, react-redux
- **Matrix:** matrix-js-sdk
- **HTTP:** ky
- **Язык:** JavaScript (`.jsx`/`.js`), без TypeScript

---

## Команды

```bash
cd mtrx
npm install
npm run dev      # dev-сервер, порт 3000, host 0.0.0.0
npm run build    # сборка в mtrx/dist
npm run serve    # preview, порт 4173
```

---

## Соглашения кода

### Архитектура Matrix

- Вся логика Matrix располагается в `mtrx/src/services/` (директория называется `services`, не `srvices`).
- `matrixClient.js` отвечает за MatrixClient, sync, crypto/store, токены, session lifecycle.
- Компоненты React не импортируют `matrix-js-sdk`, не читают Matrix session storage и не вызывают Matrix API напрямую.
- Redux actions только валидируют UI-ввод, вызывают методы сервисов и преобразуют результат в Redux actions. Reducers не содержат Matrix-логики.
- Новую Matrix-функцию сначала добавляй в подходящий сервис; наружу экспортируй небольшой доменный API вместо SDK-объектов.
- Не дублируй `createClient`, `startClient`, `whoami`, `logout`, работу с токенами или обработку Matrix-событий в компонентах и actions.
- Не дублируй низкоуровневую логику SDK.

### Redux

- Action types: `constants/redux.js` (`MTRXCTL_*`, `AUTHCTL_*`)
- Reducers: `*Rdcr` (`mtrxControlRdcr`, `authControlRdcr`)
- Actions передаются в компоненты через `bindActionCreators` в контейнерах

### React

- Функциональные компоненты, `PropTypes` для props
- Презентация — `components/`, логика store — `containers/`

### Прочее

- Ключи `localStorage` — `constants/storage.js`
- Ошибки HTTP — `actions/utils/kyError.js`
- Vite `base: './'` — относительные пути для статического деплоя

---

## Правила для агента

1. Действуй как senior FullStack-разработчик.
2. Не расширяй объём правок без запроса.
3. Для критичных изменений указывай риски и шаги проверки.
4. Не добавляй TypeScript, тесты, CI и новые зависимости без явного запроса.
5. Не редактируй `mtrx/dist` вручную — только `npm run build`.
6. Сохраняй русский язык в документации и комментариях.

## Эталон интерфейса

- Используй [Cinny](https://github.com/cinnyapp/cinny) как референс для Matrix UX и структуры чат-клиента.
- Ориентируйся на простой, элегантный, безопасный и современный интерфейс, удобный для ежедневной переписки.
- Перенимай принципы взаимодействия и визуальной иерархии, но не копируй код, ассеты или фирменный дизайн напрямую.
- Сохраняй текущий стек проекта: JavaScript, React, MUI, Redux и matrix-js-sdk; TypeScript из Cinny не переносить без явного запроса.

## Отступы

- Используй отступ `2` пробела.
- Для отступов используй только символы `Space`, символы табуляции `Tab` в код не добавляй.
