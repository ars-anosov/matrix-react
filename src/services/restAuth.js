import ky from "ky";
import { REST_AUTH_EXPIRE_TIME_KEY, REST_LOGIN_KEY, REST_URI_AUTH_KEY } from "../constants/storage";

const REST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const REST_REQUEST_TIMEOUT_MS = 5000;

// Петлевые адреса разрешены только в DEV — для локального mock-сервера.
function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

// Учётные данные REST можно отправлять только на https-адрес.
function resolveRestAuthUrl(uriRestAuth) {
  const raw = typeof uriRestAuth === "string" ? uriRestAuth.trim() : "";
  if (!raw) {
    throw new Error("Не задан адрес сервиса авторизации REST.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Адрес сервиса авторизации REST указан некорректно.");
  }

  if (url.username || url.password) {
    throw new Error("Адрес сервиса REST не должен содержать учётные данные.");
  }

  const isHttps = url.protocol === "https:";
  const isDevLoopbackHttp = import.meta.env.DEV && url.protocol === "http:" && isLoopbackHost(url.hostname);

  if (!isHttps && !isDevLoopbackHttp) {
    throw new Error("Сервис авторизации REST должен использовать https (http допустим только для локальной разработки).");
  }

  return url.toString();
}

function getStoredRestAuthUri() {
  return localStorage.getItem(REST_URI_AUTH_KEY) || "";
}

function getStoredRestLogin() {
  return localStorage.getItem(REST_LOGIN_KEY) || "";
}

function storeRestAuthUri(uriRestAuth) {
  localStorage.setItem(REST_URI_AUTH_KEY, uriRestAuth);
}

function persistRestAuthSession({ login }) {
  localStorage.setItem(REST_LOGIN_KEY, login);
  localStorage.setItem(REST_AUTH_EXPIRE_TIME_KEY, String(Date.now() + REST_SESSION_TTL_MS));
}

function clearRestAuthSession() {
  localStorage.removeItem(REST_AUTH_EXPIRE_TIME_KEY);
}

function isRestAuthSessionExpired() {
  const raw = localStorage.getItem(REST_AUTH_EXPIRE_TIME_KEY);
  if (!raw) return false;

  const expireTime = Number(raw);
  return Number.isFinite(expireTime) && Date.now() > expireTime;
}

// Пароль передаётся как есть: trim исказил бы учётные данные с пробелами.
async function loginRest({ login, password, uriRestAuth }) {
  const url = resolveRestAuthUrl(uriRestAuth);
  storeRestAuthUri(url);

  const responseData = await ky
    .post(url, {
      json: { login, password },
      timeout: REST_REQUEST_TIMEOUT_MS,
    })
    .json();

  persistRestAuthSession({ login });

  return responseData;
}

export { clearRestAuthSession, getStoredRestAuthUri, getStoredRestLogin, isRestAuthSessionExpired, loginRest };
