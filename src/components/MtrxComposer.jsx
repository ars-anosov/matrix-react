import { AttachFile as IconAttach, Close as IconClose, InsertDriveFileOutlined as IconFile, Send as IconSend } from "@mui/icons-material";
import { alpha, Box, IconButton, LinearProgress, Stack, TextField, Tooltip, Typography, useTheme } from "@mui/material";
import PropTypes from "prop-types";
import { useRef, useState } from "react";

import { ROOM_FILE_MAX_SIZE } from "../constants/ui.js";
import { PAPER_BACKGROUND, roundIconButtonSx } from "../theme.js";
import { formatFileSize } from "./utils/fileFormat.js";

// Поле ввода сообщения комнаты. Отправка — Enter, перенос строки — Shift+Enter.
// Вложение (кнопка-скрепка) уходит отдельным сообщением, а текст в поле — его подписью.
function MtrxComposer({ onSend, onSendFile, placeholder = "Написать сообщение…" }) {
  const theme = useTheme();
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [errText, setErrText] = useState("");
  const fileInputRef = useRef(null);

  // Скрепка — кругляш в стиле остальных действий панели. Поле ввода выше
  // кругляша (40px против 32px), поэтому сдвигаем её на 4px вверх: при
  // alignItems: flex-end центр иконки совпадёт с центром строки текста
  const attachSx = { flexShrink: 0, mb: 0.5, ...roundIconButtonSx(theme, theme.palette.primary.main) };

  // Отправка — без кругляша: иконка ровно по высоте поля (TextField size="small"
  // — 40px), поэтому её центр совпадает со строкой ввода без ручных сдвигов
  const sendSx = {
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 2,
    color: theme.palette.primary.main,
    "&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
    "&.Mui-disabled": { color: alpha(theme.palette.primary.main, 0.3) },
    "& .MuiSvgIcon-root": { fontSize: "1.25rem" },
  };

  const canSend = !isSending && (Boolean(pendingFile) || text.trim().length > 0);

  const clearPendingFile = () => {
    setPendingFile(null);
    setProgress(0);
  };

  const handleSend = async () => {
    if (!canSend) return;

    const body = text.trim();
    const file = pendingFile;
    setIsSending(true);
    setErrText("");

    if (file) {
      setProgress(0);
      try {
        await onSendFile(file, {
          caption: body,
          onProgress: (loaded, total) => setProgress(total > 0 ? Math.round((loaded / total) * 100) : 0),
        });
        clearPendingFile();
        setText("");
      } catch (error) {
        // Вложение оставляем в поле, чтобы отправку можно было повторить
        setErrText(error?.message || "Не удалось отправить файл.");
      } finally {
        setIsSending(false);
      }
      return;
    }

    setText("");

    try {
      await onSend(body);
    } catch (error) {
      // Возвращаем текст в поле, чтобы сообщение не потерялось
      setText(body);
      setErrText(error?.message || "Не удалось отправить сообщение.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    // Незавершённый ввод IME (например, для китайского) не прерываем отправкой
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent?.isComposing) return;
    event.preventDefault();
    handleSend();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    // Сбрасываем input: иначе повторный выбор того же файла не даст события
    event.target.value = "";
    if (!file) return;

    setErrText("");

    if (file.size > ROOM_FILE_MAX_SIZE) {
      clearPendingFile();
      setErrText(`Файл больше ${formatFileSize(ROOM_FILE_MAX_SIZE)} — такое вложение не отправить.`);
      return;
    }

    setPendingFile(file);
  };

  return (
    <Box sx={{ flexShrink: 0, px: 2, py: 1, bgcolor: PAPER_BACKGROUND }}>
      {/* Скрытый input живёт вне Stack: как первый ребёнок он получал бы
          межэлементный отступ MUI и сдвигал скрепку вправо от края */}
      <input ref={fileInputRef} type="file" hidden onChange={handleFileChange} />

      {errText && (
        <Typography variant="caption" color="error" sx={{ display: "block", mb: 0.5 }}>
          {errText}
        </Typography>
      )}

      {pendingFile && (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mb: 0.5, minWidth: 0 }}>
          <IconFile fontSize="small" color="action" />
          <Typography variant="caption" noWrap title={pendingFile.name} sx={{ minWidth: 0, flex: 1 }}>
            {pendingFile.name} · {formatFileSize(pendingFile.size)}
          </Typography>
          <Tooltip title="Убрать вложение">
            <span>
              <IconButton aria-label="Убрать вложение" size="small" disabled={isSending} onClick={clearPendingFile}>
                <IconClose fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      )}

      {isSending && pendingFile && (
        <LinearProgress
          variant={progress > 0 ? "determinate" : "indeterminate"}
          value={progress}
          aria-label="Загрузка вложения"
          sx={{ mb: 0.75, borderRadius: 1 }}
        />
      )}

      {/* useFlexGap: Stack со spacing обнуляет margin'ы прямых детей, а кнопкам
          нужен собственный сдвиг относительно строки ввода */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "flex-end" }}>
        <Tooltip title="Прикрепить файл">
          <span>
            <IconButton aria-label="Прикрепить файл" disabled={isSending} onClick={() => fileInputRef.current?.click()} sx={attachSx}>
              <IconAttach />
            </IconButton>
          </span>
        </Tooltip>
        <TextField
          fullWidth
          multiline
          maxRows={5}
          size="small"
          placeholder={placeholder}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{
            htmlInput: { "aria-label": "Текст сообщения" },
          }}
        />
        <IconButton aria-label="Отправить сообщение" disabled={!canSend} onClick={handleSend} sx={sendSx}>
          <IconSend />
        </IconButton>
      </Stack>
    </Box>
  );
}

MtrxComposer.propTypes = {
  onSend: PropTypes.func.isRequired,
  onSendFile: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default MtrxComposer;
