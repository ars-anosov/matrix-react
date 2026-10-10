import { alpha, Box, IconButton, keyframes, Tooltip, useTheme } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect, useMemo } from "react";
import { getAuthSourceView } from "./utils/authSourceView.jsx";

// Пульс берёт цвет из --status-pulse, который задаёт сам индикатор: на белой шапке
// прежнее белое свечение было не видно.
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 var(--status-pulse); transform: scale(1); }
  70% { box-shadow: 0 0 0 8px rgba(0, 0, 0, 0); transform: scale(1.04); }
  100% { box-shadow: 0 0 0 0 var(--status-pulse); transform: scale(1); }
`;

// Индикатор авторизации: статусов теперь два (REST и authentik), а кругляш один — цвет и
// иконку задаёт активный источник, подписи обоих собраны в tooltip. Подпись дублирует
// статус в aria-label.
function AuthIco({ sources, activeSourceKind }) {
  const theme = useTheme();

  // Активный источник — тот, чьи данные панель предлагает запустить, либо чья сессия жива
  const activeSource = sources?.find((source) => source.kind === activeSourceKind) || sources?.[0] || null;
  const activeView = getAuthSourceView(activeSource);

  // Кэшируем конфигурацию стиля, чтобы не пересчитывать при каждом рендере
  const cfg = useMemo(() => {
    const color = activeView.color === "inherit" ? theme.palette.text.secondary : theme.palette[activeView.color].main;

    return {
      icon: activeView.icon,
      color,
      pulse: activeSource?.state === "loading",
      label: `${activeSource?.label || "авторизация"}: ${activeView.label}`,
    };
  }, [activeView, activeSource, theme]);

  const { icon, color, pulse: isPulsing, label } = cfg;

  // Оба статуса рядом: один кругляш не должен скрывать состояние второго источника
  const tooltip = (sources || []).map((source) => `${source.kind === activeSourceKind ? "▸ " : ""}${source.label}: ${getAuthSourceView(source).label}`);

  // Логирование монтирования только для разработки
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("AuthIco MOUNT");
      return () => console.log("AuthIco UNMOUNT");
    }
  }, []);

  return (
    <Tooltip
      title={
        <Box component="span" sx={{ whiteSpace: "pre-line" }}>
          {tooltip.join("\n")}
        </Box>
      }
    >
      <IconButton
        size="small"
        aria-label={tooltip.join(". ") || label}
        sx={{
          width: 42,
          height: 42,
          "--status-pulse": alpha(color, 0.45),
          color,
          backgroundColor: alpha(color, 0.12),
          border: `1px solid ${alpha(color, 0.28)}`,
          animation: isPulsing ? `${pulse} 1.4s ease-out infinite` : "none",
          transition: theme.transitions.create(["background-color", "border-color", "transform"], {
            duration: theme.transitions.duration.short,
          }),
          "&:hover": {
            backgroundColor: alpha(color, 0.2),
            borderColor: alpha(color, 0.45),
            transform: "translateY(-1px)",
          },
          "& .MuiSvgIcon-root": {
            fontSize: "1.35rem",
          },
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

AuthIco.propTypes = {
  // Источники матричных учётных данных: состояние, готовность и принадлежность сессии
  sources: PropTypes.arrayOf(
    PropTypes.shape({
      kind: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      state: PropTypes.string,
      ready: PropTypes.bool,
      session: PropTypes.bool,
    }),
  ).isRequired,
  activeSourceKind: PropTypes.string,
};

export default AuthIco;
