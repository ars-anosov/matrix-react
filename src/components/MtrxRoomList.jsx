import { Avatar, List, ListItemAvatar, ListItemButton, ListItemText, Typography } from "@mui/material";
import PropTypes from "prop-types";

import { PAPER_BACKGROUND } from "../theme.js";

function getRoomInitial(name = "") {
  return name.trim().charAt(0).toUpperCase() || "#";
}

function MtrxRoomList({ rooms, selectedRoomId = "", onSelect, fullHeight = false }) {
  if (rooms.length === 0) {
    return (
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          height: fullHeight ? "100%" : undefined,
          bgcolor: PAPER_BACKGROUND,
          display: fullHeight ? "flex" : undefined,
          alignItems: fullHeight ? "center" : undefined,
          justifyContent: fullHeight ? "center" : undefined,
          px: 1,
          py: 2,
          textAlign: "center",
        }}
      >
        В этом аккаунте пока нет комнат.
      </Typography>
    );
  }

  return (
    <List
      disablePadding
      aria-label="Список комнат"
      sx={{
        height: fullHeight ? "100%" : undefined,
        maxHeight: fullHeight ? undefined : 360,
        bgcolor: PAPER_BACKGROUND,
        overflowY: "auto",
        scrollbarWidth: "thin",
      }}
    >
      {rooms.map((room) => (
        <ListItemButton
          key={room.roomId}
          selected={room.roomId === selectedRoomId}
          onClick={() => onSelect(room)}
          sx={{
            minHeight: 52,
            px: 1.25,
            py: 0.75,
            my: 0.25,
            borderRadius: 2,
            transition: "all 150ms ease",
            "&.Mui-selected": {
              bgcolor: "action.selected",
              "& .MuiListItemText-primary": {
                color: "primary.main",
              },
            },
            "&.Mui-selected:hover": {
              bgcolor: "action.selected",
            },
          }}
        >
          <ListItemAvatar sx={{ minWidth: 46 }}>
            <Avatar
              src={room.avatarUrl || undefined}
              alt=""
              sx={{
                width: 38,
                height: 38,
                bgcolor: "action.selected",
                color: "text.primary",
                fontSize: 15,
                fontWeight: 600,
              }}
            >
              {getRoomInitial(room.name)}
            </Avatar>
          </ListItemAvatar>
          <ListItemText
            primary={room.name}
            // secondary={room.roomId}
            slotProps={{
              primary: { noWrap: true, fontSize: 14, fontWeight: 600 },
              secondary: {
                noWrap: true,
                fontSize: 11,
                color: "text.secondary",
              },
            }}
          />
        </ListItemButton>
      ))}
    </List>
  );
}

MtrxRoomList.propTypes = {
  rooms: PropTypes.arrayOf(
    PropTypes.shape({
      roomId: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      avatarUrl: PropTypes.string,
    }),
  ).isRequired,
  selectedRoomId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
  fullHeight: PropTypes.bool,
};

export default MtrxRoomList;
