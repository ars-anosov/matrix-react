import ky from "ky";
import {
  AD_AUTH_EXPIRE_TIME_KEY,
  AD_LOGIN_KEY,
  AD_URI_AUTH_KEY,
} from "../constants/storage";

const AD_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const AD_REQUEST_TIMEOUT_MS = 5000;

// Петлевые адреса разрешены только в DEV — для локального mock-сервера.
function isLoopbackHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

// Учётные данные AD можно отправлять только на https-адрес.
function resolveAdAuthUrl(uriAdAuth) {
  const raw = typeof uriAdAuth === "string" ? uriAdAuth.trim() : "";
  if (!raw) {
    throw new Error("Не задан адрес сервиса авторизации AD.");
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Адрес сервиса авторизации AD указан некорректно.");
  }

  if (url.username || url.password) {
    throw new Error("Адрес сервиса AD не должен содержать учётные данные.");
  }

  const isHttps = url.protocol === "https:";
  const isDevLoopbackHttp =
    import.meta.env.DEV &&
    url.protocol === "http:" &&
    isLoopbackHost(url.hostname);

  if (!isHttps && !isDevLoopbackHttp) {
    throw new Error(
      "Сервис авторизации AD должен использовать https (http допустим только для локальной разработки).",
    );
  }

  return url.toString();
}

function getStoredAdAuthUri() {
  return localStorage.getItem(AD_URI_AUTH_KEY) || "";
}

function getStoredAdLogin() {
  return localStorage.getItem(AD_LOGIN_KEY) || "";
}

function storeAdAuthUri(uriAdAuth) {
  localStorage.setItem(AD_URI_AUTH_KEY, uriAdAuth);
}

function persistAdAuthSession({ login }) {
  localStorage.setItem(AD_LOGIN_KEY, login);
  localStorage.setItem(
    AD_AUTH_EXPIRE_TIME_KEY,
    String(Date.now() + AD_SESSION_TTL_MS),
  );
}

function clearAdAuthSession() {
  localStorage.removeItem(AD_AUTH_EXPIRE_TIME_KEY);
}

function isAdAuthSessionExpired() {
  const raw = localStorage.getItem(AD_AUTH_EXPIRE_TIME_KEY);
  if (!raw) return false;

  const expireTime = Number(raw);
  return Number.isFinite(expireTime) && Date.now() > expireTime;
}

// Пароль передаётся как есть: trim исказил бы учётные данные с пробелами.
async function loginAd({ login, password, uriAdAuth }) {
  const url = resolveAdAuthUrl(uriAdAuth);
  storeAdAuthUri(url);

  const responseData = await ky
    .post(url, {
      json: { login, password },
      timeout: AD_REQUEST_TIMEOUT_MS,
    })
    .json();

  persistAdAuthSession({ login });

  return responseData;
}

export {
  clearAdAuthSession,
  getStoredAdAuthUri,
  getStoredAdLogin,
  isAdAuthSessionExpired,
  loginAd,
};
