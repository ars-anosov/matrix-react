import {
  AudiotrackOutlined as IconAudio,
  DownloadOutlined as IconDownload,
  InsertDriveFileOutlined as IconFile,
  ImageOutlined as IconImage,
  MovieOutlined as IconVideo,
} from "@mui/icons-material";
import { Box, IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

import { formatFileSize } from "./utils/fileFormat.js";

const MEDIA_ICONS = {
  "m.audio": IconAudio,
  "m.file": IconFile,
  "m.image": IconImage,
  "m.video": IconVideo,
};

// Вложение в таймлайне: картинка — превью, остальные типы — карточка с именем,
// размером и кнопкой скачивания. Само скачивание идёт через onDownload (сервис).
function MtrxAttachment({ message, onDownload }) {
  const [errText, setErrText] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);

  const media = message.media;
  const filename = message.filename || "Файл";
  const hasPreview = message.msgType === "m.image" && Boolean(message.mediaPreviewUrl);
  const Icon = MEDIA_ICONS[message.msgType] || IconFile;
  const sizeLabel = formatFileSize(media?.size);

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setErrText("");

    try {
      await onDownload(message);
    } catch (error) {
      setErrText(error?.message || "Не удалось скачать файл.");
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadButton = (
    <Tooltip title="Скачать">
      <span>
        <IconButton aria-label={`Скачать ${filename}`} size="small" disabled={isDownloading} onClick={handleDownload}>
          <IconDownload fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Box sx={{ mt: 0.25, maxWidth: "100%" }}>
      {hasPreview ? (
        <Box sx={{ maxWidth: 320 }}>
          <Box
            component="img"
            src={message.mediaPreviewUrl}
            alt={filename}
            onClick={handleDownload}
            sx={{
              display: "block",
              maxWidth: "100%",
              maxHeight: 260,
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
              bgcolor: "action.hover",
              cursor: "pointer",
            }}
          />
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.25, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap title={filename} sx={{ minWidth: 0, flex: 1 }}>
              {filename} · {sizeLabel}
            </Typography>
            {downloadButton}
          </Stack>
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ display: "inline-flex", alignItems: "center", gap: 1, px: 1.25, py: 0.75, borderRadius: 2, maxWidth: "100%" }}>
          <Icon fontSize="small" color="action" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap title={filename}>
              {filename}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sizeLabel}
            </Typography>
          </Box>
          {downloadButton}
        </Paper>
      )}

      {errText && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.25 }}>
          {errText}
        </Typography>
      )}
    </Box>
  );
}

MtrxAttachment.propTypes = {
  message: PropTypes.shape({
    msgType: PropTypes.string.isRequired,
    filename: PropTypes.string,
    mediaPreviewUrl: PropTypes.string,
    media: PropTypes.shape({
      url: PropTypes.string.isRequired,
      size: PropTypes.number,
    }),
  }).isRequired,
  onDownload: PropTypes.func.isRequired,
};

export default MtrxAttachment;
