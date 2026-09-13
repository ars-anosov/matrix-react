import { ROOM_MESSAGES_LIMIT } from "../constants/ui.js";
import { getMatrixClient } from "./matrixClientStore.js";

// Кэш резолвнутых аватарок (mxc → objectURL), чтобы не фетчить повторно
// и не плодить blob-URL без revoke.
const avatarUrlCache = new Map();

function clearRoomAvatarCache() {
  for (const url of avatarUrlCache.values()) {
    if (typeof url === "string" && url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Игнорируем
      }
    }
  }
  avatarUrlCache.clear();
}

function getRoomDisplayName(room) {
  if (!room) return "Без названия";

  // Room.name заполняется SDK после sync / из state
  const name = typeof room.name === "string" ? room.name.trim() : "";
  if (name) return name;

  const alias = room.getCanonicalAlias?.();
  if (typeof alias === "string" && alias.trim()) return alias;

  return room.roomId || "Без названия";
}

function getRoomMxcAvatarUrl(room) {
  if (!room) return "";

  const mxcUrl = room.getMxcAvatarUrl?.();
  if (typeof mxcUrl === "string" && mxcUrl.trim()) return mxcUrl;

  // DM без аватара комнаты — аватар собеседника
  const fallbackMember = room.getAvatarFallbackMember?.();
  const memberMxcUrl = fallbackMember?.getMxcAvatarUrl?.();
  if (typeof memberMxcUrl === "string" && memberMxcUrl.trim()) {
    return memberMxcUrl;
  }

  return "";
}

/**
 * Резолвит `mxc://` в object URL, пробуя authenticated media (MSC3916).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#mxcurltohttp
 * @see https://spec.matrix.org/latest/client-server-api/#content-repo
 */
async function resolveMxcAvatarUrl(client, mxcUrl, contextId = "") {
  if (!client || !mxcUrl || typeof client.mxcUrlToHttp !== "function") {
    return "";
  }

  if (avatarUrlCache.has(mxcUrl)) {
    return avatarUrlCache.get(mxcUrl);
  }

  const accessToken = client.getAccessToken?.();
  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

  // Сначала без авторизации, затем с auth (MSC3916 / authenticated media).
  // Blob нужен: <img> не шлёт Authorization-заголовок.
  const attempts = [
    {
      url: client.mxcUrlToHttp(mxcUrl, 64, 64, "scale", false, true, false),
      headers: undefined,
    },
    {
      url: client.mxcUrlToHttp(mxcUrl, 64, 64, "scale", false, true, true),
      headers: authHeaders,
    },
  ].filter((attempt) => attempt.url);

  for (const { url, headers } of attempts) {
    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        if (import.meta.env.DEV) {
          console.warn("[matrixRooms] avatar fetch failed", contextId, url, response.status);
        }
        continue;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      avatarUrlCache.set(mxcUrl, objectUrl);
      return objectUrl;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[matrixRooms] avatar fetch error", contextId, url, err);
      }
    }
  }

  avatarUrlCache.set(mxcUrl, "");
  return "";
}

async function resolveRoomAvatarUrl(client, room) {
  return resolveMxcAvatarUrl(client, getRoomMxcAvatarUrl(room), room?.roomId);
}

async function resolveMemberAvatarUrl(client, room, senderId) {
  const member = room?.getMember?.(senderId);
  const mxcUrl = member?.getMxcAvatarUrl?.();

  return resolveMxcAvatarUrl(client, mxcUrl, room?.roomId);
}

function buildRoomMessages(room, limit = ROOM_MESSAGES_LIMIT) {
  const events = room?.getLiveTimeline?.()?.getEvents?.() || [];

  return events
    .filter((event) => {
      if (event?.getType?.() === "m.room.message") return true;
      return event?.isEncrypted?.() && event.getClearContent?.();
    })
    .map((event, index) => {
      const content =
        event.getType?.() === "m.room.message" ? event.getContent?.() || {} : event.getClearContent?.() || {};
      const body = typeof content.body === "string" ? content.body : "";
      const formattedBody =
        content.format === "org.matrix.custom.html" && typeof content.formatted_body === "string"
          ? content.formatted_body
          : "";

      if (!body.trim() && !formattedBody.trim()) return null;

      const senderId = event.getSender?.() || "";
      const member = room.getMember?.(senderId);
      const sender = member?.name || member?.rawDisplayName || senderId || "Неизвестный пользователь";
      const timestamp = Number(event.getTs?.()) || 0;

      return {
        eventId: event.getId?.() || `${senderId}-${timestamp}-${index}`,
        senderId,
        sender,
        body,
        formattedBody,
        timestamp,
      };
    })
    .filter(Boolean)
    .slice(-limit);
}

/**
 * `roomId` всех комнат, где пользователь в membership `join`, по алфавиту.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#getmymembership
 */
function getJoinedRoomIds() {
  const client = getMatrixClient();
  if (!client?.getRooms) return [];

  // KnownMembership.Join === "join"
  return client
    .getRooms()
    .filter((room) => room?.getMyMembership?.() === "join")
    .sort((a, b) =>
      getRoomDisplayName(a).localeCompare(getRoomDisplayName(b), undefined, {
        sensitivity: "base",
      }),
    )
    .map((room) => room.roomId);
}

const PRESENCE_LABELS = {
  online: "в сети",
  unavailable: "отошёл",
  offline: "не в сети",
};

function getMembersLabel(count) {
  const remainder = count % 10;
  const lastTwoDigits = count % 100;

  if (remainder === 1 && lastTwoDigits !== 11) return `${count} участник`;
  if (remainder >= 2 && remainder <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
    return `${count} участника`;
  }

  return `${count} участников`;
}

// Собеседник личной комнаты: только 1-на-1, иначе это группа.
function getRoomPeer(room, myUserId) {
  const joinedCount = room?.getJoinedMemberCount?.() || 0;
  if (joinedCount > 2) return null;

  const fallbackMember = room?.getAvatarFallbackMember?.();
  if (fallbackMember?.userId && fallbackMember.userId !== myUserId) {
    return fallbackMember;
  }

  const joined = room?.getJoinedMembers?.() || [];
  if (joined.length === 2) {
    return joined.find((member) => member.userId !== myUserId) || null;
  }

  return null;
}

// Статус собеседника берём напрямую (presence в sync-фильтр не запрошен).
async function getPeerStatusText(client, peer) {
  if (typeof client?.getPresence !== "function" || !peer?.userId) {
    return peer?.name || peer?.userId || "";
  }

  try {
    const status = await client.getPresence(peer.userId);
    const statusMsg = typeof status?.status_msg === "string" ? status.status_msg.trim() : "";
    if (statusMsg) return statusMsg;

    return PRESENCE_LABELS[status?.presence] || peer.name || peer.userId || "";
  } catch {
    return peer.name || peer.userId || "";
  }
}

async function getRoomSubtitle(client, room) {
  const myUserId = client?.getUserId?.();
  const peer = getRoomPeer(room, myUserId);

  if (peer) return getPeerStatusText(client, peer);

  const count = room?.getJoinedMemberCount?.() || 0;
  return count > 0 ? getMembersLabel(count) : "";
}

/**
 * Сериализуемый снимок метаданных комнаты для UI (имя, аватар, подпись).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html
 */
async function getRoomMeta(roomId) {
  const client = getMatrixClient();
  const room = client?.getRoom?.(roomId);
  if (!room) return null;

  return {
    roomId,
    name: getRoomDisplayName(room),
    avatarUrl: await resolveRoomAvatarUrl(client, room),
    subtitle: await getRoomSubtitle(client, room),
  };
}

/**
 * Снимок сообщений активной комнаты из таймлайна SDK (с аватарами отправителей).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#getlivetimeline
 * @see https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3roomsroomidmessages
 */
async function getRoomMessages(roomId, limit = ROOM_MESSAGES_LIMIT) {
  const client = getMatrixClient();
  const room = client?.getRoom?.(roomId);
  if (!room) return [];

  const messages = buildRoomMessages(room, limit);
  const senderIds = [...new Set(messages.map((message) => message.senderId).filter(Boolean))];
  const senderAvatarEntries = await Promise.all(
    senderIds.map(async (senderId) => [senderId, await resolveMemberAvatarUrl(client, room, senderId)]),
  );
  const senderAvatarUrls = new Map(senderAvatarEntries);

  return messages.map((message) => ({
    ...message,
    avatarUrl: senderAvatarUrls.get(message.senderId) || "",
  }));
}

/**
 * Дельта-подписка на список комнат: INITIALIZE / PUT / DELETE одного roomId.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#getrooms
 * @see https://spec.matrix.org/latest/client-server-api/#syncing
 */
function watchRoomList(onChange) {
  const client = getMatrixClient();
  if (!client?.on) return () => {};

  const handleRoom = (room) => {
    if (room?.getMyMembership?.() === "join") {
      onChange?.({ type: "PUT", roomId: room.roomId });
    }
  };

  const handleMembershipChange = (room) => {
    if (room?.getMyMembership?.() === "join") {
      onChange?.({ type: "PUT", roomId: room.roomId });
    } else {
      onChange?.({ type: "DELETE", roomId: room.roomId });
    }
  };

  const handleDeleteRoom = (roomId) => {
    onChange?.({ type: "DELETE", roomId });
  };

  onChange?.({ type: "INITIALIZE", roomIds: getJoinedRoomIds() });

  client.on("Room", handleRoom);
  client.on("Room.myMembership", handleMembershipChange);
  client.on("deleteRoom", handleDeleteRoom);

  return () => {
    client.removeListener("Room", handleRoom);
    client.removeListener("Room.myMembership", handleMembershipChange);
    client.removeListener("deleteRoom", handleDeleteRoom);
  };
}

/**
 * Подписка на сообщения активной комнаты (данные — в SDK, отдаём снимок).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#getlivetimeline
 */
function watchRoomMessages(roomId, onChange) {
  const client = getMatrixClient();
  if (!client?.on || !roomId) return () => {};

  let disposed = false;

  const emit = async () => {
    if (disposed) return;
    const messages = await getRoomMessages(roomId);
    if (!disposed) onChange?.(messages);
  };

  const handleTimeline = (_event, room) => {
    if (room?.roomId === roomId) emit();
  };
  const handleDecrypted = (event) => {
    if (event?.getRoomId?.() === roomId) emit();
  };

  client.on("Room.timeline", handleTimeline);
  client.on("Event.decrypted", handleDecrypted);
  emit();

  return () => {
    disposed = true;
    client.removeListener("Room.timeline", handleTimeline);
    client.removeListener("Event.decrypted", handleDecrypted);
  };
}

export { clearRoomAvatarCache, getJoinedRoomIds, getRoomMessages, getRoomMeta, watchRoomList, watchRoomMessages };
