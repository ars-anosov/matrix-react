import IconHub from "@mui/icons-material/Hub";
import IconSync from "@mui/icons-material/Sync";
import { alpha, IconButton, keyframes, Tooltip, useTheme } from "@mui/material";
import PropTypes from "prop-types";
import { useEffect, useMemo } from "react";

// Пульс берёт цвет из --status-pulse, который задаёт сам индикатор: на белой шапке
// прежнее белое свечение было не видно.
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 var(--status-pulse); transform: scale(1); }
  70% { box-shadow: 0 0 0 8px rgba(0, 0, 0, 0); transform: scale(1.04); }
  100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); transform: scale(1); }
`;

// Индикатор состояния Matrix: цвет иконки и подложки задаёт статус,
// подпись дублирует его в tooltip и aria-label.
function MtrxIco({ mtrxControlRdcr }) {
  const theme = useTheme();
  const status = mtrxControlRdcr?.status;

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log("MtrxIco MOUNT");
      return () => console.log("MtrxIco UNMOUNT");
    }
  }, []);

  const cfg = useMemo(() => {
    switch (status) {
      case "loading":
        return {
          icon: <IconSync />,
          color: theme.palette.warning.dark,
          pulse: true,
          label: "Matrix: подключение…",
        };
      case "success":
        return {
          icon: <IconHub />,
          color: theme.palette.success.main,
          pulse: false,
          label: "Matrix: подключено",
        };
      case "error":
        return {
          //   icon: <IconLinkOff />,
          icon: <IconHub />,
          color: theme.palette.error.main,
          pulse: false,
          label: "Matrix: ошибка подключения",
        };
      default:
        return {
          icon: <IconHub />,
          color: theme.palette.text.secondary,
          pulse: false,
          label: "Matrix: не подключено",
        };
    }
  }, [status, theme]);

  const { icon, color, pulse: isPulsing, label } = cfg;

  return (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        sx={{
          ml: 1,
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

MtrxIco.propTypes = {
  mtrxControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(["idle", "loading", "success", "error"]),
  }).isRequired,
};

export default MtrxIco;
