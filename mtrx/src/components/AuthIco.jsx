import { useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import { IconButton, keyframes, useTheme, alpha } from '@mui/material'

import IconAdminPanelSettings from '@mui/icons-material/AdminPanelSettings'
import IconHowToReg from '@mui/icons-material/HowToReg'
import IconPersonOff from '@mui/icons-material/PersonOff'
import IconSync from '@mui/icons-material/Sync'

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.3); transform: scale(1); }
  70% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); transform: scale(1.05); }
  100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); transform: scale(1); }
`

function AdIco({ authControlRdcr }) {
  const theme = useTheme()
  const status = authControlRdcr?.status

  // Логирование монтирования только для разработки
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('AdIco MOUNT')
      return () => console.log('AdIco UNMOUNT')
    }
  }, [])

  // Кэшируем конфигурацию стиля, чтобы не пересчитывать при каждом рендере
  const cfg = useMemo(() => {
    switch (status) {
      case 'loading':
        return {
          icon: <IconSync />,
          bg: theme.palette.warning.main,
          color: theme.palette.warning.contrastText,
          pulse: true,
        }
      case 'success':
        return {
          icon: <IconHowToReg />,
          bg: alpha(theme.palette.common.white, 0.2),
          color: theme.palette.common.white,
          pulse: false,
        }
      case 'error':
        return {
          icon: <IconPersonOff />,
          bg: theme.palette.error.dark,
          color: theme.palette.error.contrastText,
          pulse: false,
        }
      case 'idle':
      default:
        return {
          icon: <IconAdminPanelSettings />,
          bg: alpha(theme.palette.common.black, 0.2),
          color: theme.palette.action.disabled,
          pulse: false,
        }
    }
  }, [status, theme])

  return (
    <IconButton
      size="small"
      sx={{
        ml: 1,
        width: 46,
        height: 46,
        backgroundColor: cfg.bg,
        color: cfg.color,
        border: `1px solid ${alpha(theme.palette.common.white, 0.3)}`,
        animation: cfg.pulse ? `${pulse} 1.2s infinite` : 'none',
        transition: theme.transitions.create(['background-color', 'transform', 'box-shadow'], {
          duration: theme.transitions.duration.short,
        }),

        '&:hover': {
          backgroundColor: cfg.bg,
          filter: 'brightness(1.1)',
          transform: 'translateY(-1px)',
        },
        '& .MuiSvgIcon-root': {
          fontSize: '1.6rem',
        },
      }}
    >
      {cfg.icon}
    </IconButton>
  )
}

AdIco.propTypes = {
  authControlRdcr: PropTypes.shape({
    status: PropTypes.oneOf(['idle', 'loading', 'success', 'error']),
  }).isRequired,
}

export default AdIco
