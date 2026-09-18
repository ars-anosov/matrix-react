import { alpha, createTheme } from "@mui/material/styles";

// Фон «шапок»: панель мессенджера и шапка комнаты.
export const HEADER_BACKGROUND = "grey.100";

// Фон контейнеров, внутри которых лежит шапка HEADER_BACKGROUND: панели
// AuthPad/MtrxPad, комната и верхняя панель с меню. Сейчас белый.
export const PAPER_BACKGROUND = "background.paper";

// Кругляш проекта: иконка в тонированном круге с рамкой. Сейчас так оформлена
// только кнопка создания комнаты (MtrxPad) — остальные действия (скрепка,
// отправка, покинуть комнату, состояние подключения) идут без подложки.
// Цвет задаёт семантику: primary — создать.
export function roundIconButtonSx(theme, color, size = 32) {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    color,
    backgroundColor: alpha(color, 0.12),
    border: `1px solid ${alpha(color, 0.28)}`,
    transition: theme.transitions.create(["background-color", "border-color", "transform"], {
      duration: theme.transitions.duration.short,
    }),
    "&:hover": {
      backgroundColor: alpha(color, 0.2),
      borderColor: alpha(color, 0.45),
      transform: "translateY(-1px)",
    },
    "&.Mui-disabled": {
      color: alpha(color, 0.4),
      backgroundColor: alpha(color, 0.06),
      borderColor: alpha(color, 0.16),
    },
    "& .MuiSvgIcon-root": {
      fontSize: "1rem",
    },
  };
}

// Цвет статуса собеседника: плашка в шапке комнаты и точка в списке берут его
// из одного места. Онлайн — зелёный, отошёл — янтарный, остальное — серый.
export function presenceColor(theme, presence) {
  switch (presence) {
    case "online":
      return theme.palette.success.main;
    case "unavailable":
      return theme.palette.warning.main;
    default:
      return theme.palette.text.secondary;
  }
}

// Современная тема в стиле чистых интерфейсов Material You / Modern UI
const theme = createTheme({
  cssVariables: true,
  shape: {
    // MUI умножает числовой borderRadius из sx на это значение, поэтому шкала
    // в компонентах читается как кратные: 1 → 4px, 2 → 8px, 3 → 12px.
    borderRadius: 4,
  },
  palette: {
    mode: "light",
    primary: {
      main: "#2563eb", // чистый современный royal blue
      light: "#60a5fa",
      dark: "#1d4ed8",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#0f766e",
      light: "#14b8a6",
      dark: "#115e59",
    },
    error: {
      main: "#dc2626", // red-600: читается и как текст, и как иконка на белом
      light: "#f87171",
      dark: "#b91c1c",
    },
    // Семантические цвета нужны статусным индикаторам в шапке: на белом фоне
    // они должны читаться без подсказки (подложка + иконка одного тона).
    success: {
      main: "#16a34a",
      light: "#4ade80",
      dark: "#15803d",
    },
    warning: {
      main: "#d97706",
      light: "#fbbf24",
      dark: "#b45309",
    },
    info: {
      main: "#0284c7",
      light: "#38bdf8",
      dark: "#0369a1",
    },
    background: {
      default: "#f8fafc", // slate-50
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a", // slate-900
      secondary: "#64748b", // slate-500
    },
    divider: "#e2e8f0", // slate-200
  },
  typography: {
    fontFamily: ["-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", '"Helvetica Neue"', "Arial", "sans-serif"].join(","),
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    subtitle1: {
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: ({ theme }) => ({
          // PAPER_BACKGROUND — тот же palette.background.paper (CSS-var темы)
          backgroundColor: theme.palette.background.paper,
          color: "#0f172a",
          borderRadius: theme.shape.borderRadius * 3,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
          border: "1px solid #e2e8f0",
        }),
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          width: 260,
          // Меню-панель: фон как у контейнеров с шапкой (PAPER_BACKGROUND)
          backgroundColor: theme.palette.background.paper,
          // У temporary-варианта MUI рамку не рисует (Drawer.js:133 — только для
          // не-temporary), а display/flexDirection/height задаёт сам.
          borderRight: `1px solid ${theme.palette.divider}`,
          borderTopRightRadius: theme.shape.borderRadius * 3,
          borderBottomRightRadius: theme.shape.borderRadius * 3,
          boxShadow: "0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)",
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius * 2,
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
        elevation1: {
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)",
        },
        elevation8: {
          boxShadow: "0 12px 32px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)",
        },
      },
    },
    MuiListSubheader: {
      styleOverrides: {
        root: {
          lineHeight: 1.75,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        // Без override поле берёт shape.borderRadius напрямую и выглядит острее
        // соседних кнопок — держим контролы на одной ступени.
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius * 2,
        }),
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: theme.shape.borderRadius * 2,
        }),
      },
    },
  },
});

export default theme;
