// Причины, по которым авторизация устройства recovery key не проходит.
// Код едет из сервиса (matrixClient) через actions в Redux (deviceVerification.errCode),
// а MtrxDeviceVerification выбирает по нему подсказку и действие: у «в аккаунте нет
// Secret Storage» и «ключ не подходит к аккаунту» разные выходы из ситуации.
export const VERIFICATION_ERR = {
  // Строка не похожа на recovery key Matrix: base58, байт чётности, префикс, длина
  INVALID_KEY: "MTRX_VERIFICATION_INVALID_KEY",
  // В аккаунте нет Secret Storage: сверять введённый ключ не с чем
  NO_SECRET_STORAGE: "MTRX_VERIFICATION_NO_SECRET_STORAGE",
  // Secret Storage есть, но введённый ключ к нему не подходит
  KEY_MISMATCH: "MTRX_VERIFICATION_KEY_MISMATCH",
  // Ключ верный, но приватных ключей кросс-подписи нет ни на устройстве, ни в
  // Secret Storage: одним ключом устройство не авторизовать (нужно SAS или сброс)
  CROSS_SIGNING_MISSING: "MTRX_VERIFICATION_CROSS_SIGNING_MISSING",
  // Сброс шифрования не удался: неверный пароль, отказ UIA, сеть
  RESET_FAILED: "MTRX_VERIFICATION_RESET_FAILED",
  // Первый /sync не пришёл: account data аккаунта ещё не читается
  SYNC_INCOMPLETE: "MTRX_VERIFICATION_SYNC_INCOMPLETE",
  // Хранилище уже есть: создавать новое нельзя, иначе старые секреты потеряются
  STORAGE_EXISTS: "MTRX_VERIFICATION_STORAGE_EXISTS",
};
