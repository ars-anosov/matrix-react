// Presence не приходит в sync-фильтре, поэтому статус выбранной комнаты
// обновляем лёгким polling'ом (мс).
export const ROOM_STATUS_REFRESH_MS = 30000;

// Сколько последних сообщений комнаты отдаём в UI.
export const ROOM_MESSAGES_LIMIT = 20;

// Предел размера вложения на стороне UI. Homeserver может лимитировать строже —
// тогда отправку отклонит сам сервер (M_TOO_LARGE), и текст ошибки придёт в composer.
export const ROOM_FILE_MAX_SIZE = 50 * 1024 * 1024;
