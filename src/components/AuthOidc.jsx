import { Close as IconClose, Key as IconKey, Login as IconLogin } from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

// Вход через Matrix Authentication Service (MAS, OAuth 2.0 / MSC2965). Сама форма только
// просит мост запустить переход (props onLogin): discovery, регистрация клиента и PKCE
// живут в services/masAuth.js, браузер уходит на authorization_endpoint MAS и возвращается
// уже с `?code=&state=`, поэтому форму закрывает редирект, а не успешный ответ. Сессию
// Matrix по токенам поднимает MTRXCTL_ по клику тумблера в AuthPad, а связывает шаги мост
// AuthContainer. Форма — модальный Dialog, как AuthRest/MtrxReg.
function AuthOidc(props) {
  const { authControlRdcr, authControlActions, onLogin, isMatrixUriMissing } = props;

  // Ошибку, закрытую крестиком алерта, прячем локально: статус ошибки в Redux остаётся
  const [isErrDismissed, setIsErrDismissed] = useState(false);

  const isLoading = authControlRdcr.oidcStatus === "loading";
  const isError = authControlRdcr.oidcStatus === "error";
  const errText = authControlRdcr.oidcErrText || "";
  const showError = isError && !isErrDismissed && Boolean(errText);
  // Issuer узнаётся из auth_metadata homeserver при первом входе и кэшируется сервисом
  const issuer = authControlRdcr.oidcIssuer || "";

  const handleSubmit = (event) => {
    event.preventDefault();
    // Новая попытка показывает ошибку снова, даже если текст тот же
    setIsErrDismissed(false);
    if (isLoading || isMatrixUriMissing) return;

    onLogin();
  };

  const handleClose = () => {
    // Закрытие формы сбрасывает неиспользованные токены: они одноразовые для запуска
    authControlActions.handleOidcClear();
  };

  const isSubmitDisabled = isLoading || isMatrixUriMissing;

  // Paper — сам тег form: Enter отправляет запрос, кнопки живут в DialogActions
  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="masAuthTitle"
      aria-describedby="masAuthSubtitle"
      slotProps={{
        paper: {
          component: "form",
          onSubmit: handleSubmit,
          noValidate: true,
          sx: { borderRadius: 3 },
        },
      }}
    >
      <IconButton aria-label="Закрыть форму входа через MAS" onClick={handleClose} sx={{ position: "absolute", top: 8, right: 8 }}>
        <IconClose color="action" />
      </IconButton>

      <DialogTitle
        id="masAuthTitle"
        variant="h5"
        sx={{ pt: 4, pb: 1, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
      >
        <Avatar sx={{ width: 56, height: 56, backgroundColor: "primary.light" }}>
          <IconKey sx={{ fontSize: 32, color: "primary.main" }} />
        </Avatar>
        MAS
      </DialogTitle>

      <DialogContent>
        <DialogContentText id="masAuthSubtitle" variant="body2" sx={{ textAlign: "center", mb: 2.5 }}>
          Вход через Matrix Authentication Service
        </DialogContentText>

        <Stack spacing={2.5}>
          {/* Адрес сервера авторизации не вводится: MAS объявляет себя через auth_metadata
              homeserver, а клиент регистрируется динамически (MSC2966) */}
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Сервер авторизации
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              {issuer || "определяется автоматически по homeserver"}
            </Typography>
          </Box>

          <Collapse in={showError}>
            <Alert
              severity="error"
              onClose={() => setIsErrDismissed(true)}
              slotProps={{ closeButton: { "aria-label": "Закрыть уведомление об ошибке" } }}
              sx={{ borderRadius: 2 }}
            >
              {errText}
            </Alert>
          </Collapse>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          startIcon={<IconLogin />}
          size="large"
          fullWidth
          disabled={isSubmitDisabled}
          sx={{ py: 1.3, fontWeight: "bold", borderRadius: 2 }}
        >
          {isLoading ? "Переходим в MAS…" : "Войти через MAS"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

AuthOidc.propTypes = {
  authControlRdcr: PropTypes.shape({
    displayOidc: PropTypes.bool,
    oidcIssuer: PropTypes.string,
    oidcStatus: PropTypes.oneOf(["idle", "loading", "ready", "success", "error"]),
    oidcErrText: PropTypes.string,
  }).isRequired,
  authControlActions: PropTypes.shape({
    handleOidcClear: PropTypes.func.isRequired,
  }).isRequired,
  // Мост к MTRXCTL_ живёт в AuthContainer: форма только просит запустить переход в MAS
  onLogin: PropTypes.func.isRequired,
  // В DEV вход невозможен без адреса homeserver — его подставляет мост
  isMatrixUriMissing: PropTypes.bool,
};

export default AuthOidc;
