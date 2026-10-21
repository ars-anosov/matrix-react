import { MTRX_HS_URL_KEY } from "../constants/storage";

/**
 * Приводит адрес homeserver к виду без завершающего слэша и проверяет его.
 * Общий разбор для Matrix-сервисов и MAS: адрес приходит из формы/`localStorage`,
 * а не из SDK, поэтому валидация одна на всех.
 */
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

export { resolveHomeserverUrl };
