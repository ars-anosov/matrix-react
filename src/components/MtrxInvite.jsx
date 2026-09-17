import { MailOutlined as IconMail } from "@mui/icons-material";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

// Приглашение в комнату: превью вместо таймлайна, принять или отклонить.
function MtrxInvite({ roomName, onAccept, onDecline }) {
  const [pending, setPending] = useState("");
  const [errText, setErrText] = useState("");

  const run = (kind, handler) => async () => {
    setPending(kind);
    setErrText("");

    try {
      await handler();
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[MtrxInvite] не удалось выполнить действие", error);
      setErrText(error?.message || "Не удалось выполнить действие.");
    } finally {
      // При успехе membership меняется и панель размонтируется;
      // сброс нужен на случай ошибки или задержки обновления списка
      setPending("");
    }
  };

  return (
    <Stack
      spacing={1.5}
      sx={{
        flex: 1,
        minHeight: 0,
        alignItems: "center",
        justifyContent: "center",
        px: 3,
        py: 4,
        textAlign: "center",
        bgcolor: "background.default",
        overflowY: "auto",
      }}
    >
      <IconMail sx={{ fontSize: 36, opacity: 0.55, color: "text.secondary" }} />

      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body1" fontWeight={600} color="text.primary">
          Вас пригласили в комнату
        </Typography>
        <Typography variant="subtitle1" color="text.primary" sx={{ overflowWrap: "anywhere" }}>
          {roomName}
        </Typography>
      </Box>

      {errText && (
        <Typography variant="caption" color="error">
          {errText}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
        <Button
          variant="contained"
          disableElevation
          disabled={Boolean(pending)}
          onClick={run("join", onAccept)}
          startIcon={pending === "join" ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          Принять
        </Button>
        <Button variant="outlined" color="inherit" disabled={Boolean(pending)} onClick={run("leave", onDecline)}>
          Отклонить
        </Button>
      </Stack>
    </Stack>
  );
}

MtrxInvite.propTypes = {
  roomName: PropTypes.string.isRequired,
  onAccept: PropTypes.func.isRequired,
  onDecline: PropTypes.func.isRequired,
};

export default MtrxInvite;
