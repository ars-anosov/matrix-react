import {
  CheckCircle as IconCheckCircle,
  Close as IconClose,
  RestartAlt as IconRestartAlt,
  Security as IconSecurity,
  VpnKey as IconVpnKey,
} from "@mui/icons-material";
import { Alert, Avatar, Box, Button, CircularProgress, Divider, Grid, IconButton, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";
import { VERIFICATION_ERR } from "../constants/verification.js";

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

// Коды ошибок, которые говорят не про неверный ключ, поэтому показываем
// предупреждение, а не ошибку
const WARNING_ERR_CODES = new Set([VERIFICATION_ERR.SYNC_INCOMPLETE]);

// Приватных ключей кросс-подписи нет нигде — устройство не подписать: предлагаем
// сброс шифрования (новая идентичность) или авторизацию с другого устройства
const RESET_ERR_CODES = new Set([VERIFICATION_ERR.CROSS_SIGNING_MISSING, VERIFICATION_ERR.RESET_FAILED]);

// Чем выйти из состояния ошибки: у каждой причины свой шаг
const RETRY_LABELS = {
  [VERIFICATION_ERR.SYNC_INCOMPLETE]: "Повторить",
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
    handleCreateSecretStorage,
    handleRequestDeviceVerification,
    handleResetEncryption,
    handleStartDeviceVerification,
    handleVerifyDeviceWithRecoveryKey,
  } = mtrxControlActions;

  // Ключ из поля ввода: verification.recoveryKey — это уже созданный новый ключ
  const [recoveryKeyInput, setRecoveryKeyInput] = useState("");
  // Подтверждение необратимого создания Secret Storage: первый клик показывает
  // предупреждение, второй запускает создание
  const [isConfirmCreate, setIsConfirmCreate] = useState(false);
  // «Я сохранил ключ» убирает карточку нового ключа и возвращает форму ввода,
  // чтобы этим ключом можно было авторизовать текущее устройство
  const [isKeyAcknowledged, setIsKeyAcknowledged] = useState(false);
  // Подтверждение сброса шифрования: пароль нужен серверу для UIA
  const [isConfirmReset, setIsConfirmReset] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const status = verification?.status || "idle";
  const emoji = verification?.sas?.emoji || [];
  const isActive = ["requested", "ready", "started"].includes(status);
  const isSuccess = status === "success" && verification?.verified;
  // Карточка нового ключа — своё состояние со своим главным действием
  const isCreatedKeyView = Boolean(verification.recoveryKey) && !isKeyAcknowledged;
  // Пока идёт операция (запрос/SAS/сброс) или показан новый ключ, сброс не предлагаем
  const canReset = status !== "loading" && !isActive && !isCreatedKeyView;

  const handleClose = () => {
    if (isActive) {
      handleCancelDeviceVerification();
    } else {
      handleClearDeviceVerification();
    }
    onClose();
  };

  // После ошибки возвращаем форму: при незавершённом sync повторяем с тем же ключом
  const handleRetry = () => {
    if (verification.errCode === VERIFICATION_ERR.SYNC_INCOMPLETE) {
      handleVerifyDeviceWithRecoveryKey(recoveryKeyInput);
      return;
    }
    handleClearDeviceVerification();
  };

  const handleCreateStorage = () => {
    setIsConfirmCreate(false);
    handleCreateSecretStorage();
  };

  // Новый ключ уходит в поле ввода: дальше им можно авторизовать устройство
  const handleKeySaved = () => {
    setRecoveryKeyInput(verification.recoveryKey || "");
    setIsKeyAcknowledged(true);
  };

  const handleCancelReset = () => {
    setIsConfirmReset(false);
    setResetPassword("");
  };

  const handleReset = () => {
    setIsConfirmReset(false);
    handleResetEncryption(resetPassword);
  };

  const renderContent = () => {
    // Новый recovery key после создания Secret Storage: показываем его до конца
    // сессии — если окно закрыть сразу, ключ больше нигде не увидеть
    if (verification.recoveryKey && !isKeyAcknowledged) {
      return (
        <Stack spacing={2}>
          <Alert severity="success" sx={{ borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Хранилище секретов создано
            </Typography>
            <Typography variant="body2">Сохраните recovery key: им секреты аккаунта восстанавливаются на других устройствах.</Typography>
          </Alert>

          <Box
            component="code"
            sx={{
              display: "block",
              p: 1.5,
              borderRadius: 2,
              bgcolor: "action.hover",
              fontFamily: "monospace",
              fontSize: "0.8125rem",
              lineHeight: 1.6,
              wordBreak: "break-all",
              userSelect: "all",
            }}
          >
            {verification.recoveryKey}
          </Box>

          <Typography variant="body2" color="text.secondary">
            {verification.verified ? "Устройство авторизовано: Matrix может передавать ему ключи шифрования." : "Устройство пока не авторизовано."} Дальше
            откроется форма ввода ключа: им можно авторизовать текущее устройство. Ключ можно открыть здесь повторно до конца сессии.
          </Typography>

          <Button variant="contained" size="large" fullWidth onClick={handleKeySaved} sx={BUTTON_SX}>
            Я сохранил ключ
          </Button>
        </Stack>
      );
    }

    if (status === "loading") {
      return renderWaiting("Создаём запрос на авторизацию устройства…");
    }

    if (status === "requested") {
      return verification.initiatedByMe ? (
        renderWaiting("Запрос отправлен на другое устройство. Примите его там, чтобы продолжить.")
      ) : (
        <Stack spacing={1.5}>
          <Typography>Другое устройство просит подтвердить текущую сессию. Если вы ожидаете этот запрос, примите его.</Typography>
          <Button variant="contained" size="large" fullWidth startIcon={<IconSecurity />} onClick={handleAcceptDeviceVerification} sx={BUTTON_SX}>
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
          <Typography>Сравните эти emoji с кодами на другом устройстве. Они должны совпадать и идти в том же порядке.</Typography>
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
            <Button variant="contained" color="success" size="large" onClick={handleConfirmDeviceVerification} fullWidth sx={BUTTON_SX}>
              Совпадают
            </Button>
            <Button variant="outlined" color="error" size="large" onClick={handleCancelDeviceVerification} fullWidth sx={BUTTON_SX}>
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
      // «В аккаунте нет Secret Storage» и «ключ не подходит» — разные выходы,
      // поэтому у ошибки есть код (constants/verification.js)
      if (verification.errCode === VERIFICATION_ERR.NO_SECRET_STORAGE) {
        return (
          <Stack spacing={2}>
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                В аккаунте нет Secret Storage
              </Typography>
              <Typography variant="body2">
                Recovery key расшифровывает секреты аккаунта — кросс-подписи и ключ бэкапа, — а на этом homeserver их нет. Проверьте, что ключ и сессия
                относятся к одному аккаунту и одному homeserver.
              </Typography>
            </Alert>

            {isConfirmCreate ? (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  Создать новое хранилище секретов?
                </Typography>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  Секреты, зашифрованные другим ключом, новым ключом не открыть. Новый recovery key покажем здесь — его нужно сохранить.
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="contained" color="error" onClick={handleCreateStorage} sx={{ ...BUTTON_SX, py: 1 }}>
                    Создать
                  </Button>
                  <Button variant="text" color="inherit" onClick={() => setIsConfirmCreate(false)} sx={{ ...BUTTON_SX, py: 1 }}>
                    Отмена
                  </Button>
                </Stack>
              </Alert>
            ) : (
              <Button variant="contained" size="large" fullWidth startIcon={<IconVpnKey />} onClick={() => setIsConfirmCreate(true)} sx={BUTTON_SX}>
                Создать хранилище секретов
              </Button>
            )}
          </Stack>
        );
      }

      if (RESET_ERR_CODES.has(verification.errCode)) {
        return (
          <Stack spacing={2}>
            {verification.errCode === VERIFICATION_ERR.RESET_FAILED && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {verification.errText || "Не удалось сбросить шифрование."}
              </Alert>
            )}

            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Подписывать устройство нечем
              </Typography>
              <Typography variant="body2">
                В аккаунте нет приватных ключей кросс-подписи: ни на этом устройстве, ни в Secret Storage. Проверка с другого устройства подтверждает доверие
                только между вашими устройствами, а зелёный статус E2EE означает подпись устройства вашим ключом — создать её может только новая кросс-подпись.
              </Typography>
            </Alert>

            <Button variant="outlined" size="large" fullWidth onClick={handleRequestDeviceVerification} sx={BUTTON_SX}>
              Авторизовать с другого устройства
            </Button>
          </Stack>
        );
      }

      return (
        <Stack spacing={2}>
          <Alert severity={WARNING_ERR_CODES.has(verification.errCode) ? "warning" : "error"} sx={{ borderRadius: 2 }}>
            {verification.errText || "Не удалось авторизовать устройство."}
          </Alert>
          <Button variant="outlined" size="large" fullWidth onClick={handleRetry} sx={BUTTON_SX}>
            {RETRY_LABELS[verification.errCode] || "Ввести другой ключ"}
          </Button>
        </Stack>
      );
    }

    return (
      <Stack spacing={2.5}>
        <Typography>Авторизуйте текущую сессию с другого устройства</Typography>
        <Button variant="contained" size="large" fullWidth startIcon={<IconSecurity />} onClick={handleRequestDeviceVerification} sx={BUTTON_SX}>
          Запрос устройству
        </Button>
        <Typography>или используйте recovery key</Typography>
        <Box>
          <TextField
            label="Recovery key"
            value={recoveryKeyInput}
            onChange={(event) => setRecoveryKeyInput(event.target.value)}
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
          onClick={() => handleVerifyDeviceWithRecoveryKey(recoveryKeyInput)}
          disabled={!recoveryKeyInput.trim()}
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
      <IconButton aria-label="Закрыть" onClick={handleClose} size="small" sx={{ position: "absolute", top: 4, right: 4 }}>
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
          {isSuccess ? <IconCheckCircle sx={{ fontSize: 32, color: "success.main" }} /> : <IconSecurity sx={{ fontSize: 32, color: "primary.main" }} />}
        </Avatar>
        <Typography variant="h5" fontWeight="600" align="center">
          Авторизация устройства
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          {isSuccess ? "Устройство готово к передаче ключей" : "Подтвердите доверие между устройствами"}
        </Typography>
      </Stack>

      <Stack spacing={2.5}>{renderContent()}</Stack>

      {/* Сброс E2EE доступен в любом состоянии диалога, кроме моментов, когда
          операция уже идёт (запрос/SAS), и карточки нового ключа: там свои действия */}
      {canReset && (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 2 }} />

          {isConfirmReset ? (
            <Stack spacing={1.5}>
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                <Typography variant="body2" fontWeight="bold">
                  Сбросить E2EE?
                </Typography>
                <Typography variant="body2">
                  Будет создана новая кросс-подпись и это устройство станет доверенным. Все бэкапы ключей на сервере удаляются, Secret Storage и recovery key
                  станут новыми, а другие пользователи увидят у вас новый мастер-ключ.
                </Typography>
              </Alert>

              <TextField
                label="Пароль аккаунта"
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                autoComplete="current-password"
                fullWidth
                required
                slotProps={{ htmlInput: { "aria-label": "Пароль аккаунта" } }}
              />

              <Stack direction="row" spacing={1.5}>
                <Button variant="contained" color="error" fullWidth disabled={!resetPassword.trim()} onClick={handleReset} sx={{ ...BUTTON_SX, py: 1 }}>
                  Сбросить
                </Button>
                <Button variant="text" color="inherit" fullWidth onClick={handleCancelReset} sx={{ ...BUTTON_SX, py: 1 }}>
                  Отмена
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Button
              variant="outlined"
              color="error"
              size="large"
              fullWidth
              startIcon={<IconRestartAlt />}
              onClick={() => setIsConfirmReset(true)}
              sx={BUTTON_SX}
            >
              Сбросить E2EE
            </Button>
          )}
        </Box>
      )}
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
    // Код причины ошибки: по нему выбирается подсказка и действие
    errCode: PropTypes.string,
    // Новый recovery key после создания Secret Storage
    recoveryKey: PropTypes.string,
    sas: PropTypes.shape({
      emoji: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)),
    }),
  }).isRequired,
  mtrxControlActions: PropTypes.shape({
    handleAcceptDeviceVerification: PropTypes.func.isRequired,
    handleCancelDeviceVerification: PropTypes.func.isRequired,
    handleClearDeviceVerification: PropTypes.func.isRequired,
    handleConfirmDeviceVerification: PropTypes.func.isRequired,
    handleCreateSecretStorage: PropTypes.func.isRequired,
    handleRequestDeviceVerification: PropTypes.func.isRequired,
    handleResetEncryption: PropTypes.func.isRequired,
    handleStartDeviceVerification: PropTypes.func.isRequired,
    handleVerifyDeviceWithRecoveryKey: PropTypes.func.isRequired,
  }).isRequired,
  onClose: PropTypes.func.isRequired,
};

export default MtrxDeviceVerification;
