import {
  MTRX_ACCESS_TOKEN_KEY,
  MTRX_DEVICE_ID_KEY,
  MTRX_HS_URL_KEY,
  MTRX_LOGIN_KEY,
  MTRX_REFRESH_TOKEN_KEY,
  MTRX_USER_ID_KEY,
} from "../constants/storage";
import { loadMatrixSdk } from "./matrixSdk.js";
import { clearRoomAvatarCache } from "./matrixRooms.js";
import {
  clearMatrixClient,
  getMatrixClient,
  setMatrixClient,
} from "./matrixClientStore.js";

const DEVICE_DISPLAY_NAME = "matrix-react";

let matrixSessionCleanup = null;

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

async function createMatrixClientFromSession({
  baseUrl,
  accessToken,
  userId,
  deviceId,
  refreshToken,
}) {
  if (!baseUrl || typeof baseUrl !== "string") {
    throw new Error(
      `[createMatrixClientFromSession] Невалидный baseUrl: ${baseUrl}`,
    );
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
        console.warn(
          "[tokenRefreshFunction] Рефреш-токен протух (401). Чистим хранилища…",
        );
        deleteMatrixLocalStores();
        await deleteMatrixIndexedDbStores(storeKey);
        getMatrixClient()?.emit?.("Session.logged_out");
        throw new Error("REFRESH_TOKEN_EXPIRED: Store cleared");
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
        expiry: tokenData.expires_in_ms
          ? new Date(Date.now() + tokenData.expires_in_ms)
          : undefined,
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
        console.warn(
          "[matrixClient] рассогласование device_id в IndexedDB, чищу store и пробую снова",
          err,
        );
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
      console.warn(
        "[matrixClient] Сессия невалидна (401). Уничтожаем инстанс.",
      );
      deleteMatrixLocalStores();
      try {
        client.stopClient();
      } catch {
        // Игнорируем
      }
      await clearMatrixClientStores(client);
      throw new Error("MATRIX_UNAUTHORIZED");
    }

    console.warn(
      "[matrixClient] Не удалось проверить токен (возможно нет сети):",
      err,
    );
  }

  setMatrixClient(client);
  return client;
}

async function deleteMatrixIndexedDbStores(storeKey) {
  if (typeof indexedDB === "undefined" || !storeKey) return;

  const prefix = cryptoDbPrefix(storeKey);
  const dbNames = [
    `matrix-js-sdk:${syncDbName(storeKey)}`,
    `${prefix}::matrix-sdk-crypto`,
    `${prefix}::matrix-sdk-crypto-meta`,
  ];

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

function persistMatrixSession({
  homeserverUrl,
  login,
  accessToken,
  userId,
  deviceId,
  refreshToken,
}) {
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

  if (
    !["http:", "https:"].includes(parsedUrl.protocol) ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error(
      "Homeserver должен использовать URL http или https без учетных данных.",
    );
  }

  return parsedUrl.toString().replace(/\/$/, "");
}

async function loginMatrix({ login, password, uriMatrix }) {
  const homeserverUrl = resolveHomeserverUrl(uriMatrix);
  const tempClient = await createTempMatrixClient(homeserverUrl);

  const { login: storedLogin, deviceId: storedLoginDeviceId } =
    getStoredMatrixData();
  const storedDeviceId =
    storedLogin === login ? storedLoginDeviceId || undefined : undefined;

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
      displayName: await fetchDisplayName(client, loginResponse.user_id).catch(
        () => loginResponse.user_id,
      ),
    };
  } catch (error) {
    destroyMatrixClient();
    deleteMatrixLocalStores();
    throw error;
  }
}

function getStoredMatrixSession() {
  const homeserverUrl = (localStorage.getItem(MTRX_HS_URL_KEY) || "").trim();
  const accessToken = localStorage.getItem(MTRX_ACCESS_TOKEN_KEY);
  const userId = localStorage.getItem(MTRX_USER_ID_KEY);
  const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY);
  const refreshToken = localStorage.getItem(MTRX_REFRESH_TOKEN_KEY);

  if (
    !homeserverUrl ||
    homeserverUrl === "undefined" ||
    !accessToken ||
    accessToken === "undefined" ||
    !userId ||
    userId === "undefined" ||
    !userId.startsWith("@")
  ) {
    return null;
  }

  return {
    baseUrl: homeserverUrl,
    accessToken,
    userId,
    deviceId: deviceId === "undefined" ? "" : deviceId || "",
    refreshToken: refreshToken === "undefined" ? "" : refreshToken || "",
  };
}

async function restoreMatrixSession() {
  const session = getStoredMatrixSession();
  if (!session) return null;

  let client = null;
  try {
    client = await createMatrixClientFromSession(session);
    await startMatrixSync(client);
  } catch (error) {
    console.error("Критическая ошибка восстановления клиента Matrix:", error);
    destroyMatrixClient();
    deleteMatrixLocalStores();
    throw error;
  }

  const finalUserId = client.getUserId() || session.userId;

  return {
    homeserverUrl: session.baseUrl,
    userId: finalUserId,
    deviceId: session.deviceId || client.getDeviceId() || "",
    displayName: await fetchDisplayName(client, finalUserId).catch(
      () => finalUserId,
    ),
  };
}

function getActiveMatrixSession() {
  const client = getMatrixClient();
  if (!client?.clientRunning) return null;

  return {
    homeserverUrl: (localStorage.getItem(MTRX_HS_URL_KEY) || "").trim(),
    userId: client.getUserId(),
    deviceId:
      localStorage.getItem(MTRX_DEVICE_ID_KEY) || client.getDeviceId() || "",
    displayName: null,
  };
}

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
  getActiveMatrixSession,
  getStoredMatrixData,
  invalidateMatrixSession,
  loginMatrix,
  logoutMatrix,
  restoreMatrixSession,
  watchMatrixSession,
};
