import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import {
  Box,
  Stack,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Popover,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Checkbox,
  Divider,
} from '@mui/material'

import { useTheme } from '@mui/material/styles'

import MenuIcon         from '@mui/icons-material/Menu'
import ChevronLeftIcon  from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'

import AuthIco          from './AuthIco'
import AuthAdInfo       from './AuthAdInfo'
import MtrxPad          from './MtrxPad'
import Copyright        from '../Copyright'



const MENU_ITEMS_MTRX = [
  { key: 'displayReg', primary: 'Matrix Вход', secondary: 'MtrxReg.jsx' },
  { key: 'displayPad', primary: 'Matrix Мессенджер', secondary: 'MtrxPad.jsx' },
]

const MENU_ITEMS_AUTH = [
  { key: 'displayAd', primary: 'AD Авторизация', secondary: 'AuthAd.jsx' },
  { key: 'displayControl', primary: 'AD Кругляш', secondary: 'AuthIco.jsx' },
]



function MenuAppBar(props) {
  const { mtrxControlRdcr, mtrxControlActions, authControlRdcr, authControlActions } = props

  useEffect(() => {
    if (import.meta.env.DEV) console.log('MenuAppBar MOUNT')

    return () => {
      if (import.meta.env.DEV) console.log('MenuAppBar UNMOUNT')
    }
  }, [])

  const theme = useTheme()

  const rawToolbarHeight = theme?.mixins?.toolbar?.maxHeight
  const toolbarHeight = typeof rawToolbarHeight === 'number'
    ? rawToolbarHeight
    : (rawToolbarHeight ? parseInt(String(rawToolbarHeight).replace('px', ''), 10) : 64)

    const [anchorEl_adControl, setAnchorEl_adControl] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleOpenMenu = () => setDrawerOpen(true)
  const handleCloseMenu = () => setDrawerOpen(false)

  const toggleDisplayMtrx = (keyName) => {
    mtrxControlActions.handleChangeStore(keyName, !mtrxControlRdcr[keyName])
  }
  const toggleDisplayAuth = (keyName) => {
    authControlActions.handleChangeStore(keyName, !authControlRdcr[keyName])
  }
  
  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={handleOpenMenu}
          >
            <MenuIcon />
          </IconButton>

          <Drawer
            anchor="left"
            variant="temporary"
            open={drawerOpen}
            onClose={handleCloseMenu}
            slotProps={{
              backdrop: {
                sx: { backgroundColor: 'transparent' } 
              }
            }}
          >
            <Stack direction="row" spacing={2}
              sx={{ p: 1, height: toolbarHeight }}
            >
              <Box component="img" src="img/Vite.png" sx={{ height: '100%', width: 'auto' }} alt="Vite" />
              <Box component="img" src="img/React.png" sx={{ height: '100%', width: 'auto' }} alt="React" />
              <Box sx={{ flexGrow: 1 }} />
              <IconButton onClick={handleCloseMenu} >
                <ChevronLeftIcon color='primary' sx={{ height: '100%', width: 'auto' }} />
              </IconButton>
            </Stack>
            
            <Divider />

            <List>
              {MENU_ITEMS_MTRX.map((item) => {
                const isChecked = !!mtrxControlRdcr[item.key];
                const labelId = `checkbox-list-label-${item.key}`;
                return (
                  <ListItemButton
                    key={item.key}
                    onClick={() => toggleDisplayMtrx(item.key)}
                    sx={{ alignItems: 'flex-start' }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={isChecked}
                        tabIndex={-1}
                        disableRipple
                        slotProps={{ input: { 'aria-labelledby': labelId } }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      id={labelId}
                      primary={item.primary}
                      secondary={item.secondary}
                    />
                  </ListItemButton>
                )
              })}
            </List>

            <Divider />

            <List>
              {MENU_ITEMS_AUTH.map((item) => {
                const isChecked = !!authControlRdcr[item.key];
                const labelId = `checkbox-list-label-${item.key}`;
                return (
                  <ListItemButton
                    key={item.key}
                    onClick={() => toggleDisplayAuth(item.key)}
                    sx={{ alignItems: 'flex-start' }}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={isChecked}
                        tabIndex={-1}
                        disableRipple
                        slotProps={{ input: { 'aria-labelledby': labelId } }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      id={labelId}
                      primary={item.primary}
                      secondary={item.secondary}
                    />
                  </ListItemButton>
                )
              })}
            </List>

            <Box 
              sx={{ 
                mt: 'auto', // Выталкивает блок в самый низ контейнера
                p: 2, 
                textAlign: 'center' 
              }}
            >
              <Divider sx={{ mb: 2 }} />
              <Copyright showFull={false}/>
            </Box>
          </Drawer>



          <Typography variant="h6" component="div">
            Matrix
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          {authControlRdcr.displayControl && (
            <Stack 
              direction="row" 
              spacing={1} 
              sx={{ cursor: 'pointer', alignItems: 'center' }}
              onClick={(e) => setAnchorEl_adControl(e.currentTarget)}
            >
              <Typography variant="caption" sx={{ pl: 1 }}>
                {authControlRdcr?.responseData?.ad_login}
              </Typography>
              <AuthIco authControlRdcr={authControlRdcr} />
            </Stack>
          )}

        </Toolbar>
      </AppBar>

      <Popover
        id='adControl_id'
        open={Boolean(anchorEl_adControl)}
        anchorEl={anchorEl_adControl}
        onClose={() => setAnchorEl_adControl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Box
          sx={{ p: 1 }}
        >
          <Typography variant='body2'>{authControlRdcr.uriAdAuth}</Typography>
          <Divider />
          <AuthAdInfo
            authControlRdcr={authControlRdcr}
            authControlActions={authControlActions}
            showFull={false}
          />
        </Box>
      </Popover>

    </Box>
  )
}

MenuAppBar.propTypes = {
  mtrxControlRdcr: PropTypes.object.isRequired,
  mtrxControlActions: PropTypes.object.isRequired,
  authControlRdcr: PropTypes.object,
  authControlActions: PropTypes.object,
}

export default MenuAppBar
