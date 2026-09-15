import { Close as IconClose } from "@mui/icons-material";
import { Box, Divider, IconButton, Paper, Stack, Switch, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect } from "react";
import { HEADER_BACKGROUND } from "../constants/ui.js";

// Панель «Мост к сервисам». Сама ничего не диспатчит: все действия — колбэки
// контейнера AuthContainer, который держит оба среза (AUTHCTL_ и MTRXCTL_).
function AuthPad(props) {
  const { authControlRdcr, mtrxControlRdcr, onToggleMtrx, onClose } = props;

  useEffect(() => {
    if (import.meta.env.DEV) console.log("AuthPad MOUNT");
    return () => {
      if (import.meta.env.DEV) console.log("AuthPad UNMOUNT");
    };
  }, []);

  // mtrx_password нужен как признак полноты пары, в разметку не выводится
  const mtrxLogin = authControlRdcr?.responseData?.mtrx_login || "";
  const mtrxPassword = authControlRdcr?.responseData?.mtrx_password || "";
  const hasMtrxData = Boolean(mtrxLogin && mtrxPassword);

  // Тумблер отражает состояние сессии Matrix:
  //   откл           — сессии нет → клик запускает автоматическую авторизацию;
  //   зелёный        — авторизация успешна → клик сбрасывает сессию;
  //   красный        — авторизация не удалась (status === "error") или сессия потеряна
  //                    (authLost: принудительный logout / 401) → клик сбрасывает сессию.
  // В MUI Switch цвет применяется к checked-состоянию, поэтому цветной = checked + color.
  const authLost = !!mtrxControlRdcr?.authLost;
  const mtrxAuthorized = mtrxControlRdcr?.status === "success";
  const mtrxFailed = mtrxControlRdcr?.status === "error";
  const mtrxSwitchOn = authLost || mtrxFailed || mtrxAuthorized;
  const mtrxSwitchColor = authLost || mtrxFailed ? "error" : mtrxAuthorized ? "success" : "primary";
  const mtrxSwitchAria = authLost
    ? "Сбросить потерянную сессию Matrix"
    : mtrxFailed
      ? "Сбросить неудачную авторизацию Matrix"
      : mtrxAuthorized
        ? "Отключить сессию Matrix"
        : "Автоматическая авторизация Matrix";

  // Тумблер — и индикатор состояния сессии, и действие (что делать, решает контейнер)
  const handleToggleMtrx = () => {
    onToggleMtrx();
  };

  // Подпись внизу вместо иконки-кругляша: пока AD-сеанса нет, Matrix-реквизиты
  // (mtrx_login / mtrx_password) недоступны, поэтому тумблер автозапуска не сработает
  const isAdRequired = authControlRdcr?.status !== "success";

  return (
    <Paper
      elevation={8}
      sx={{
        maxWidth: 320,
        width: "100%",
        mx: "auto",
        mt: 2,
        borderRadius: 3,
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* ✕ поверх шапки: как в MtrxPad — кнопка над полосой, полоса оставляет место (pr: 6) */}
      <IconButton aria-label="Закрыть панель" onClick={onClose} sx={{ position: "absolute", top: 4, right: 4, zIndex: 1 }}>
        <IconClose color="action" />
      </IconButton>

      {/* Шапка — тот же дизайн, что у MtrxPad.jsx: серый фон HEADER_BACKGROUND */}
      <Stack
        direction="row"
        sx={{
          minHeight: 48,
          pl: { xs: 1.5, sm: 2 },
          pr: 6,
          py: 0.5,
          alignItems: "center",
          bgcolor: HEADER_BACKGROUND,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" color="primary" noWrap>
            Мост к сервисам
          </Typography>
        </Box>
      </Stack>

      <Divider />

      {/* Тело панели: padding переехал с Paper на тело, чтобы шапка легла вплотную к краям */}
      <Box sx={{ p: 1 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body1" color="text.primary">
            {`Вход в Matrix ${mtrxLogin || "—"}`}
          </Typography>
          <Switch
            checked={mtrxSwitchOn}
            color={mtrxSwitchColor}
            disabled={!hasMtrxData && !mtrxSwitchOn}
            onChange={handleToggleMtrx}
            slotProps={{
              input: { "aria-label": mtrxSwitchAria },
            }}
          />
        </Stack>

        {/* Отчерк и мелкая серая подпись по центру: AD-сеанса нет — реквизитов Matrix тоже */}
        {isAdRequired && (
          <>
            <Divider sx={{ mt: 1 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center" }}>
              Требуется AD Авторизация
            </Typography>
          </>
        )}
      </Box>
    </Paper>
  );
}

AuthPad.propTypes = {
  authControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(["idle", "loading", "success", "error"]),
    responseData: PropTypes.shape({
      mtrx_login: PropTypes.string,
      mtrx_password: PropTypes.string,
    }),
  }).isRequired,
  mtrxControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(["idle", "loading", "success", "error"]),
    authLost: PropTypes.bool,
  }).isRequired,
  onToggleMtrx: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AuthPad;
