import {
  CheckCircle as IconCheckCircle,
  Close as IconClose,
  Security as IconSecurity,
  VpnKey as IconVpnKey,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

// Единый стиль кнопок диалога — согласован с MtrxReg.
const BUTTON_SX = { py: 1.3, fontWeight: "bold", borderRadius: 2 };

// Плитка одного emoji-кода SAS.
const EMOJI_TILE_SX = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 0.25,
  py: 1.25,
  px: 0.5,
  minHeight: 64,
  borderRadius: 2,
  border: "1px solid",
  borderColor: "divider",
  backgroundColor: "action.hover",
  transition: (theme) => theme.transitions.create(["border-color", "background-color"]),
  "&:hover": {
    borderColor: "primary.main",
    backgroundColor: "action.selected",
  },
};

// Единое состояние ожидания: спиннер + подпись.
function renderWaiting(text) {
  return (
    <Stack spacing={2} sx={{ alignItems: "center", py: 1 }}>
      <CircularProgress size={28} />
      <Typography align="center" color="text.secondary">
        {text}
      </Typography>
    </Stack>
  );
}

function MtrxDeviceVerification(props) {
  const { open, verification, mtrxControlActions, onClose } = props;

  const {
    handleAcceptDeviceVerification,
    handleCancelDeviceVerification,
    handleClearDeviceVerification,
    handleConfirmDeviceVerification,
    handleRequestDeviceVerification,
    handleStartDeviceVerification,
    handleVerifyDeviceWithRecoveryKey,
  } = mtrxControlActions;

  const [recoveryKey, setRecoveryKey] = useState("");
  const status = verification?.status || "idle";
  const emoji = verification?.sas?.emoji || [];
  const isActive = ["requested", "ready", "started"].includes(status);
  const isSuccess = status === "success" && verification?.verified;

  const handleClose = () => {
    if (isActive) {
      handleCancelDeviceVerification();
    } else {
      handleClearDeviceVerification();
    }
    onClose();
  };

  const renderContent = () => {
    if (status === "loading") {
      return renderWaiting("Создаём запрос на авторизацию устройства…");
    }

    if (status === "requested") {
      return verification.initiatedByMe ? (
        renderWaiting("Запрос отправлен на другое устройство. Примите его там, чтобы продолжить.")
      ) : (
        <Stack spacing={1.5}>
          <Typography>
            Другое устройство просит подтвердить текущую сессию. Если вы ожидаете этот запрос, примите его.
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<IconSecurity />}
            onClick={handleAcceptDeviceVerification}
            sx={BUTTON_SX}
          >
            Принять запрос
          </Button>
        </Stack>
      );
    }

    if (status === "ready") {
      return verification.initiatedByMe ? (
        <Stack spacing={1.5}>
          <Typography>Запрос принят. Запустите проверку и сравните emoji-коды на обоих устройствах.</Typography>
          <Button variant="contained" size="large" fullWidth onClick={handleStartDeviceVerification} sx={BUTTON_SX}>
            Начать проверку
          </Button>
        </Stack>
      ) : (
        renderWaiting("Ожидаем запуск проверки на другом устройстве…")
      );
    }

    if (status === "started" && emoji.length === 0) {
      return renderWaiting("Готовим emoji-коды для сравнения…");
    }

    if (status === "started") {
      return (
        <Stack spacing={1.5}>
          <Typography>
            Сравните эти emoji с кодами на другом устройстве. Они должны совпадать и идти в том же порядке.
          </Typography>
          <Grid container spacing={1.5} sx={{ justifyContent: "center" }}>
            {emoji.map(([symbol, name], index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: SAS emoji-код может содержать повторы, порядок задан протоколом
              <Grid key={`${symbol}-${name}-${index}`} size={{ xs: 4, sm: 3 }}>
                <Box sx={EMOJI_TILE_SX}>
                  <Typography variant="h4" component="span" sx={{ lineHeight: 1 }}>
                    {symbol}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {name}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              color="success"
              size="large"
              onClick={handleConfirmDeviceVerification}
              fullWidth
              sx={BUTTON_SX}
            >
              Совпадают
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="large"
              onClick={handleCancelDeviceVerification}
              fullWidth
              sx={BUTTON_SX}
            >
              Не совпадают
            </Button>
          </Stack>
        </Stack>
      );
    }

    if (isSuccess) {
      return (
        <Alert severity="success" sx={{ borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Устройство авторизовано
          </Typography>
          <Typography variant="body2">Matrix может передавать этому устройству ключи шифрования.</Typography>
        </Alert>
      );
    }

    if (status === "cancelled") {
      return <Typography color="text.secondary">Проверка отменена.</Typography>;
    }

    if (status === "error") {
      return (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {verification.errText || "Не удалось авторизовать устройство."}
        </Alert>
      );
    }

    return (
      <Stack spacing={2.5}>
        <Typography>Авторизуйте текущую сессию с другого устройства</Typography>
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<IconSecurity />}
          onClick={handleRequestDeviceVerification}
          sx={BUTTON_SX}
        >
          Запрос устройству
        </Button>
        <Typography>или используйте recovery key.</Typography>
        <Box>
          <TextField
            label="Recovery key"
            value={recoveryKey}
            onChange={(event) => setRecoveryKey(event.target.value)}
            type="password"
            autoComplete="off"
            fullWidth
            required
            id="MtrxDeviceVerificationRecoveryKey"
            variant="outlined"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <IconVpnKey color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<IconVpnKey />}
          onClick={() => handleVerifyDeviceWithRecoveryKey(recoveryKey)}
          disabled={!recoveryKey.trim()}
          sx={BUTTON_SX}
        >
          recovery key
        </Button>
      </Stack>
    );
  };

  if (!open) return null;

  return (
    <Paper
      elevation={12}
      sx={{
        maxWidth: 400,
        width: { xs: "80vw", sm: "100%" },
        mx: "auto",
        mt: 2,
        p: { xs: 2, sm: 4 },
        borderRadius: 3,
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <IconButton
        aria-label="Закрыть"
        onClick={handleClose}
        size="small"
        sx={{ position: "absolute", top: 4, right: 4 }}
      >
        <IconClose color="action" />
      </IconButton>

      <Stack spacing={1} sx={{ alignItems: "center", mb: 4 }}>
        <Avatar
          sx={{
            width: 56,
            height: 56,
            backgroundColor: isSuccess ? "success.light" : "primary.light",
            mb: 1,
            transition: "background-color 0.3s ease",
          }}
        >
          {isSuccess ? (
            <IconCheckCircle sx={{ fontSize: 32, color: "success.main" }} />
          ) : (
            <IconSecurity sx={{ fontSize: 32, color: "primary.main" }} />
          )}
        </Avatar>
        <Typography variant="h5" fontWeight="600" align="center">
          Авторизация устройства
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          {isSuccess ? "Устройство готово к передаче ключей" : "Подтвердите доверие между устройствами"}
        </Typography>
      </Stack>

      <Stack spacing={2.5}>{renderContent()}</Stack>
    </Paper>
  );
}

MtrxDeviceVerification.propTypes = {
  open: PropTypes.bool.isRequired,
  verification: PropTypes.shape({
    status: PropTypes.string,
    verified: PropTypes.bool,
    initiatedByMe: PropTypes.bool,
    errText: PropTypes.string,
    sas: PropTypes.shape({
      emoji: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
    }),
  }).isRequired,
  mtrxControlActions: PropTypes.shape({
    handleAcceptDeviceVerification: PropTypes.func.isRequired,
    handleCancelDeviceVerification: PropTypes.func.isRequired,
    handleClearDeviceVerification: PropTypes.func.isRequired,
    handleConfirmDeviceVerification: PropTypes.func.isRequired,
    handleRequestDeviceVerification: PropTypes.func.isRequired,
    handleStartDeviceVerification: PropTypes.func.isRequired,
    handleVerifyDeviceWithRecoveryKey: PropTypes.func.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MtrxDeviceVerification;
