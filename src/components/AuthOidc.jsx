import { Close as IconClose, Key as IconKey, Login as IconLogin, Logout as IconLogout, VpnKey as IconVpnKey } from "@mui/icons-material";
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

// Вход через OIDC (OAuth 2.0) в authentik. Сама форма только собирает адрес ресурса IdP
// и запускает флоу своего среза (AUTHCTL_); popup, возврат loginToken и подъём сессии —
// в services/oidcAuth.js и thunk-ах authControlActions/mtrxControlActions, а связывает их
// мост AuthContainer (props onLogin/onLogout). Форма — модальный Dialog, как AuthRest/MtrxReg.
function AuthOidc(props) {
  const { authControlRdcr, authControlActions, onLogin, onLogout, isMatrixUriMissing } = props;

  const [uriOidcAuth, setUriOidcAuth] = useState(() => authControlRdcr.uriOidcAuth || "");
  // Ошибку, закрытую крестиком алерта, прячем локально: статус ошибки в Redux остаётся
  const [isErrDismissed, setIsErrDismissed] = useState(false);

  const isLoading = authControlRdcr.oidcStatus === "loading";
  const isError = authControlRdcr.oidcStatus === "error";
  const isSuccess = authControlRdcr.oidcStatus === "success";
  const errText = authControlRdcr.oidcErrText || "";
  const showError = isError && !isErrDismissed && Boolean(errText);

  // Синхронизируем адрес из глобального стора при его изменении
  useEffect(() => {
    setUriOidcAuth(authControlRdcr.uriOidcAuth || "");
  }, [authControlRdcr.uriOidcAuth]);

  const handleSubmit = (event) => {
    event.preventDefault();
    // Новая попытка показывает ошибку снова, даже если текст тот же
    setIsErrDismissed(false);
    if (isLoading || isSuccess) return;
    if (!uriOidcAuth.trim()) return;

    authControlActions.handleChangeStore("uriOidcAuth", uriOidcAuth.trim());
    onLogin({ uriOidcAuth });
  };

  const handleReset = () => {
    setUriOidcAuth(authControlRdcr.uriOidcAuth || "");
    onLogout();
  };

  const handleClose = () => {
    // Закрытие прерывает незавершённое ожидание loginToken (handleOidcClear → abort),
    // поэтому крестик доступен и во время входа
    authControlActions.handleOidcClear();
  };

  const isSubmitDisabled = isLoading || isSuccess || !uriOidcAuth.trim() || isMatrixUriMissing;

  // Paper — сам тег form: Enter в поле отправляет запрос, кнопки живут в DialogActions
  return (
    <Dialog
      open
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="oidcAuthTitle"
      aria-describedby="oidcAuthSubtitle"
      slotProps={{
        paper: {
          component: "form",
          onSubmit: handleSubmit,
          noValidate: true,
          sx: { borderRadius: 3 },
        },
      }}
    >
      <IconButton aria-label="Закрыть форму входа через authentik" onClick={handleClose} sx={{ position: "absolute", top: 8, right: 8 }}>
        <IconClose color="action" />
      </IconButton>

      <DialogTitle
        id="oidcAuthTitle"
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
          <IconKey sx={{ fontSize: 32, color: isSuccess ? "success.main" : "primary.main" }} />
        </Avatar>
        authentik
      </DialogTitle>

      <DialogContent>
        <DialogContentText id="oidcAuthSubtitle" variant="body2" sx={{ textAlign: "center", mb: 2.5 }}>
          {isSuccess ? authControlRdcr.oidcResponseData?.display_name || authControlRdcr.oidcResponseData?.user_id || "" : "Вход по OIDC (OAuth 2.0)"}
        </DialogContentText>

        <Stack spacing={2.5}>
          {/* Адрес ресурса IdP: в DEV доступен для правки, в PROD берётся сохранённый */}
          <TextField
            fullWidth
            required
            disabled={isLoading || isSuccess || !import.meta.env.DEV}
            id="uriOidcAuth"
            label={import.meta.env.DEV ? "Ресурс authentik (Dev Only)" : "Ресурс authentik"}
            variant="outlined"
            value={uriOidcAuth}
            onChange={(event) => setUriOidcAuth(event.target.value)}
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
            Войти через authentik
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

AuthOidc.propTypes = {
  authControlRdcr: PropTypes.shape({
    displayOidc: PropTypes.bool,
    uriOidcAuth: PropTypes.string,
    oidcIdpId: PropTypes.string,
    oidcStatus: PropTypes.oneOf(["idle", "loading", "success", "error"]),
    oidcResponseData: PropTypes.shape({
      user_id: PropTypes.string,
      display_name: PropTypes.string,
      device_id: PropTypes.string,
    }),
    oidcErrText: PropTypes.string,
  }).isRequired,
  authControlActions: PropTypes.shape({
    handleChangeStore: PropTypes.func.isRequired,
  }).isRequired,
  // Мост к MTRXCTL_ живёт в AuthContainer: форма только просит вход и выход
  onLogin: PropTypes.func.isRequired,
  onLogout: PropTypes.func.isRequired,
  // В DEV вход невозможен без адреса homeserver — его подставляет мост
  isMatrixUriMissing: PropTypes.bool,
};

export default AuthOidc;
