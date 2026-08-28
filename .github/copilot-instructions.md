# Инструкции для GitHub Copilot

Репозиторий **matrix-react** — ReactJS-компоненты на базе [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk).

## Где код

- Основное приложение: `mtrx/`
- Исходники: `mtrx/src/`
- Сборка: `npm run build` → `mtrx/dist`

## Компоненты Matrix

- `MtrxReg` — регистрация и вход
- `MtrxPad` — чат-панель
- `AuthAd` — интеграция с AD-авторизацией

## Технологии

React 19, Vite 8, Material UI 9, Redux (thunk), matrix-js-sdk, ky.  
Проект на **JavaScript** — не предлагать миграцию на TypeScript без запроса.

## Стиль

- Документация и комментарии — на русском
- Redux: action types в `constants/redux.js`, reducers с суффиксом `Rdcr`
- Минимальный объём правок; не добавлять зависимости и инфраструктуру без запроса
