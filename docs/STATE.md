# STATE.md — matrix-react

Архитектура и сценарии работы (диаграммы Mermaid).

## Слои и потоки данных

```mermaid
flowchart LR
  UI["React: контейнеры + компоненты"]

  subgraph Redux["Redux — view-model"]
    IDX["индекс комнат<br/>roomIds · selectedRoomId · roomsMeta"]
    SES["сессия Matrix<br/>status · responseData · deviceVerification"]
    AD["сессия AD<br/>uriAdAuth · status · responseData<br/>(срок — authTimeoutMiddleware)"]
  end

  subgraph SVC["src/services"]
    CL["matrixClient<br/>session / crypto / sync / токены<br/>(+ matrixClientStore, matrixSdk)"]
    ROOMS["matrixRooms<br/>getRoomMeta / getRoomMessages / watchRoomList<br/>watchRoomMessages / create·join·leave<br/>sendRoomMessage / markRoomRead"]
    ADSV["adAuth<br/>валидация https · POST · сессия AD"]
  end

  SDK["matrix-js-sdk<br/>Room / Timeline / MatrixEvent<br/>(источник истины данных)"]
  ADAPI["внешний AD-сервис"]
  Store[("local store<br/>localStorage + IndexedDB")]

  UI -->|"dispatch: login / AD / restore / logout / select / verify"| Redux
  Redux -->|"actions → методы сервисов"| SVC
  ROOMS -->|"дельта INITIALIZE / PUT / DELETE"| IDX
  CL -->|"session → status"| SES
  ADSV -->|"login → responseData"| AD
  UI -->|"watchRoomMessages"| ROOMS
  UI -->|"getStoredAdLogin"| ADSV
  CL <--> Store
  ADSV <--> Store
  ROOMS -->|"чтение Room / Timeline"| SDK
  CL -->|"createClient / sync / crypto"| SDK
  ADSV -->|"POST login + password"| ADAPI
```

## Инициализация store

Сервисы со стором сводит только слой стора — reducers и middleware сервисов не импортируют и
остаются чистыми:

```mermaid
flowchart LR
  ADSV["adAuth"]
  PS["store/preloadedState.js<br/>сид: uriAdAuth ← getStoredAdAuthUri()"]
  CS["store/configureStore.js<br/>createStore(rootReducer, preloadedState)"]
  MW["authTimeoutMiddleware<br/>createAuthTimeoutMiddleware({ isSessionExpired, clearSession })"]

  ADSV -->|"getStoredAdAuthUri"| PS
  PS -->|"preloadedState"| CS
  CS -->|"инжект зависимостей"| MW
```

- `authControlRdcr` экспортирует чистый `initialState` (только UI-дефолты, без чтения сервисов);
  `preloadedState.js` собирает из него срез и подставляет сохранённый `uriAdAuth`. Срез
  передаётся целиком: `combineReducers` подменяет его, а не мержит с `initialState`.
- `configureStore(preloadedState = getPreloadedState())` — единственное место, где стор сходится
  с сервисами: сид и зависимости `authTimeoutMiddleware` (`isAdAuthSessionExpired` →
  `isSessionExpired`, `clearAdAuthSession` → `clearSession`).
- Тот же `configureStore()` без аргументов вызывает `main.jsx`.

## Сценарии работы

```mermaid
sequenceDiagram
  participant UI as React<br/>(MtrxContainer / MtrxPadContainer / AuthContainer / AuthAd)
  participant Redux as Redux<br/>(actions + индекс)
  participant Rooms as matrixRooms
  participant Client as matrixClient
  participant Ad as adAuth
  participant SDK as matrix-js-sdk
  participant Store as local store<br/>(localStorage + IndexedDB)
  participant ADAPI as внешний AD-сервис

  Note over UI,Store: Старт
  Note over UI: срез AD: displayAd=false, displayAuthPad=false → на экране только ссылки AuthLinks
  Note over UI: срез Matrix: displayReg=false, displayPad=false → чата нет

  Note over UI,Store: Restore
  UI->>Redux: handleRestoreSession
  Redux->>Store: hydrate uriMatrix / login
  Redux->>Client: restoreMatrixSession
  Client->>Store: читать токены / sync + crypto
  Store-->>Client: session data
  Client->>Client: whoami()
  alt 401 / сессии нет
    Client->>Store: очистить LS + IDB
    Client-->>Redux: MATRIX_UNAUTHORIZED → CLEAR
    Note over Redux,UI: authLost=false (живой сессии не было), форма входа не форсируется
  else ok / сеть
    Client-->>Redux: session → status
    Redux->>Client: watchMatrixSession + watchDeviceVerification
    Redux-->>UI: показать Pad
  end

  Note over UI,Store: Login (MtrxReg)
  UI->>Redux: handleRegister
  Redux->>Client: loginMatrix
  Client->>Client: login + startClient
  Client->>Store: persist session
  Client-->>Redux: session → status
  Redux-->>UI: показать Pad

  Note over UI,Store: Обновление токена
  Client->>Client: tokenRefreshFunction (POST /refresh)
  alt refresh 401
    Client->>Store: очистить LS + IDB
    Client-->>Redux: Session.logged_out → invalidate → CLEAR
  else ok
    Client->>Store: persist session
  end

  Note over UI,SDK: Авторизация устройства (MtrxDeviceVerification)
  UI->>Redux: handleRequestDeviceVerification
  Redux->>Client: requestCurrentDeviceVerification
  Client->>SDK: crypto.requestOwnUserVerification
  Client-->>Redux: deviceVerification (status)
  UI->>Redux: handleStartDeviceVerification
  Redux->>Client: startVerification("m.sas.v1")
  Client->>SDK: verifier.verify()
  SDK-->>Redux: show_sas → emoji
  UI->>Redux: handleConfirmDeviceVerification
  Redux->>Client: sas.confirm + getDeviceVerificationStatus
  Redux-->>UI: verified / crossSigningVerified

  Note over UI,SDK: Recovery key (альтернатива)
  UI->>Redux: handleVerifyDeviceWithRecoveryKey
  Redux->>Client: decodeRecoveryKey → bootstrapCrossSigning / SecretStorage
  Redux->>Client: restoreKeyBackup

  Note over UI,ADAPI: AD-авторизация (AuthAd)
  UI->>Redux: handleAdRegister
  Redux->>Ad: loginAd()
  Ad->>Ad: resolveAdAuthUrl (https)
  Ad->>Store: сохранить uriAdAuth
  Ad->>ADAPI: POST login + password
  ADAPI-->>Ad: ad_login / ad_cn / ad_title / ad_department / mtrx_login / mtrx_password
  Ad->>Store: сессия AD на 24 ч
  Ad-->>Redux: responseData → status
  Note over Redux,Store: authTimeoutMiddleware (10 с): срок истёк → CLEAR

  Note over UI,Store: Список комнат (дельта)
  UI->>Redux: handleStartRoomWatch
  Redux->>Rooms: watchRoomList
  Rooms->>SDK: on Room / Room.myMembership / Room.receipt / deleteRoom
  Rooms-->>Redux: INITIALIZE (roomId · membership · isSpace · unread)
  Redux->>Rooms: getRoomMeta(roomId)
  Rooms->>SDK: read Room / getPresence (подпись личной комнаты)
  SDK-->>Rooms: name / avatarUrl / subtitle / membership / children
  Rooms-->>Redux: roomsMeta (STORE)
  SDK-->>Rooms: PUT (membership · unread · highlight) / DELETE
  Rooms-->>Redux: PUT / DELETE → индекс

  Note over UI,Store: Выбор комнаты + сообщения
  UI->>Redux: handleSelectRoom(roomId)
  Redux->>Rooms: markRoomRead(roomId) → m.read receipt (бейджи гаснут)
  Redux-->>UI: selectedRoomId
  UI->>Rooms: watchRoomMessages(roomId)
  Rooms->>SDK: read Timeline (getRoomMessages)
  SDK-->>Rooms: сообщения (сериализуемый снимок)
  Rooms-->>UI: messages → MtrxRoom
  SDK-->>Rooms: Room.timeline / Event.decrypted
  Rooms-->>UI: обновлённые сообщения

  Note over UI,Store: Приглашение (MtrxInvite), создание чата (поле в MtrxPad), выход (MtrxLeaveRoom)
  UI->>Redux: handleJoinRoom(roomId)
  Redux->>Rooms: joinRoom() → POST /join
  Redux-->>Redux: PUT membership=join (оптимистично, не ждём /sync)
  UI->>Redux: handleCreateRoom(name + invitees)
  Redux->>Rooms: createRoom(name + invitees)
  Rooms->>SDK: getProfileInfo(userId) — проверка приглашаемых
  Rooms->>SDK: POST /createRoom (preset private_chat, invite)
  Redux-->>Redux: PUT + roomsMeta (введённое имя) + выбор комнаты
  UI->>Redux: handleLeaveRoom(roomId) — «Отклонить» или «Покинуть комнату»
  Redux->>Rooms: leaveRoom() → POST /leave
  Redux-->>Redux: DELETE → комната уходит из списка
  UI->>Redux: handleSendMessage(roomId, body)
  Redux->>Rooms: sendRoomMessage() → sendTextMessage (E2EE — внутри SDK)
  Note over UI,Rooms: Пространство m.space сообщений не пишет: MtrxSpace показывает m.space.child

  Note over UI,Store: Logout (MtrxReg) / invalidate
  UI->>Redux: handleRegClear
  Redux->>Client: logout / invalidate
  Client->>Store: очистить LS + IDB
  Client-->>Redux: CLEAR → Redux
  Note over Redux,UI: authLost=true → форсируется AuthPad с красным тумблером (клик — сброс сессии)
```

Интерактивные archify-диаграммы к этой схеме:

- [`matrix-react-architecture.html`](archify/matrix-react-architecture.html) — архитектура: слои,
  хранилища и мост AD → Matrix;
- [`matrix-react-chat-sequence.html`](archify/matrix-react-chat-sequence.html) — комнаты и чат:
  дельта-список, выбор комнаты и read receipt, таймлайн, приглашение, новый чат, отправка и выход;
- [`matrix-react-auth-sequence.html`](archify/matrix-react-auth-sequence.html) — вход, сессия
  Matrix и сброс.

## Мост к сервисам (`AuthContainer`)

Thunk-и namespace-чистые: `authControlActions` не диспатчит `MTRXCTL_`, `mtrxControlActions` —
`AUTHCTL_`. Оба направления моста живут в `AuthContainer`. `AuthPad` рендерится по флагу
`displayAuthPad` (пункт меню «Мост к сервисам», ✕ снимает флаг): `initialState` — `false`,
`true` выставляется на `AUTHCTL_SUBMIT_SUCCESS`, сбрасывается на `AUTHCTL_CLEAR`. Поэтому на
старте панели нет, а на экране — стартовый блок `AuthLinks` с двумя ссылками на формы
авторизации; после успеха AD панель появляется (при отсутствии AD-данных она информирует текстом).

Владение рендером — по срезу: `AuthContainer` (домен `authControlRdcr`, плюс стартовые ссылки на
обе формы и мост) держит форму `AuthAd` (флаг `displayAd` или `errComponent === "AuthAd"`),
`AuthPad` и `AuthLinks`; `MtrxContainer`
(домен `mtrxControlRdcr`) рендерит форму входа `MtrxReg` (флаг `displayReg` или
`errComponent === "MtrxReg"`) и `MtrxPadContainer`, auth-срез не читает. Обе формы входа —
модальный `Dialog` в портале, вне потока документа, поэтому их показ не раздвигает вёрстку;
чужие срезы читает лишь `AuthContainer` — как мост.

Интерактивная Sequence-диаграмма этого процесса (archify):
[`matrix-react-auth-sequence.html`](archify/matrix-react-auth-sequence.html) — AD-сессия, автовход
данными AD, исход входа и сброс сессии.

Тумблер `AuthPad` — индикатор состояния сессии Matrix и действие (в MUI `Switch` цвет применяется
к checked-состоянию, поэтому цветной = `checked` + `color`):

| Состояние | Условие | Клик |
| --- | --- | --- |
| откл | сессии нет (`status !== "success"`, `status !== "error"`, `authLost` нет) | автоматическая авторизация данными AD → `handleRegister` |
| зелёный | `mtrxControlRdcr.status === "success"` | сброс сессии → `handleRegClear` |
| красный | `mtrxControlRdcr.status === "error"` (неудачная авторизация) или `mtrxControlRdcr.authLost` (сессия потеряна) | сброс сессии → `handleRegClear` |

Неудачная авторизация — это `MTRXCTL_SUBMIT_ERROR`: тумблер краснеет и остаётся красным до клика
(клик из этого состояния тоже сбрасывает сессию, а не повторяет попытку). Вынужденная потеря
авторизации вдобавок приходит как `MTRXCTL_CLEAR` с `payload.authLost` из `watchSessionAndDispatchClear`
(принудительный logout сервером / 401). Сброс (`handleRegClear`) и старт без сессии шлют `CLEAR` без
payload, поэтому тумблер возвращается в исходное состояние — откл, без раскраски. `authLost`
сбрасывается на `MTRXCTL_SUBMIT_SUCCESS`; потеря авторизации вдобавок форсирует показ `AuthPad`.
`MTRXCTL_SUBMIT_REQUEST` и `MTRXCTL_SUBMIT_ERROR` не трогают `displayReg`: форму `MtrxReg` никто не
форсирует, поэтому неудачный вход с тумблера оставляет на экране только его красное состояние, а
форма, открытая вручную, остаётся открытой и показывает `errText` своим Alert.

```mermaid
sequenceDiagram
  actor User
  participant AuthAd as AuthAd.jsx
  participant AuthPad as AuthPad.jsx
  participant AuthAct as authControlActions.js
  participant AuthCont as AuthContainer.jsx
  participant MtrxAct as mtrxControlActions.js
  participant Dispatch as authControlRdcr / mtrxControlRdcr

  User->>AuthAd: Ввод AD-логина и пароля
  AuthAd->>AuthAct: handleAdRegister(formData)
  AuthAct->>Dispatch: AUTHCTL_SUBMIT_REQUEST (responseData=null)
  AuthAct->>AuthAct: POST uriAdAuth
  AuthAct->>Dispatch: AUTHCTL_SUBMIT_SUCCESS (mtrx_login, mtrx_password)
  AuthCont->>Dispatch: MTRXCTL_STORE_VALUE (login = mtrx_login)
  Note over AuthCont: displayAuthPad=true на success → рендер AuthPad (тумблер откл, без матричной пары — текст)
  User->>AuthPad: Клик по тумблеру (откл)
  AuthPad->>AuthCont: onToggleMtrx()
  AuthCont->>MtrxAct: handleRegister({login: mtrx_login, password: mtrx_password, uriMatrix})
  MtrxAct->>Dispatch: MTRXCTL_SUBMIT_REQUEST → SUCCESS/ERROR
  alt успешная авторизация
    Dispatch-->>AuthPad: SUCCESS → зелёный тумблер (authorized)
    Dispatch-->>AuthCont: responseData.user_id активной сессии
    AuthCont->>Dispatch: AUTHCTL_STORE_VALUE (responseData.mtrx_user_id)
  else неуспешная авторизация
    Dispatch-->>AuthPad: ERROR (status="error") → красный тумблер, форма MtrxReg не форсируется
  end

  Note over User,Dispatch: Потеря авторизации Matrix → сброс сессии
  Dispatch-->>AuthPad: authLost=true → красный тумблер, AuthPad показан принудительно
  User->>AuthPad: Клик по красному или зелёному тумблеру
  AuthPad->>AuthCont: onToggleMtrx()
  AuthCont->>MtrxAct: handleRegClear()
  MtrxAct->>MtrxAct: logoutMatrix (POST /logout + очистка LS/IndexedDB)
  MtrxAct->>Dispatch: MTRXCTL_CLEAR (без payload) → authLost=false, status=idle
  Dispatch-->>AuthPad: тумблер вернулся в исходное состояние — откл, без раскраски
```

`AuthContainer` синхронизирует `mtrx_user_id` в `authControlRdcr.responseData` только при активной
AD-сессии (`status === "success"`) — иначе после AD-выхода `responseData` заполнился бы снова.
