import { initialState as authControlInitialState } from "../reducers/authControlRdcr";
import { initialState as mtrxControlInitialState } from "../reducers/mtrxControlRdcr";
import { getStoredOidcIdpId, getStoredOidcIssuer } from "../services/oidcAuth";
import { getStoredRestAuthUri } from "../services/restAuth";

// Сид стора: чтение localStorage живёт в слое стора, а не внутри reducers.
// Срез собирается целиком — combineReducers не мержит частичный preloadedState
// с initialState редьюсера, а подменяет срез как есть.
export default function getPreloadedState() {
  return {
    authControlRdcr: {
      ...authControlInitialState,
      uriRestAuth: getStoredRestAuthUri(),
      // OIDC-вход живёт в AUTH-срезе: адрес ресурса IdP задаёт index.html, id провайдера —
      // сохранённое значение (или DEFAULT_OIDC_IDP_ID в сервисе)
      uriOidcAuth: getStoredOidcIssuer(),
      oidcIdpId: getStoredOidcIdpId(),
    },
    mtrxControlRdcr: {
      ...mtrxControlInitialState,
    },
  };
}
