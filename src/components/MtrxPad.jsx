import { Close as IconClose } from "@mui/icons-material";
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

import MtrxRoomList from "./MtrxRoomList";

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
        minWidth: 320,
        maxWidth: 500,
        width: "100%",
        minHeight: 200,
        mx: "auto",
        mt: 2,
        p: 1,
        borderRadius: 3,
        position: "relative",
      }}
    >
      <Stack
        direction="row"
        sx={{ mb: 1, alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="h6" color="primary">
          Matrix мессенджер
        </Typography>
        <Stack direction="row" spacing={1}>
          <IconButton
            onClick={handleClose}
            sx={{ position: "absolute", top: 4, right: 4 }}
          >
            <IconClose color="action" />
          </IconButton>
        </Stack>
      </Stack>

      <Divider sx={{ mb: 1 }} />

      <Box sx={{ maxHeight: 360, overflowY: "auto", pr: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Комнаты
        </Typography>

        <MtrxRoomList
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSelect={(room) => setSelectedRoomId(room.roomId)}
        />
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
