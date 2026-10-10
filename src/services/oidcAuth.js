import { OIDC_IDP_KEY, OIDC_ISSUER_KEY } from "../constants/storage";

// Взаимодействие с IdP через legacy-схему Synapse `m.login.sso`: SPA уводит браузер на
// `/_matrix/client/v3/login/sso/redirect/{idp}`, Synapse сам проводит Authorization Code +
// PKCE в authentik, получает код на своём `/_synapse/client/oidc/callback` и возвращает
// браузер в приложение с `loginToken`. Токен ждёт здесь, в модуле, до клика тумблера
// AuthPad, а сессию по нему поднимает мост AuthContainer → MTRXCTL_ (`m.login.token`).
//
// Вход полностраничный: popup и страница возврата не нужны, разбором `?loginToken`
// на старте занимается takeOidcReturn.

// Ресурс authentik с приложением, чей Authorization flow — explicit consent в сторону
// `/_synapse/client/oidc/callback`. Адрес по умолчанию для поля формы задаёт inline-скрипт
// index.html (localStorage `uriOidcAuth`), поэтому здесь его нет.
// id провайдера на стороне Synapse: он же id в GET /_matrix/client/v3/login → m.login.sso
export const DEFAULT_OIDC_IDP_ID = "oidc-authentik";

// loginToken живёт только здесь: он одноразовый и короткоживущий (по умолчанию 2 минуты
// на стороне Synapse), а DEV-логгер Redux печатает payload'ы экшенов — в стор его не кладём
let pendingLoginToken = "";

// Признак «ушли в authentik и разбора возврата ещё не было»: после редиректа память
// страницы теряется, поэтому о незавершённой попытке может сказать только sessionStorage
const OIDC_PENDING_KEY = "oidcLoginPending";

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

function markOidcPending(isPending) {
  if (isPending) {
    sessionStorage.setItem(OIDC_PENDING_KEY, "1");
    return;
  }

  sessionStorage.removeItem(OIDC_PENDING_KEY);
}

function isOidcPending() {
  return sessionStorage.getItem(OIDC_PENDING_KEY) === "1";
}

// Адрес возврата — корень приложения: Synapse дописывает к нему loginToken, а разбирает
// параметры takeOidcReturn. Query и hash текущего экрана не переносим (HashRouter)
function buildSsoRedirectUrl(baseUrl) {
  return new URL(".", baseUrl).toString();
}

// Параметры возврата убираем из адресной строки и истории: loginToken не должен
// оставаться в URL, попадать в закладки и в Referer при загрузке ресурсов приложения
function clearOidcReturnParams() {
  const url = new URL(window.location.href);
  url.searchParams.delete("loginToken");
  url.searchParams.delete("error");
  url.searchParams.delete("error_description");

  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Уводит браузер на SSO-редирект Synapse: дальше Synapse сам проведёт вход в authentik и
 * вернёт браузер в приложение с `loginToken`, который подберёт takeOidcReturn на старте.
 *
 * @param {object} params
 * @param {string} params.uriOidcAuth адрес ресурса authentik
 * @param {string} [params.idpId] id провайдера на стороне Synapse
 * @param {(redirectUrl: string, idpId: string) => string} params.buildSsoLoginUrl
 *   абсолютный адрес SSO-редиректа на homeserver (его строит matrixClient)
 * @returns {{issuer: string, idpId: string}} что сохранено перед переходом
 */
function beginOidcRedirect({ uriOidcAuth, idpId, buildSsoLoginUrl }) {
  const issuer = resolveOidcIssuerUrl(uriOidcAuth);
  const resolvedIdpId = (typeof idpId === "string" ? idpId.trim() : "") || getStoredOidcIdpId();

  if (typeof buildSsoLoginUrl !== "function") throw new Error("Не задан построитель SSO-редиректа.");

  const redirectUrl = buildSsoRedirectUrl(window.location.href);
  const ssoUrl = buildSsoLoginUrl(redirectUrl, resolvedIdpId);

  // Адрес ресурса и id провайдера сохраняем до перехода: на возврате память страницы новая
  storeOidcIssuer(issuer);
  storeOidcIdpId(resolvedIdpId);
  markOidcPending(true);

  window.location.assign(ssoUrl);

  return { issuer, idpId: resolvedIdpId };
}

/**
 * Разбирает параметры возврата из authentik на старте приложения. Токен остаётся в модуле
 * (не в сторе), а параметры сразу убираются из адресной строки.
 *
 * @param {string} [search] query-строка возврата
 * @returns {{kind: "token"|"error"|"pending"|"none", errorText?: string}}
 */
function takeOidcReturn(search = window.location.search) {
  const params = new URLSearchParams(search);
  const loginToken = params.get("loginToken") || "";
  const error = params.get("error") || "";
  const errorDescription = params.get("error_description") || "";

  if (!loginToken && !error) {
    // Вернулись, но Synapse не довёл вход: страница ошибки Synapse или «назад».
    // Признак попытки снимаем — сообщение о незавершённом входе показываем один раз
    if (!isOidcPending()) return { kind: "none" };

    markOidcPending(false);
    return { kind: "pending" };
  }

  clearOidcReturnParams();
  markOidcPending(false);

  if (error) {
    return { kind: "error", errorText: `authentik вернул ошибку: ${errorDescription || error}` };
  }

  pendingLoginToken = loginToken;

  return { kind: "token" };
}

// Токен одноразовый: мост забирает его ровно один раз
function consumeLoginToken() {
  const loginToken = pendingLoginToken;
  pendingLoginToken = "";

  return loginToken;
}

// Сброс готовности (закрытие формы или разбор ошибки): израсходованный или просроченный
// токен больше не предлагаем запускать
function clearOidcCredentials() {
  pendingLoginToken = "";
  markOidcPending(false);
}

export {
  beginOidcRedirect,
  buildSsoRedirectUrl,
  clearOidcCredentials,
  consumeLoginToken,
  getStoredOidcIdpId,
  getStoredOidcIssuer,
  resolveOidcIssuerUrl,
  storeOidcIdpId,
  storeOidcIssuer,
  takeOidcReturn,
};
