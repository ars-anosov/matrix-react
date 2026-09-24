import { Close as IconClose, HowToReg as IconHowToReg, PersonOff as IconPersonOff } from "@mui/icons-material";
import { Box, Button, Divider, IconButton, Paper, Snackbar, Stack, Switch, Tooltip, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect } from "react";
import { HEADER_BACKGROUND, PAPER_BACKGROUND } from "../theme.js";

// Состояние AD-подключения для кнопки в подвале панели: статусы и иконки те же,
// что у кнопок состояния в MtrxInfo (HowToReg — сессия есть, PersonOff — нет).
// У подключённой сессии вместо слова «Подключено» — логин, под которым вошли
function getAdConnectionConfig(status, adLogin) {
  switch (status) {
    case "loading":
      return { label: "Авторизация…", color: "warning", icon: <IconPersonOff /> };
    case "success":
      // Логин может не прийти (сессия из хранилища без сохранённого логина)
      return { label: adLogin || "Подключено", color: "success", icon: <IconHowToReg /> };
    case "error":
      return { label: "Ошибка авторизации", color: "error", icon: <IconPersonOff /> };
    default:
      return { label: "AD не подключено", color: "inherit", icon: <IconPersonOff /> };
  }
}

// Панель «Мост к сервисам». Сама ничего не диспатчит: все действия — колбэки
// контейнера AuthContainer, который держит оба среза (AUTHCTL_ и MTRXCTL_).
function AuthPad(props) {
  const { authControlRdcr, mtrxControlRdcr, onToggleMtrx, onOpenAd, onClose } = props;

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

  // Подпись, цвет и иконка кнопки состояния AD в подвале панели
  const adConnection = getAdConnectionConfig(authControlRdcr?.status, authControlRdcr?.responseData?.ad_login || "");

  // Тумблер отражает состояние сессии Matrix:
  //   откл           — сессии нет → клик запускает автоматическую авторизацию;
  //   зелёный        — авторизация успешна → клик сбрасывает сессию;
  //   красный        — авторизация не удалась (status === "error") или сессия потеряна
  //                    (authLost: принудительный logout / 401) → клик сбрасывает сессию.
  // В MUI Switch цвет применяется к checked-состоянию, поэтому цветной = checked + color.
  const authLost = !!mtrxControlRdcr?.authLost;
  const mtrxAuthorized = mtrxControlRdcr?.status === "success";
  const mtrxFailed = mtrxControlRdcr?.status === "error";
  // Пока идёт инициализация Matrix-клиента (запрос логина), тумблер заблокирован:
  // повторный клик не должен запускать второй вход, пока первый не завершился.
  const mtrxLoading = mtrxControlRdcr?.status === "loading";
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

  // Информируем, если AD-авторизация не выполнена или не вернула матричную пару:
  // без неё тумблер автозапуска не сработает
  const missingFields = [];
  if (!mtrxLogin) missingFields.push("mtrx_login");
  if (!mtrxPassword) missingFields.push("mtrx_password");

  let infoText = "";
  if (authControlRdcr?.status !== "success") {
    infoText = "Авторизуйтесь в AD чтобы получить Matrix-данные.";
  } else if (missingFields.length > 0) {
    infoText = `AD не вернул: ${missingFields.join(", ")}.`;
  }

  return (
    // Панель — всплывающий Snackbar справа внизу: корень MUI позиционирован fixed и места
    // в потоке документа не занимает. onClose намеренно не передан: иначе MUI закрывал бы
    // панель по клику мимо и Escape, а закрывает её только ✕ (проп onClose компоненты)
    <Snackbar
      open
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{
        // Панель открывает модальную форму AuthAd, а zIndex.snackbar (1400) выше
        // zIndex.modal (1300) — опускаем панель под подложку диалога
        zIndex: (theme) => theme.zIndex.modal - 1,
        // Ширину задаёт корень Snackbar: у fixed-элемента дочерний width: "100%"
        // не от чего считать проценты (на xs ширину держат left/right: 8)
        width: { xs: "auto", sm: 320 },
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: 320,
          width: "100%",
          bgcolor: PAPER_BACKGROUND,
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
          <Stack spacing={1}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="body1" color="text.primary">
                {`Вход в Matrix под ${mtrxLogin || "—"}`}
              </Typography>
              <Switch
                checked={mtrxSwitchOn}
                color={mtrxSwitchColor}
                disabled={mtrxLoading || (!hasMtrxData && !mtrxSwitchOn)}
                onChange={handleToggleMtrx}
                slotProps={{
                  input: { "aria-label": mtrxSwitchAria },
                }}
              />
            </Stack>
          </Stack>

          {/* Отчерк и мелкая серая подпись по центру: AD-сеанса нет или в нём нет матричной пары */}
          {infoText && (
            <>
              <Divider sx={{ mt: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center" }}>
                {infoText}
              </Typography>
            </>
          )}
        </Box>

        <Divider />

        {/* Подвал панели: слева состояние AD-сессии. Кнопка кликабельна — открывает
            форму входа AuthAd, где видно сеанс и есть выход из него */}
        <Stack
          direction="row"
          sx={{
            px: { xs: 1.5, sm: 2 },
            py: 0.75,
            alignItems: "center",
            bgcolor: HEADER_BACKGROUND,
          }}
        >
          <Tooltip title="Открыть форму входа AD">
            {/* Стиль как у кнопок состояния в MtrxInfo: цветная иконка с подписью,
                без подложки и рамки — остаётся только hover-подсветка MUI */}
            <Button
              size="small"
              variant="text"
              color={adConnection.color}
              startIcon={adConnection.icon}
              onClick={onOpenAd}
              aria-label={`AD: ${adConnection.label}. Открыть форму входа`}
              sx={{ maxWidth: "100%" }}
            >
              {/* Длинный логин (почта, домен) не должен растягивать подвал:
                  многоточие работает только на flex-элементе с minWidth 0 */}
              <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {adConnection.label}
              </Box>
            </Button>
          </Tooltip>
        </Stack>
      </Paper>
    </Snackbar>
  );
}

AuthPad.propTypes = {
  authControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(["idle", "loading", "success", "error"]),
    responseData: PropTypes.shape({
      mtrx_login: PropTypes.string,
      mtrx_password: PropTypes.string,
      // Логин AD — подпись кнопки состояния в подвале панели
      ad_login: PropTypes.string,
    }),
  }).isRequired,
  mtrxControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(["idle", "loading", "success", "error"]),
    authLost: PropTypes.bool,
  }).isRequired,
  onToggleMtrx: PropTypes.func.isRequired,
  // Клик по кнопке состояния в подвале — открыть форму входа AD (AuthAd)
  onOpenAd: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AuthPad;
