import { OIDC_IDP_KEY, OIDC_ISSUER_KEY } from "../constants/storage";

// Взаимодействие с IdP через legacy-схему Synapse `m.login.sso`: SPA открывает
// `/_matrix/client/v3/login/sso/redirect/{idp}` в popup, Synapse уводит браузер в
// authentik, а после consent'а получает код на своём `/_synapse/client/oidc/callback`
// и редиректит popup на нашу страницу возврата с `loginToken`. Токен приходит
// сообщением в основное окно, а сессию поднимает `matrixClient.loginMatrixWithToken`.

// Ресурс authentik с приложением, чей Authorization flow — explicit consent в сторону
// `/_synapse/client/oidc/callback`. Адрес по умолчанию для поля формы задаёт inline-скрипт
// index.html (localStorage `uriOidcAuth`), поэтому здесь его нет.
// id провайдера на стороне Synapse: он же id в GET /_matrix/client/v3/login → m.login.sso
export const DEFAULT_OIDC_IDP_ID = "oidc-authentik";

// Страница возврата в popup: тот же origin, что у приложения, поэтому postMessage
// можно проверять по origin. Файл лежит в корне статики (public/sso-callback.html).
const SSO_CALLBACK_FILE = "sso-callback.html";
// Тип сообщения страницы возврата — по нему отбираем loginToken среди прочих событий
const SSO_MESSAGE_TYPE = "matrix-sso-login-token";
// Попытка входа в authentik не должна висеть бесконечно: страница возврата шлёт
// единственное сообщение сразу после ответа Synapse
const SSO_TIMEOUT_MS = 5 * 60 * 1000;
const SSO_POPUP_FEATURES = "popup=yes,width=520,height=680";

// Петлевые адреса разрешены только в DEV — как у restAuth, для локальных проверок
function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

/**
 * Приводит адрес ресурса IdP к виду без завершающего слэша.
 * Пускает только https (в DEV — ещё http на петлевой адрес).
 */
function resolveOidcIssuerUrl(uriOidcAuth) {
  const raw = typeof uriOidcAuth === "string" ? uriOidcAuth.trim() : "";
  if (!raw) {
    throw new Error("Не задан адрес ресурса authentik.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Адрес ресурса authentik указан некорректно.");
  }

  if (url.username || url.password) {
    throw new Error("Адрес ресурса authentik не должен содержать учётные данные.");
  }

  const isHttps = url.protocol === "https:";
  const isDevLoopbackHttp = import.meta.env.DEV && url.protocol === "http:" && isLoopbackHost(url.hostname);

  if (!isHttps && !isDevLoopbackHttp) {
    throw new Error("Ресурс authentik должен использовать https (http допустим только для локальной разработки).");
  }

  return url.toString().replace(/\/$/, "");
}

function getStoredOidcIssuer() {
  return localStorage.getItem(OIDC_ISSUER_KEY) || "";
}

function getStoredOidcIdpId() {
  return localStorage.getItem(OIDC_IDP_KEY) || DEFAULT_OIDC_IDP_ID;
}

function storeOidcIssuer(issuer) {
  localStorage.setItem(OIDC_ISSUER_KEY, issuer);
}

function storeOidcIdpId(idpId) {
  localStorage.setItem(OIDC_IDP_KEY, idpId);
}

// Адрес страницы возврата: базовый путь приложения сохраняем, query и hash — нет,
// иначе в redirectUrl попали бы чужие параметры текущего экрана (HashRouter)
function buildSsoRedirectUrl(baseUrl) {
  return new URL(SSO_CALLBACK_FILE, baseUrl).toString();
}

// Ожидает сообщение страницы возврата. Резолвится loginToken'ом либо отклоняется, если
// popup закрыли или попытку отменили (закрытие формы → AbortSignal): молчаливый resolve
// оставлял бы форму в вечном loading с недоступным крестиком.
function waitForLoginToken(popup, appOrigin, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const closeTimer = setInterval(() => {
      if (settled) return;
      if (popup.closed) finish(new Error("Окно входа authentik закрыто: вход не завершён."));
    }, 500);
    const timeoutTimer = setTimeout(() => {
      finish(new Error("Вход через authentik не завершён. Повторите попытку."));
    }, SSO_TIMEOUT_MS);

    // Отмена (закрытие формы или новая попытка): окно закрываем сами, ожидание прекращаем
    function handleAbort() {
      popup.close?.();
      finish(new Error("Вход через authentik отменён."));
    }

    function cleanup() {
      settled = true;
      clearInterval(closeTimer);
      clearTimeout(timeoutTimer);
      window.removeEventListener("message", handleMessage);
      signal?.removeEventListener("abort", handleAbort);
    }

    function finish(error, loginToken) {
      if (settled) return;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      resolve(loginToken);
    }

    function handleMessage(event) {
      if (event.origin !== appOrigin) return;
      if (event.data?.type !== SSO_MESSAGE_TYPE) return;
      if (typeof event.data.loginToken !== "string" || !event.data.loginToken) {
        finish(new Error("Synapse не вернул loginToken: вход не завершён."));
        return;
      }
      finish(null, event.data.loginToken);
    }

    if (signal?.aborted) {
      handleAbort();
      return;
    }

    signal?.addEventListener("abort", handleAbort, { once: true });
    window.addEventListener("message", handleMessage);
  });
}

/**
 * Открывает popup с редиректом Synapse в authentik и ждёт loginToken со страницы
 * возврата. Флоу ведёт слой AUTH (authControlActions.handleOidcLogin); сессию Matrix по
 * токену поднимает MTRXCTL_ (handleLoginWithToken), шаги связывает мост AuthContainer.
 *
 * @param {object} params
 * @param {string} params.uriOidcAuth адрес ресурса authentik
 * @param {string} [params.idpId] id провайдера на стороне Synapse
 * @param {(redirectUrl: string, idpId: string) => string} params.buildSsoLoginUrl
 *   абсолютный адрес SSO-редиректа на homeserver (его строит matrixClient)
 * @param {AbortSignal} [params.signal] прерывает ожидание (закрытие формы, новая попытка)
 * @returns {Promise<{loginToken: string, issuer: string, idpId: string}>}
 */
async function startOidcLogin({ uriOidcAuth, idpId, buildSsoLoginUrl, signal }) {
  const issuer = resolveOidcIssuerUrl(uriOidcAuth);
  const resolvedIdpId = (typeof idpId === "string" ? idpId.trim() : "") || getStoredOidcIdpId();

  if (typeof buildSsoLoginUrl !== "function") throw new Error("Не задан построитель SSO-редиректа.");

  const redirectUrl = buildSsoRedirectUrl(window.location.href);
  const ssoUrl = buildSsoLoginUrl(redirectUrl, resolvedIdpId);

  // Popup открываем синхронно, до первого await: иначе браузер теряет признак
  // пользовательского действия и блокирует окно
  const popup = window.open(ssoUrl, "matrix-sso-popup", SSO_POPUP_FEATURES);
  if (!popup) {
    throw new Error("Браузер заблокировал окно входа authentik. Разрешите всплывающие окна и повторите.");
  }

  popup.focus?.();

  const loginToken = await waitForLoginToken(popup, window.location.origin, signal);

  // Адрес ресурса и id провайдера запоминаем только после удачного входа
  storeOidcIssuer(issuer);
  storeOidcIdpId(resolvedIdpId);

  return { loginToken, issuer, idpId: resolvedIdpId };
}

export { buildSsoRedirectUrl, getStoredOidcIdpId, getStoredOidcIssuer, resolveOidcIssuerUrl, startOidcLogin, storeOidcIdpId, storeOidcIssuer };
