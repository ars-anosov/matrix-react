import { applyMiddleware, legacy_createStore as createStore } from "redux";
// Middleware
import { createLogger } from "redux-logger";
import { thunk } from "redux-thunk";
import rootReducer from "../reducers/rootReducer";
import getPreloadedState from "./preloadedState";

// Единственное место, где стор сходится с сервисами: сид (preloadedState).
// Reducers и middleware сервисов не импортируют.
export default function configureStore(preloadedState = getPreloadedState()) {
  const logger = createLogger();
  const middlewareProd = [thunk];
  const middlewareDev = [thunk, logger];

  return createStore(rootReducer, preloadedState, import.meta.env.PROD ? applyMiddleware(...middlewareProd) : applyMiddleware(...middlewareDev));
}
