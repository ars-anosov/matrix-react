import { AddCommentOutlined as IconAddRoom, Close as IconClose, ForumOutlined as IconForum } from "@mui/icons-material";
import { Alert, alpha, Box, Divider, IconButton, InputAdornment, Paper, Stack, TextField, Typography, useTheme } from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

import { HEADER_BACKGROUND, PAPER_BACKGROUND } from "../theme.js";
import MtrxRoom from "./MtrxRoom";
import MtrxRoomList, { filterRoomsByQuery, isSameLogin } from "./MtrxRoomList";

function getRoomCountLabel(count) {
  const remainder = count % 10;
  const lastTwoDigits = count % 100;

  if (remainder === 1 && lastTwoDigits !== 11) return `${count} комната`;
  if (remainder >= 2 && remainder <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
    return `${count} комнаты`;
  }

  return `${count} комнат`;
}

function getSpaceCountLabel(count) {
  const remainder = count % 10;
  const lastTwoDigits = count % 100;

  if (remainder === 1 && lastTwoDigits !== 11) return `${count} пространство`;
  if (remainder >= 2 && remainder <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
    return `${count} пространства`;
  }

  return `${count} пространств`;
}

// Пространства не чаты: считаем их отдельно, чтобы счётчик не врал
function getRoomListLabel(rooms) {
  const spaceCount = rooms.filter((room) => room.isSpace).length;
  const roomCount = rooms.length - spaceCount;

  if (rooms.length === 0) return "Нет доступных комнат";

  const roomLabel = roomCount > 0 ? getRoomCountLabel(roomCount) : "";
  const spaceLabel = spaceCount > 0 ? getSpaceCountLabel(spaceCount) : "";

  return [roomLabel, spaceLabel].filter(Boolean).join(" · ");
}

// Чат уже есть, если совпал логин: он лежит в имени комнаты или в её собеседнике
function hasRoomForLogin(rooms, login) {
  if (!String(login || "").trim()) return false;

  return rooms.some((room) => isSameLogin(room.name, login) || isSameLogin(room.peerId, login));
}

function MtrxPad({
  rooms,
  selectedRoomId,
  selectedRoom,
  newRoomLogin,
  onNewRoomLoginChange,
  onSelectRoom,
  onClose,
  onCreateRoom,
  onSendMessage,
  onAcceptInvite,
  onDeclineInvite,
  onLeaveRoom,
}) {
  const theme = useTheme();
  // Кругляш кнопки создания — как у индикатора MtrxIco: тон в тон, с рамкой
  const createRoomColor = theme.palette.primary.main;
  const [isCreating, setIsCreating] = useState(false);
  const [createErrText, setCreateErrText] = useState("");

  const login = newRoomLogin.trim();
  // Введённый логин фильтрует список комнат и блокирует повторное создание чата
  const visibleRooms = filterRoomsByQuery(rooms, newRoomLogin);
  const hasExistingRoom = hasRoomForLogin(rooms, login);
  const canCreate = !isCreating && login.length > 0 && !hasExistingRoom;

  // Создание чата: логин берётся из Redux, название комнаты будет равно логину
  const handleCreate = async (event) => {
    event.preventDefault();
    if (!canCreate) return;

    setIsCreating(true);
    setCreateErrText("");

    try {
      await onCreateRoom(login);
      onNewRoomLoginChange("");
    } catch (error) {
      setCreateErrText(error?.message || "Не удалось создать чат.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Paper
      elevation={8}
      sx={{
        minWidth: { xs: 320, sm: 640 },
        maxWidth: 900,
        width: "100%",
        height: {
          xs: "min(680px, calc(100vh - 160px))",
          sm: "min(720px, calc(100vh - 140px))",
        },
        minHeight: { xs: 500, sm: 600 },
        mx: "auto",
        mt: 2,
        bgcolor: PAPER_BACKGROUND,
        borderRadius: 3,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <IconButton aria-label="Закрыть мессенджер" onClick={onClose} sx={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}>
        <IconClose color="action" />
      </IconButton>

      {/* Шапка — тот же дизайн, что у AuthPad.jsx: серая полоса HEADER_BACKGROUND
          с одним заголовком, сразу под ней Divider */}
      <Stack
        direction="row"
        sx={{
          minHeight: 48,
          pl: { xs: 1.5, sm: 2 },
          pr: 6,
          py: 0.5,
          alignItems: "center",
          flexShrink: 0,
          bgcolor: HEADER_BACKGROUND,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" color="primary" noWrap>
            Matrix мессенджер
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ flexShrink: 0 }} />

      {/* Новый чат: поле логина и кнопка создания — один контрол (кнопка внутри
          поля), вместе занимают половину ширины строки. Значение поля живёт в Redux,
          поэтому его может заполнить любой компонент */}
      <Box component="form" noValidate onSubmit={handleCreate} sx={{ px: { xs: 1.5, sm: 2 }, py: 0.5, mt: 1, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            placeholder="Логин"
            value={newRoomLogin}
            disabled={isCreating}
            onChange={(event) => onNewRoomLoginChange(event.target.value)}
            slotProps={{
              htmlInput: { "aria-label": "Логин" },
              input: {
                endAdornment: (
                  <InputAdornment position="end" sx={{ mr: -0.5 }}>
                    <IconButton
                      type="submit"
                      size="small"
                      aria-label="Создать чат"
                      disabled={!canCreate}
                      sx={{
                        width: 24,
                        height: 24,
                        color: createRoomColor,
                        backgroundColor: alpha(createRoomColor, 0.12),
                        border: `1px solid ${alpha(createRoomColor, 0.28)}`,
                        transition: theme.transitions.create(["background-color", "border-color", "transform"], {
                          duration: theme.transitions.duration.short,
                        }),
                        "&:hover": {
                          backgroundColor: alpha(createRoomColor, 0.2),
                          borderColor: alpha(createRoomColor, 0.45),
                          transform: "translateY(-1px)",
                        },
                        "&.Mui-disabled": {
                          color: alpha(createRoomColor, 0.4),
                          backgroundColor: alpha(createRoomColor, 0.06),
                          borderColor: alpha(createRoomColor, 0.16),
                        },
                        "& .MuiSvgIcon-root": {
                          fontSize: "0.9rem",
                        },
                      }}
                    >
                      <IconAddRoom fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: "50%", flexShrink: 0 }}
          />

          <Box sx={{ flex: 1, minWidth: 0 }} />

          <Typography variant="caption" color="text.secondary" noWrap sx={{ flexShrink: 0, display: { xs: "none", sm: "block" } }}>
            {getRoomListLabel(visibleRooms)}
          </Typography>
        </Stack>

        {hasExistingRoom ? (
          <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
            Чат с логином {login} уже есть
          </Alert>
        ) : (
          createErrText && (
            <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>
              {createErrText}
            </Alert>
          )
        )}
      </Box>

      <Box
        sx={{
          display: "grid",
          flex: 1,
          minHeight: 0,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "minmax(200px, 0.35fr) minmax(0, 1fr)",
          },
          gridTemplateRows: {
            xs: "minmax(150px, 0.38fr) minmax(0, 1fr)",
            sm: "minmax(0, 1fr)",
          },
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
            borderRight: { sm: 1 },
            borderBottom: { xs: 1, sm: 0 },
            borderColor: "divider",
            bgcolor: PAPER_BACKGROUND,
            p: 1,
            scrollbarWidth: "thin",
          }}
        >
          <MtrxRoomList rooms={rooms} selectedRoomId={selectedRoomId} filter={newRoomLogin} onSelect={(room) => onSelectRoom(room.roomId)} fullHeight />
        </Box>

        <Box sx={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {selectedRoom ? (
            <MtrxRoom
              room={selectedRoom}
              fullHeight
              onSelectRoom={onSelectRoom}
              onSendMessage={onSendMessage}
              onAcceptInvite={onAcceptInvite}
              onDeclineInvite={onDeclineInvite}
              onLeaveRoom={onLeaveRoom}
            />
          ) : (
            <Box
              sx={{
                height: "100%",
                minHeight: 220,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                p: 3,
                color: "text.secondary",
                textAlign: "center",
                bgcolor: "background.paper",
              }}
            >
              <IconForum sx={{ fontSize: 40, opacity: 0.4 }} />
              <Typography variant="body1" fontWeight={500}>
                Выберите комнату, чтобы открыть чат
              </Typography>
              <Typography variant="caption">Список комнат находится слева</Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

MtrxPad.propTypes = {
  rooms: PropTypes.arrayOf(
    PropTypes.shape({
      roomId: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string,
      subtitle: PropTypes.string,
      membership: PropTypes.oneOf(["join", "invite", ""]),
      isSpace: PropTypes.bool,
      peerId: PropTypes.string,
      unread: PropTypes.number,
      highlight: PropTypes.number,
    }),
  ).isRequired,
  selectedRoomId: PropTypes.string,
  selectedRoom: PropTypes.object,
  newRoomLogin: PropTypes.string,
  onNewRoomLoginChange: PropTypes.func.isRequired,
  onSelectRoom: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onCreateRoom: PropTypes.func.isRequired,
  onSendMessage: PropTypes.func.isRequired,
  onAcceptInvite: PropTypes.func.isRequired,
  onDeclineInvite: PropTypes.func.isRequired,
  onLeaveRoom: PropTypes.func.isRequired,
};

export default MtrxPad;
