// Статус E2EE рисуют два места — кнопка в подвале MtrxPad и справка в MtrxInfo,
// поэтому цвет и подпись считаются в одном месте и не разъезжаются.
// Зелёный — только авторизованное устройство, всё остальное серое:
// неавторизованное устройство ничего не запрещает, а без подключения статус
// проверки вообще неизвестен, поэтому красный здесь только пугал бы.
export function getE2eeConfig(status, deviceVerified, isVerificationPending = false) {
  // Пришёл запрос SAS от другого устройства — это важнее статуса самого устройства
  if (isVerificationPending) {
    return { label: "Другое устройство просит подтвердить сессию", color: "warning.main" };
  }

  if (status === "success" && deviceVerified) {
    return { label: "Устройство авторизовано для E2EE", color: "success.main" };
  }

  if (status === "success") {
    return { label: "Устройство не авторизовано для E2EE", color: "text.secondary" };
  }

  return { label: "E2EE: устройство не проверено — нет подключения", color: "text.secondary" };
}
