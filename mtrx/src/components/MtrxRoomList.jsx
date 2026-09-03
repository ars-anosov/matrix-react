import PropTypes from 'prop-types'

import {
  Avatar,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material'

function getRoomInitial(name = '') {
  return name.trim().charAt(0).toUpperCase() || '#'
}

function MtrxRoomList({ rooms, selectedRoomId, onSelect }) {
  if (rooms.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
        В этом аккаунте пока нет комнат.
      </Typography>
    )
  }

  return (
    <List disablePadding aria-label="Список комнат">
      {rooms.map(room => (
        <ListItemButton
          key={room.roomId}
          selected={room.roomId === selectedRoomId}
          onClick={() => onSelect(room)}
          sx={{
            minHeight: 56,
            px: 1,
            py: 0.5,
            borderRadius: 2,
            '&.Mui-selected': {
              bgcolor: 'action.selected',
            },
            '&.Mui-selected:hover': {
              bgcolor: 'action.selected',
            },
          }}
        >
          <ListItemAvatar sx={{ minWidth: 48 }}>
            <Avatar
              src={room.avatarUrl || undefined}
              alt=""
              sx={{ width: 40, height: 40, bgcolor: 'primary.light', fontSize: 15 }}
            >
              {getRoomInitial(room.name)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={room.name}
            secondary={room.roomId}
            primaryTypographyProps={{ noWrap: true, fontSize: 14, fontWeight: 600 }}
            secondaryTypographyProps={{ noWrap: true, fontSize: 11, color: 'text.secondary' }}
          />
        </ListItemButton>
      ))}
    </List>
  )
}

MtrxRoomList.propTypes = {
  rooms: PropTypes.arrayOf(PropTypes.shape({
    roomId: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string,
  })).isRequired,
  selectedRoomId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
}

MtrxRoomList.defaultProps = {
  selectedRoomId: '',
}

export default MtrxRoomList