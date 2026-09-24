# Архитектура matrix-react

## 1. UI, store и сервисы

```mermaid
flowchart LR
  UI["UI<br/>components + containers"] -->|dispatch| Actions["Redux actions"]
  Actions -->|команды| Services["Сервисы<br/>matrixClient · matrixRooms · adAuth"]
  Services -->|события и результаты| Actions
  Actions -->|состояние UI| Store["Redux store<br/>сессии + индекс комнат"]
  Store -->|useSelector| UI
  Services <--> SDK["matrix-js-sdk<br/>комнаты и сообщения"]
  Services -->|сообщения активной комнаты| UI
```

Redux хранит состояние интерфейса, а не таймлайн и SDK-объекты. Компоненты не вызывают Matrix API;
прямую подписку на сообщения держит контейнер. `store/configureStore.js` связывает сервисы с
начальным состоянием и зависимостями middleware, не импортируя их в reducers.

## 2. Мост AD ↔ Matrix

```mermaid
flowchart LR
  AD["adAuth → AUTHCTL_ → authControlRdcr"] -->|данные AD| Bridge["AuthContainer + AuthPad"]
  Bridge -->|login / clear| Act["mtrxControlActions → matrixClient"]
  Act -->|MTRXCTL_| State["mtrxControlRdcr"]
  State -->|status / user_id| Bridge
  Bridge -->|mtrx_user_id в AD-срез| AD
```

`AuthContainer` — единственное место перехода между срезами: thunk-и не диспатчат чужой namespace.
Без сессии видны `AuthLinks`; успех AD показывает `AuthPad`. Тумблер запускает Matrix-вход
данными AD, а при успехе, ошибке или потере Matrix-сессии — сброс. `mtrx_user_id` записывается
в AD-срез только при активной AD-сессии.

## 3. Matrix-авторизация и хранилища

```mermaid
flowchart LR
  UI["MtrxContainer / MtrxReg / AuthPad"] --> Act["mtrxControlActions<br/>login · restore · logout"]
  Act --> Client["matrixClient<br/>сессия · sync · crypto"]
  Client <--> Instance["matrixClientStore<br/>клиент в памяти"]
  Client <--> LS["localStorage<br/>токены и адрес"]
  Client --> SDK["matrix-js-sdk<br/>sync и crypto"]
  SDK <--> IDB["IndexedDB<br/>sync и crypto"]
  Act --> Redux["mtrxControlRdcr<br/>status · authLost · данные UI"]
  Redux --> UI
```

`matrixClient` создаёт и восстанавливает SDK-клиент, проверяет сессию и очищает хранилища при
выходе или инвалидировании. Redux не хранит сам клиент и токены; серверный logout/401
сигнализирует `authLost` через action.

## 4. Matrix-чаты и store

```mermaid
flowchart LR
  SDK["matrix-js-sdk<br/>Room + Timeline"] --> Rooms["matrixRooms"]
  Rooms -->|INITIALIZE / PUT / DELETE| Act["mtrxControlActions"]
  Act --> Index["Redux<br/>roomIds · selectedRoomId · roomsMeta"]
  Index --> UI["MtrxContainer + MtrxPadContainer"]
  Rooms -->|watchRoomMessages| UI
  UI -->|выбор, создание, отправка| Act
  Act -->|create · join · leave · send| Rooms
  Rooms -->|вложения| Media["matrixMedia"]
```

Список и метаданные комнат обновляются в Redux дельтами; сообщения выбранной комнаты идут
напрямую из сервиса в контейнер и в Redux не копируются. Вложения обрабатывает `matrixMedia`.

Интерактивные схемы: [слои приложения](archify/matrix-react-architecture.html),
[мост AD → Matrix](archify/matrix-react-auth-sequence.html),
[чат: последовательность событий](archify/matrix-react-chat-flow.html).
