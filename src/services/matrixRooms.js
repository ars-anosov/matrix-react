import { getMatrixClient } from "./matrixClientStore.js";

// Кэш резолвнутых аватарок (mxc → objectURL), чтобы не фетчить повторно
// и не плодить blob-URL без revoke.
const avatarUrlCache = new Map();
const ROOM_MESSAGES_LIMIT = 20;

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

async function resolveRoomAvatarUrl(client, room) {
  if (!client || !room) return "";

  const mxcUrl = getRoomMxcAvatarUrl(room);
  if (!mxcUrl || typeof client.mxcUrlToHttp !== "function") return "";

  if (avatarUrlCache.has(mxcUrl)) {
    return avatarUrlCache.get(mxcUrl);
  }

  const accessToken = client.getAccessToken?.();
  const authHeaders = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined;

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
          console.warn(
            "[matrixRooms] avatar fetch failed",
            room.roomId,
            url,
            response.status,
          );
        }
        continue;
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      avatarUrlCache.set(mxcUrl, objectUrl);
      return objectUrl;
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn("[matrixRooms] avatar fetch error", room.roomId, url, err);
      }
    }
  }

  avatarUrlCache.set(mxcUrl, "");
  return "";
}

function getRoomMessages(room, limit = ROOM_MESSAGES_LIMIT) {
  const events = room?.getLiveTimeline?.()?.getEvents?.() || [];

  return events
    .filter((event) => event?.getType?.() === "m.room.message")
    .map((event, index) => {
      const content = event.getContent?.() || {};
      const body = typeof content.body === "string" ? content.body : "";
      const formattedBody =
        content.format === "org.matrix.custom.html" &&
        typeof content.formatted_body === "string"
          ? content.formatted_body
          : "";

      if (!body.trim() && !formattedBody.trim()) return null;

      const senderId = event.getSender?.() || "";
      const member = room.getMember?.(senderId);
      const sender =
        member?.name || member?.rawDisplayName || senderId || "Неизвестный пользователь";
      const timestamp = Number(event.getTs?.()) || 0;

      return {
        eventId: event.getId?.() || `${senderId}-${timestamp}-${index}`,
        sender,
        body,
        formattedBody,
        timestamp,
      };
    })
    .filter(Boolean)
    .slice(-limit);
}

async function getJoinedRooms() {
  const client = getMatrixClient();
  if (!client?.getRooms) return [];

  // KnownMembership.Join === "join"
  const rooms = client
    .getRooms()
    .filter((room) => room?.getMyMembership?.() === "join")
    .sort((a, b) =>
      getRoomDisplayName(a).localeCompare(getRoomDisplayName(b), undefined, {
        sensitivity: "base",
      }),
    );

  const resolvedRooms = [];

  for (const room of rooms) {
    resolvedRooms.push({
      roomId: room.roomId,
      name: getRoomDisplayName(room),
      avatarUrl: await resolveRoomAvatarUrl(client, room),
      messages: getRoomMessages(room),
    });
  }

  return resolvedRooms;
}

function watchRoomChanges(onChange) {
  const client = getMatrixClient();
  if (!client) return () => {};

  // ClientEvent.Sync / ClientEvent.Room
  const handleSync = (state) => {
    if (["PREPARED", "SYNCING", "CATCHUP", "ERROR"].includes(state)) {
      onChange?.();
    }
  };

  const handleRoom = () => {
    onChange?.();
  };

  client.on("sync", handleSync);
  client.on("Room", handleRoom);

  return () => {
    client.removeListener("sync", handleSync);
    client.removeListener("Room", handleRoom);
  };
}

export { clearRoomAvatarCache, getJoinedRooms, watchRoomChanges };
