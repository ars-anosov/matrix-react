import { useEffect } from 'react'
import PropTypes from 'prop-types'

import {
  Paper,
  Typography,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material'

import {
  HowToReg as IconHowToReg,
  PersonOff as IconPersonOff,
} from '@mui/icons-material'

function AuthAdInfo(props) {
  const {
    authControlRdcr, 
    authControlActions,
    showFull = false
  } = props

  if (import.meta.env.DEV) {
    console.log('AuthAdInfo render')
  }

  useEffect(() => {
    if (import.meta.env.DEV) console.log('AuthAdInfo MOUNT')
    return () => {
      if (import.meta.env.DEV) console.log('AuthAdInfo UNMOUNT')
    }
  }, [])

  const toggleAuth = () => {
    authControlActions?.handleChangeStore('displayAd', !authControlRdcr?.displayAd)
  }

  const isAuthorized = authControlRdcr?.status === 'success'
  const authButtonColor = isAuthorized ? 'success' : 'error'

  return (
    <Paper 
      elevation={ showFull ? 8 : 0 } 
      sx={{ 
        maxWidth: 320, 
        width: '100%', 
        mx: 'auto', 
        mt: 2,
        p: showFull ? 1 : 0, 
        borderRadius: 3, 
        position: 'relative'
      }}
    >

    <Typography 
      variant='body2' 
      component="pre"
      sx={{ overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
    >
{`cn\t\t\t${authControlRdcr?.responseData?.ad_cn || ''}
title:\t\t${authControlRdcr?.responseData?.ad_title || ''}
department:\t${authControlRdcr?.responseData?.ad_department || ''}

SIP num:\t${authControlRdcr?.responseData?.sip_username || ''}`}
    </Typography>

      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Tooltip title={isAuthorized ? "Деавторизоваться" : "Авторизоваться"}>
          <IconButton
            color={authButtonColor}
            onClick={toggleAuth}
          >
            {isAuthorized ? <IconHowToReg /> : <IconPersonOff />}
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  )
}

AuthAdInfo.propTypes = {
  authControlRdcr: PropTypes.object.isRequired,
  authControlActions: PropTypes.object.isRequired,
  showFull: PropTypes.bool,
}

export default AuthAdInfo
