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
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

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
      return (
        <Typography align="center">
          Создаём запрос на авторизацию устройства…
        </Typography>
      );
    }

    if (status === "requested") {
      return verification.initiatedByMe ? (
        <Typography>
          Запрос отправлен на другое устройство. Примите его там, чтобы
          продолжить.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <Typography>
            Другое устройство просит подтвердить текущую сессию. Если вы
            ожидаете этот запрос, примите его.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            startIcon={<IconSecurity />}
            onClick={handleAcceptDeviceVerification}
          >
            Принять запрос
          </Button>
        </Stack>
      );
    }

    if (status === "ready") {
      return verification.initiatedByMe ? (
        <Stack spacing={1.5}>
          <Typography>
            Запрос принят. Запустите проверку и сравните emoji-коды на обоих
            устройствах.
          </Typography>
          <Button
            variant="contained"
            fullWidth
            onClick={handleStartDeviceVerification}
          >
            Начать проверку
          </Button>
        </Stack>
      ) : (
        <Typography>Ожидаем запуск проверки на другом устройстве…</Typography>
      );
    }

    if (status === "started" && emoji.length === 0) {
      return (
        <Typography align="center">
          Готовим emoji-коды для сравнения…
        </Typography>
      );
    }

    if (status === "started") {
      return (
        <Stack spacing={1.5}>
          <Typography>
            Сравните эти emoji с кодами на другом устройстве. Они должны
            совпадать и идти в том же порядке.
          </Typography>
          <Grid container spacing={1} justifyContent="center">
            {emoji.map(([symbol, name]) => (
              <Grid key={`${symbol}-${name}`} size={{ xs: 4, sm: 3 }}>
                <Box
                  sx={{
                    p: 0.75,
                    textAlign: "center",
                    backgroundColor: "action.hover",
                    borderRadius: 1.5,
                  }}
                >
                  <Typography variant="h4" component="span" display="block">
                    {symbol}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
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
              onClick={handleConfirmDeviceVerification}
              fullWidth
            >
              Совпадают
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleCancelDeviceVerification}
              fullWidth
            >
              Не совпадают
            </Button>
          </Stack>
        </Stack>
      );
    }

    if (isSuccess) {
      return (
        <Stack spacing={1} alignItems="center">
          <Typography variant="h6">Устройство авторизовано</Typography>
          <Typography color="text.secondary" align="center">
            Matrix может передавать этому устройству ключи шифрования.
          </Typography>
        </Stack>
      );
    }

    if (status === "cancelled") {
      return <Typography color="text.secondary">Проверка отменена.</Typography>;
    }

    if (status === "error") {
      return (
        <Alert severity="error" sx={{ borderRadius: 1.5 }}>
          {verification.errText || "Не удалось авторизовать устройство."}
        </Alert>
      );
    }

    return (
      <Stack spacing={2.5}>
        <Typography>Авторизуйте текущую сессию с другого устройства</Typography>
        <Button
          variant="contained"
          fullWidth
          startIcon={<IconSecurity />}
          onClick={handleRequestDeviceVerification}
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
            fullWidth
            required
            id="MtrxDeviceVerificationRecoveryKey"
            variant="outlined"
          />
        </Box>
        <Button
          variant="contained"
          fullWidth
          startIcon={<IconVpnKey />}
          onClick={() => handleVerifyDeviceWithRecoveryKey(recoveryKey)}
          disabled={!recoveryKey.trim()}
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
          {isSuccess
            ? "Устройство готово к передаче ключей"
            : "Подтвердите доверие между устройствами"}
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
