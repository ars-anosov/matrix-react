import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
  Alert,
  Collapse,
  IconButton,
  InputAdornment,
  Avatar
} from '@mui/material'

import {
  Login as IconLogin,
  Logout as IconLogout,
  Close as IconClose,
  AccountCircle,
  Lock,
  Visibility,
  VisibilityOff,
  AdminPanelSettings
} from '@mui/icons-material'

function AdAuth(props) {
  const {
    authControlRdcr,
    authControlActions,
  } = props
  
  const [login, setLogin] = useState(() => localStorage.getItem('adLogin') || '')
  const [password, setPassword] = useState('')
  const [uriAdAuth, setUriAdAuth] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const isLoading = authControlRdcr.status === 'loading'
  const isError = authControlRdcr.status === 'error'
  const isSuccess = authControlRdcr.status === 'success'
  const responseData = authControlRdcr.responseData

  // Синхронизируем URI из глобального стора при его изменении
  useEffect(() => {
    setUriAdAuth(authControlRdcr.uriAdAuth || '')
  }, [authControlRdcr.uriAdAuth])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!login.trim() || !password.trim()) return
    authControlActions.handleAdRegister({ login, password, uriAdAuth })
  }

  const handleReset = () => {
    // setLogin('')
    setPassword('')
    setUriAdAuth(authControlRdcr.uriAdAuth || '')
    authControlActions.handleAdAuthClear()
  }

  const handleClose = () => {
    authControlActions.handleChangeStore('displayAd', false)
  }

  const isSubmitDisabled = isLoading || isSuccess || !login.trim() || !password.trim() || (import.meta.env.DEV && !uriAdAuth.trim())

  return (
    <Paper 
      elevation={12} 
      sx={{ 
        maxWidth: 400, 
        // На мобильных берем ширину от самого экрана устройства, на десктопе — обычные 100%
        width: { xs: '80vw', sm: '100%' }, 
        // Центрируем элемент по горизонтали в любых условиях
        mx: 'auto', 
        mt: 2,
        // Минимальный паддинг для мобильных (16px вместо 32px), чтобы инпутам внутри было просторно
        p: { xs: 2, sm: 4 }, 
        borderRadius: 3, 
        position: 'relative',
        // Важно: гарантирует, что паддинги считаются внутрь ширины и не раздувают форму
        boxSizing: 'border-box' 
      }}
    >
      {/* Кнопка закрытия формы сверху справа */}
      <IconButton 
        onClick={handleClose} 
        disabled={isLoading}
        sx={{ position: 'absolute', top: 4, right: 4 }}
      >
        <IconClose color="action" />
      </IconButton>

      {/* Блок Логотипа и Заголовка */}
      <Stack spacing={1} sx={{ alignItems: 'center', mb: 4 }}>
        <Avatar 
          sx={{ 
            width: 56, 
            height: 56, 
            backgroundColor: isSuccess ? 'success.light' : 'primary.light', 
            mb: 1,
            transition: 'background-color 0.3s ease'
          }}
        >
          <AdminPanelSettings sx={{ fontSize: 32, color: isSuccess ? 'success.main' : 'primary.main' }} />
        </Avatar>
        <Typography variant="h5" fontWeight="600">
          AD Авторизация
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {isSuccess
            ? responseData.ad_cn
            : 'Введите учетные данные Active Directory'
          }
        </Typography>
      </Stack>

      <Box component="form" onSubmit={handleSubmit} noValidate>
        <Stack spacing={2.5}>
          
          {/* Поле ввода Логина */}
          <TextField
            fullWidth
            required
            disabled={isLoading || isSuccess}
            id="adAuthLogin"
            label="Логин"
            variant="outlined"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <AccountCircle color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Поле ввода Пароля */}
          <TextField
            fullWidth
            required
            disabled={isLoading || isSuccess}
            id="adAuthPassword"
            label="Пароль"
            type={showPassword ? 'text' : 'password'}
            variant="outlined"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="переключить видимость пароля"
                      onClick={() => setShowPassword((prev) => !prev)}
                      onMouseDown={(event) => event.preventDefault()}
                      edge="end"
                      disabled={isLoading || isSuccess}
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />

          {/* Безопасный инпут API URI — рендерится только в DEV режиме */}
          {import.meta.env.DEV && (
            <TextField
              fullWidth
              required
              disabled={isLoading || isSuccess}
              id="uriAdAuth"
              label="API URI (Dev Only)"
              variant="outlined"
              size="small"
              value={uriAdAuth}
              onChange={(event) => setUriAdAuth(event.target.value)}
              sx={{ opacity: 0.8 }}
            />
          )}

          {/* Блок управляющих кнопок */}
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {!isSuccess ? (
              <Button
                type="submit"
                variant="contained"
                color="primary"
                startIcon={<IconLogin />}
                size="large"
                fullWidth
                disabled={isSubmitDisabled}
                sx={{ py: 1.3, fontWeight: 'bold', borderRadius: 2 }}
              >
                Войти в систему
              </Button>
            ) : (
              <Button
                type="button"
                variant="contained"
                color="error"
                startIcon={<IconLogout />}
                size="large"
                fullWidth
                onClick={handleReset}
                disabled={isLoading}
                sx={{ py: 1.3, fontWeight: 'bold', borderRadius: 2 }}
              >
                Выйти
              </Button>
            )}
          </Stack>

        </Stack>
      </Box>

      <Collapse in={isError}>
        <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
          {authControlRdcr.errText}
        </Alert>
      </Collapse>
    </Paper>
  )
}

AdAuth.propTypes = {
  authControlRdcr: PropTypes.shape({
    uriAdAuth: PropTypes.string,
    status: PropTypes.string,
    errText: PropTypes.string,
    responseData: PropTypes.shape({
      sip_username: PropTypes.string,
      sip_secret: PropTypes.string,
    }),
  }).isRequired,
  authControlActions: PropTypes.shape({
    handleAdRegister: PropTypes.func.isRequired,
    handleChangeStore: PropTypes.func.isRequired,
    handleAdAuthClear: PropTypes.func.isRequired,
  }).isRequired,
}

export default AdAuth
