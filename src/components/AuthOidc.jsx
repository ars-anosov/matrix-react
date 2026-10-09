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
// и запускает флоу; popup, возврат loginToken и подъём сессии — в services/oidcAuth.js и
// thunk-е handleOidcLogin. Форма — модальный Dialog, как AuthRest/MtrxReg.
function AuthOidc(props) {
  const { mtrxControlRdcr, mtrxControlActions } = props;

  const [uriOidcAuth, setUriOidcAuth] = useState(() => mtrxControlRdcr.uriOidcAuth || "");
  // Ошибку, закрытую крестиком алерта, прячем локально: статус ошибки в Redux остаётся
  const [isErrDismissed, setIsErrDismissed] = useState(false);

  const isLoading = mtrxControlRdcr.status === "loading";
  const isError = mtrxControlRdcr.status === "error";
  const isSuccess = mtrxControlRdcr.status === "success";
  const errText = mtrxControlRdcr.errText || "";
  const showError = isError && !isErrDismissed && Boolean(errText);

  // Синхронизируем адрес из глобального стора при его изменении
  useEffect(() => {
    setUriOidcAuth(mtrxControlRdcr.uriOidcAuth || "");
  }, [mtrxControlRdcr.uriOidcAuth]);

  const handleSubmit = (event) => {
    event.preventDefault();
    // Новая попытка показывает ошибку снова, даже если текст тот же
    setIsErrDismissed(false);
    if (isLoading || isSuccess) return;
    if (!uriOidcAuth.trim()) return;

    mtrxControlActions.handleChangeStore("uriOidcAuth", uriOidcAuth.trim());
    mtrxControlActions.handleOidcLogin({
      uriOidcAuth,
      uriMatrix: mtrxControlRdcr.uriMatrix,
      idpId: mtrxControlRdcr.oidcIdpId,
    });
  };

  const handleReset = () => {
    setUriOidcAuth(mtrxControlRdcr.uriOidcAuth || "");
    mtrxControlActions.handleRegClear();
  };

  const handleClose = () => {
    mtrxControlActions.handleChangeStore("displayOidc", false);
  };

  const isSubmitDisabled = isLoading || isSuccess || !uriOidcAuth.trim() || (import.meta.env.DEV && !mtrxControlRdcr.uriMatrix?.trim());

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
      <IconButton aria-label="Закрыть форму входа через authentik" onClick={handleClose} disabled={isLoading} sx={{ position: "absolute", top: 8, right: 8 }}>
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
          {isSuccess ? mtrxControlRdcr.responseData?.display_name || mtrxControlRdcr.responseData?.user_id || "" : "Вход по OIDC (OAuth 2.0)"}
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
  mtrxControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(["idle", "loading", "success", "error"]),
    uriMatrix: PropTypes.string,
    uriOidcAuth: PropTypes.string,
    oidcIdpId: PropTypes.string,
    errText: PropTypes.string,
    responseData: PropTypes.shape({
      user_id: PropTypes.string,
      display_name: PropTypes.string,
      device_id: PropTypes.string,
    }),
  }).isRequired,
  mtrxControlActions: PropTypes.shape({
    handleOidcLogin: PropTypes.func.isRequired,
    handleChangeStore: PropTypes.func.isRequired,
    handleRegClear: PropTypes.func.isRequired,
  }).isRequired,
};

export default AuthOidc;
