import { initialState as authControlInitialState } from "../reducers/authControlRdcr";
import { getStoredAdAuthUri } from "../services/adAuth";

// Сид стора: чтение localStorage живёт в слое стора, а не внутри reducers.
// Срез собирается целиком — combineReducers не мержит частичный preloadedState
// с initialState редьюсера, а подменяет срез как есть.
export default function getPreloadedState() {
  return {
    authControlRdcr: {
      ...authControlInitialState,
      uriAdAuth: getStoredAdAuthUri(),
    },
  };
}
