import { AUTHCTL_CLEAR } from '../constants/redux'

// Выносим переменную на уровень модуля. 
// Теперь она гарантированно существует в единственном экземпляре.
let intervalId = null

export const authTimeoutMiddleware = (store) => {
  
  const checkTokenExpiration = () => {
    const expireTime = localStorage.getItem('adAuthExpireTime')
    
    if (expireTime) {
      const now = Date.now()
      
      if (now > Number(expireTime)) {
        if (import.meta.env.DEV) {
          console.warn('Время сессии истекло (вызов из Middleware). Очищаем данные.')
        }

        localStorage.removeItem('adAuthExpireTime')
        store.dispatch({ type: AUTHCTL_CLEAR }) 
      }
    }
  }

  // Запускаем интервал строго один раз
  if (!intervalId) {
    checkTokenExpiration() // Проверка прямо в момент инициализации приложения
    intervalId = setInterval(checkTokenExpiration, 10000)
  }

  return (next) => (action) => {
    if (action.type === AUTHCTL_CLEAR) {
      localStorage.removeItem('adAuthExpireTime')
    }

    return next(action)
  }
}
