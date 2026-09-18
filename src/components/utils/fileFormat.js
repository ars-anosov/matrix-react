// Размер файла для UI: `512 Б`, `12,4 КБ`, `3,1 МБ`.
export function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} Б`;

  const units = ["КБ", "МБ", "ГБ"];
  let value = size / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
}
