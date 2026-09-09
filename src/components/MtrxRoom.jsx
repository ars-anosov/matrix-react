import { List, ListItem, ListItemText, Paper, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { Fragment } from "react";

const ALLOWED_FORMATTED_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "CODE",
  "DEL",
  "DIV",
  "EM",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "I",
  "LI",
  "OL",
  "P",
  "PRE",
  "S",
  "STRONG",
  "U",
  "UL",
]);

function formatMessageTime(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function getMessageSecondary(message) {
  const time = formatMessageTime(message.timestamp);
  return time ? `${message.sender} · ${time}` : message.sender;
}

function getSafeHref(value) {
  if (typeof value !== "string") return null;

  try {
    const baseUrl =
      typeof window === "undefined"
        ? "http://localhost"
        : window.location.origin;
    const url = new URL(value, baseUrl);
    return ["http:", "https:", "mailto:"].includes(url.protocol)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function renderFormattedNode(node, key) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return null;

  const tagName = node.tagName.toUpperCase();
  const children = Array.from(node.childNodes).map((child, index) =>
    renderFormattedNode(child, `${key}-${index}`),
  );

  if (tagName === "BR") return <br key={key} />;
  if (tagName === "A") {
    const href = getSafeHref(node.getAttribute("href"));
    if (!href) return <Fragment key={key}>{children}</Fragment>;

    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ overflowWrap: "anywhere" }}
      >
        {children}
      </a>
    );
  }

  if (!ALLOWED_FORMATTED_TAGS.has(tagName)) {
    return <Fragment key={key}>{children}</Fragment>;
  }

  const Tag = tagName.toLowerCase();
  return <Tag key={key}>{children}</Tag>;
}

function renderMessageBody(message) {
  if (!message.formattedBody || typeof DOMParser === "undefined") {
    return message.body;
  }

  const document = new DOMParser().parseFromString(
    message.formattedBody,
    "text/html",
  );

  return Array.from(document.body.childNodes).map((node, index) =>
    renderFormattedNode(node, `formatted-${message.eventId}-${index}`),
  );
}

function MtrxRoom({ room }) {
  const messages = room.messages || [];

  return (
    <Paper
      variant="outlined"
      sx={{
        minHeight: 220,
        p: 2,
        borderRadius: 2,
      }}
    >
      <Typography variant="h6" component="h2" noWrap>
        {room.name}
      </Typography>
      <Typography variant="caption" component="pre" noWrap>
        {room.roomId}
      </Typography>

      {messages.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Сообщений пока нет.
        </Typography>
      ) : (
        <List
          disablePadding
          aria-label={`Последние сообщения комнаты ${room.name}`}
          sx={{ maxHeight: 300, overflowY: "auto", mt: 2 }}
        >
          {messages.map((message) => (
            <ListItem
              key={message.eventId}
              disableGutters
              alignItems="flex-start"
            >
              <ListItemText
                primary={renderMessageBody(message)}
                secondary={getMessageSecondary(message)}
                slotProps={{
                  primary: {
                    component: "div",
                    sx: {
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                    },
                  },
                  secondary: {
                    noWrap: true,
                    fontSize: 11,
                    color: "text.secondary",
                  },
                }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
}

MtrxRoom.propTypes = {
  room: PropTypes.shape({
    roomId: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string,
    messages: PropTypes.arrayOf(
      PropTypes.shape({
        eventId: PropTypes.string.isRequired,
        sender: PropTypes.string.isRequired,
        body: PropTypes.string.isRequired,
        formattedBody: PropTypes.string,
        timestamp: PropTypes.number.isRequired,
      }),
    ),
  }).isRequired,
};

export default MtrxRoom;
