import { AUTHCTL_CLEAR } from "../constants/redux";

// Выносим переменную на уровень модуля.
// Теперь она гарантированно существует в единственном экземпляре.
let intervalId = null;

const AUTH_TIMEOUT_CHECK_MS = 10000;

// Сервисы сюда не импортируются: сброс AD-сессии инжектит configureStore —
// единственное место, где стор сходится с сервисами.
export const createAuthTimeoutMiddleware =
  ({ clearSession }) =>
  () =>
  (next) =>
  (action) => {
    // Любой сброс AD-сессии (в том числе по таймауту) чистит и её срок в хранилище.
    if (action.type === AUTHCTL_CLEAR) {
      clearSession();
    }

    return next(action);
  };

/**
 * Запускает проверку срока AD-сессии: сразу и дальше раз в `intervalMs`.
 *
 * Вызывать только после `createStore`: во время `applyMiddleware` Redux запрещает
 * dispatch («Dispatching while constructing your middleware is not allowed»),
 * поэтому middleware не может проверять срок в момент своей сборки.
 */
export function startAuthTimeoutCheck({ store, isSessionExpired, clearSession, intervalMs = AUTH_TIMEOUT_CHECK_MS }) {
  if (intervalId) return;

  const checkTokenExpiration = () => {
    if (!isSessionExpired()) return;

    if (import.meta.env.DEV) {
      console.warn("Время AD-сессии истекло. Очищаем данные.");
    }

    clearSession();
    store.dispatch({ type: AUTHCTL_CLEAR });
  };

  checkTokenExpiration();
  intervalId = setInterval(checkTokenExpiration, intervalMs);
}
