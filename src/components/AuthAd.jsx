import {
  AccountCircle,
  AdminPanelSettings,
  Close as IconClose,
  Login as IconLogin,
  Logout as IconLogout,
  Lock,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  Alert,
  Avatar,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { getStoredAdLogin } from "../services/adAuth";

function AdAuth(props) {
  const { authControlRdcr, authControlActions } = props;

  const [login, setLogin] = useState(() => getStoredAdLogin());
  const [password, setPassword] = useState("");
  const [uriAdAuth, setUriAdAuth] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Ошибку, закрытую крестиком алерта, прячем локально: Redux-статус ошибки
  // остаётся (его показывает индикатор AuthIco), но текст больше не мозолит глаза
  const [isErrDismissed, setIsErrDismissed] = useState(false);

  const isLoading = authControlRdcr.status === "loading";
  const isError = authControlRdcr.status === "error";
  const isSuccess = authControlRdcr.status === "success";
  const responseData = authControlRdcr.responseData;
  const errText = authControlRdcr.errText || "";
  const showError = isError && !isErrDismissed && Boolean(errText);

  // Синхронизируем URI из глобального стора при его изменении
  useEffect(() => {
    setUriAdAuth(authControlRdcr.uriAdAuth || "");
  }, [authControlRdcr.uriAdAuth]);

  const handleSubmit = (event) => {
    event.preventDefault();
    // Новая попытка входа показывает ошибку снова, даже если текст тот же
    setIsErrDismissed(false);
    if (!login.trim() || !password) return;
    authControlActions.handleAdRegister({ login, password, uriAdAuth });
  };

  const handleReset = () => {
    // setLogin('')
    setPassword("");
    setUriAdAuth(authControlRdcr.uriAdAuth || "");
    authControlActions.handleAdAuthClear();
  };

  const handleClose = () => {
    authControlActions.handleChangeStore("displayAd", false);
  };

  const isSubmitDisabled = isLoading || isSuccess || !login.trim() || !password || (import.meta.env.DEV && !uriAdAuth.trim());

  // Модальное окно: портал вне потока документа, поэтому форма не раздвигает
  // остальные компоненты; Escape и клик по подложке закрывают её через onClose.
  // Paper — сам тег form, поэтому Enter в поле отправляет запрос, а кнопки живут
  // в DialogActions (см. MUI → Dialog → Form dialog).
  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="adAuthTitle"
      aria-describedby="adAuthSubtitle"
      slotProps={{
        paper: {
          component: "form",
          onSubmit: handleSubmit,
          noValidate: true,
          sx: { borderRadius: 3 },
        },
      }}
    >
      {/* Кнопка закрытия формы в углу подложки */}
      <IconButton aria-label="Закрыть форму AD авторизации" onClick={handleClose} disabled={isLoading} sx={{ position: "absolute", top: 8, right: 8 }}>
        <IconClose color="action" />
      </IconButton>

      {/* Блок Логотипа и Заголовка: DialogTitle — единственный заголовок окна (h2) */}
      <DialogTitle id="adAuthTitle" variant="h5" sx={{ pt: 4, pb: 1, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
        <Avatar
          sx={{
            width: 56,
            height: 56,
            backgroundColor: isSuccess ? "success.light" : "primary.light",
            transition: "background-color 0.3s ease",
          }}
        >
          <AdminPanelSettings
            sx={{
              fontSize: 32,
              color: isSuccess ? "success.main" : "primary.main",
            }}
          />
        </Avatar>
        AD Авторизация
      </DialogTitle>

      {/* DialogContent после DialogTitle идёт без верхнего паддинга — это штатное
          правило MUI; первым элементом идёт подзаголовок, поэтому лейбл поля не обрезается */}
      <DialogContent>
        <DialogContentText id="adAuthSubtitle" variant="body2" sx={{ textAlign: "center", mb: 2.5 }}>
          {isSuccess ? responseData?.ad_cn || "" : "Введите учетные данные Active Directory"}
        </DialogContentText>

        <Stack spacing={2.5}>
          {/* Поле ввода Логина */}
          <TextField
            fullWidth
            required
            disabled={isLoading || isSuccess}
            id="adAuthLogin"
            label="Логин"
            variant="outlined"
            autoComplete="username"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AccountCircle color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Поле ввода Пароля */}
          <TextField
            fullWidth
            required
            disabled={isLoading || isSuccess}
            id="adAuthPassword"
            label="Пароль"
            type={showPassword ? "text" : "password"}
            autoComplete={showPassword ? "off" : "current-password"}
            variant="outlined"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="переключить видимость пароля"
                      onClick={() => setShowPassword((prev) => !prev)}
                      onMouseDown={(event) => event.preventDefault()}
                      edge="end"
                      disabled={isLoading || isSuccess}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Безопасный инпут API URI — рендерится только в DEV режиме */}
          {import.meta.env.DEV && (
            <TextField
              fullWidth
              required
              disabled={isLoading || isSuccess}
              id="uriAdAuth"
              label="API URI (Dev Only)"
              variant="outlined"
              size="small"
              value={uriAdAuth}
              onChange={(event) => setUriAdAuth(event.target.value)}
              sx={{ opacity: 0.8 }}
            />
          )}

          <Collapse in={showError}>
            {/* Алерт ошибки закрывается крестиком: отказ от входа не должен
                требовать повторной отправки формы */}
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

      {/* Блок управляющих кнопок */}
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {!isSuccess ? (
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
            Войти в систему
          </Button>
        ) : (
          <Button
            type="button"
            variant="contained"
            color="error"
            startIcon={<IconLogout />}
            size="large"
            fullWidth
            onClick={handleReset}
            disabled={isLoading}
            sx={{ py: 1.3, fontWeight: "bold", borderRadius: 2 }}
          >
            Выйти
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

AdAuth.propTypes = {
  authControlRdcr: PropTypes.shape({
    uriAdAuth: PropTypes.string,
    status: PropTypes.string,
    errText: PropTypes.string,
    responseData: PropTypes.shape({
      ad_login: PropTypes.string,
      ad_cn: PropTypes.string,
      ad_title: PropTypes.string,
      ad_department: PropTypes.string,
      mtrx_login: PropTypes.string,
      mtrx_password: PropTypes.string,
      mtrx_user_id: PropTypes.string,
    }),
  }).isRequired,
  authControlActions: PropTypes.shape({
    handleAdRegister: PropTypes.func.isRequired,
    handleChangeStore: PropTypes.func.isRequired,
    handleAdAuthClear: PropTypes.func.isRequired,
  }).isRequired,
};

export default AdAuth;
