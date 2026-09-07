import { applyMiddleware, legacy_createStore as createStore } from "redux";
// Middleware
import { createLogger } from "redux-logger";
import { thunk } from "redux-thunk";
import { authTimeoutMiddleware } from "../reducers/authTimeoutMiddleware";
import rootReducer from "../reducers/rootReducer";

export default function configureStore(initialState) {
  const logger = createLogger();
  const middlewareProd = [thunk, authTimeoutMiddleware];
  const middlewareDev = [thunk, authTimeoutMiddleware, logger];

  const store = createStore(
    rootReducer,
    initialState,
    import.meta.env.PROD
      ? applyMiddleware(...middlewareProd)
      : applyMiddleware(...middlewareDev),
  );

  return store;
}
