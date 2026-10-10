import { HowToReg as IconHowToReg, PersonOff as IconPersonOff } from "@mui/icons-material";
import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect } from "react";
import { AUTH_SOURCE_OIDC } from "../constants/authSource.js";
import { getAuthSourceView } from "./utils/authSourceView.jsx";

// Состояние входа через authentik (OIDC) — аналог AuthRestInfo для второго источника
// матричных учётных данных. Подписи статусов те же, что у источника в панели AuthPad и у
// кругляша AuthIco: их даёт общий модуль представления.
function AuthOidcInfo(props) {
  const { authControlRdcr, mtrxControlRdcr, authControlActions, showFull = false } = props;

  if (import.meta.env.DEV) {
    console.log("AuthOidcInfo render");
  }

  useEffect(() => {
    if (import.meta.env.DEV) console.log("AuthOidcInfo MOUNT");
    return () => {
      if (import.meta.env.DEV) console.log("AuthOidcInfo UNMOUNT");
    };
  }, []);

  const toggleAuth = () => {
    authControlActions?.handleChangeStore("displayOidc", !authControlRdcr?.displayOidc);
  };

  const oidcStatus = authControlRdcr?.oidcStatus || "idle";
  // Готовый токен и поднятая по нему сессия — те же два признака, что у источника в панели
  const isReady = oidcStatus === "ready";
  const isAuthorized = isReady || (oidcStatus === "success" && mtrxControlRdcr?.status === "success");
  const authButtonColor = isAuthorized ? "success" : "error";
  const sourceView = getAuthSourceView({ kind: AUTH_SOURCE_OIDC, state: oidcStatus, ready: isReady, session: isAuthorized });

  return (
    <Paper
      elevation={showFull ? 8 : 0}
      sx={{
        maxWidth: 320,
        width: "100%",
        mx: "auto",
        mt: 2,
        p: showFull ? 1 : 0,
        borderRadius: 3,
        position: "relative",
      }}
    >
      <Typography
        variant="body2"
        component="pre"
        sx={{
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {`ресурс:\t\t${authControlRdcr?.uriOidcAuth || ""}
IdP:\t\t${authControlRdcr?.oidcIdpId || ""}
токен:\t\t${sourceView.label}

Matrix:\t\t${mtrxControlRdcr?.responseData?.user_id || ""}`}
      </Typography>

      {oidcStatus === "error" && authControlRdcr?.oidcErrText && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {authControlRdcr.oidcErrText}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "space-between", alignItems: "center" }}>
        <Tooltip title={isAuthorized ? "Деавторизоваться" : "Авторизоваться"}>
          <IconButton color={authButtonColor} onClick={toggleAuth} aria-label="Открыть форму входа через authentik">
            {isAuthorized ? <IconHowToReg /> : <IconPersonOff />}
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

AuthOidcInfo.propTypes = {
  authControlRdcr: PropTypes.shape({
    displayOidc: PropTypes.bool,
    uriOidcAuth: PropTypes.string,
    oidcIdpId: PropTypes.string,
    oidcStatus: PropTypes.oneOf(["idle", "loading", "ready", "success", "error"]),
    oidcErrText: PropTypes.string,
  }).isRequired,
  // Матричный идентификатор после подъёма сессии — как в AuthRestInfo
  mtrxControlRdcr: PropTypes.shape({
    status: PropTypes.string,
    responseData: PropTypes.shape({
      user_id: PropTypes.string,
    }),
  }),
  authControlActions: PropTypes.shape({
    handleChangeStore: PropTypes.func.isRequired,
  }).isRequired,
  showFull: PropTypes.bool,
};

export default AuthOidcInfo;
