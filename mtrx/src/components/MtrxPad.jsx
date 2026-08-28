import { useState, useEffect, useRef } from 'react'
import PropTypes from 'prop-types'

import {
  Paper,
  Stack,
  IconButton,
  Typography,
} from '@mui/material'

import {
  Close as IconClose,
} from '@mui/icons-material'


function MtrxPad(props) {
  if (import.meta.env.DEV) console.log('MtrxPad hook')

  const {
    mtrxControlRdcr, mtrxControlActions,
    showInput
  } = props

  useEffect(() => {
    if (import.meta.env.DEV) console.log('MtrxPad MOUNT')

    return () => {
      if (import.meta.env.DEV) console.log('MtrxPad UNMOUNT')
    }
  }, [])

  const handleClose = () => {
    mtrxControlActions.handleChangeStore('displayPad', false)
  }


  return (
    <Paper 
      elevation={8} 
      sx={{ 
        minWidth: 320, maxWidth: 500,
        width: '100%',
        minHeight: 200,
        mx: 'auto',
        mt: 2,
        p: 1,
        borderRadius: 3,
        position: 'relative'
      }}
    >

      <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" color="primary">Matrix мессенджер</Typography>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={handleClose} sx={{ position: 'absolute', top: 4, right: 4 }}>
            <IconClose color="action" />
          </IconButton>
        </Stack>
      </Stack>

    </Paper>
  )
}



MtrxPad.propTypes = {
  mtrxControlRdcr      : PropTypes.object.isRequired,
  mtrxControlActions   : PropTypes.object.isRequired,
  showInput            : PropTypes.bool.isRequired,
}

export default MtrxPad
