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

function MtrxInfo(props) {
  const {
    mtrxControlRdcr,
    mtrxControlActions,
    showFull = false,
  } = props

  if (import.meta.env.DEV) {
    console.log('MtrxInfo render')
  }

  useEffect(() => {
    if (import.meta.env.DEV) console.log('MtrxInfo MOUNT')
    return () => {
      if (import.meta.env.DEV) console.log('MtrxInfo UNMOUNT')
    }
  }, [])

  const toggleAuth = () => {
    mtrxControlActions?.handleChangeStore('displayReg', !mtrxControlRdcr?.displayReg)
  }

  const isAuthorized = mtrxControlRdcr?.status === 'success'
  const authButtonColor = isAuthorized ? 'success' : 'error'

  return (
    <Paper
      elevation={showFull ? 8 : 0}
      sx={{
        maxWidth: 320,
        width: '100%',
        mx: 'auto',
        mt: 2,
        p: showFull ? 1 : 0,
        borderRadius: 3,
        position: 'relative',
      }}
    >
      <Typography
        variant="body2"
        component="pre"
        sx={{ overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
      >
{`display_name:\t${mtrxControlRdcr?.responseData?.display_name || ''}
user_id:\t\t${mtrxControlRdcr?.responseData?.user_id || ''}
device_id:\t${mtrxControlRdcr?.responseData?.device_id || ''}

homeserver:\t${mtrxControlRdcr?.uriMatrix || ''}`}
      </Typography>

      {mtrxControlRdcr?.status === 'error' && mtrxControlRdcr?.errText && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {mtrxControlRdcr.errText}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: 'space-between', alignItems: 'center' }}>
        <Tooltip title={isAuthorized ? 'Деавторизоваться' : 'Авторизоваться'}>
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

MtrxInfo.propTypes = {
  mtrxControlRdcr: PropTypes.object.isRequired,
  mtrxControlActions: PropTypes.object.isRequired,
  showFull: PropTypes.bool,
}

export default MtrxInfo
