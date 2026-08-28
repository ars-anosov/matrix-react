import { HTTPError } from 'ky'

/**
 * Парсит ошибку от Ky и возвращает текстовое сообщение для пользователя
 * @param {Error} error - Объект ошибки из блока catch
 * @param {string} defaultMessage - Сообщение по умолчанию
 * @returns {Promise<string>}
 */
export const getApiErrorMessage = async (error, defaultMessage = 'Не удалось выполнить запрос.') => {
  if (error instanceof HTTPError) {
    // Безопасно пытаемся прочитать JSON от сервера. 
    // Если там не JSON, catch вернет null и мы возьмем статус-текст (например, "Internal Server Error")
    const data = await error.response.json().catch(() => null)
    return data?.message || data?.error || data?.detail || error.response.statusText || defaultMessage
  }

  if (error.name === 'TimeoutError') {
    return 'Время ожидания запроса истекло. Сервер не отвечает.'
  }

  if (error.name === 'TypeError') {
    return 'Сетевая ошибка. Проверьте подключение к интернету.'
  }

  return error.message || defaultMessage
}
