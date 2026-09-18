import { AdminPanelSettings, Hub as IconHub } from "@mui/icons-material";
import { IconButton, Stack, Tooltip, Typography } from "@mui/material";
import PropTypes from "prop-types";

// Иконки-входы стартового экрана: использовать Matrix или получить матричные атрибуты
// через AD. Показываются, пока ни AD-, ни Matrix-сессия не активны (условие считает
// AuthContainer). Сами ничего не диспатчат — только колбэки. Размеры — стандартные:
// Typography по умолчанию (body1), IconButton medium с иконкой 24px.
const iconButtonSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  color: "primary.main",
  "&:hover": { borderColor: "primary.main", backgroundColor: "action.hover" },
};

function AuthLinks({ onOpenAd, onOpenMtrx }) {
  return (
    // flexGrow занимает свободное место окна, поэтому блок стоит по центру между
    // AppBar и футером (auto-отступ футера забирает остаток, только когда блока нет)
    <Stack spacing={1} sx={{ flexGrow: 1, justifyContent: "center", alignItems: "center" }}>
      <Typography color="text.secondary">Войти</Typography>

      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Tooltip title="Использовать Matrix">
          <IconButton aria-label="Войти с учётной записью Matrix" onClick={onOpenMtrx} sx={iconButtonSx}>
            <IconHub />
          </IconButton>
        </Tooltip>

        {/* <Tooltip title="Получить атрибуты через AD">
          <IconButton aria-label="Получить атрибуты через AD" onClick={onOpenAd} sx={iconButtonSx}>
            <AdminPanelSettings />
          </IconButton>
        </Tooltip> */}
      </Stack>
    </Stack>
  );
}

AuthLinks.propTypes = {
  onOpenAd: PropTypes.func.isRequired,
  onOpenMtrx: PropTypes.func.isRequired,
};

export default AuthLinks;
