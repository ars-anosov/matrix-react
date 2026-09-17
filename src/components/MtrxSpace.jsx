import { ChevronRight as IconChevron, WorkspacesOutlined as IconSpace } from "@mui/icons-material";
import { Box, List, ListItemButton, ListItemText, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";

import { PAPER_BACKGROUND } from "../theme.js";

// Пространство Matrix — не чат: сообщения в нём не пишутся, внутри лежат комнаты.
function MtrxSpace({ room, onSelectRoom }) {
  const children = room.children || [];

  return (
    <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, px: 2, py: 3, bgcolor: PAPER_BACKGROUND, overflowY: "auto" }}>
      <Stack spacing={0.5} sx={{ alignItems: "center", textAlign: "center", color: "text.secondary" }}>
        <IconSpace sx={{ fontSize: 36, opacity: 0.55 }} />
        <Typography variant="body1" fontWeight={600} color="text.primary">
          Это пространство
        </Typography>
        <Typography variant="caption">Пространство объединяет комнаты, писать сообщения в нём нельзя</Typography>
      </Stack>

      {children.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
          В пространстве пока нет комнат.
        </Typography>
      ) : (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", px: 1, pb: 0.5 }}>
            Комнаты пространства
          </Typography>
          <List disablePadding aria-label={`Комнаты пространства ${room.name}`}>
            {children.map((child) => (
              <ListItemButton key={child.roomId} onClick={() => onSelectRoom(child.roomId)} sx={{ minHeight: 44, px: 1.25, borderRadius: 2, my: 0.25 }}>
                <ListItemText
                  primary={child.name}
                  slotProps={{
                    primary: { noWrap: true, fontSize: 14, fontWeight: 600 },
                  }}
                />
                <IconChevron fontSize="small" color="action" sx={{ flexShrink: 0 }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
    </Stack>
  );
}

MtrxSpace.propTypes = {
  room: PropTypes.shape({
    roomId: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    children: PropTypes.arrayOf(
      PropTypes.shape({
        roomId: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
      }),
    ),
  }).isRequired,
  onSelectRoom: PropTypes.func.isRequired,
};

export default MtrxSpace;
