import {
  AccountCircle,
  Close as IconClose,
  Hub as IconHub,
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
import { useState } from "react";

function MtrxReg(props) {
  const { mtrxControlRdcr, mtrxControlActions } = props;

  const uriMatrix = mtrxControlRdcr.uriMatrix;
  const login = mtrxControlRdcr.login;
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const isLoading = mtrxControlRdcr.status === "loading";
  const isError = mtrxControlRdcr.status === "error";
  const isSuccess = mtrxControlRdcr.status === "success";
  const responseData = mtrxControlRdcr.responseData;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!login.trim() || !password.trim()) return;
    // Enter в поле отправляет форму мимо disabled-кнопки: повторный вход во время
    // запроса логинил бы в то же устройство и отзывал токены первой сессии
    if (isLoading || isSuccess) return;
    mtrxControlActions.handleRegister({ login, password, uriMatrix });
  };

  const handleReset = () => {
    mtrxControlActions.handleChangeStore("login", "");
    setPassword("");
    mtrxControlActions.handleRegClear();
  };

  const handleClose = () => {
    mtrxControlActions.handleChangeStore("displayReg", false);
  };

  const isSubmitDisabled = isLoading || isSuccess || !login.trim() || !password.trim() || (import.meta.env.DEV && !uriMatrix.trim());

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
      aria-labelledby="mtrxRegTitle"
      aria-describedby="mtrxRegSubtitle"
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
      <IconButton aria-label="Закрыть форму входа Matrix" onClick={handleClose} disabled={isLoading} sx={{ position: "absolute", top: 8, right: 8 }}>
        <IconClose color="action" />
      </IconButton>

      {/* Блок Логотипа и Заголовка: DialogTitle — единственный заголовок окна (h2) */}
      <DialogTitle
        id="mtrxRegTitle"
        variant="h5"
        sx={{ pt: 4, pb: 1, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}
      >
        <Avatar
          sx={{
            width: 56,
            height: 56,
            backgroundColor: isSuccess ? "success.light" : "primary.light",
            transition: "background-color 0.3s ease",
          }}
        >
          <IconHub
            sx={{
              fontSize: 32,
              color: isSuccess ? "success.main" : "primary.main",
            }}
          />
        </Avatar>
        Matrix
      </DialogTitle>

      {/* DialogContent после DialogTitle идёт без верхнего паддинга — это штатное
          правило MUI; первым элементом идёт подзаголовок, поэтому лейбл поля не обрезается */}
      <DialogContent>
        <DialogContentText id="mtrxRegSubtitle" variant="body2" sx={{ textAlign: "center", mb: 2.5 }}>
          {isSuccess ? responseData?.display_name || responseData?.user_id || "" : "Введите учетные данные"}
        </DialogContentText>

        <Stack spacing={2.5}>
          <TextField
            fullWidth
            required
            disabled={isLoading || isSuccess}
            id="MtrxRegLogin"
            label="Логин"
            variant="outlined"
            autoComplete="username"
            value={login}
            onChange={(event) => mtrxControlActions.handleChangeStore("login", event.target.value)}
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

          <TextField
            fullWidth
            required
            disabled={isLoading || isSuccess}
            id="MtrxRegPassword"
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

          {import.meta.env.DEV && (
            <TextField
              fullWidth
              required
              disabled={isLoading || isSuccess}
              id="uriMatrix"
              label="Matrix URI (Dev Only)"
              variant="outlined"
              size="small"
              value={uriMatrix}
              onChange={(event) => mtrxControlActions.handleChangeStore("uriMatrix", event.target.value)}
              sx={{ opacity: 0.8 }}
            />
          )}

          <Collapse in={isError}>
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {mtrxControlRdcr.errText}
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

MtrxReg.propTypes = {
  mtrxControlRdcr: PropTypes.shape({
    uriMatrix: PropTypes.string,
    login: PropTypes.string,
    status: PropTypes.string,
    errText: PropTypes.string,
    responseData: PropTypes.shape({
      user_id: PropTypes.string,
      display_name: PropTypes.string,
      device_id: PropTypes.string,
    }),
  }).isRequired,
  mtrxControlActions: PropTypes.shape({
    handleRegister: PropTypes.func.isRequired,
    handleChangeStore: PropTypes.func.isRequired,
    handleRegClear: PropTypes.func.isRequired,
  }).isRequired,
};

export default MtrxReg;
