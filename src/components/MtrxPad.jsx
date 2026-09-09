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
import { useEffect, useState } from "react";

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

function MtrxPad(props) {
  if (import.meta.env.DEV) console.log("MtrxPad hook");

  const { mtrxControlRdcr, mtrxControlActions } = props;

  const {
    handleChangeStore,
    handleLoadRooms,
    handleStartRoomWatch,
    handleStopRoomWatch,
  } = mtrxControlActions;

  const rooms = mtrxControlRdcr.rooms || [];
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const selectedRoom = rooms.find((room) => room.roomId === selectedRoomId);

  useEffect(() => {
    if (import.meta.env.DEV) console.log("MtrxPad MOUNT");

    return () => {
      if (import.meta.env.DEV) console.log("MtrxPad UNMOUNT");
    };
  }, []);

  useEffect(() => {
    if (mtrxControlRdcr.status !== "success") {
      setSelectedRoomId("");
      return;
    }

    handleLoadRooms();
    handleStartRoomWatch();
    return () => handleStopRoomWatch();
  }, [
    mtrxControlRdcr.status,
    handleLoadRooms,
    handleStartRoomWatch,
    handleStopRoomWatch,
  ]);

  const handleClose = () => {
    handleChangeStore("displayPad", false);
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
        p: { xs: 1, sm: 1.5 },
        borderRadius: 3,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        sx={{
          minHeight: 48,
          px: 0.5,
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
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
        <IconButton
          aria-label="Закрыть мессенджер"
          onClick={handleClose}
          sx={{ flexShrink: 0 }}
        >
          <IconClose color="action" />
        </IconButton>
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
          pt: { xs: 1, sm: 1.5 },
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
            onSelect={(room) => setSelectedRoomId(room.roomId)}
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
  mtrxControlRdcr: PropTypes.object.isRequired,
  mtrxControlActions: PropTypes.object.isRequired,
  showInput: PropTypes.bool.isRequired,
};

export default MtrxPad;
