# Архитектура matrix-react

Схемы повторяют интерактивные [archify-диаграммы](archify/matrix-react-architecture.html); под
каждой — краткие пояснения по сути. Полный свод правил — в [AGENTS.md](../AGENTS.md).

## 1. Архитектура

```mermaid
flowchart LR
  subgraph UI["UI — компоненты"]
    ViewAd["AuthAd · AuthPad<br/>формы AD"]
    ViewMtrx["MtrxReg · MtrxPad<br/>регистрация и чат"]
  end
  subgraph CT["Контейнеры — связь с Redux"]
    Bridge["AuthContainer<br/>мост AUTHCTL_ ↔ MTRXCTL_"]
    MtrxCnt["MtrxContainer<br/>контейнер чата"]
  end
  subgraph RX["Redux — actions и reducers"]
    AdAct["authControlActions<br/>AUTHCTL_"]
    AdStore["authControlRdcr<br/>состояние AD"]
    MtrxAct["mtrxControlActions<br/>MTRXCTL_"]
    MtrxStore["mtrxControlRdcr<br/>индекс комнат"]
  end
  subgraph SV["Сервисы"]
    AdSvc["adAuth<br/>AD-авторизация · ky"]
    MtrxSvc["Matrix-сервисы<br/>matrixClient · matrixRooms · matrixMedia"]
  end
  subgraph ST["Хранилище"]
    Ls["localStorage<br/>ключи приложения"]
    Idb["IndexedDB<br/>sync и crypto"]
  end
  ViewAd -->|события| Bridge
  Bridge -->|dispatch| AdAct
  AdAct -->|доменный API| AdSvc
  AdSvc -->|ky · POST| AdRes["AD-сервис<br/>внешний блок"]
  AdAct -->|состояние AD| AdStore
  AdStore -->|useSelector| Bridge
  AdSvc -->|ключи AD| Ls
  ViewMtrx -->|события| MtrxCnt
  MtrxCnt -->|dispatch| MtrxAct
  MtrxAct -->|доменный API| MtrxSvc
  MtrxSvc -->|Matrix API| Sdk["matrix-js-sdk<br/>homeserver · sync · crypto"]
  MtrxAct -->|деляты комнат| MtrxStore
  MtrxStore -->|useSelector: индекс| MtrxCnt
  MtrxSvc -->|токены и адрес| Ls
  Sdk -->|sync и crypto| Idb
  MtrxSvc -->|сообщения комнаты — мимо Redux| ViewMtrx
  Bridge -->|мост: loginMatrix · logoutMatrix| MtrxAct
```

- Пунктирные области — слои: UI, контейнеры (связь со store), Redux (`actions` и `reducers`),
  сервисы и хранилище; `AD-сервис` и `matrix-js-sdk` — внешние блоки вне слоёв.
- Срезы `AUTHCTL_` и `MTRXCTL_` идут строками (суффикс в подписях узлов): состояние каждого —
  свой редьюсер (`authControlRdcr`, `mtrxControlRdcr`), а переход между срезами есть только в
  `AuthContainer` (мост); обратный поток (`authLost`, `mtrx_user_id`) идёт через тот же мост.
- У каждого среза свой сервис и внешний ресурс: `AUTHCTL_` → `adAuth` → AD-сервис (`ky`),
  `MTRXCTL_` → Matrix-сервисы → `matrix-js-sdk`; ключи приложения в `localStorage` пишут сервисы
  обоих срезов, sync и crypto — в `IndexedDB`.

## 2. Старт и авторизация

```mermaid
sequenceDiagram
  participant UI as MtrxContainer
  participant Act as mtrxControlActions
  participant Cl as matrixClient
  participant SDK as matrix-js-sdk
  participant HS as Homeserver
  participant LS as localStorage
  participant Auth as AuthContainer
  Note over UI,Auth: Старт — сессия не восстанавливается
  UI->>Act: handleHydrateStoredMatrixData
  Act->>Cl: getStoredMatrixData
  Cl->>LS: uriMatrix · mtrxLogin
  LS-->>Cl: адрес · логин
  Cl-->>Act: uriMatrix · login
  Act-->>UI: форма входа предзаполнена, status idle
  Note over UI,Auth: Вход по логину и паролю
  UI->>Act: handleRegister
  Act->>Cl: loginMatrix
  Cl->>HS: POST /_matrix/client/v3/login
  HS-->>Cl: access_token · device_id
  Cl->>SDK: createClient + startClient
  SDK->>HS: GET /sync
  HS-->>SDK: 200 · события
  SDK-->>Cl: SYNCING
  Cl-->>Act: session · userId · deviceId
  Act-->>UI: status success → чат
  Note over UI,Auth: Активная сессия потеряна
  HS-->>SDK: 401 · M_UNKNOWN_TOKEN
  SDK->>Cl: tokenRefreshFunction
  Cl->>HS: POST /_matrix/client/v3/refresh
  HS-->>Cl: 401 · refresh отвергнут
  Cl->>SDK: TokenRefreshLogoutError
  SDK-->>Act: Session.logged_out
  Act->>Cl: invalidateMatrixSession
  Cl->>LS: deleteMatrixLocalStores
  Act-->>Auth: authLost → AuthPad, красный тумблер
```

- Старт: сохранённые адрес и логин только предзаполняют форму входа; клиент Matrix не создаётся,
  `status` остаётся `idle`, поэтому виден `AuthLinks` — авторизация требуется при каждом запуске.
- Сохранённый access token для входа не используется: он нужен только для активной сессии и
  переиспользования `deviceId` при следующем входе тем же логином (важно для E2EE).
- После входа: `SYNCING` даёт снимок сессии, `status success` включает чат и
  `handleStartRoomWatch`; таймлайн остаётся в SDK.
- Потеря активной сессии: 401 (`M_UNKNOWN_TOKEN`) зовёт `tokenRefreshFunction`; принятый refresh
  обновляет токены без сброса, а 401 на refresh — `TokenRefreshLogoutError` →
  `Session.logged_out` → `invalidateMatrixSession` (токены и IndexedDB удалены) → `authLost` →
  `AuthPad` с красным тумблером.

## 3. Чат

```mermaid
sequenceDiagram
  participant UI as Контейнер чата
  participant Act as mtrxControlActions
  participant R as matrixRooms
  participant SDK as matrix-js-sdk
  participant RX as Redux
  Note over UI,RX: Список комнат
  UI->>Act: handleStartRoomWatch
  Act->>R: watchRoomList
  SDK-->>R: Room · myMembership · receipt
  R-->>Act: INITIALIZE / PUT / DELETE
  Act->>RX: roomIds · roomsMeta
  Note over UI,RX: Выбранная комната
  UI->>Act: handleSelectRoom
  Act->>RX: selectedRoomId
  UI->>R: watchRoomMessages
  SDK-->>R: Room.timeline · Event.decrypted
  R-->>UI: снимок сообщений — мимо Redux
  Note over UI,RX: Отправка
  UI->>Act: handleSendMessage
  Act->>R: sendRoomMessage
  R->>SDK: sendTextMessage
```

- Список комнат и выбор — лёгкий индекс в Redux, который обновляется дельтами.
- Две подписки: `watchRoomList` обновляет индекс, `watchRoomMessages` отдаёт таймлайн
  контейнеру напрямую (в том числе по `Event.decrypted`) — сообщения активной комнаты остаются
  в SDK.

## 4. Мост Auth → Чат

```mermaid
sequenceDiagram
  participant P as Пользователь
  participant A as AuthAd · AuthPad
  participant AD as adAuth
  participant B as AuthContainer
  participant M as matrixClient
  participant LS as localStorage
  Note over P,LS: AD-вход
  P->>A: ввод AD-учётных данных
  A->>AD: loginAd
  AD->>LS: uriAdAuth · adLogin · adAuthExpireTime
  AD-->>B: mtrx_login · mtrx_password
  B-->>A: AuthPad · логин в форму
  Note over P,LS: Вход Matrix
  P->>A: включить тумблер
  A->>B: onToggleMtrx
  B->>M: handleRegister → loginMatrix
  M->>LS: uriMatrix · токены · mtrxDeviceId
  M-->>B: успех / ошибка → цвет тумблера
  Note over P,LS: Сброс
  P->>A: клик по цветному тумблеру
  B->>M: handleRegClear → logoutMatrix
  M->>LS: удаление токенов сессии
```

- `AuthContainer` — единственный мост между срезами `AUTHCTL_` и `MTRXCTL_`; пароль AD в Matrix
  Redux не попадает.
- Отключённый тумблер запускает вход данными AD; успех, ошибка или потеря сессии — сброс.
- Ключи AD и Matrix ложатся в `localStorage` (`constants/storage.js`); при сбросе токены
  удаляются, адрес и логин остаются.

## 5. Хранилища

`localStorage` доступен только сервисам: ключи объявлены в `constants/storage.js`, полный список
с владельцами — в [README](../README.md#ключи-localstorage). `matrixClient` хранит адрес, логин и
токены (токены — для активной сессии и переиспользования `deviceId`, а не для входа при
следующем запуске), `adAuth` — адрес сервиса, логин и срок AD-сессии (24 ч). При выходе удаляются
токены, `mtrxUserId` и `mtrxDeviceId`; recovery key не сохраняется. Вместе с токенами
`matrixClient` чистит IndexedDB-хранилища SDK (`sync` и `crypto`). `IndexedDB` принадлежит
`matrix-js-sdk`; в `localStorage` он пишет свои служебные ключи (например, id фильтра sync), а
очередь неотправленных событий попадает туда только при `pendingEventOrdering: Detached`, который
приложение не задаёт.

Интерактивные схемы: [Архитектура](archify/matrix-react-architecture.html),
[Старт и авторизация](archify/matrix-react-session-restore.html),
[Чат](archify/matrix-react-chat-flow.html),
[Мост Auth → Чат](archify/matrix-react-auth-sequence.html).
