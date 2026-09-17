import { Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

// Подтверждение выхода из комнаты: действие необратимое, поэтому с диалогом.
function MtrxLeaveRoom({ open, roomName, onClose, onConfirm }) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [errText, setErrText] = useState("");

  const handleClose = () => {
    if (isLeaving) return;
    setErrText("");
    onClose();
  };

  const handleConfirm = async () => {
    if (isLeaving) return;

    setIsLeaving(true);
    setErrText("");

    try {
      await onConfirm();
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[MtrxLeaveRoom] не удалось выйти из комнаты", error);
      setErrText(error?.message || "Не удалось выйти из комнаты.");
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth aria-labelledby="mtrxLeaveRoomTitle">
      <DialogTitle id="mtrxLeaveRoomTitle" variant="h6">
        Покинуть комнату
      </DialogTitle>

      <DialogContent dividers>
        <DialogContentText sx={{ overflowWrap: "anywhere" }}>Выйти из комнаты «{roomName}»? Новые сообщения из неё приходить не будут.</DialogContentText>

        {errText && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 1.5 }}>
            {errText}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isLeaving}>
          Отмена
        </Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={isLeaving}
          startIcon={isLeaving ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Покинуть
        </Button>
      </DialogActions>
    </Dialog>
  );
}

MtrxLeaveRoom.propTypes = {
  open: PropTypes.bool.isRequired,
  roomName: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
};

export default MtrxLeaveRoom;
