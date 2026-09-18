import { ROOM_MESSAGES_LIMIT } from "../constants/ui.js";
import { getMatrixClient } from "./matrixClientStore.js";
import { downloadMediaFile, resolveImagePreviewUrl, uploadRoomMedia } from "./matrixMedia.js";

// Кэш резолвнутых аватарок (mxc → objectURL), чтобы не фетчить повторно
// и не плодить blob-URL без revoke.
const avatarUrlCache = new Map();

// RoomEvent.UnreadNotifications: строку держим здесь, чтобы сервис не тянул SDK
const ROOM_UNREAD_EVENT = "Room.UnreadNotifications";

// Account data со списком личных комнат: { "@user:server": ["!room:server"] }
const DIRECT_EVENT = "m.direct";

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

// Последнее имя комнаты из таймлайна. У комнаты, созданной в текущей сессии,
// `m.room.name` приходит только в timeline, а состояние и Room.name отстают.
function getTimelineRoomName(room) {
  const events = room?.getLiveTimeline?.()?.getEvents?.() || [];

  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].getType?.() !== "m.room.name") continue;

    const name = events[index].getContent?.()?.name;
    return typeof name === "string" ? name.trim() : "";
  }

  return "";
}

/**
 * Имя комнаты: явное событие `m.room.name` важнее вычисленного SDK, иначе
 * `Room.name` у комнаты без имени вернул бы сгенерированное «Empty room».
 *
 * У личной комнаты приоритет обратный: `m.room.name` — состояние комнаты,
 * одно на двоих, поэтому у собеседника в списке оказывался бы чужой логин.
 * Имя собеседника каждый клиент считает сам, поэтому для `direct` берём его.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#name
 */
function getRoomDisplayName(room, peer = null, direct = false) {
  if (!room) return "Без названия";

  if (direct && peer?.userId) return peer.name || peer.userId;

  const nameEvent = room.currentState?.getStateEvents?.("m.room.name", "");
  const stateName = nameEvent?.getContent?.()?.name;
  if (typeof stateName === "string" && stateName.trim()) return stateName.trim();

  // Таймлайн смотрим, только если события имени в состоянии нет вовсе:
  // пустое событие означает, что имя сняли, и подставлять старое нельзя
  if (!nameEvent) {
    const timelineName = getTimelineRoomName(room);
    if (timelineName) return timelineName;
  }

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

// Сообщения с вложениями: картинки, видео, аудио и файлы
const MEDIA_MSG_TYPES = new Set(["m.image", "m.video", "m.audio", "m.file"]);

// Контент события: у расшифрованного события SDK отдаёт clear-контент обоими путями
function getEventMessageContent(event) {
  if (event?.getType?.() === "m.room.message") return event.getContent?.() || {};

  return event?.getClearContent?.() || {};
}

function buildMediaInfo(source) {
  const info = source && typeof source === "object" ? source : {};

  return {
    mimetype: typeof info.mimetype === "string" ? info.mimetype : "",
    size: Number(info.size) || 0,
    width: Number(info.w) || 0,
    height: Number(info.h) || 0,
  };
}

/**
 * Дескриптор вложения для UI — только сериализуемые данные из `content`
 * (`url` либо зашифрованный `file`), без SDK-объектов.
 *
 * @see https://spec.matrix.org/latest/client-server-api/#mroommessage-msgtypes
 */
function buildMediaDescriptor(content) {
  const file = content?.file && typeof content.file === "object" ? content.file : null;
  const url = typeof content?.url === "string" ? content.url : "";
  const mxcUrl = url || (typeof file?.url === "string" ? file.url : "");
  if (!mxcUrl) return null;

  const info = buildMediaInfo(content.info);
  const infoSource = content.info && typeof content.info === "object" ? content.info : {};
  const thumbnailFile = infoSource.thumbnail_file && typeof infoSource.thumbnail_file === "object" ? infoSource.thumbnail_file : null;
  const thumbnailUrl =
    typeof infoSource.thumbnail_url === "string" ? infoSource.thumbnail_url : typeof thumbnailFile?.url === "string" ? thumbnailFile.url : "";
  const thumbnailInfo = buildMediaInfo(infoSource.thumbnail_info);

  return {
    url: mxcUrl,
    // `url` и `file` взаимоисключающие: `file` означает шифрованное вложение
    file: url ? null : file,
    ...info,
    thumbnail: thumbnailUrl ? { url: thumbnailUrl, file: thumbnailFile, ...thumbnailInfo, mimetype: thumbnailInfo.mimetype || info.mimetype } : null,
  };
}

/**
 * Подпись к медиа (spec v1.10): если `filename` отличается от `body`, то `body`
 * — это подпись, иначе `body` — имя файла.
 *
 * @see https://spec.matrix.org/latest/client-server-api/#media-captions
 */
function getMediaCaption(content) {
  const filename = typeof content?.filename === "string" ? content.filename : "";
  const body = typeof content?.body === "string" ? content.body : "";

  return filename && filename !== body ? body : "";
}

function buildRoomMessages(room, limit = ROOM_MESSAGES_LIMIT) {
  const events = room?.getLiveTimeline?.()?.getEvents?.() || [];

  return events
    .filter((event) => {
      if (event?.getType?.() === "m.room.message") return true;
      return event?.isEncrypted?.() && event.getClearContent?.();
    })
    .map((event, index) => {
      const content = getEventMessageContent(event);
      const body = typeof content.body === "string" ? content.body : "";
      const msgType = typeof content.msgtype === "string" ? content.msgtype : "";
      const media = MEDIA_MSG_TYPES.has(msgType) ? buildMediaDescriptor(content) : null;
      const caption = media ? getMediaCaption(content) : "";
      const formattedBody = content.format === "org.matrix.custom.html" && typeof content.formatted_body === "string" ? content.formatted_body : "";

      if (!media && !body.trim() && !formattedBody.trim()) return null;

      const senderId = event.getSender?.() || "";
      const member = room.getMember?.(senderId);
      const sender = member?.name || member?.rawDisplayName || senderId || "Неизвестный пользователь";
      const timestamp = Number(event.getTs?.()) || 0;

      return {
        eventId: event.getId?.() || `${senderId}-${timestamp}-${index}`,
        senderId,
        sender,
        // У медиа в body лежит подпись, а имя файла отдаём отдельным полем
        body: media ? caption : body,
        formattedBody: media && !caption ? "" : formattedBody,
        msgType: media ? msgType : "m.text",
        filename: media ? (typeof content.filename === "string" && content.filename.trim() ? content.filename.trim() : body) : "",
        media,
        timestamp,
      };
    })
    .filter(Boolean)
    .slice(-limit);
}

// Membership текущего пользователя: "join" | "invite" | "leave" | "ban" | "knock".
function getRoomMembership(room) {
  return room?.getMyMembership?.() || "";
}

// В список комнат попадают только те, где пользователь участник или приглашён.
function isListedMembership(membership) {
  return membership === "join" || membership === "invite";
}

// Пространство — комната с типом `m.space` (MSC1772), а не чат.
function isSpace(room) {
  return Boolean(room?.isSpaceRoom?.() ?? room?.getType?.() === "m.space");
}

/**
 * Комнаты внутри пространства: `m.space.child` (state_key — roomId ребёнка).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#isspaceroom
 * @see https://spec.matrix.org/latest/client-server-api/#spaces
 */
function getSpaceChildren(room) {
  const events = room?.currentState?.getStateEvents?.("m.space.child") || [];
  const client = getMatrixClient();
  const children = [];

  for (const event of events) {
    const roomId = event?.getStateKey?.();
    if (typeof roomId !== "string" || !roomId.startsWith("!") || children.some((child) => child.roomId === roomId)) continue;

    // Комнаты нет в клиенте — имени у неё не будет, и в списке появлялась
    // служебная строка «Без названия»; такую ссылку просто не показываем
    const childRoom = client?.getRoom?.(roomId);
    if (!childRoom) continue;

    children.push({
      roomId,
      name: getRoomDisplayName(childRoom),
    });
  }

  return children;
}

/**
 * Список комнат для UI: приглашения первыми, затем `join` по алфавиту,
 * пространства — в конце (это не чаты).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#getmymembership
 */
function getRoomList() {
  const client = getMatrixClient();
  if (!client?.getRooms) return [];

  const byName = (a, b) =>
    getRoomDisplayName(a).localeCompare(getRoomDisplayName(b), undefined, {
      sensitivity: "base",
    });

  // KnownMembership.Invite === "invite", KnownMembership.Join === "join"
  const rooms = client.getRooms();
  const invited = rooms.filter((room) => getRoomMembership(room) === "invite").sort(byName);
  const joined = rooms.filter((room) => getRoomMembership(room) === "join" && !isSpace(room)).sort(byName);
  const spaces = rooms.filter((room) => getRoomMembership(room) === "join" && isSpace(room)).sort(byName);

  return [...invited, ...joined, ...spaces].map((room) => ({
    roomId: room.roomId,
    membership: getRoomMembership(room),
    isSpace: isSpace(room),
    ...getRoomUnreadCounts(room),
  }));
}

/**
 * Счётчики непрочитанного: `total` — все новые сообщения, `highlight` — те,
 * что адресованы пользователю (упоминание). Значения строк совпадают с
 * `NotificationCountType` из matrix-js-sdk.
 *
 * Приглашение — событие, требующее действия, а не сообщение: таймлайна в такой
 * комнате нет, и счётчик SDK для неё всегда нулевой. Поэтому приглашение
 * показываем как одно непрочитанное — строка списка и суммарный бейдж получают
 * тот же красный счётчик, что и у непрочитанного сообщения.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html#getunreadnotificationcount
 */
function getRoomUnreadCounts(room) {
  // Приглашение важнее счётчика SDK: до вступления сообщений в комнате нет
  if (getRoomMembership(room) === "invite") return { unread: 1, highlight: 0 };

  if (typeof room?.getUnreadNotificationCount !== "function") return { unread: 0, highlight: 0 };

  return {
    unread: room.getUnreadNotificationCount("total") || 0,
    highlight: room.getUnreadNotificationCount("highlight") || 0,
  };
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

// Пишем личную комнату в account data `m.direct` — по этой метке и наш клиент,
// и другие (Element, Cinny) отличают личный чат от комнаты на двоих.
// Ошибку не пробрасываем: комната уже создана, а признак `direct` определится
// и по одному собеседнику.
//
// @see https://spec.matrix.org/latest/client-server-api/#direct-messaging
async function markDirectChat(client, userId, roomId) {
  if (!userId || !roomId) return;

  try {
    const current = client.getAccountData?.(DIRECT_EVENT)?.getContent?.() || {};
    const rooms = Array.isArray(current[userId]) ? current[userId] : [];
    if (rooms.includes(roomId)) return;

    await client.setAccountData(DIRECT_EVENT, { ...current, [userId]: [...rooms, roomId] });
  } catch (error) {
    console.warn("[matrixRooms] не удалось записать m.direct", roomId, error);
  }
}

// Комната 1-на-1 — личная, если это подтверждает метка `m.direct`, флаг
// `is_direct` из приглашения или имя комнаты, совпавшее с собеседником:
// прежняя версия клиента писала в `m.room.name` логин приглашённого.
function isDirectRoom(client, room, peer) {
  if (!room || !peer?.userId) return false;

  const direct = client.getAccountData?.(DIRECT_EVENT)?.getContent?.();
  if (direct && Object.values(direct).some((rooms) => Array.isArray(rooms) && rooms.includes(room.roomId))) {
    return true;
  }

  // Сервер ставит `is_direct` в `m.room.member` приглашённого
  if (peer.getDMInviter?.()) return true;

  const nameEvent = room.currentState?.getStateEvents?.("m.room.name", "");
  const roomName = nameEvent?.getContent?.()?.name;
  const value = typeof roomName === "string" ? roomName.trim() : "";
  // 1-на-1 без имени — это личный чат; с именем — только если имя и есть собеседник
  if (!value) return true;

  const localpart = String(peer.userId).replace(/^@/, "").split(":")[0].toLowerCase();
  const peerName = String(peer.name || "")
    .trim()
    .toLowerCase();
  const candidate = value.replace(/^@/, "").split(":")[0].toLowerCase();

  return candidate === localpart || candidate === peerName;
}

// Статус собеседника берём напрямую (presence в sync-фильтр не запрошен):
// `presence` UI использует для цвета плашки, `text` — для её подписи.
async function getPeerStatus(client, peer) {
  const fallback = { presence: "", text: peer?.name || peer?.userId || "" };
  if (typeof client?.getPresence !== "function" || !peer?.userId) return fallback;

  try {
    const status = await client.getPresence(peer.userId);
    const statusMsg = typeof status?.status_msg === "string" ? status.status_msg.trim() : "";
    const presence = typeof status?.presence === "string" ? status.presence : "";

    // Свой статус-текст важнее служебной подписи, но presence отдаём в любом случае
    return { presence, text: statusMsg || PRESENCE_LABELS[presence] || fallback.text };
  } catch {
    return fallback;
  }
}

// Кто пригласил: отправитель `m.room.member` текущего пользователя.
function getInviterName(room, myUserId) {
  const memberEvent = room?.currentState?.getStateEvents?.("m.room.member", myUserId);
  const senderId = memberEvent?.getSender?.() || "";
  if (!senderId) return "";

  const member = room?.getMember?.(senderId);
  return member?.name || member?.rawDisplayName || senderId;
}

async function getRoomSubtitle(client, room, peerStatus) {
  const myUserId = client?.getUserId?.();

  if (getRoomMembership(room) === "invite") {
    const inviter = getInviterName(room, myUserId);
    return inviter ? `Приглашение от ${inviter}` : "Приглашение в комнату";
  }

  if (peerStatus) return peerStatus.text;

  const count = room?.getJoinedMemberCount?.() || 0;
  return count > 0 ? getMembersLabel(count) : "";
}

/**
 * Сериализуемый снимок метаданных комнаты для UI (имя, аватар, подпись и
 * presence собеседника, membership, тип пространства и его дочерние комнаты).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.Room.html
 */
async function getRoomMeta(roomId) {
  const client = getMatrixClient();
  const room = client?.getRoom?.(roomId);
  if (!room) return null;

  const space = isSpace(room);
  // Собеседник личной комнаты: нужен и для подписи-статуса, и для поиска чата по логину
  const peer = space ? null : getRoomPeer(room, client?.getUserId?.());
  // Личная комната: имя в списке даёт собеседник, а не общее `m.room.name`
  const direct = space ? false : isDirectRoom(client, room, peer);
  const peerStatus = peer ? await getPeerStatus(client, peer) : null;

  return {
    roomId,
    name: getRoomDisplayName(room, peer, direct),
    avatarUrl: await resolveRoomAvatarUrl(client, room),
    subtitle: space ? "Пространство" : await getRoomSubtitle(client, room, peerStatus),
    membership: getRoomMembership(room),
    isSpace: space,
    // presence собеседника: UI красит по нему плашку статуса в шапке
    presence: peerStatus?.presence || "",
    // Собеседник личной комнаты: по нему UI понимает, что чат с этим логином уже есть
    peerId: peer?.userId ?? "",
    ...getRoomUnreadCounts(room),
    children: space ? getSpaceChildren(room) : [],
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
  const senderAvatarEntries = await Promise.all(senderIds.map(async (senderId) => [senderId, await resolveMemberAvatarUrl(client, room, senderId)]));
  const senderAvatarUrls = new Map(senderAvatarEntries);

  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      avatarUrl: senderAvatarUrls.get(message.senderId) || "",
      // Превью собираем только для картинок: остальные типы рисуются карточкой
      mediaPreviewUrl: message.media && message.msgType === "m.image" ? await resolveImagePreviewUrl(message.media) : "",
    })),
  );
}

/**
 * Дельта-подписка на список комнат: INITIALIZE / PUT / DELETE.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#getrooms
 * @see https://spec.matrix.org/latest/client-server-api/#syncing
 */
function watchRoomList(onChange) {
  const client = getMatrixClient();
  if (!client?.on) return () => {};

  const emitPut = (room) => {
    onChange?.({
      type: "PUT",
      roomId: room.roomId,
      membership: getRoomMembership(room),
      isSpace: isSpace(room),
      ...getRoomUnreadCounts(room),
    });
  };

  // RoomEvent.UnreadNotifications эмитит сама комната, клиент его не переиздаёт —
  // поэтому подписка на каждую комнату, а не на клиент
  const roomListeners = new Map();

  const attachRoom = (room) => {
    if (!room?.on || !room.roomId || roomListeners.has(room.roomId)) return;

    const listener = () => emitPut(room);
    room.on(ROOM_UNREAD_EVENT, listener);
    roomListeners.set(room.roomId, { room, listener });
  };

  const detachRoom = (roomId) => {
    const entry = roomListeners.get(roomId);
    if (!entry) return;

    entry.room.removeListener(ROOM_UNREAD_EVENT, entry.listener);
    roomListeners.delete(roomId);
  };

  const handleRoom = (room) => {
    if (!isListedMembership(getRoomMembership(room))) return;

    attachRoom(room);
    emitPut(room);
  };

  // Смена membership: приглашение → участие (PUT меняет метаданные комнаты),
  // выход/бан → комната уходит из списка.
  const handleMembershipChange = (room) => {
    if (isListedMembership(getRoomMembership(room))) {
      attachRoom(room);
      emitPut(room);
    } else {
      detachRoom(room.roomId);
      onChange?.({ type: "DELETE", roomId: room.roomId });
    }
  };

  const handleDeleteRoom = (roomId) => {
    detachRoom(roomId);
    onChange?.({ type: "DELETE", roomId });
  };

  // Чтение с другого устройства приходит receipt'ом — счётчики пересчитываем
  const handleReceipt = (_event, room) => {
    if (room?.roomId) emitPut(room);
  };

  const initialRooms = client.getRooms?.() || [];
  initialRooms.forEach((room) => {
    if (isListedMembership(getRoomMembership(room))) attachRoom(room);
  });

  onChange?.({ type: "INITIALIZE", rooms: getRoomList() });

  client.on("Room", handleRoom);
  client.on("Room.myMembership", handleMembershipChange);
  client.on("Room.receipt", handleReceipt);
  client.on("deleteRoom", handleDeleteRoom);

  return () => {
    client.removeListener("Room", handleRoom);
    client.removeListener("Room.myMembership", handleMembershipChange);
    client.removeListener("Room.receipt", handleReceipt);
    client.removeListener("deleteRoom", handleDeleteRoom);

    roomListeners.forEach(({ room, listener }) => {
      room.removeListener(ROOM_UNREAD_EVENT, listener);
    });
    roomListeners.clear();
  };
}

/**
 * Принимает приглашение (или входит в публичную комнату): POST /join/{roomId}.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#joinroom
 * @see https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3joinroomidoralias
 */
async function joinRoom(roomId) {
  const client = getMatrixClient();
  if (!client?.joinRoom) throw new Error("Клиент Matrix не инициализирован.");
  if (!roomId) throw new Error("Не указан идентификатор комнаты.");

  const room = await client.joinRoom(roomId);
  return { roomId: room?.roomId || roomId };
}

/**
 * Отклоняет приглашение или покидает комнату: POST /leave/{roomId}.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#leave
 * @see https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3roomsroomidleave
 */
async function leaveRoom(roomId) {
  const client = getMatrixClient();
  if (!client || typeof client.leave !== "function") {
    throw new Error("Клиент Matrix не инициализирован.");
  }
  if (!roomId) throw new Error("Не указан идентификатор комнаты.");

  await client.leave(roomId);
  return { roomId };
}

/**
 * Отправляет текстовое сообщение в комнату. Шифрование (если комната encrypted)
 * выполняет SDK внутри `sendEvent`.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#sendtextmessage
 * @see https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3roomsroomidsendeventtypetxnid
 */
async function sendRoomMessage(roomId, body) {
  const client = getMatrixClient();
  const text = typeof body === "string" ? body.trim() : "";

  if (typeof client?.sendTextMessage !== "function") {
    throw new Error("Клиент Matrix не инициализирован.");
  }
  if (!roomId) throw new Error("Не указан идентификатор комнаты.");
  if (!text) throw new Error("Сообщение не может быть пустым.");

  const { event_id: eventId } = await client.sendTextMessage(roomId, text);
  return { roomId, eventId };
}

/**
 * Отправляет файл в комнату: загрузка в content repository плюс `m.room.message`
 * с msgtype по типу файла. В шифрованной комнате файл шифруется (см. matrixMedia).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#uploadcontent
 * @see https://spec.matrix.org/latest/client-server-api/#content-repository
 */
async function sendRoomFile(roomId, file, { caption = "", onProgress } = {}) {
  return uploadRoomMedia(roomId, file, { caption, onProgress });
}

/**
 * Скачивает вложение сообщения в файл пользователя (при необходимости расшифровывает).
 */
async function downloadRoomFile(media, filename) {
  return downloadMediaFile(media, filename);
}

/**
 * Помечает комнату прочитанной: `m.read` receipt на последнее событие таймлайна.
 * По этому receipt сервер сбрасывает notification_count, и бейджи непрочитанного
 * гаснут (в том числе на других устройствах пользователя).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#sendreadreceipt
 * @see https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3roomsroomidreceiptreceipttypeeventid
 */
async function markRoomRead(roomId) {
  const client = getMatrixClient();
  const room = client?.getRoom?.(roomId);
  if (!room || typeof client.sendReadReceipt !== "function") return;

  const events = room.getLiveTimeline?.()?.getEvents?.() || [];
  const lastEvent = events[events.length - 1];
  if (!lastEvent) return;

  try {
    await client.sendReadReceipt(lastEvent);
  } catch (error) {
    // Прочитанность не критична для UI: ошибку только логируем
    if (import.meta.env.DEV) {
      console.warn("[matrixRooms] sendReadReceipt failed", roomId, error);
    }
  }
}

/**
 * Приводит ввод пользователя к Matrix ID: `test2` → `@test2:<домен текущего
 * пользователя>`, `@test2:server` и `test2:server` — к полному виду.
 */
function normalizeUserId(value, myUserId) {
  const userId = typeof value === "string" ? value.trim().replace(/^@/, "") : "";
  if (!userId) return "";

  if (userId.includes(":")) return `@${userId}`;

  const myId = String(myUserId || "");
  const domain = myId.slice(myId.indexOf(":") + 1);
  return domain ? `@${userId}:${domain}` : `@${userId}`;
}

const MXID_PATTERN = /^@[^\s:]+:[^\s:]+$/;

// Логин без домена: домен дописываем сами, поэтому требуем ASCII-локалпарт —
// иначе «не mxid» превратилось бы в два приглашения для опечаток
const LOCALPART_PATTERN = /^[a-z0-9._=+/-]+$/i;

// Список приглашаемых: нормализуем, отбрасываем пустые и себя, убираем дубли.
function normalizeInvitees(invitees, myUserId) {
  const list = Array.isArray(invitees) ? invitees : [];
  const normalized = [];

  for (const raw of list) {
    const value = typeof raw === "string" ? raw.trim().replace(/^@/, "") : "";
    if (!value) continue;

    if (!value.includes(":") && !LOCALPART_PATTERN.test(value)) {
      throw new Error(`Некорректный Matrix ID: ${String(raw).trim()}`);
    }

    const userId = normalizeUserId(value, myUserId);
    if (!userId || userId === myUserId) continue;

    if (!MXID_PATTERN.test(userId)) {
      throw new Error(`Некорректный Matrix ID: ${String(raw).trim()}`);
    }

    if (!normalized.includes(userId)) normalized.push(userId);
  }

  return normalized;
}

/**
 * Проверяет, что пользователь известен серверу: `GET /profile/{userId}`,
 * и возвращает его display name (пустую строку, если имени нет или профиль
 * недоступен). Неизвестный логин сервер отдаёт как 404 `M_NOT_FOUND` —
 * тогда комнату создавать нельзя.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#getprofileinfo
 * @see https://spec.matrix.org/latest/client-server-api/#get_matrixclientv3profileuserid
 */
async function assertUserExists(client, userId) {
  if (typeof client.getProfileInfo !== "function") return "";

  try {
    const profile = await client.getProfileInfo(userId);
    // Display name нужен вызывающему как отображаемое имя личного чата
    return typeof profile?.displayname === "string" ? profile.displayname.trim() : "";
  } catch (error) {
    if (error?.errcode === "M_NOT_FOUND" || error?.httpStatus === 404) {
      throw new Error(`Пользователь ${userId} не найден на сервере.`, { cause: error });
    }

    throw new Error(`Не удалось проверить пользователя ${userId} на сервере.`, { cause: error });
  }
}

/**
 * Создаёт комнату (`private_chat` — вход только по приглашению) и приглашает
 * в неё перечисленных пользователей. Пользователей предварительно проверяем
 * на сервере: с несуществующим логином комната не создаётся.
 *
 * Один приглашаемый — личный чат: `m.room.name` у него не ставим, иначе у
 * собеседника в списке висел бы логин инициатора; имя собеседника клиент
 * считает сам, а `is_direct` + `m.direct` помечают комнату как личную.
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#createroom
 * @see https://spec.matrix.org/latest/client-server-api/#post_matrixclientv3createroom
 * @see https://spec.matrix.org/latest/client-server-api/#mroomcreate
 * @see https://spec.matrix.org/latest/client-server-api/#direct-messaging
 */
async function createRoom({ name, invitees } = {}) {
  const client = getMatrixClient();
  if (typeof client?.createRoom !== "function") {
    throw new Error("Клиент Matrix не инициализирован.");
  }

  const invited = normalizeInvitees(invitees, client.getUserId?.());
  const direct = invited.length === 1;

  // Название нужно только комнате: у личного чата его заменяет имя собеседника
  const roomName = typeof name === "string" ? name.trim() : "";
  if (!direct && !roomName) throw new Error("Введите название комнаты.");

  const displayNames = new Map();
  for (const userId of invited) {
    displayNames.set(userId, await assertUserExists(client, userId));
  }

  // Preset.PrivateChat === "private_chat"
  const { room_id: roomId } = await client.createRoom({
    ...(direct ? {} : { name: roomName }),
    preset: "private_chat",
    is_direct: direct,
    invite: invited,
  });

  const peerId = direct ? invited[0] : "";
  if (direct) await markDirectChat(client, peerId, roomId);

  return {
    roomId,
    // Для личного чата — имя собеседника: под ним комната живёт в сторе до /sync
    name: direct ? displayNames.get(peerId) || peerId : roomName,
    peerId,
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

export {
  clearRoomAvatarCache,
  createRoom,
  downloadRoomFile,
  getRoomList,
  getRoomMessages,
  getRoomMeta,
  joinRoom,
  leaveRoom,
  markRoomRead,
  sendRoomFile,
  sendRoomMessage,
  watchRoomList,
  watchRoomMessages,
};
