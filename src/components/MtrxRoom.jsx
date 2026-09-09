import { Paper, Typography } from "@mui/material";
import PropTypes from "prop-types";

function MtrxRoom({ room }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        minHeight: 220,
        p: 2,
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" component="h2">
        {room.name}
      </Typography>
      <Typography variant="caption" component="pre">
        {room.roomId}
      </Typography>
    </Paper>
  );
}

MtrxRoom.propTypes = {
  room: PropTypes.shape({
    roomId: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string,
  }).isRequired,
};

export default MtrxRoom;
