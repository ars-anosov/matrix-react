import { MAS_CLIENT_KEY, MAS_ISSUER_KEY, MTRX_DEVICE_ID_KEY } from "../constants/storage";
import { loadMatrixSdk } from "./matrixSdk.js";
import { resolveHomeserverUrl } from "./matrixUrl.js";

// Вход через Matrix Authentication Service (MAS) по MSC2965/MSC2964:
//   1. GET /_matrix/client/v1/auth_metadata на homeserver — метаданные OAuth 2.0;
//   2. динамическая регистрация клиента (MSC2966) в MAS;
//   3. браузер уходит на authorization_endpoint с PKCE (без client secret);
//   4. MAS возвращает `?code=&state=`, код меняется на токены в token_endpoint.
//
// Access token MAS — обычный Matrix-токен: Synapse проверяет его через introspection,
// поэтому сессию по нему поднимает MTRXCTL_ тем же путём, что и после входа по паролю.
// Legacy-схема Synapse `m.login.sso` здесь больше не используется: на сервере с MAS
// возврат ограничен известными клиентами, а MAS — самостоятельный OAuth-провайдер.

// Контекст незавершённого перехода: после редиректа память страницы теряется, поэтому
// state, PKCE-verifier, клиент и метаданные ждут возврата в sessionStorage (своя копия
// у каждой вкладки). Токены сюда не пишутся — только после обмена, в модуль.
const PENDING_KEY = "masOauthPending";

// Сколько ждём возврата из MAS. Дольше держать state и verifier незачем.
const PENDING_TTL_MS = 15 * 60 * 1000;

// MAS требует https для client_uri. В DEV приложение открыто на http://localhost,
// поэтому регистрируем native-клиент с публичным client_uri, а redirect_uri оставляем
// петлевым: MAS разрешает loopback для public/native-клиентов.
const DEV_CLIENT_URI = "https://ars-anosov.github.io/matrix-react/";

// Готовые к запуску токены: живут только в модуле, как раньше loginToken. В Redux не
// попадают — DEV-логгер печатает payload'ы экшенов.
let pendingAuth = null;

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function readPending() {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
  } catch {
    return null;
  }
}

function writePending(pending) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

function clearPending() {
  sessionStorage.removeItem(PENDING_KEY);
}

function readStoredClient() {
  try {
    return JSON.parse(localStorage.getItem(MAS_CLIENT_KEY) || "null");
  } catch {
    return null;
  }
}

function storeClient(client) {
  localStorage.setItem(MAS_CLIENT_KEY, JSON.stringify(client));
}

function getStoredMasIssuer() {
  return localStorage.getItem(MAS_ISSUER_KEY) || "";
}

function storeMasIssuer(issuer) {
  localStorage.setItem(MAS_ISSUER_KEY, issuer);
}

// Адрес возврата — корень приложения без query и hash (HashRouter не должен получить
// `?code` в свой маршрут). MAS допишет к нему параметры ответа.
function buildRedirectUri() {
  return new URL(".", window.location.href).toString();
}

function randomToken(bytes) {
  return crypto.getRandomValues(new Uint8Array(bytes));
}

/**
 * Метаданные OAuth 2.0 сервера авторизации (MSC2965) с homeserver.
 * `getAuthMetadata` сам выбирает стабильный (`/v1`) или нестабильный (`msc2965`) префикс
 * и проверяет обязательные поля, включая S256 и refresh_token.
 *
 * @see https://spec.matrix.org/v1.18/client-server-api/#get_matrixclientv1auth_metadata
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#getauthmetadata
 */
async function discoverMas(uriMatrix) {
  const baseUrl = resolveHomeserverUrl(uriMatrix);
  const { createClient } = await loadMatrixSdk();
  const client = createClient({ baseUrl });

  try {
    return await client.getAuthMetadata();
  } catch (error) {
    throw new Error("Homeserver не отдал параметры MAS: сервер не поддерживает MSC2965 или недоступен.", { cause: error });
  } finally {
    try {
      client.stopClient();
    } catch {
      // Клиент не запускался — останавливать нечего.
    }
  }
}

/**
 * Client ID для текущего адреса возврата. Регистрация динамическая (MSC2966) и
 * кэшируется в localStorage: повторный вход не создаёт нового клиента в MAS.
 */
async function ensureClient(metadata, redirectUri) {
  const stored = readStoredClient();
  if (stored?.clientId && stored.issuer === metadata.issuer && stored.redirectUri === redirectUri) {
    return stored.clientId;
  }

  const { OAuth2 } = await loadMatrixSdk();
  const redirect = new URL(redirectUri);
  const isLoopback = redirect.protocol === "http:" && isLoopbackHost(redirect.hostname);

  try {
    const clientId = await OAuth2.registerClient(metadata, {
      application_type: isLoopback ? "native" : "web",
      client_name: "matrix-react",
      client_uri: isLoopback ? DEV_CLIENT_URI : redirectUri,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });

    storeClient({ issuer: metadata.issuer, redirectUri, clientId });
    return clientId;
  } catch (error) {
    throw new Error(
      isLoopback
        ? "MAS не зарегистрировал клиента для localhost. Откройте приложение по https или разрешите loopback-redirect в MAS."
        : "MAS не зарегистрировал клиента: приложение должно быть открыто по https, а адрес возврата — совпадать с текущим.",
      { cause: error },
    );
  }
}

/**
 * Готовит полностраничный переход в MAS: discovery, регистрация клиента, PKCE и state.
 * Контекст сохраняется до перехода, потому что на возврате память страницы новая.
 *
 * @param {{uriMatrix?: string}} params
 * @returns {Promise<{issuer: string}>} адрес MAS (для стора/подписи источника)
 */
async function beginMasRedirect({ uriMatrix } = {}) {
  const redirectUri = buildRedirectUri();
  const metadata = await discoverMas(uriMatrix);
  const clientId = await ensureClient(metadata, redirectUri);

  const { OAuth2, encodeUnpaddedBase64Url } = await loadMatrixSdk();
  const codeVerifier = encodeUnpaddedBase64Url(randomToken(72));
  const state = encodeUnpaddedBase64Url(randomToken(16));
  // device_id переиспользуем, чтобы после повторного входа сохранить E2EE-ключи устройства.
  const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY) || encodeUnpaddedBase64Url(randomToken(8));

  const oauth = new OAuth2(metadata, { clientId, redirectUri, deviceId, codeVerifier });
  // response_mode=query: приложение на HashRouter, и `#` занят маршрутом. Параметры
  // ответа приходят в `location.search` и сразу вычищаются takeMasReturn.
  const authorizationUrl = await oauth.generateAuthorizationCodeGrantUrl(state, "query");

  writePending({ state, codeVerifier, clientId, redirectUri, deviceId, issuer: metadata.issuer, metadata, startedAt: Date.now() });
  storeMasIssuer(metadata.issuer);

  window.location.assign(authorizationUrl);

  return { issuer: metadata.issuer };
}

// Параметры возврата убираем из адресной строки и истории: код одноразовый и не должен
// оставаться в закладках, истории и Referer при загрузке ресурсов приложения.
function clearReturnParams() {
  const url = new URL(window.location.href);
  for (const key of ["code", "state", "error", "error_description", "session_state", "iss"]) {
    url.searchParams.delete(key);
  }

  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Разбирает возврат из MAS на старте приложения. Query чистится сразу, а код остаётся
 * в памяти до обмена: сессию по нему поднимает MTRXCTL_ после клика тумблера.
 *
 * @param {string} [search] query-строка возврата
 * @returns {{kind: "code"|"error"|"pending"|"none", code?: string, state?: string, errorText?: string}}
 */
function takeMasReturn(search = window.location.search) {
  const params = new URLSearchParams(search);
  const code = params.get("code") || "";
  const state = params.get("state") || "";
  const error = params.get("error") || "";
  const errorDescription = params.get("error_description") || "";
  const pending = readPending();

  if (!code && !error) {
    // Вернулись без ответа MAS: страница ошибки, «назад» или повторный запуск.
    if (!pending) return { kind: "none" };

    clearPending();
    return { kind: "pending" };
  }

  clearReturnParams();

  if (error) {
    clearPending();
    return { kind: "error", errorText: `MAS вернул ошибку: ${errorDescription || error}` };
  }

  return { kind: "code", code, state };
}

/**
 * Меняет код авторизации на токены и проверяет state/срок контекста.
 * Метаданные берутся из контекста перехода, поэтому повторный discovery на возврате
 * не нужен: endpoints уже проверены при уходе в MAS.
 *
 * @param {{code: string, state: string}} params
 * @returns {Promise<{tokens: object, oauth: object}>}
 */
async function completeMasAuth({ code, state } = {}) {
  const pending = readPending();
  if (!pending) {
    throw new Error("Контекст входа MAS утерян: войдите заново.");
  }

  if (!state || state !== pending.state) {
    clearPending();
    throw new Error("Параметр state не совпал: вход через MAS отклонён.");
  }

  if (!pending.startedAt || Date.now() - pending.startedAt > PENDING_TTL_MS) {
    clearPending();
    throw new Error("Сессия входа MAS истекла: войдите заново.");
  }

  let tokens;
  try {
    const { OAuth2 } = await loadMatrixSdk();
    const oauth = new OAuth2(pending.metadata, {
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      deviceId: pending.deviceId,
      codeVerifier: pending.codeVerifier,
    });
    tokens = await oauth.completeAuthorizationCodeGrant(code);
  } catch (error) {
    throw new Error("MAS не выдал токен: войдите заново.", { cause: error });
  } finally {
    clearPending();
  }

  storeMasIssuer(pending.issuer);
  pendingAuth = {
    tokens,
    oauth: {
      metadata: pending.metadata,
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      deviceId: pending.deviceId,
      issuer: pending.issuer,
    },
  };

  return pendingAuth;
}

// Токены одноразовые для запуска: мост забирает их ровно один раз
function consumeMasTokens() {
  const auth = pendingAuth;
  pendingAuth = null;

  return auth;
}

// Сброс незавершённого/неиспользованного входа: после ошибки или закрытия формы
function clearMasCredentials() {
  pendingAuth = null;
  clearPending();
}

/**
 * Обновление access token через MAS (refresh_token grant). Используется
 * `tokenRefreshFunction` клиента вместо compat-эндпоинта `/_matrix/client/v3/refresh`.
 *
 * @see https://spec.matrix.org/v1.18/client-server-api/#refreshing-access-tokens
 */
async function refreshMasTokens(oauth, refreshToken) {
  if (!oauth?.metadata || !oauth?.clientId) throw new Error("Нет контекста OAuth MAS для обновления токена.");

  const { OAuth2 } = await loadMatrixSdk();
  const client = new OAuth2(oauth.metadata, {
    clientId: oauth.clientId,
    redirectUri: oauth.redirectUri,
    deviceId: oauth.deviceId,
  });

  return client.performRefreshTokenGrant(refreshToken);
}

/**
 * Завершает OAuth-сессию в MAS. Для OAuth-токена compat-эндпоинт `/logout` не подходит:
 * сессию закрывает отзыв токенов на revocation_endpoint.
 */
async function revokeMasSession(oauth, { accessToken, refreshToken } = {}) {
  if (!oauth?.metadata || !oauth?.clientId) return;

  const { OAuth2 } = await loadMatrixSdk();
  const client = new OAuth2(oauth.metadata, {
    clientId: oauth.clientId,
    redirectUri: oauth.redirectUri,
    deviceId: oauth.deviceId,
  });

  const tokens = [
    [accessToken, "access_token"],
    [refreshToken, "refresh_token"],
  ].filter(([token]) => token);

  for (const [token, type] of tokens) {
    try {
      await client.revokeToken(token, type);
    } catch {
      // Выход не должен блокироваться сетью или уже отозванным токеном.
    }
  }
}

export {
  beginMasRedirect,
  clearMasCredentials,
  completeMasAuth,
  consumeMasTokens,
  getStoredMasIssuer,
  refreshMasTokens,
  revokeMasSession,
  storeMasIssuer,
  takeMasReturn,
};
