import { ROOM_FILE_MAX_SIZE } from "../constants/ui.js";
import { getMatrixClient } from "./matrixClientStore.js";
import { loadMatrixSdk } from "./matrixSdk.js";

// Размер серверного thumbnail'а для превью картинок в таймлайне (px).
const PREVIEW_THUMBNAIL_PX = 512;

// objectURL'ы медиа: ключ варианта → blob-url, чтобы не качать один файл дважды.
// Blob-URL нужно освобождать вручную — чистим при logout (clearMediaUrlCache).
const mediaUrlCache = new Map();

function clearMediaUrlCache() {
  for (const url of mediaUrlCache.values()) {
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Игнорируем
      }
    }
  }
  mediaUrlCache.clear();
}

function getAuthHeaders(client) {
  const accessToken = client?.getAccessToken?.();
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

// Ключ кэша: у зашифрованного вложения от того же mxc без ключа толку нет.
function buildCacheKey(media, variant) {
  const file = media?.file || {};

  return [variant, media?.url || "", file.url || "", file.iv || "", file?.key?.k || ""].join("|");
}

/**
 * Варианты URL для скачивания: сначала без авторизации, затем authenticated
 * media (MSC3916) — старые homeserver'ы отдают только первый, новые только второй.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#mxcurltohttp
 * @see https://spec.matrix.org/latest/client-server-api/#content-repository
 */
function buildMediaUrls(client, mxcUrl, type) {
  if (!client?.mxcUrlToHttp || !mxcUrl) return [];

  // Без геометрии mxcUrlToHttp отдаёт download, с ней — thumbnail: undefined
  // в первых трёх аргументах обязателен, иначе они уезжают в width/height
  const geometry = type === "thumbnail" ? [PREVIEW_THUMBNAIL_PX, PREVIEW_THUMBNAIL_PX, "scale"] : [undefined, undefined, undefined];
  const attempts = [
    { url: client.mxcUrlToHttp(mxcUrl, ...geometry, false, true, false), headers: undefined },
    { url: client.mxcUrlToHttp(mxcUrl, ...geometry, false, true, true), headers: getAuthHeaders(client) },
  ];

  return attempts.filter((attempt) => attempt.url);
}

/**
 * Расшифровывает вложение по `content.file` (AES-256-CTR, ключ и IV в JWK).
 * Перед использованием контента обязательна проверка хэша шифротекста.
 *
 * @see https://spec.matrix.org/latest/client-server-api/#sending-encrypted-attachments
 */
async function decryptMediaBlob(blob, source) {
  const { decodeBase64, encodeUnpaddedBase64 } = await loadMatrixSdk();
  const ciphertext = await blob.arrayBuffer();

  const expectedHash = source?.file?.hashes?.sha256;
  if (typeof expectedHash === "string" && expectedHash) {
    const digest = await crypto.subtle.digest("SHA-256", ciphertext);
    const actualHash = encodeUnpaddedBase64(new Uint8Array(digest));
    if (actualHash !== expectedHash) {
      throw new Error("Вложение повреждено: хэш не совпал с указанным в событии.");
    }
  }

  const keyBytes = decodeBase64(String(source?.file?.key?.k || ""));
  const iv = decodeBase64(String(source?.file?.iv || ""));
  if (keyBytes.length !== 32 || iv.length !== 16) {
    throw new Error("В событии некорректные параметры шифрования вложения.");
  }

  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-CTR", false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-CTR", counter: iv, length: 64 }, key, ciphertext);

  return new Blob([plaintext], { type: source?.mimetype || "application/octet-stream" });
}

async function fetchFirstUrl(client, source, type) {
  let lastError = null;

  for (const { url, headers } of buildMediaUrls(client, source.url, type)) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Сервер вернул ${response.status} при загрузке вложения.`);
      }

      const blob = await response.blob();
      // Тип из события важнее ответа сервера: у шифротекста он всегда octet-stream
      return source.mimetype ? blob.slice(0, blob.size, source.mimetype) : blob;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Не удалось получить вложение.");
}

/**
 * Забирает вложение из content repository и при необходимости расшифровывает.
 * Для картинок (m.image) берём превью: без шифрования — серверный thumbnail,
 * с шифрованием — thumbnail или сам файл, который сервер уменьшить не может.
 */
async function fetchMediaBlob(media, { variant = "full" } = {}) {
  const client = getMatrixClient();
  const source = variant === "thumbnail" && media?.thumbnail?.url ? media.thumbnail : media;
  if (!client || !source?.url) throw new Error("Вложение недоступно.");

  if (source.file) {
    return decryptMediaBlob(await fetchFirstUrl(client, source, "full"), source);
  }

  if (variant === "thumbnail") {
    try {
      return await fetchFirstUrl(client, source, "thumbnail");
    } catch {
      // Сервер не умеет thumbnails — показываем полный файл
    }
  }

  return fetchFirstUrl(client, source, "full");
}

/**
 * objectURL превью картинки для таймлайна (пустая строка — превью не собралось).
 */
async function resolveImagePreviewUrl(media) {
  if (!media) return "";

  const cacheKey = buildCacheKey(media, "preview");
  if (mediaUrlCache.has(cacheKey)) return mediaUrlCache.get(cacheKey);

  let objectUrl = "";
  try {
    objectUrl = URL.createObjectURL(await fetchMediaBlob(media, { variant: "thumbnail" }));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[matrixMedia] не удалось собрать превью", media.url, error);
    }
  }

  mediaUrlCache.set(cacheKey, objectUrl);
  return objectUrl;
}

// Имя файла из события приходит от другого пользователя — вырезаем служебные символы
function getSafeFilename(value) {
  const name = typeof value === "string" ? value.trim() : "";

  return name.replace(/[\\/:*?"<>|\p{Cc}]/gu, "_").slice(0, 180);
}

/**
 * Скачивает вложение в файл пользователя: расшифровывает при необходимости и
 * отдаёт браузеру через blob-ссылку с исходным именем.
 */
async function downloadMediaFile(media, filename) {
  const blob = await fetchMediaBlob(media);
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = getSafeFilename(filename) || "file";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Ссылку освобождаем с задержкой: браузер начинает скачивание асинхронно
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
  }

  return { filename: getSafeFilename(filename) || "file", size: blob.size };
}

function getMsgTypeForFile(file) {
  const type = String(file?.type || "");

  if (type.startsWith("image/")) return "m.image";
  if (type.startsWith("video/")) return "m.video";
  if (type.startsWith("audio/")) return "m.audio";

  return "m.file";
}

// Размеры картинки для `info.w`/`info.h` (если браузер умеет их прочитать)
async function getImageSize(file) {
  if (typeof createImageBitmap !== "function") return {};

  try {
    const bitmap = await createImageBitmap(file);
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close?.();
    return size;
  } catch {
    return {};
  }
}

/**
 * Шифрует файл одноразовым ключом AES-256-CTR. Counter block — 64 случайных бита
 * IV плюс 64 нулевых бита счётчика, хэш считается по шифротексту.
 *
 * @see https://spec.matrix.org/latest/client-server-api/#sending-encrypted-attachments
 */
async function encryptFilePayload(file) {
  const { encodeUnpaddedBase64, encodeUnpaddedBase64Url } = await loadMatrixSdk();

  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = new Uint8Array(16);
  iv.set(crypto.getRandomValues(new Uint8Array(8)), 0);

  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-CTR", false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-CTR", counter: iv, length: 64 }, key, await file.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", ciphertext);

  return {
    blob: new Blob([ciphertext], { type: "application/octet-stream" }),
    encryptedFile: {
      v: "v2",
      key: {
        kty: "oct",
        key_ops: ["encrypt", "decrypt"],
        alg: "A256CTR",
        k: encodeUnpaddedBase64Url(keyBytes),
        ext: true,
      },
      iv: encodeUnpaddedBase64(iv),
      hashes: { sha256: encodeUnpaddedBase64(new Uint8Array(digest)) },
    },
  };
}

/**
 * Загружает файл в content repository и отправляет его в комнату сообщением
 * `m.room.message` (`m.image` / `m.video` / `m.audio` / `m.file`).
 * В шифрованной комнате шифруется сам файл, а ключ уезжает в `content.file`.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#uploadcontent
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#sendevent
 * @see https://spec.matrix.org/latest/client-server-api/#mroommessage-msgtypes
 */
async function uploadRoomMedia(roomId, file, { caption = "", onProgress } = {}) {
  const client = getMatrixClient();
  if (typeof client?.uploadContent !== "function" || typeof client?.sendEvent !== "function") {
    throw new Error("Клиент Matrix не инициализирован.");
  }
  if (!roomId) throw new Error("Не указан идентификатор комнаты.");
  if (!file?.size) throw new Error("Файл пуст или не выбран.");
  if (file.size > ROOM_FILE_MAX_SIZE) {
    throw new Error("Файл больше допустимого размера вложения.");
  }

  const msgtype = getMsgTypeForFile(file);
  const info = { mimetype: file.type || "application/octet-stream", size: file.size };
  if (msgtype === "m.image") Object.assign(info, await getImageSize(file));

  const progressHandler = ({ loaded, total }) => onProgress?.(loaded, total);
  const encrypted = Boolean(client.isRoomEncrypted?.(roomId));

  let contentUri = "";
  let encryptedFile = null;

  if (encrypted) {
    const payload = await encryptFilePayload(file);
    // Имя файла на сервере не оставляем: для шифрованного вложения это утечка
    const response = await client.uploadContent(payload.blob, {
      type: "application/octet-stream",
      includeFilename: false,
      progressHandler,
    });
    contentUri = response.content_uri;
    encryptedFile = { ...payload.encryptedFile, url: contentUri };
  } else {
    const response = await client.uploadContent(file, {
      type: info.mimetype,
      name: file.name,
      progressHandler,
    });
    contentUri = response.content_uri;
  }

  // filename и body: по спецификации при разных значениях body — подпись (caption)
  const text = typeof caption === "string" ? caption.trim() : "";
  const content = { msgtype, body: text || file.name, filename: file.name, info };
  if (encryptedFile) {
    content.file = encryptedFile;
  } else {
    content.url = contentUri;
  }

  const { event_id: eventId } = await client.sendEvent(roomId, "m.room.message", content);
  return { roomId, eventId };
}

export { clearMediaUrlCache, downloadMediaFile, resolveImagePreviewUrl, uploadRoomMedia };
