import { Avatar, Box, List, ListItemAvatar, ListItemButton, ListItemText, Typography } from "@mui/material";
import PropTypes from "prop-types";

import { PAPER_BACKGROUND } from "../theme.js";

function getRoomInitial(name = "") {
  return name.trim().charAt(0).toUpperCase() || "#";
}

// Бейдж не раздуваем: больше 99 показываем как «99+»
function formatUnreadCount(count) {
  return count > 99 ? "99+" : String(count);
}

// Логин в сравнимый вид: без «@» и регистра, домен — отдельно
function splitLogin(value) {
  const [localpart = "", domain = ""] = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .split(":");

  return { localpart, domain };
}

/**
 * Один и тот же логин: домен сравниваем, только если он указан с обеих сторон —
 * «test2» и «@test2:server» это один логин, а «@test2:a» и «@test2:b» — разные.
 */
export function isSameLogin(left, right) {
  const a = splitLogin(left);
  const b = splitLogin(right);
  if (!a.localpart || !b.localpart || a.localpart !== b.localpart) return false;

  return !a.domain || !b.domain || a.domain === b.domain;
}

/**
 * Комната подходит под запрос: логин встречается в имени подстрокой или
 * совпадает с именем комнаты либо с её собеседником (личный чат).
 */
export function matchesRoomQuery(room, query) {
  const needle = String(query || "")
    .trim()
    .toLowerCase();
  if (!needle) return true;

  if (
    String(room.name || "")
      .toLowerCase()
      .includes(needle)
  )
    return true;

  return isSameLogin(room.name, query) || isSameLogin(room.peerId, query);
}

/**
 * Фильтр списка по введённому логину: пустой запрос ничего не отсеивает.
 */
export function filterRoomsByQuery(rooms, query = "") {
  if (!String(query || "").trim()) return rooms;

  return rooms.filter((room) => matchesRoomQuery(room, query));
}

function MtrxRoomList({ rooms, selectedRoomId = "", filter = "", onSelect, fullHeight = false }) {
  const visibleRooms = filterRoomsByQuery(rooms, filter);

  if (visibleRooms.length === 0) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          height: fullHeight ? "100%" : undefined,
          bgcolor: PAPER_BACKGROUND,
          display: fullHeight ? "flex" : undefined,
          alignItems: fullHeight ? "center" : undefined,
          justifyContent: fullHeight ? "center" : undefined,
          px: 1,
          py: 2,
          textAlign: "center",
        }}
      >
        {rooms.length === 0 ? "В этом аккаунте пока нет комнат." : "Ничего не найдено."}
      </Typography>
    );
  }

  return (
    <List
      disablePadding
      aria-label="Список комнат"
      sx={{
        height: fullHeight ? "100%" : undefined,
        maxHeight: fullHeight ? undefined : 360,
        bgcolor: PAPER_BACKGROUND,
        overflowY: "auto",
        scrollbarWidth: "thin",
      }}
    >
      {visibleRooms.map((room) => (
        <ListItemButton
          key={room.roomId}
          selected={room.roomId === selectedRoomId}
          onClick={() => onSelect(room)}
          sx={{
            // Плотный список: строка ниже, но остаётся удобной для клика
            minHeight: 40,
            px: 1,
            py: 0.5,
            my: 0.25,
            borderRadius: 2,
            transition: "all 150ms ease",
            "&.Mui-selected": {
              bgcolor: "action.selected",
              "& .MuiListItemText-primary": {
                color: "primary.main",
              },
            },
            "&.Mui-selected:hover": {
              bgcolor: "action.selected",
            },
          }}
        >
          <ListItemAvatar sx={{ minWidth: 36 }}>
            <Avatar
              src={room.avatarUrl || undefined}
              alt=""
              sx={{
                width: 28,
                height: 28,
                bgcolor: "action.selected",
                color: "text.primary",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {getRoomInitial(room.name)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={room.name}
            // У ListItemText есть собственные margin'ы (ListItemText.js:52) —
            // для плотного списка уменьшаем их до 2px
            sx={{ my: 0.25 }}
            // Второй строкой: в узкой колонке бейдж справа сжимает название.
            // Приглашение важнее типа комнаты, поэтому проверяем его первым.
            secondary={room.membership === "invite" ? "Приглашение" : room.isSpace ? "Пространство" : undefined}
            slotProps={{
              // lineHeight задаём через sx: у Typography это не системный prop,
              // иначе он уходит атрибутом в DOM (React warning)
              primary: { noWrap: true, fontSize: 14, fontWeight: 600, sx: { lineHeight: 1.35 } },
              secondary: {
                noWrap: true,
                fontSize: 11,
                color: room.membership === "invite" ? "primary.main" : "text.secondary",
                fontWeight: room.membership === "invite" ? 600 : 400,
                sx: { lineHeight: 1.35 },
              },
            }}
          />
          {room.unread > 0 && (
            <Box
              component="span"
              aria-label={`Непрочитанных сообщений: ${room.unread}`}
              sx={{
                flexShrink: 0,
                ml: 1,
                minWidth: 20,
                height: 20,
                px: 0.75,
                borderRadius: 10,
                // Непрочитанное — всегда красным
                bgcolor: "error.main",
                color: "common.white",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {formatUnreadCount(room.unread)}
            </Box>
          )}
        </ListItemButton>
      ))}
    </List>
  );
}

MtrxRoomList.propTypes = {
  rooms: PropTypes.arrayOf(
    PropTypes.shape({
      roomId: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string,
      membership: PropTypes.oneOf(["join", "invite", ""]),
      isSpace: PropTypes.bool,
      unread: PropTypes.number,
      highlight: PropTypes.number,
    }),
  ).isRequired,
  selectedRoomId: PropTypes.string,
  filter: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  fullHeight: PropTypes.bool,
};

export default MtrxRoomList;
