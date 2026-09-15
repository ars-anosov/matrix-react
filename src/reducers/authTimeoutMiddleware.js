import { AUTHCTL_CLEAR } from "../constants/redux";

// Выносим переменную на уровень модуля.
// Теперь она гарантированно существует в единственном экземпляре.
let intervalId = null;

// Сервисы сюда не импортируются: чтение срока и сброс AD-сессии инжектит
// configureStore — единственное место, где стор сходится с сервисами.
export const createAuthTimeoutMiddleware =
  ({ isSessionExpired, clearSession }) =>
  (store) => {
    const checkTokenExpiration = () => {
      if (isSessionExpired()) {
        if (import.meta.env.DEV) {
          console.warn("Время сессии истекло (вызов из Middleware). Очищаем данные.");
        }

        clearSession();
        store.dispatch({ type: AUTHCTL_CLEAR });
      }
    };

    // Запускаем интервал строго один раз
    if (!intervalId) {
      checkTokenExpiration(); // Проверка прямо в момент инициализации приложения
      intervalId = setInterval(checkTokenExpiration, 10000);
    }

    return (next) => (action) => {
      if (action.type === AUTHCTL_CLEAR) {
        clearSession();
      }

      return next(action);
    };
  };
