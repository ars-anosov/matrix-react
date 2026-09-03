export function getMatrixErrorMessage(error) {
  if (!error) return 'Неизвестная ошибка'

  if (typeof error.error === 'string' && error.error.trim()) {
    return error.error.trim()
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim()
  }

  if (typeof error.errcode === 'string' && error.errcode.trim()) {
    return error.errcode.trim()
  }

  return 'Ошибка авторизации Matrix'
}
