import { applyMiddleware, legacy_createStore as createStore } from "redux";
// Middleware
import { createLogger } from "redux-logger";
import { thunk } from "redux-thunk";
import { createAuthTimeoutMiddleware, startAuthTimeoutCheck } from "../reducers/authTimeoutMiddleware";
import rootReducer from "../reducers/rootReducer";
import { clearAdAuthSession, isAdAuthSessionExpired } from "../services/adAuth";
import getPreloadedState from "./preloadedState";

// Единственное место, где стор сходится с сервисами: сид (preloadedState) и
// зависимости middleware. Reducers и middleware сервисов не импортируют.
export default function configureStore(preloadedState = getPreloadedState()) {
  const logger = createLogger();
  const authTimeoutMiddleware = createAuthTimeoutMiddleware({ clearSession: clearAdAuthSession });
  const middlewareProd = [thunk, authTimeoutMiddleware];
  const middlewareDev = [thunk, authTimeoutMiddleware, logger];

  const store = createStore(rootReducer, preloadedState, import.meta.env.PROD ? applyMiddleware(...middlewareProd) : applyMiddleware(...middlewareDev));

  // Проверку срока AD-сессии запускаем после сборки стора: во время applyMiddleware
  // dispatch запрещён, а здесь он уже безопасен.
  startAuthTimeoutCheck({
    store,
    isSessionExpired: isAdAuthSessionExpired,
    clearSession: clearAdAuthSession,
  });

  return store;
}
