import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Box,
  Checkbox,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Popover,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import Copyright from "../Copyright";
import { HEADER_BACKGROUND } from "../theme.js";
import AuthAdInfo from "./AuthAdInfo";
import AuthIco from "./AuthIco";
import MtrxIco from "./MtrxIco";
import MtrxInfo from "./MtrxInfo";

const MENU_ITEMS_MTRX = [
  { key: "displayControl", primary: "Matrix Кругляш", secondary: "MtrxIco.jsx" },
  { key: "displayReg", primary: "Matrix Авторизация", secondary: "MtrxReg.jsx" },
  { key: "displayPad", primary: "Matrix Мессенджер", secondary: "MtrxPad.jsx" },
];

const MENU_ITEMS_AUTH = [
  { key: "displayControl", primary: "AD Кругляш", secondary: "AuthIco.jsx" },
  { key: "displayAd", primary: "AD Авторизация", secondary: "AuthAd.jsx" },
  { key: "displayAuthPad", primary: "Мост к сервисам", secondary: "AuthPad.jsx" },
];

// Отступы строки меню. Горизонталь равна padding подзаголовков List, чтобы
// названия пунктов и заголовки секций стояли на одной вертикали.
// Радиус, вертикальные поля строки и цвет берутся из theme.MuiListItemButton.
const MENU_ROW_SX = { px: 1.5, py: 0.75, my: 0.25 };

const LIST_SUBHEADER_PROPS = {
  component: "div",
  disableSticky: true,
  sx: { px: 1.5 },
};

// Кликабельная группа «подпись + индикатор статуса» в шапке.
const STATUS_STACK_SX = { cursor: "pointer", alignItems: "center" };

function MenuAppBar(props) {
  const { mtrxControlRdcr, mtrxControlActions, authControlRdcr, authControlActions } = props;

  useEffect(() => {
    if (import.meta.env.DEV) console.log("MenuAppBar MOUNT");

    return () => {
      if (import.meta.env.DEV) console.log("MenuAppBar UNMOUNT");
    };
  }, []);

  const [anchorEl_mtrxControl, setAnchorEl_mtrxControl] = useState(null);
  const [anchorEl_adControl, setAnchorEl_adControl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleOpenMenu = () => setDrawerOpen(true);
  const handleCloseMenu = () => setDrawerOpen(false);

  const toggleDisplayMtrx = (keyName) => {
    mtrxControlActions.handleChangeStore(keyName, !mtrxControlRdcr[keyName]);
  };
  const toggleDisplayAuth = (keyName) => {
    authControlActions.handleChangeStore(keyName, !authControlRdcr[keyName]);
  };

  return (
    // Без flexGrow: корень App — flex-колонка, и выросшая обёртка уводила бы футер вниз
    <Box>
      <AppBar position="static" color="inherit" elevation={0}>
        <Toolbar>
          <IconButton size="large" edge="start" color="inherit" aria-label="menu" sx={{ mr: 2 }} onClick={handleOpenMenu}>
            <MenuIcon />
          </IconButton>

          <Drawer
            anchor="left"
            variant="temporary"
            open={drawerOpen}
            onClose={handleCloseMenu}
            slotProps={{
              backdrop: {
                sx: { backgroundColor: "transparent" },
              },
            }}
          >
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                px: 1.5,
                py: 1.5,
                alignItems: "center",
                bgcolor: HEADER_BACKGROUND,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                <Box component="img" src="img/Vite.png" sx={{ height: 18, width: "auto" }} alt="Vite" />
                <Box component="img" src="img/React.png" sx={{ height: 18, width: "auto" }} alt="React" />
              </Stack>
              {/* Две распорки, а не ml:"auto": у Stack со spacing селектор
                  `& > :not(style) + :not(style)` задаёт margin-left и перебивает auto. */}
              <Box sx={{ flexGrow: 1 }} />
              <Typography variant="subtitle1" color="primary" noWrap>
                Компоненты
              </Typography>
              <Box sx={{ flexGrow: 1 }} />
              <IconButton size="small" onClick={handleCloseMenu} sx={{ color: "text.secondary" }}>
                <ChevronLeftIcon />
              </IconButton>
            </Stack>

            <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
              <List disablePadding sx={{ px: 1 }} subheader={<ListSubheader {...LIST_SUBHEADER_PROPS}>Компоненты Matrix</ListSubheader>}>
                {MENU_ITEMS_MTRX.map((item) => {
                  const isChecked = !!mtrxControlRdcr[item.key];
                  const labelId = `checkbox-list-label-${item.key}`;
                  return (
                    <ListItemButton key={item.key} onClick={() => toggleDisplayMtrx(item.key)} sx={MENU_ROW_SX}>
                      <ListItemText
                        id={labelId}
                        primary={item.primary}
                        secondary={item.secondary}
                        slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                      />
                      <Checkbox edge="end" size="small" checked={isChecked} tabIndex={-1} disableRipple slotProps={{ input: { "aria-labelledby": labelId } }} />
                    </ListItemButton>
                  );
                })}
              </List>

              <Divider sx={{ my: 1.5 }} />

              <List disablePadding sx={{ px: 1 }} subheader={<ListSubheader {...LIST_SUBHEADER_PROPS}>Компоненты AD</ListSubheader>}>
                {MENU_ITEMS_AUTH.map((item) => {
                  const isChecked = !!authControlRdcr[item.key];
                  const labelId = `checkbox-list-label-${item.key}`;
                  return (
                    <ListItemButton key={item.key} onClick={() => toggleDisplayAuth(item.key)} sx={MENU_ROW_SX}>
                      <ListItemText
                        id={labelId}
                        primary={item.primary}
                        secondary={item.secondary}
                        slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                      />
                      <Checkbox edge="end" size="small" checked={isChecked} tabIndex={-1} disableRipple slotProps={{ input: { "aria-labelledby": labelId } }} />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>

            <Box
              sx={{
                mt: "auto",
                p: 2,
                textAlign: "center",
              }}
            >
              <Divider sx={{ mb: 2 }} />
              <Copyright showFull={false} />
            </Box>
          </Drawer>

          <Typography variant="h6" component="div">
            Matrix
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {mtrxControlRdcr.displayControl && (
            <Stack direction="row" spacing={1} sx={STATUS_STACK_SX} onClick={(e) => setAnchorEl_mtrxControl(e.currentTarget)}>
              <Typography variant="caption" sx={{ pl: 1 }}>
                {mtrxControlRdcr?.responseData?.display_name || mtrxControlRdcr?.responseData?.user_id || ""}
              </Typography>
              <MtrxIco mtrxControlRdcr={mtrxControlRdcr} />
            </Stack>
          )}

          {authControlRdcr.displayControl && (
            <Stack direction="row" spacing={1} sx={STATUS_STACK_SX} onClick={(e) => setAnchorEl_adControl(e.currentTarget)}>
              <Typography variant="caption" sx={{ pl: 1 }}>
                {authControlRdcr?.responseData?.ad_login}
              </Typography>
              <AuthIco authControlRdcr={authControlRdcr} />
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Popover
        id="mtrxControl_id"
        open={Boolean(anchorEl_mtrxControl)}
        anchorEl={anchorEl_mtrxControl}
        onClose={() => setAnchorEl_mtrxControl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="body2">{mtrxControlRdcr.uriMatrix}</Typography>
          <Divider />
          <MtrxInfo mtrxControlRdcr={mtrxControlRdcr} mtrxControlActions={mtrxControlActions} showFull={false} />
        </Box>
      </Popover>

      <Popover
        id="adControl_id"
        open={Boolean(anchorEl_adControl)}
        anchorEl={anchorEl_adControl}
        onClose={() => setAnchorEl_adControl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Box sx={{ p: 1 }}>
          <Typography variant="body2">{authControlRdcr.uriAdAuth}</Typography>
          <Divider />
          <AuthAdInfo authControlRdcr={authControlRdcr} authControlActions={authControlActions} showFull={false} />
        </Box>
      </Popover>
    </Box>
  );
}

MenuAppBar.propTypes = {
  mtrxControlRdcr: PropTypes.object.isRequired,
  mtrxControlActions: PropTypes.object.isRequired,
  authControlRdcr: PropTypes.object,
  authControlActions: PropTypes.object,
};

export default MenuAppBar;
