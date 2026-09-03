import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { getStoredMatrixLogin } from '../services/matrixAuth'

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

function MtrxReg(props) {
  const {
    mtrxControlRdcr,
    mtrxControlActions,
  } = props
  
  const [login, setLogin] = useState(getStoredMatrixLogin)
  const [password, setPassword] = useState('')
  const [uriMatrix, setUriMatrix] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const isLoading = mtrxControlRdcr.status === 'loading'
  const isError = mtrxControlRdcr.status === 'error'
  const isSuccess = mtrxControlRdcr.status === 'success'
  const responseData = mtrxControlRdcr.responseData

  // Синхронизируем URI из глобального стора при его изменении
  useEffect(() => {
    setUriMatrix(mtrxControlRdcr.uriMatrix || '')
  }, [mtrxControlRdcr.uriMatrix])

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!login.trim() || !password.trim()) return
    mtrxControlActions.handleRegister({ login, password, uriMatrix })
  }

  const handleReset = () => {
    // setLogin('')
    setPassword('')
    setUriMatrix(mtrxControlRdcr.uriMatrix || '')
    mtrxControlActions.handleRegClear()
  }

  const handleClose = () => {
    mtrxControlActions.handleChangeStore('displayReg', false)
  }

  const isSubmitDisabled = isLoading || isSuccess || !login.trim() || !password.trim() || (import.meta.env.DEV && !uriMatrix.trim())

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
          Matrix
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          {isSuccess
            ? (responseData?.display_name || responseData?.user_id || '')
            : 'Введите учетные данные'
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
            id="MtrxRegLogin"
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
            id="MtrxRegPassword"
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
              id="uriMatrix"
              label="Matrix URI (Dev Only)"
              variant="outlined"
              size="small"
              value={uriMatrix}
              onChange={(event) => setUriMatrix(event.target.value)}
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
          {mtrxControlRdcr.errText}
        </Alert>
      </Collapse>
    </Paper>
  )
}

MtrxReg.propTypes = {
  mtrxControlRdcr: PropTypes.shape({
    uriMatrix: PropTypes.string,
    status: PropTypes.string,
    errText: PropTypes.string,
    responseData: PropTypes.shape({
      user_id: PropTypes.string,
      display_name: PropTypes.string,
      device_id: PropTypes.string,
    }),
  }).isRequired,
  mtrxControlActions: PropTypes.shape({
    handleRegister: PropTypes.func.isRequired,
    handleChangeStore: PropTypes.func.isRequired,
    handleRegClear: PropTypes.func.isRequired,
  }).isRequired,
}

export default MtrxReg
