import {
  Close as IconClose,
  ForumOutlined as IconForum,
} from "@mui/icons-material";
import {
  Box,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";

import { HEADER_BACKGROUND } from "../constants/ui.js";
import MtrxRoom from "./MtrxRoom";
import MtrxRoomList from "./MtrxRoomList";

function getRoomCountLabel(count) {
  const remainder = count % 10;
  const lastTwoDigits = count % 100;

  if (remainder === 1 && lastTwoDigits !== 11) return `${count} комната`;
  if (
    remainder >= 2 &&
    remainder <= 4 &&
    (lastTwoDigits < 10 || lastTwoDigits >= 20)
  ) {
    return `${count} комнаты`;
  }

  return `${count} комнат`;
}

function MtrxPad({
  rooms,
  selectedRoomId,
  selectedRoom,
  onSelectRoom,
  onClose,
}) {
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
        borderRadius: 3,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <IconButton
        aria-label="Закрыть мессенджер"
        onClick={onClose}
        sx={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}
      >
        <IconClose color="action" />
      </IconButton>

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
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" color="primary" noWrap>
            Matrix мессенджер
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {rooms.length > 0
              ? getRoomCountLabel(rooms.length)
              : "Нет доступных комнат"}
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ flexShrink: 0 }} />

      <Box
        sx={{
          display: "grid",
          flex: 1,
          minHeight: 0,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "minmax(190px, 0.32fr) minmax(0, 1fr)",
          },
          gridTemplateRows: {
            xs: "minmax(150px, 0.38fr) minmax(0, 1fr)",
            sm: "minmax(0, 1fr)",
          },
          gap: { xs: 1, sm: 1.5 },
          p: { xs: 1, sm: 1.5 },
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            bgcolor: "background.default",
            p: 0.75,
            scrollbarWidth: "thin",
          }}
        >
          <MtrxRoomList
            rooms={rooms}
            selectedRoomId={selectedRoomId}
            onSelect={(room) => onSelectRoom(room.roomId)}
            fullHeight
          />
        </Box>

        <Box sx={{ minWidth: 0, minHeight: 0, overflow: "hidden" }}>
          {selectedRoom ? (
            <MtrxRoom room={selectedRoom} fullHeight />
          ) : (
            <Paper
              variant="outlined"
              sx={{
                height: "100%",
                minHeight: 220,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                p: 3,
                borderRadius: 3,
                color: "text.secondary",
                textAlign: "center",
              }}
            >
              <IconForum sx={{ fontSize: 40, opacity: 0.55 }} />
              <Typography variant="body1">
                Выберите комнату, чтобы открыть чат
              </Typography>
              <Typography variant="caption">
                Список комнат находится слева
              </Typography>
            </Paper>
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
    }),
  ).isRequired,
  selectedRoomId: PropTypes.string,
  selectedRoom: PropTypes.object,
  onSelectRoom: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MtrxPad;
