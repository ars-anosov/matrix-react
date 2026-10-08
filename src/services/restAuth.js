import ky from "ky";
import { REST_LOGIN_KEY, REST_URI_AUTH_KEY } from "../constants/storage";

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

function storeRestLogin(login) {
  localStorage.setItem(REST_LOGIN_KEY, login);
}

// Адрес сохраняем до запроса, логин — только после успеха.
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

  storeRestLogin(login);

  return responseData;
}

export { getStoredRestAuthUri, getStoredRestLogin, loginRest };
