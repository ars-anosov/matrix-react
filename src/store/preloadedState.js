import { initialState as authControlInitialState } from "../reducers/authControlRdcr";
import { initialState as mtrxControlInitialState } from "../reducers/mtrxControlRdcr";
import { getStoredMasIssuer } from "../services/masAuth";
import { getStoredRestAuthUri } from "../services/restAuth";

// Сид стора: чтение localStorage живёт в слое стора, а не внутри reducers.
// Срез собирается целиком — combineReducers не мержит частичный preloadedState
// с initialState редьюсера, а подменяет срез как есть.
export default function getPreloadedState() {
  return {
    authControlRdcr: {
      ...authControlInitialState,
      uriRestAuth: getStoredRestAuthUri(),
      // OIDC-вход живёт в AUTH-срезе: issuer MAS узнаётся из auth_metadata homeserver,
      // а сохранённое значение нужно только для подписи источника до первого входа
      oidcIssuer: getStoredMasIssuer(),
    },
    mtrxControlRdcr: {
      ...mtrxControlInitialState,
    },
  };
}
