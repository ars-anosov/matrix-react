import { applyMiddleware, legacy_createStore as createStore } from "redux";
// Middleware
import { createLogger } from "redux-logger";
import { thunk } from "redux-thunk";
import { createAuthTimeoutMiddleware } from "../reducers/authTimeoutMiddleware";
import rootReducer from "../reducers/rootReducer";
import { clearAdAuthSession, isAdAuthSessionExpired } from "../services/adAuth";
import getPreloadedState from "./preloadedState";

// Единственное место, где стор сходится с сервисами: сид (preloadedState) и
// зависимости middleware. Reducers и middleware сервисов не импортируют.
export default function configureStore(preloadedState = getPreloadedState()) {
  const logger = createLogger();
  const authTimeoutMiddleware = createAuthTimeoutMiddleware({
    isSessionExpired: isAdAuthSessionExpired,
    clearSession: clearAdAuthSession,
  });
  const middlewareProd = [thunk, authTimeoutMiddleware];
  const middlewareDev = [thunk, authTimeoutMiddleware, logger];

  const store = createStore(rootReducer, preloadedState, import.meta.env.PROD ? applyMiddleware(...middlewareProd) : applyMiddleware(...middlewareDev));

  return store;
}
