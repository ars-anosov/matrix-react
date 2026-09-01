import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'

import {
  Paper,
  Stack,
  IconButton,
  Typography,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Box,
  Divider,
} from '@mui/material'

import {
  Close as IconClose,
} from '@mui/icons-material'

import { getJoinedRooms, watchRoomChanges } from '../services/matrixClient'

function MtrxPad(props) {
  if (import.meta.env.DEV) console.log('MtrxPad hook')

  const {
    mtrxControlRdcr, mtrxControlActions,
    showInput
  } = props

  const [rooms, setRooms] = useState([])

  useEffect(() => {
    if (import.meta.env.DEV) console.log('MtrxPad MOUNT')

    return () => {
      if (import.meta.env.DEV) console.log('MtrxPad UNMOUNT')
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadRooms = async () => {
      try {
        const joinedRooms = await getJoinedRooms()
        if (isMounted) setRooms(joinedRooms)
      } catch {
        if (isMounted) setRooms([])
      }
    }

    if (mtrxControlRdcr.status === 'success') {
      loadRooms()
      const unsubscribe = watchRoomChanges(() => {
        loadRooms()
      })
      return () => {
        unsubscribe()
        isMounted = false
      }
    }

    setRooms([])
    return () => {
      isMounted = false
    }
  }, [mtrxControlRdcr.status])

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

      <Divider sx={{ mb: 1 }} />

      <Box sx={{ maxHeight: 360, overflowY: 'auto', pr: 1 }}>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Комнаты
        </Typography>

        {rooms.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            В этом аккаунте пока нет комнат.
          </Typography>
        ) : (
          <List disablePadding>
            {rooms.map(room => (
              <ListItem key={room.roomId} disablePadding sx={{ py: 0.5 }}>
                <ListItemAvatar>
                  <Avatar
                    src={room.avatarUrl || undefined}
                    alt={room.name}
                    sx={{ width: 36, height: 36, bgcolor: 'primary.light', fontSize: 14 }}
                  >
                    {room.name.charAt(0).toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={room.name}
                  secondary={room.roomId}
                  primaryTypographyProps={{ noWrap: true, fontSize: 14 }}
                  secondaryTypographyProps={{ noWrap: true, fontSize: 11, color: 'text.secondary' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Paper>
  )
}



MtrxPad.propTypes = {
  mtrxControlRdcr      : PropTypes.object.isRequired,
  mtrxControlActions   : PropTypes.object.isRequired,
  showInput            : PropTypes.bool.isRequired,
}

export default MtrxPad
