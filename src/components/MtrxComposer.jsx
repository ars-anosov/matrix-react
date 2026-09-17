import { Send as IconSend } from "@mui/icons-material";
import { Box, IconButton, Stack, TextField, Typography } from "@mui/material";
import PropTypes from "prop-types";
import { useState } from "react";

import { PAPER_BACKGROUND } from "../theme.js";

// Поле ввода сообщения комнаты. Отправка — Enter, перенос строки — Shift+Enter.
function MtrxComposer({ onSend, placeholder = "Написать сообщение…" }) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errText, setErrText] = useState("");

  const canSend = !isSending && text.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;

    const body = text.trim();
    setIsSending(true);
    setErrText("");
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

  return (
    <Box sx={{ flexShrink: 0, px: { xs: 1, sm: 1.5 }, py: 1, bgcolor: PAPER_BACKGROUND }}>
      {errText && (
        <Typography variant="caption" color="error" sx={{ display: "block", mb: 0.5, px: 0.5 }}>
          {errText}
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ alignItems: "flex-end" }}>
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
        <IconButton aria-label="Отправить сообщение" color="primary" disabled={!canSend} onClick={handleSend} sx={{ mb: 0.25, flexShrink: 0 }}>
          <IconSend />
        </IconButton>
      </Stack>
    </Box>
  );
}

MtrxComposer.propTypes = {
  onSend: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default MtrxComposer;
