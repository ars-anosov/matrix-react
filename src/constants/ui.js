// Фон «шапок»: панель мессенджера и шапка комнаты.
export const HEADER_BACKGROUND = "grey.100";

// Presence не приходит в sync-фильтре, поэтому статус выбранной комнаты
// обновляем лёгким polling'ом (мс).
export const ROOM_STATUS_REFRESH_MS = 30000;

// Сколько последних сообщений комнаты отдаём в UI.
export const ROOM_MESSAGES_LIMIT = 20;
