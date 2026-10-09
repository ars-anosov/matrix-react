import {
  AUTHCTL_CLEAR,
  AUTHCTL_OIDC_CLEAR,
  AUTHCTL_OIDC_ERROR,
  AUTHCTL_OIDC_REQUEST,
  AUTHCTL_OIDC_SUCCESS,
  AUTHCTL_STORE_VALUE,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
} from "../constants/redux";

// Только UI-дефолты: сохранённые значения (uriRestAuth, uriOidcAuth, oidcIdpId) подставляет
// сид стора — store/preloadedState.js → preloadedState в configureStore.
export const initialState = {
  displayRest: false,
  // Мост к сервисам показываем после успешной REST-авторизации (AUTHCTL_SUBMIT_SUCCESS);
  // на старте вместо него — ссылки на обе формы авторизации (AuthLinks)
  displayAuthPad: false,
  displayControl: false,
  uriRestAuth: "",
  status: "idle", // 'idle' | 'loading' | 'success' | 'error'
  responseData: null,
  errText: "",
  // --- OIDC (OAuth 2.0) через authentik ---
  // Вход общий для приложения, поэтому его форма и ход входа живут в этом срезе, а не в
  // Matrix: сюда приходит loginToken, а сессию Matrix по нему поднимает MTRXCTL_.
  displayOidc: false,
  // Адрес ресурса IdP: сохранённое значение подставляет сид стора (store/preloadedState.js)
  uriOidcAuth: "",
  // id провайдера на стороне Synapse (GET /login → m.login.sso.identity_providers[].id)
  oidcIdpId: "",
  oidcStatus: "idle", // 'idle' | 'loading' | 'success' | 'error'
  oidcResponseData: null,
  oidcErrText: "",
};

export default function authControlRdcr(state = initialState, action) {
  switch (action.type) {
    case AUTHCTL_SUBMIT_REQUEST:
      return {
        ...state,
        status: "loading",
        displayRest: true,
        responseData: null,
        errText: "",
      };

    case AUTHCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status: "success",
        displayRest: false,
        displayAuthPad: true,
        responseData: action.payload.responseData,
        errText: "",
      };

    case AUTHCTL_SUBMIT_ERROR: {
      const errText = action.payload.errText || "Ошибка";
      return {
        ...state,
        status: "error",
        // Форму открывает только displayRest — других флагов, удерживающих окно,
        // нет, поэтому ✕, Escape и клик по подложке её закрывают.
        displayRest: true,
        responseData: null,
        errText,
      };
    }

    case AUTHCTL_CLEAR:
      return {
        ...state,
        status: "idle",
        displayAuthPad: false,
        responseData: null,
        errText: "",
      };

    case AUTHCTL_STORE_VALUE:
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      };

    case AUTHCTL_OIDC_REQUEST:
      return {
        ...state,
        oidcStatus: "loading",
        oidcResponseData: null,
        oidcErrText: "",
      };

    case AUTHCTL_OIDC_SUCCESS:
      return {
        ...state,
        oidcStatus: "success",
        // Форма — модальное окно: на успешном входе её закрываем, чат открывает MTRXCTL_
        displayOidc: false,
        oidcResponseData: action.payload.responseData,
        oidcErrText: "",
      };

    case AUTHCTL_OIDC_ERROR: {
      const errText = action.payload.errText || "Ошибка";
      return {
        ...state,
        oidcStatus: "error",
        // displayOidc не трогаем: форму открыл пользователь, и ошибку показывает её Alert
        oidcResponseData: null,
        oidcErrText: errText,
      };
    }

    case AUTHCTL_OIDC_CLEAR:
      return {
        ...state,
        // «Выйти» закрывает форму — как и MTRXCTL_CLEAR до переноса OIDC в этот срез
        displayOidc: false,
        oidcStatus: "idle",
        oidcResponseData: null,
        oidcErrText: "",
      };

    default:
      return state;
  }
}
