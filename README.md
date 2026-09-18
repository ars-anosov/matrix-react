# matrix-react
ReactJS компоненты на базе [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk)

![mtrx](img/mtrx.png)

Сборка — `npm run build` в `dist/` (каталог в git не хранится).

## Быстрый старт

Требуется Node.js 24.

```bash
npm install
npm run dev     # Vite dev-сервер: http://localhost:3000 (host 0.0.0.0)
npm run build   # сборка в dist
npm run serve   # предпросмотр сборки: http://localhost:4173 (vite preview, host 0.0.0.0)
npm run deploy  # сборка + выкладка dist на прод по rsync (deploy.sh) — только по явному запросу
```

Проверки и форматирование — Biome (`format` и `check` пишут правки в файлы):

```bash
npm run lint    # только проверка
npm run format  # форматирование с записью
npm run check   # линт + форматирование с записью
```

В dev-режиме Vite поднимает мок-API.



# Компоненты

## MtrxReg.jsx
Форма входа в Matrix.

![component_MtrxReg.png](img/component_MtrxReg.png)

## MtrxPad.jsx
Мессенджер: список комнат, поле логина для нового чата и панель активной комнаты.

## MtrxRoomList.jsx
Список комнат: аватар, название, «Приглашение» или «Пространство», бейдж непрочитанного.
Строка списка фильтруется по логину из поля нового чата.

![component_MtrxRoomList.png](img/component_MtrxRoomList.png)

## MtrxRoom.jsx
Активная комната: шапка с аватаром и подписью, таймлайн последних сообщений, кнопка выхода.
Панель выбирает ветку: приглашение (`MtrxInvite`), пространство (`MtrxSpace`) или чат
с composer'ом.

![component_MtrxRoom.png](img/component_MtrxRoom.png)

### MtrxComposer.jsx
Ввод сообщения: Enter — отправка, Shift+Enter — перенос строки; при ошибке текст возвращается в поле.
Кнопка-скрепка прикладывает файл: он показывается строкой с именем и размером, отправка идёт с
прогрессом, а текст из поля становится подписью к вложению.

### MtrxAttachment.jsx
Вложение в таймлайне: картинка — превью (клик по ней тоже скачивает), остальные типы — карточка с
именем, размером и кнопкой скачивания; ошибка скачивания показывается рядом.

Файлы уходят в content repository (`services/matrixMedia.js`): тип сообщения выбирается по MIME
(`m.image` / `m.video` / `m.audio` / `m.file`), превью картинок запрашивается с авторизацией и
кэшируется. В шифрованной комнате файл шифруется AES-256-CTR до загрузки, а ключ и хэш шифротекста
уезжают в `content.file` события; при скачивании хэш проверяется, расшифровка идёт в браузере.

### MtrxInvite.jsx
Приглашение в комнату: «Принять» (`joinRoom`) или «Отклонить» (`leaveRoom`).

### MtrxLeaveRoom.jsx
Диалог подтверждения выхода из комнаты.

### MtrxSpace.jsx
Пространство `m.space`: список дочерних комнат, писать сообщения нельзя.

## MtrxDeviceVerification.jsx
E2EE: авторизация устройства — SAS по emoji или recovery key.

![component_MtrxDeviceVerification.png](img/component_MtrxDeviceVerification.png)

# Доп. компоненты
Плюшки для интеграции с внешними сервисами

## AuthAd.jsx
POST-запрос к серверу авторизации, ожидаемый ответ:
```json
{
  "ad_login"      : "login",
  "ad_cn"         : "ФИО",
  "ad_title"      : "Должность",
  "ad_department" : "Отдел",
  "mtrx_login"    : "matrix-login",
  "mtrx_password" : "matrix-password"
}
```

![component_AuthAd.png](img/component_AuthAd.png)

## AuthPad.jsx
Тумблер активирует сервис.

![component_AuthPad.png](img/component_AuthPad.png)



# Документация

[![Архитектура matrix-react](docs/archify/matrix-react-architecture.visual-check.2048x1320.light.png)](https://ars-anosov.github.io/matrix-react/archify/matrix-react-architecture.html)

[![Вход, сессия Matrix и сброс](docs/archify/matrix-react-auth-sequence.visual-check.2048x1320.light.png)](https://ars-anosov.github.io/matrix-react/archify/matrix-react-auth-sequence.html)

[![Чат: данные и команды](docs/archify/matrix-react-chat-flow.visual-check.2048x1320.light.png)](https://ars-anosov.github.io/matrix-react/archify/matrix-react-chat-flow.html)

Все документы: <https://ars-anosov.github.io/matrix-react/>



# Пакеты

Зависимости — в `package.json`, установка — `npm install`. Обновление мажорных версий:

```bash
npx npm-check-updates
```

# Лицензия

MIT, см. [LICENSE](LICENSE).
