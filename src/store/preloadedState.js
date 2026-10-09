import { initialState as authControlInitialState } from "../reducers/authControlRdcr";
import { initialState as mtrxControlInitialState } from "../reducers/mtrxControlRdcr";
import { DEFAULT_OIDC_ISSUER, getStoredOidcIdpId, getStoredOidcIssuer } from "../services/oidcAuth";
import { getStoredRestAuthUri } from "../services/restAuth";

// Сид стора: чтение localStorage живёт в слое стора, а не внутри reducers.
// Срез собирается целиком — combineReducers не мержит частичный preloadedState
// с initialState редьюсера, а подменяет срез как есть.
export default function getPreloadedState() {
  return {
    authControlRdcr: {
      ...authControlInitialState,
      uriRestAuth: getStoredRestAuthUri(),
    },
    // Срез Matrix собран целиком: поля OIDC дополнены значениями из localStorage
    mtrxControlRdcr: {
      ...mtrxControlInitialState,
      uriOidcAuth: getStoredOidcIssuer() || DEFAULT_OIDC_ISSUER,
      oidcIdpId: getStoredOidcIdpId(),
    },
  };
}
