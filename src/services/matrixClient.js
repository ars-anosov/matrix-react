import { CryptoEvent } from "matrix-js-sdk/lib/crypto-api/CryptoEvent.js";
import { TokenRefreshLogoutError } from "matrix-js-sdk/lib/http-api/errors.js";
import { MTRX_ACCESS_TOKEN_KEY, MTRX_DEVICE_ID_KEY, MTRX_HS_URL_KEY, MTRX_LOGIN_KEY, MTRX_REFRESH_TOKEN_KEY, MTRX_USER_ID_KEY } from "../constants/storage";
import { VERIFICATION_ERR } from "../constants/verification";
import { clearMatrixClient, getMatrixClient, setMatrixClient } from "./matrixClientStore.js";
import { clearMediaUrlCache } from "./matrixMedia.js";
import { clearRoomAvatarCache } from "./matrixRooms.js";
import { loadMatrixSdk } from "./matrixSdk.js";

const DEVICE_DISPLAY_NAME = "matrix-react";

// Имя события sync у MatrixClient (ClientEvent.Sync): по нему ждём первый /sync
const SYNC_EVENT = "sync";
// Сколько ждём первый /sync перед чтением account data: ключ Secret Storage лежит
// именно там, а getDefaultKeyId() до первого sync вынужден ходить в сеть
const INITIAL_SYNC_WAIT_MS = 15000;

let matrixSessionCleanup = null;
let deviceVerificationCleanup = null;
let activeDeviceVerificationRequest = null;
let activeDeviceVerificationRequestCleanup = null;
let activeDeviceVerificationVerifier = null;
let secretStorageKeyCache = null;

function buildStoreKey(userId, deviceId) {
  return deviceId || userId;
}

function syncDbName(storeKey) {
  return `mx-sync-${storeKey}`;
}

function cryptoDbPrefix(storeKey) {
  return `mx-crypto-${storeKey}`;
}

async function createTempMatrixClient(baseUrl) {
  const { createClient } = await loadMatrixSdk();
  return createClient({ baseUrl });
}

/**
 * Создаёт MatrixClient по сохранённой сессии: IndexedDB-стор, Rust crypto,
 * автообновление access token и ранняя проверка токена через `whoami`.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/functions/matrix.createClient.html
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html
 * @see https://spec.matrix.org/latest/client-server-api/#using-access-tokens
 */
async function createMatrixClientFromSession({ baseUrl, accessToken, userId, deviceId, refreshToken }) {
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error(`[createMatrixClientFromSession] Невалидный baseUrl: ${baseUrl}`);
  }

  const { createClient, IndexedDBStore } = await loadMatrixSdk();
  destroyMatrixClient();

  const storeKey = buildStoreKey(userId, deviceId);
  const cryptoPrefix = cryptoDbPrefix(storeKey);

  const clientOptions = {
    baseUrl,
    accessToken,
    userId,
    deviceId,
    refreshToken: refreshToken || undefined,
    verificationMethods: ["m.sas.v1"],
    cryptoCallbacks: createCryptoCallbacks(),
  };

  if (typeof indexedDB !== "undefined" && IndexedDBStore) {
    clientOptions.store = new IndexedDBStore({
      indexedDB,
      localStorage,
      dbName: syncDbName(storeKey),
    });
  }

  // Не вызываем client.refreshToken() из tokenRefreshFunction:
  // он идёт через authedRequest и может задедлочить TokenRefresher.
  // Прямой POST /refresh — рекомендуемый обходной путь для password-сессий.
  if (refreshToken) {
    clientOptions.tokenRefreshFunction = async (currentRefreshToken) => {
      const response = await fetch(`${baseUrl}/_matrix/client/v3/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: currentRefreshToken }),
      });

      if (response.status === 401) {
        // Рефреш-токен отозван сервером (одноразовый токен, повторный логин в то же
        // устройство): сессия потеряна, восстанавливать нечего.
        // Бросаем именно TokenRefreshLogoutError: SDK по нему переводит клиент
        // в Logout — прекращает retry-шторм и сам эмитит Session.logged_out на
        // СВОЁМ клиенте. Обычная ошибка здесь означала бы Failure: SDK ретраил бы
        // 401 бесконечно, а emit через getMatrixClient() мог попасть в уже новый
        // клиент и выбросить пользователя сразу после успешного входа.
        console.warn("[tokenRefreshFunction] Рефреш-токен протух (401). Сессия потеряна.");
        throw new TokenRefreshLogoutError(new Error("REFRESH_TOKEN_EXPIRED"));
      }

      if (!response.ok) {
        throw new Error(`REFRESH_ERROR: ${response.status}`);
      }

      const tokenData = await response.json();
      if (!tokenData.access_token) {
        throw new Error("Homeserver не вернул access token.");
      }

      persistMatrixSession({
        homeserverUrl: baseUrl,
        login: localStorage.getItem(MTRX_LOGIN_KEY) || "",
        accessToken: tokenData.access_token,
        userId,
        deviceId,
        refreshToken: tokenData.refresh_token || currentRefreshToken,
      });

      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || currentRefreshToken,
        expiry: tokenData.expires_in_ms ? new Date(Date.now() + tokenData.expires_in_ms) : undefined,
      };
    };
  }

  const client = createClient(clientOptions);

  if (clientOptions.store) {
    await clientOptions.store.startup();
  }

  try {
    await client.initRustCrypto({
      useIndexedDB: true,
      cryptoDatabasePrefix: cryptoPrefix,
    });
  } catch (err) {
    const message = String(err?.message || "");

    if (message.includes("doesn't match the account in the constructor")) {
      if (import.meta.env.DEV) {
        console.warn("[matrixClient] рассогласование device_id в IndexedDB, чищу store и пробую снова", err);
      }

      await deleteMatrixIndexedDbStores(storeKey);
      if (clientOptions.store) {
        await clientOptions.store.startup();
      }
      await client.initRustCrypto({
        useIndexedDB: true,
        cryptoDatabasePrefix: cryptoPrefix,
      });
    } else {
      throw err;
    }
  }

  // Ранняя проверка токена до startClient (сеть/502 не считаем фатальными).
  try {
    await client.whoami();
  } catch (err) {
    if (err.httpStatus === 401) {
      console.warn("[matrixClient] Сессия невалидна (401). Уничтожаем инстанс.");
      deleteMatrixLocalStores();
      try {
        client.stopClient();
      } catch {
        // Игнорируем
      }
      await clearMatrixClientStores(client);
      throw new Error("MATRIX_UNAUTHORIZED");
    }

    console.warn("[matrixClient] Не удалось проверить токен (возможно нет сети):", err);
  }

  setMatrixClient(client);
  return client;
}

async function deleteMatrixIndexedDbStores(storeKey) {
  if (typeof indexedDB === "undefined" || !storeKey) return;

  const prefix = cryptoDbPrefix(storeKey);
  const dbNames = [`matrix-js-sdk:${syncDbName(storeKey)}`, `${prefix}::matrix-sdk-crypto`, `${prefix}::matrix-sdk-crypto-meta`];

  await Promise.all(
    dbNames.map(
      (name) =>
        new Promise((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        }),
    ),
  );
}

function destroyMatrixClient() {
  clearRoomAvatarCache();
  clearMediaUrlCache();
  deviceVerificationCleanup?.();
  deviceVerificationCleanup = null;
  activeDeviceVerificationRequestCleanup?.();
  activeDeviceVerificationRequestCleanup = null;
  activeDeviceVerificationRequest = null;
  activeDeviceVerificationVerifier = null;
  secretStorageKeyCache = null;
  const client = getMatrixClient();
  if (!client) return;

  matrixSessionCleanup?.();
  matrixSessionCleanup = null;

  try {
    client.stopClient();
  } catch {
    // Игнорируем ошибки остановки
  }

  clearMatrixClient();
}

async function clearMatrixClientStores(client) {
  if (!client) return;

  const userId = client.getUserId?.();
  const deviceId = client.getDeviceId?.();
  const storeKey = userId ? buildStoreKey(userId, deviceId) : null;
  const cryptoPrefix = storeKey ? cryptoDbPrefix(storeKey) : undefined;

  // clearStores требует остановленный клиент и сам чистит sync + rust crypto IDB.
  if (!client.clientRunning && typeof client.clearStores === "function") {
    try {
      await client.clearStores({ cryptoDatabasePrefix: cryptoPrefix });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[matrixClient] clearStores failed:", err);
      }
    }
  }

  if (storeKey) {
    await deleteMatrixIndexedDbStores(storeKey);
  }
}

function createCryptoCallbacks() {
  return {
    // Ключ хранится только в памяти текущей сессии. Не сохраняем recovery key в localStorage.
    cacheSecretStorageKey: (keyId, _keyInfo, privateKey) => {
      secretStorageKeyCache = { keyId, privateKey };
    },
    getSecretStorageKey: async ({ keys }) => {
      if (!secretStorageKeyCache || !keys[secretStorageKeyCache.keyId]) return null;
      return [secretStorageKeyCache.keyId, secretStorageKeyCache.privateKey];
    },
  };
}

function getVerificationPhaseName(phase) {
  return (
    {
      1: "unsent",
      2: "requested",
      3: "ready",
      4: "started",
      5: "cancelled",
      6: "success",
    }[phase] || "idle"
  );
}

function getDeviceVerificationSnapshot() {
  const request = activeDeviceVerificationRequest;
  const verifier = activeDeviceVerificationVerifier || request?.verifier;
  const sas = verifier?.getShowSasCallbacks?.()?.sas;

  return {
    status: request ? getVerificationPhaseName(request.phase) : "idle",
    initiatedByMe: Boolean(request?.initiatedByMe),
    sas: sas
      ? {
          emoji: sas.emoji || null,
          decimal: sas.decimal || null,
        }
      : null,
  };
}

function bindDeviceVerificationRequest(request, onChange) {
  if (activeDeviceVerificationRequest === request) return;

  activeDeviceVerificationRequestCleanup?.();
  activeDeviceVerificationRequestCleanup = null;
  activeDeviceVerificationRequest = request;
  activeDeviceVerificationVerifier = null;

  const handleRequestChange = async () => {
    if (request.phase === 4 && request.verifier) {
      bindDeviceVerificationVerifier(request.verifier, onChange);
    }
    const snapshot = getDeviceVerificationSnapshot();
    onChange?.(snapshot);

    if (request.phase === 6) {
      try {
        onChange?.({
          ...snapshot,
          ...(await getCurrentDeviceVerification()),
        });
      } catch {
        // Состояние проверки уже завершено, статус устройства обновится при следующем запросе.
      }
    }
  };

  request.on?.("change", handleRequestChange);
  const cleanup = () => request.removeListener?.("change", handleRequestChange);
  activeDeviceVerificationRequestCleanup = cleanup;
  handleRequestChange();

  return cleanup;
}

function bindDeviceVerificationVerifier(verifier, onChange) {
  if (activeDeviceVerificationVerifier === verifier) return;

  activeDeviceVerificationVerifier = verifier;
  verifier.on?.("show_sas", () => onChange?.(getDeviceVerificationSnapshot()));
  verifier.on?.("cancel", () => onChange?.(getDeviceVerificationSnapshot()));
  verifier.verify?.().catch(() => onChange?.(getDeviceVerificationSnapshot()));
}

// Перечитывает статус текущего устройства и отдаёт объединённый снапшот наружу.
// Cross-signing секреты и подпись устройства приходят отдельными to-device
// событиями уже после завершения SAS, поэтому verified становится true не в
// момент phase 6, а с задержкой — по этим событиям статус обновляется заново.
/**
 * Текущее состояние проверки устройства для UI: фаза активного запроса SAS, если
 * он есть, иначе результат кросс-подписи (доверено устройство или нет).
 *
 * Два источника пишут в одно поле `status`, поэтому сводим их здесь: фаза запроса
 * важнее — иначе чтение кросс-подписи затирает пришедший запрос, и он пропадает
 * из интерфейса.
 */
async function getDeviceVerificationState() {
  const snapshot = getDeviceVerificationSnapshot();
  const crossSigning = await getCurrentDeviceVerification();
  const isRequestPhase = snapshot.status !== "idle";

  return {
    ...snapshot,
    ...crossSigning,
    ...(isRequestPhase ? { status: snapshot.status } : {}),
  };
}

// Перечитывает статус проверки текущего устройства и отдаёт объединённый снапшот наружу.
// Cross-signing секреты и подпись устройства приходят отдельными to-device
// событиями уже после завершения SAS, поэтому verified становится true не в
// момент phase 6, а с задержкой — по этим событиям статус обновляется заново.
async function emitDeviceVerificationStatus(onChange) {
  try {
    const state = await getDeviceVerificationState();
    onChange?.(state);
    return state;
  } catch {
    // Устройство ещё не готово — статус обновится при следующем событии crypto.
    return null;
  }
}

/**
 * Подписка на входящие запросы проверки устройства и изменения доверия.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/modules/crypto-api.html
 * @see https://spec.matrix.org/latest/client-server-api/#device-verification
 */
function watchDeviceVerification(onChange) {
  const client = getMatrixClient();
  if (!client?.on) return () => {};

  deviceVerificationCleanup?.();

  const crypto = client.getCrypto?.();

  const handleRequest = (request) => {
    if (!request?.isSelfVerification) return;
    bindDeviceVerificationRequest(request, onChange);
  };

  // Rust-crypto сообщает об изменении доверия/списка устройств асинхронно;
  // по этим событиям доводим статус устройства до актуального.
  const handleCryptoTrustChange = () => {
    emitDeviceVerificationStatus(onChange);
  };

  client.on("crypto.verificationRequestReceived", handleRequest);
  crypto?.on?.(CryptoEvent.UserTrustStatusChanged, handleCryptoTrustChange);
  crypto?.on?.(CryptoEvent.DevicesUpdated, handleCryptoTrustChange);

  // Первый /sync приносит подписи устройств и кросс-подписи, но список устройств
  // машина крипто догоняет асинхронно: читаем статус на каждом sync, пока
  // устройство не станет доверенным (дальше его обновляют crypto-события). Без
  // этого индикатор E2EE висел бы серым до первого события или клика по нему
  const handleSync = async () => {
    if (!client.isInitialSyncComplete?.()) return;
    const status = await emitDeviceVerificationStatus(onChange);
    if (status?.verified) client.removeListener?.(SYNC_EVENT, handleSync);
  };
  client.on(SYNC_EVENT, handleSync);
  handleSync();

  deviceVerificationCleanup = () => {
    client.removeListener?.("crypto.verificationRequestReceived", handleRequest);
    client.removeListener?.(SYNC_EVENT, handleSync);
    crypto?.off?.(CryptoEvent.UserTrustStatusChanged, handleCryptoTrustChange);
    crypto?.off?.(CryptoEvent.DevicesUpdated, handleCryptoTrustChange);
    if (deviceVerificationCleanup === cleanup) deviceVerificationCleanup = null;
  };
  const cleanup = deviceVerificationCleanup;

  const userId = client.getUserId?.();
  const existingRequest = userId
    ? client
        .getCrypto?.()
        ?.getVerificationRequestsToDeviceInProgress?.(userId)
        ?.find((request) => request.isSelfVerification)
    : null;
  if (existingRequest) handleRequest(existingRequest);

  return cleanup;
}

/**
 * Читает статус проверки текущего устройства (cross-signing).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html#getdeviceverificationstatus
 * @see https://spec.matrix.org/latest/client-server-api/#device-verification
 */
async function getCurrentDeviceVerification() {
  const client = getMatrixClient();
  const userId = client?.getUserId?.();
  const deviceId = client?.getDeviceId?.();
  const crypto = client?.getCrypto?.();

  if (!client || !crypto || !userId || !deviceId) {
    return { verified: false, supported: false };
  }

  const status = await crypto.getDeviceVerificationStatus(userId, deviceId);
  // Для статуса проверки используем только cross-signing. isVerified() также
  // учитывает локальное доверие и может показывать устройство проверенным раньше
  // завершения проверки на другом доверенном устройстве.
  const crossSigningVerified = Boolean(status?.crossSigningVerified);
  return {
    status: crossSigningVerified ? "success" : "idle",
    verified: crossSigningVerified,
    supported: Boolean(status),
    crossSigningVerified,
    localVerified: Boolean(status?.localVerified),
  };
}

/**
 * Инициирует проверку текущего устройства (SAS) с других доверенных устройств.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html#requestownuserverification
 * @see https://spec.matrix.org/latest/client-server-api/#device-verification
 */
async function requestCurrentDeviceVerification(onChange) {
  const crypto = getMatrixClient()?.getCrypto?.();
  if (!crypto) throw new Error("Шифрование Matrix не инициализировано.");

  const request = await crypto.requestOwnUserVerification();
  bindDeviceVerificationRequest(request, onChange);
  return getDeviceVerificationSnapshot();
}

async function acceptCurrentDeviceVerification() {
  if (!activeDeviceVerificationRequest) throw new Error("Запрос авторизации устройства не найден.");
  await activeDeviceVerificationRequest.accept();
  return getDeviceVerificationSnapshot();
}

/**
 * Запускает SAS-проверку (`m.sas.v1`) для активного запроса.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html#requestownuserverification
 * @see https://spec.matrix.org/latest/client-server-api/#device-verification
 */
async function startCurrentDeviceVerification(onChange) {
  if (!activeDeviceVerificationRequest) throw new Error("Запрос авторизации устройства не найден.");
  const verifier = await activeDeviceVerificationRequest.startVerification("m.sas.v1");
  bindDeviceVerificationVerifier(verifier, onChange);
  return getDeviceVerificationSnapshot();
}

async function confirmCurrentDeviceVerification() {
  const sas = activeDeviceVerificationVerifier?.getShowSasCallbacks?.();
  if (!sas) throw new Error("Коды проверки ещё не готовы.");
  await sas.confirm();
  return getDeviceVerificationSnapshot();
}

async function cancelCurrentDeviceVerification() {
  await activeDeviceVerificationRequest?.cancel?.();
  return getDeviceVerificationSnapshot();
}

// Ошибка с кодом: UI по нему выбирает подсказку и действие (constants/verification.js)
function verificationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// Отказ UIA по паролю: показываем понятное сообщение вместо errcode сервера
function mapAuthError(error) {
  if (error?.httpStatus === 403 || error?.errcode === "M_FORBIDDEN") {
    return verificationError(VERIFICATION_ERR.RESET_FAILED, "Неверный пароль аккаунта.");
  }
  return error;
}

// Ждём первый /sync: до него SDK читает account data из сети, после — из стора,
// поэтому без ожидания результат зависит от того, когда пользователь нажал кнопку
function waitForInitialSync(client) {
  if (client?.isInitialSyncComplete?.()) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      client?.removeListener?.(SYNC_EVENT, handleSync);
    };
    const handleSync = () => {
      if (!client?.isInitialSyncComplete?.()) return;
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(verificationError(VERIFICATION_ERR.SYNC_INCOMPLETE, "Matrix ещё не синхронизирован. Подождите пару секунд и повторите."));
    }, INITIAL_SYNC_WAIT_MS);

    client?.on?.(SYNC_EVENT, handleSync);
    // Синхронизация могла успеть пройти между проверкой и подпиской
    handleSync();
  });
}

/**
 * Проверяет устройство через recovery key из Secret Storage и восстанавливает
 * cross-signing и key backup.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/functions/crypto-api.decodeRecoveryKey.html
 * @see https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html#bootstrapcrosssigning
 * @see https://spec.matrix.org/latest/client-server-api/#secret-storage
 */
async function verifyCurrentDeviceWithRecoveryKey(encodedRecoveryKey) {
  const client = getMatrixClient();
  const crypto = client?.getCrypto?.();
  if (!crypto || !client) throw new Error("Шифрование Matrix не инициализировано.");
  if (typeof encodedRecoveryKey !== "string" || !encodedRecoveryKey.trim()) {
    throw new Error("Введите recovery key.");
  }

  const { decodeRecoveryKey } = await import("matrix-js-sdk/lib/crypto-api/recovery-key.js");

  let key;
  try {
    key = decodeRecoveryKey(encodedRecoveryKey.trim());
  } catch {
    // decodeRecoveryKey проверяет только формат (base58, чётность, префикс, длину)
    // и ничего не знает про аккаунт — про это отдельные коды ниже
    throw verificationError(VERIFICATION_ERR.INVALID_KEY, "Это не похоже на recovery key Matrix: проверьте, что скопировали его целиком.");
  }

  await waitForInitialSync(client);

  // getKey() без аргумента берёт ключ из account data аккаунта: так одним чтением
  // получаем и id ключа, и его key info, по которой ключ можно проверить
  const keyEntry = await client.secretStorage?.getKey?.();
  if (!keyEntry) {
    throw verificationError(VERIFICATION_ERR.NO_SECRET_STORAGE, "В аккаунте нет Secret Storage: recovery key здесь не с чем сверять.");
  }

  const [keyId, keyInfo] = keyEntry;
  // Ключ может быть валидным по формату и при этом от другого аккаунта, поэтому
  // сверяем его с key info из account data до bootstrap: иначе несовпадение
  // всплывёт позже и непонятной ошибкой
  const isSameKey = await client.secretStorage.checkKey(key, keyInfo);
  if (!isSameKey) {
    throw verificationError(VERIFICATION_ERR.KEY_MISMATCH, "Recovery key не подходит к этому аккаунту: проверьте, что он от того же аккаунта и homeserver.");
  }

  secretStorageKeyCache = { keyId, privateKey: key };
  try {
    // Проверяем до bootstrap: без приватных ключей кросс-подписи SDK создаёт НОВУЮ
    // идентичность (resetCrossSigning) — это сброс аккаунта, к тому же требующий
    // UIA. Пользователь, вводя ключ, просил авторизовать устройство, а не сбросить
    // кросс-подпись, поэтому в таком случае честно отказываем
    const crossSigning = await crypto.getCrossSigningStatus?.();
    const cached = crossSigning?.privateKeysCachedLocally;
    const hasLocalPrivateKeys = Boolean(cached?.masterKey && cached?.selfSigningKey && cached?.userSigningKey);
    if (crossSigning && !hasLocalPrivateKeys && !crossSigning.privateKeysInSecretStorage) {
      throw verificationError(
        VERIFICATION_ERR.CROSS_SIGNING_MISSING,
        "Ключ подходит к аккаунту, но авторизовать им устройство нельзя: в аккаунте нет секретов кросс-подписи.",
      );
    }

    // Cinny использует тот же безопасный путь: импорт ключей из Secret Storage
    // и затем загрузка room keys из server-side backup.
    await crypto.bootstrapCrossSigning({});
    await crypto.bootstrapSecretStorage({});

    try {
      await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
      await crypto.restoreKeyBackup();
    } catch (error) {
      // Проверка устройства уже завершена; backup может отсутствовать у аккаунта.
      if (import.meta.env.DEV) {
        console.warn("[matrixClient] не удалось восстановить key backup", error);
      }
    }
  } catch (error) {
    secretStorageKeyCache = null;
    throw error;
  }

  return getCurrentDeviceVerification();
}

/**
 * Создаёт в аккаунте Secret Storage и новый ключ восстановления — выход для
 * аккаунта, у которого хранилища нет (введённый recovery key тогда сверять не с чем).
 *
 * Необратимо для старых секретов: то, что было зашифровано прежним ключом,
 * новым ключом не открыть, поэтому вызывается только по явному подтверждению.
 *
 * @see https://spec.matrix.org/latest/client-server-api/#secret-storage
 * @see https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html#bootstrapsecretstorage
 */
async function createNewSecretStorage() {
  const client = getMatrixClient();
  const crypto = client?.getCrypto?.();
  if (!crypto || !client) throw new Error("Шифрование Matrix не инициализировано.");

  await waitForInitialSync(client);

  // Молчаливая замена уже существующего хранилища обесценила бы сохранённые секреты
  const existingKey = await client.secretStorage?.getKey?.();
  if (existingKey) {
    throw verificationError(VERIFICATION_ERR.STORAGE_EXISTS, "В аккаунте уже есть Secret Storage: введите recovery key от него.");
  }

  const created = await crypto.createRecoveryKeyFromPassphrase();
  await crypto.bootstrapSecretStorage({
    setupNewSecretStorage: true,
    // Колбэк обязан вернуть GeneratedSecretStorageKey: приватный ключ уходит в
    // account data (через addKey), кодированный показываем пользователю
    createSecretStorageKey: async () => created,
  });

  return {
    recoveryKey: created.encodedPrivateKey,
    verification: await getCurrentDeviceVerification(),
  };
}

/**
 * Сбрасывает шифрование аккаунта: новая кросс-подпись (это устройство
 * подписывается своим ключом и становится доверенным), удаление прежних бэкапов
 * и Secret Storage, затем новое хранилище и новый recovery key.
 *
 * Необратимо: прежние секреты и бэкапы недоступны, другие пользователи увидят
 * новый мастер-ключ. Пароль нужен серверу для UIA при публикации ключей подписи.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/interfaces/crypto-api.CryptoApi.html#resetencryption
 * @see https://spec.matrix.org/latest/client-server-api/#user-interactive-authentication-api
 */
async function resetOwnEncryption(password) {
  const client = getMatrixClient();
  const crypto = client?.getCrypto?.();
  if (!crypto || !client) throw new Error("Шифрование Matrix не инициализировано.");
  if (typeof password !== "string" || !password.trim()) throw new Error("Введите пароль аккаунта.");

  await waitForInitialSync(client);

  // Прежний ключ хранилища после сброса недействителен
  secretStorageKeyCache = null;

  // Загрузку ключей подписи сервер закрывает UIA: пробуем сразу с паролем (одноэтапный
  // UIA принимает auth без session), а если сервер ответил запросом этапов — повторяем
  // с его session. Так в консоли нет лишнего 401 от «пустой» попытки
  const authUploadDeviceSigningKeys = async (makeRequest) => {
    const identifier = { type: "m.id.user", user: client.getUserId() };
    const makePasswordRequest = (session) => makeRequest({ type: "m.login.password", identifier, password, ...(session ? { session } : {}) });

    let challenge = null;
    try {
      return await makePasswordRequest();
    } catch (error) {
      // Ответ похож на запрос UIA (flows/session) — повторяем с session, иначе это не про пароль
      if (!error?.data?.flows && !error?.data?.session) throw mapAuthError(error);
      challenge = error;
    }

    try {
      return await makePasswordRequest(challenge.data.session);
    } catch (error) {
      throw mapAuthError(error);
    }
  };

  try {
    await crypto.resetEncryption(authUploadDeviceSigningKeys);
  } catch (error) {
    if (error?.code) throw error;
    throw verificationError(VERIFICATION_ERR.RESET_FAILED, `Не удалось сбросить шифрование: ${error?.error || error?.message || "неизвестная ошибка"}`);
  }

  // resetEncryption удалил Secret Storage: создаём новое хранилище с новым ключом,
  // bootstrapSecretStorage положит туда свежие кросс-подписи и ключ бэкапа
  const created = await crypto.createRecoveryKeyFromPassphrase();
  await crypto.bootstrapSecretStorage({
    setupNewSecretStorage: true,
    createSecretStorageKey: async () => created,
  });

  return {
    recoveryKey: created.encodedPrivateKey,
    verification: await getCurrentDeviceVerification(),
  };
}

function clearCurrentDeviceVerification() {
  activeDeviceVerificationRequestCleanup?.();
  activeDeviceVerificationRequestCleanup = null;
  activeDeviceVerificationRequest = null;
  activeDeviceVerificationVerifier = null;
}

/**
 * Подписка на принудительный logout со стороны сервера.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html
 * @see https://spec.matrix.org/latest/client-server-api/#syncing
 */
function watchMatrixSession(onLoggedOut) {
  const client = getMatrixClient();
  if (!client || typeof client.on !== "function") return () => {};

  matrixSessionCleanup?.();

  const handleLoggedOut = () => onLoggedOut?.();
  // HttpApiEvent.SessionLoggedOut === "Session.logged_out"
  client.on("Session.logged_out", handleLoggedOut);

  const cleanup = () => {
    client.removeListener?.("Session.logged_out", handleLoggedOut);
    if (matrixSessionCleanup === cleanup) {
      matrixSessionCleanup = null;
    }
  };

  matrixSessionCleanup = cleanup;
  return cleanup;
}

function persistMatrixSession({ homeserverUrl, login, accessToken, userId, deviceId, refreshToken }) {
  localStorage.setItem(MTRX_HS_URL_KEY, homeserverUrl);
  localStorage.setItem(MTRX_LOGIN_KEY, login);
  localStorage.setItem(MTRX_ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(MTRX_USER_ID_KEY, userId);

  if (deviceId) {
    localStorage.setItem(MTRX_DEVICE_ID_KEY, deviceId);
  } else {
    localStorage.removeItem(MTRX_DEVICE_ID_KEY);
  }

  if (refreshToken) {
    localStorage.setItem(MTRX_REFRESH_TOKEN_KEY, refreshToken);
  } else {
    localStorage.removeItem(MTRX_REFRESH_TOKEN_KEY);
  }
}

function deleteMatrixLocalStores() {
  localStorage.removeItem(MTRX_ACCESS_TOKEN_KEY);
  localStorage.removeItem(MTRX_USER_ID_KEY);
  localStorage.removeItem(MTRX_DEVICE_ID_KEY);
  localStorage.removeItem(MTRX_REFRESH_TOKEN_KEY);
}

async function fetchDisplayName(client, userId) {
  try {
    const profile = await client.getProfileInfo(userId);
    return profile.displayname || userId;
  } catch {
    return userId;
  }
}

/**
 * Запускает синхронизацию (`/sync`) с ограничением начальной выдачи.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#startclient
 * @see https://spec.matrix.org/latest/client-server-api/#syncing
 */
async function startMatrixSync(client) {
  if (client.clientRunning) return;
  await client.startClient({ initialSyncLimit: 10 });
}

function getStoredMatrixData() {
  const uriMatrix = localStorage.getItem(MTRX_HS_URL_KEY) || "";
  const login = localStorage.getItem(MTRX_LOGIN_KEY) || "";
  const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY) || "";

  return { uriMatrix, login, deviceId };
}

function resolveHomeserverUrl(uriMatrix = "") {
  const url = (uriMatrix || localStorage.getItem(MTRX_HS_URL_KEY) || "").trim();
  if (!url) {
    throw new Error("Не задан URL homeserver Matrix.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("URL homeserver Matrix указан некорректно.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error("Homeserver должен использовать URL http или https без учетных данных.");
  }

  return parsedUrl.toString().replace(/\/$/, "");
}

/**
 * Вход по логину и паролю (`m.login.password`), сохранение сессии и запуск sync.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#loginrequest
 * @see https://spec.matrix.org/latest/client-server-api/#login
 */
async function loginMatrix({ login, password, uriMatrix }) {
  const homeserverUrl = resolveHomeserverUrl(uriMatrix);
  const tempClient = await createTempMatrixClient(homeserverUrl);

  const { login: storedLogin, deviceId: storedLoginDeviceId } = getStoredMatrixData();
  const storedDeviceId = storedLogin === login ? storedLoginDeviceId || undefined : undefined;

  const loginResponse = await tempClient.loginRequest({
    type: "m.login.password",
    identifier: {
      type: "m.id.user",
      user: login,
    },
    password,
    device_id: storedDeviceId,
    initial_device_display_name: DEVICE_DISPLAY_NAME,
    refresh_token: true,
  });

  tempClient.stopClient?.();

  try {
    const client = await createMatrixClientFromSession({
      baseUrl: homeserverUrl,
      accessToken: loginResponse.access_token,
      userId: loginResponse.user_id,
      deviceId: loginResponse.device_id,
      refreshToken: loginResponse.refresh_token,
    });

    persistMatrixSession({
      homeserverUrl,
      login,
      accessToken: loginResponse.access_token,
      userId: loginResponse.user_id,
      deviceId: loginResponse.device_id,
      refreshToken: loginResponse.refresh_token,
    });

    await startMatrixSync(client);

    return {
      homeserverUrl,
      userId: loginResponse.user_id,
      deviceId: loginResponse.device_id,
      displayName: await fetchDisplayName(client, loginResponse.user_id).catch(() => loginResponse.user_id),
    };
  } catch (error) {
    destroyMatrixClient();
    deleteMatrixLocalStores();
    throw error;
  }
}

/**
 * Завершает сессию на сервере, чистит локальные и IndexedDB-хранилища.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#logout
 * @see https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3logout
 */
async function logoutMatrix() {
  const client = getMatrixClient();

  if (client) {
    // logout(true) сам останавливает клиент до POST /logout
    try {
      await client.logout(true);
    } catch {
      try {
        client.stopClient();
      } catch {
        // Игнорируем
      }
    }

    await clearMatrixClientStores(client).catch(() => {});
    destroyMatrixClient();
  }

  deleteMatrixLocalStores();
}

/**
 * Локально инвалидирует сессию без запроса к серверу (например, при 401).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#clearstores
 * @see https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3logout
 */
async function invalidateMatrixSession() {
  const client = getMatrixClient();
  if (client) {
    try {
      client.stopClient();
    } catch {
      // Игнорируем
    }
    await clearMatrixClientStores(client).catch(() => {});
  }
  destroyMatrixClient();
  deleteMatrixLocalStores();
}

// Публичный доменный API — без SDK-объектов (MatrixClient / Room).
export {
  acceptCurrentDeviceVerification,
  cancelCurrentDeviceVerification,
  clearCurrentDeviceVerification,
  confirmCurrentDeviceVerification,
  createNewSecretStorage,
  getCurrentDeviceVerification,
  getDeviceVerificationSnapshot,
  getDeviceVerificationState,
  getStoredMatrixData,
  invalidateMatrixSession,
  loginMatrix,
  logoutMatrix,
  requestCurrentDeviceVerification,
  resetOwnEncryption,
  startCurrentDeviceVerification,
  verifyCurrentDeviceWithRecoveryKey,
  watchDeviceVerification,
  watchMatrixSession,
};
