import { AdminPanelSettings as IconAdminPanelSettings, Close as IconClose } from "@mui/icons-material";
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { useEffect } from "react";
import { AUTH_SOURCE_OIDC } from "../constants/authSource.js";
import { HEADER_BACKGROUND, PAPER_BACKGROUND } from "../theme.js";
import { getAuthSourceView } from "./utils/authSourceView.jsx";

// Панель «Мост к сервисам». Сама ничего не диспатчит: все действия — колбэки
// контейнера AuthContainer, который держит оба среза (AUTHCTL_ и MTRXCTL_).
function AuthPad(props) {
  const { mtrxControlRdcr, sources, activeSourceKind, info, onSelectSource, onToggleMtrx, onOpenActiveAuth, onClose } = props;

  useEffect(() => {
    if (import.meta.env.DEV) console.log("AuthPad MOUNT");
    return () => {
      if (import.meta.env.DEV) console.log("AuthPad UNMOUNT");
    };
  }, []);

  const activeSource = sources.find((source) => source.kind === activeSourceKind) || null;
  const activeView = activeSource ? getAuthSourceView(activeSource) : null;
  // Активного источника может не быть только на старте: подвал ведёт в форму REST, как раньше
  const footerKind = activeSource?.kind || "rest";

  // Тумблер отражает состояние сессии Matrix:
  //   откл           — сессии нет → клик запускает авторизацию выбранным источником;
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
        : "Войти в Matrix выбранным источником";

  // Логин подставляем только по факту входа: до клика тумблера он ещё неизвестен
  const sessionName = mtrxControlRdcr?.responseData?.display_name || mtrxControlRdcr?.responseData?.user_id || "";
  const toggleLabel = sessionName ? `Вход в Matrix под ${sessionName}` : "Вход в Matrix";

  const handleToggleMtrx = () => {
    onToggleMtrx();
  };

  return (
    // Панель — всплывающий Snackbar справа внизу: корень MUI позиционирован fixed и места
    // в потоке документа не занимает. onClose намеренно не передан: иначе MUI закрывал бы
    // панель по клику мимо и Escape, а закрывает её только ✕ (проп onClose компоненты)
    <Snackbar
      open
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      sx={{
        // Панель открывает модальные формы входа, а zIndex.snackbar (1400) выше
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
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="body1" color="text.primary">
              {toggleLabel}
            </Typography>
            <Switch
              checked={mtrxSwitchOn}
              color={mtrxSwitchColor}
              disabled={mtrxLoading || (!activeSource?.ready && !mtrxSwitchOn)}
              onChange={handleToggleMtrx}
              slotProps={{
                input: { "aria-label": mtrxSwitchAria },
              }}
            />
          </Stack>

          {/* Источник матричных учётных данных выбирается явно: панель запускает сессию тем,
              что отмечен. Неготовый источник выбрать можно — его подпись объясняет, чего ждём */}
          <Divider sx={{ mt: 1 }} />
          <FormControl component="fieldset" fullWidth>
            <RadioGroup
              aria-label="Источник матричных учётных данных"
              name="mtrx-auth-source"
              value={activeSourceKind || ""}
              onChange={(event) => onSelectSource(event.target.value)}
            >
              {sources.map((source) => {
                const view = getAuthSourceView(source);
                const hint = source.detail ? `${source.label}: ${source.detail}` : source.label;

                return (
                  <FormControlLabel
                    key={source.kind}
                    value={source.kind}
                    sx={{ mx: 0, alignItems: "center" }}
                    control={<Radio size="small" color={view.color === "inherit" ? "default" : view.color} />}
                    label={
                      <Tooltip title={hint}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                            {source.label}
                          </Typography>
                          <Typography
                            variant="caption"
                            color={view.color === "inherit" ? "text.secondary" : `${view.color}.main`}
                            sx={{ display: "block", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                          >
                            {view.label}
                          </Typography>
                        </Box>
                      </Tooltip>
                    }
                  />
                );
              })}
            </RadioGroup>
          </FormControl>

          {/* Мелкая серая подпись по центру: чего не хватает для запуска сессии */}
          {info?.text && (
            <>
              <Divider sx={{ mt: 1 }} />
              <Typography variant="caption" color={info.isError ? "error.main" : "text.secondary"} sx={{ display: "block", mt: 1, textAlign: "center" }}>
                {info.text}
              </Typography>
            </>
          )}
        </Box>

        <Divider />

        {/* Подвал панели: активный источник матричных учётных данных. Кнопка кликабельна —
            открывает форму соответствующего входа, где видно сеанс и есть выход из него */}
        <Stack
          direction="row"
          sx={{
            px: { xs: 1.5, sm: 2 },
            py: 0.75,
            alignItems: "center",
            bgcolor: HEADER_BACKGROUND,
          }}
        >
          <Tooltip title={`Открыть форму входа ${footerKind === AUTH_SOURCE_OIDC ? "authentik" : "REST"}`}>
            {/* Стиль как у кнопок состояния в MtrxInfo: цветная иконка с подписью,
                без подложки и рамки — остаётся только hover-подсветка MUI */}
            <Button
              size="small"
              variant="text"
              color={activeView && activeView.color !== "inherit" ? activeView.color : "inherit"}
              startIcon={activeView?.icon || <IconAdminPanelSettings />}
              onClick={onOpenActiveAuth}
              aria-label={`Источник входа: ${activeSource?.label || "REST"}. Открыть форму входа`}
              sx={{ maxWidth: "100%" }}
            >
              {/* Длинный адрес ресурса не должен растягивать подвал:
                  многоточие работает только на flex-элементе с minWidth 0 */}
              <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeView ? `${activeSource.label}: ${activeView.label}` : "REST: не подключено"}
              </Box>
            </Button>
          </Tooltip>
        </Stack>
      </Paper>
    </Snackbar>
  );
}

AuthPad.propTypes = {
  mtrxControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(["idle", "loading", "success", "error"]),
    authLost: PropTypes.bool,
    responseData: PropTypes.shape({
      user_id: PropTypes.string,
      display_name: PropTypes.string,
    }),
  }).isRequired,
  // Источники матричных учётных данных: готовность, состояние и принадлежность сессии
  sources: PropTypes.arrayOf(
    PropTypes.shape({
      kind: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      detail: PropTypes.string,
      state: PropTypes.string,
      ready: PropTypes.bool,
      session: PropTypes.bool,
    }),
  ).isRequired,
  activeSourceKind: PropTypes.string,
  // Подпись под тумблером: собранный контейнером текст и признак ошибки
  info: PropTypes.shape({
    text: PropTypes.string,
    isError: PropTypes.bool,
  }),
  onSelectSource: PropTypes.func.isRequired,
  onToggleMtrx: PropTypes.func.isRequired,
  // Клик по кнопке подвала — открыть форму активного источника
  onOpenActiveAuth: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default AuthPad;
