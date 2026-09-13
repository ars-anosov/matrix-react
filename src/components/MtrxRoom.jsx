import { ForumOutlined as IconForum } from "@mui/icons-material";
import { Avatar, Box, Divider, List, ListItem, Paper, Stack, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { Fragment, useEffect, useRef } from "react";

import { HEADER_BACKGROUND } from "../constants/ui.js";

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

const AVATAR_COLORS = ["primary.main", "secondary.main", "info.main", "success.main", "warning.dark", "error.main"];

function formatMessageTime(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function getMessageDate(timestamp) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(timestamp);
}

function getInitials(value = "") {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function getAvatarColor(value = "") {
  const hash = Array.from(value).reduce((result, character) => result + character.charCodeAt(0), 0);

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getMessageCountLabel(count) {
  const remainder = count % 10;
  const lastTwoDigits = count % 100;

  if (remainder === 1 && lastTwoDigits !== 11) return `${count} сообщение`;
  if (remainder >= 2 && remainder <= 4 && (lastTwoDigits < 10 || lastTwoDigits >= 20)) {
    return `${count} сообщения`;
  }

  return `${count} сообщений`;
}

function renderFormattedNode(node, key) {
  if (node.nodeType === 3) return node.nodeValue;
  if (node.nodeType !== 1) return null;

  const tagName = node.tagName.toUpperCase();
  const children = Array.from(node.childNodes).map((child, index) => renderFormattedNode(child, `${key}-${index}`));

  if (tagName === "BR") return <br key={key} />;
  if (tagName === "A") {
    const href = getSafeHref(node.getAttribute("href"));
    if (!href) return <Fragment key={key}>{children}</Fragment>;

    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer" style={{ overflowWrap: "anywhere" }}>
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

function getSafeHref(value) {
  if (typeof value !== "string") return null;

  try {
    const baseUrl = typeof window === "undefined" ? "http://localhost" : window.location.origin;
    const url = new URL(value, baseUrl);
    return ["http:", "https:", "mailto:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function renderMessageBody(message) {
  if (!message.formattedBody || typeof DOMParser === "undefined") {
    return message.body;
  }

  const document = new DOMParser().parseFromString(message.formattedBody, "text/html");

  return Array.from(document.body.childNodes).map((node, index) =>
    renderFormattedNode(node, `formatted-${message.eventId}-${index}`),
  );
}

function MtrxRoom({ room, fullHeight = false }) {
  const messages = room.messages || [];
  const messageListRef = useRef(null);
  const roomId = room.roomId;

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!roomId || !messageList || messages.length === 0) return;

    messageList.scrollTop = messageList.scrollHeight;
  }, [roomId, messages.length]);

  return (
    <Paper
      variant="outlined"
      sx={{
        height: fullHeight ? "100%" : undefined,
        minHeight: fullHeight ? 0 : 220,
        overflow: "hidden",
        borderRadius: 3,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: fullHeight ? "flex" : undefined,
        flexDirection: fullHeight ? "column" : undefined,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        sx={{
          alignItems: "center",
          px: 2,
          py: 1.5,
          flexShrink: 0,
          bgcolor: HEADER_BACKGROUND,
        }}
      >
        <Avatar
          src={room.avatarUrl || undefined}
          alt=""
          sx={{
            width: 42,
            height: 42,
            bgcolor: "transparent",
            color: "text.primary",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {getInitials(room.name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" component="h2" noWrap fontWeight={700}>
            {room.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap title={room.roomId} sx={{ display: "block" }}>
            {room.subtitle || room.roomId}
          </Typography>
        </Box>
        {messages.length > 0 && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexShrink: 0, display: { xs: "none", sm: "block" } }}
          >
            {getMessageCountLabel(messages.length)}
          </Typography>
        )}
      </Stack>

      <Divider />

      {messages.length === 0 ? (
        <Stack
          spacing={1}
          sx={{
            minHeight: fullHeight ? 0 : 220,
            flex: fullHeight ? 1 : undefined,
            alignItems: "center",
            justifyContent: "center",
            px: 2,
            py: 4,
            color: "text.secondary",
            textAlign: "center",
          }}
        >
          <IconForum sx={{ fontSize: 32, opacity: 0.55 }} />
          <Typography variant="body2">Сообщений пока нет.</Typography>
          <Typography variant="caption">Здесь появятся новые сообщения комнаты</Typography>
        </Stack>
      ) : (
        <List
          ref={messageListRef}
          disablePadding
          aria-label={`Последние сообщения комнаты ${room.name}`}
          sx={{
            maxHeight: fullHeight ? undefined : 320,
            flex: fullHeight ? 1 : undefined,
            minHeight: fullHeight ? 0 : undefined,
            overflowY: "auto",
            bgcolor: "background.default",
            px: { xs: 1, sm: 1.5 },
            py: 1,
            scrollbarWidth: "thin",
          }}
        >
          {messages.map((message, index) => {
            const previousMessage = messages[index - 1];
            const isContinuation = previousMessage?.sender === message.sender;
            const messageDate = getMessageDate(message.timestamp);
            const previousDate = getMessageDate(previousMessage?.timestamp);
            const showDateDivider = messageDate && messageDate !== previousDate;

            return (
              <Fragment key={message.eventId}>
                {showDateDivider && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 0.5, py: 1 }}>
                    <Divider sx={{ flex: 1 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                      {messageDate}
                    </Typography>
                    <Divider sx={{ flex: 1 }} />
                  </Stack>
                )}
                <ListItem
                  disableGutters
                  alignItems="flex-start"
                  sx={{
                    gap: 1.25,
                    px: 0.5,
                    py: isContinuation ? 0.35 : 0.75,
                    borderRadius: 1.5,
                    transition: "background-color 120ms ease",
                    "&:hover": {
                      bgcolor: "action.hover",
                      "& .message-time": { opacity: 1 },
                    },
                  }}
                >
                  <Avatar
                    alt=""
                    sx={{
                      width: 34,
                      height: 34,
                      mt: isContinuation ? 0.25 : 0,
                      flexShrink: 0,
                      visibility: isContinuation ? "hidden" : "visible",
                      bgcolor: getAvatarColor(message.sender),
                      objectFit: "cover",
                      color: "common.white",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                    src={message.avatarUrl || undefined}
                  >
                    {getInitials(message.sender)}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    {!isContinuation && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: "baseline", minWidth: 0 }}>
                        <Typography
                          variant="body2"
                          component="span"
                          noWrap
                          sx={{
                            minWidth: 0,
                            maxWidth: "75%",
                            color: getAvatarColor(message.sender),
                            fontWeight: 700,
                          }}
                        >
                          {message.sender}
                        </Typography>
                        <Typography variant="caption" component="span" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {formatMessageTime(message.timestamp)}
                        </Typography>
                      </Stack>
                    )}
                    {isContinuation && formatMessageTime(message.timestamp) && (
                      <Typography
                        className="message-time"
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          float: "right",
                          ml: 1,
                          opacity: 0,
                          transition: "opacity 120ms ease",
                        }}
                      >
                        {formatMessageTime(message.timestamp)}
                      </Typography>
                    )}
                    <Box
                      component="div"
                      sx={{
                        mt: isContinuation ? 0 : 0.15,
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                        color: "text.primary",
                        fontSize: 14,
                        lineHeight: 1.4,
                        "& p": { my: 0 },
                        "& p + p": { mt: 1 },
                        "& a": { color: "primary.main" },
                        "& blockquote": {
                          m: 0,
                          pl: 1.5,
                          borderLeft: 3,
                          borderColor: "divider",
                          color: "text.secondary",
                        },
                        "& code": {
                          px: 0.5,
                          py: 0.15,
                          borderRadius: 0.75,
                          bgcolor: "action.selected",
                          fontFamily: "monospace",
                          fontSize: "0.9em",
                        },
                        "& pre": {
                          m: 0,
                          p: 1,
                          overflowX: "auto",
                          borderRadius: 1,
                          bgcolor: "action.selected",
                          fontFamily: "monospace",
                        },
                        "& ul, & ol": { mt: 0.5, mb: 0, pl: 2.5 },
                      }}
                    >
                      {renderMessageBody(message)}
                    </Box>
                  </Box>
                </ListItem>
              </Fragment>
            );
          })}
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
    subtitle: PropTypes.string,
    messages: PropTypes.arrayOf(
      PropTypes.shape({
        eventId: PropTypes.string.isRequired,
        sender: PropTypes.string.isRequired,
        avatarUrl: PropTypes.string,
        body: PropTypes.string.isRequired,
        formattedBody: PropTypes.string,
        timestamp: PropTypes.number.isRequired,
      }),
    ),
  }).isRequired,
  fullHeight: PropTypes.bool,
};

export default MtrxRoom;
