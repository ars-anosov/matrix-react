import {
  AUTHCTL_CLEAR,
  AUTHCTL_OIDC_CLEAR,
  AUTHCTL_OIDC_ERROR,
  AUTHCTL_OIDC_READY,
  AUTHCTL_OIDC_REQUEST,
  AUTHCTL_OIDC_SUCCESS,
  AUTHCTL_SELECT_AUTH_SOURCE,
  AUTHCTL_STORE_VALUE,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
} from "../constants/redux";

// Только UI-дефолты: сохранённые значения (uriRestAuth, oidcIssuer) подставляет
// сид стора — store/preloadedState.js → preloadedState в configureStore.
export const initialState = {
  displayRest: false,
  // Мост к сервисам показываем после успешной авторизации (REST или OIDC);
  // на старте вместо него — ссылки на формы авторизации (AuthLinks)
  displayAuthPad: false,
  displayControl: false,
  uriRestAuth: "",
  status: "idle", // 'idle' | 'loading' | 'success' | 'error'
  responseData: null,
  errText: "",
  // --- OIDC (OAuth 2.0) через MAS ---
  // Вход общий для приложения, поэтому его форма и ход входа живут в этом срезе, а не в
  // Matrix: сюда приходит готовность токенов, а сессию Matrix по ним поднимает MTRXCTL_.
  displayOidc: false,
  // Issuer MAS из auth_metadata homeserver: известен после первого входа, сохранённое
  // значение подставляет сид стора (store/preloadedState.js)
  oidcIssuer: "",
  // 'idle' | 'loading' | 'ready' | 'success' | 'error'.
  // ready — токены получены и ждут клика тумблера AuthPad; success — сессия по ним поднята,
  // то есть токены израсходованы (повторно запускать ими нельзя)
  oidcStatus: "idle",
  oidcErrText: "",
  // Источник, которым поднимается сессия Matrix: 'rest' (матричная пара из REST-ответа)
  // или 'oidc' (токены MAS). Пусто, пока данных нет ни от одного источника
  activeAuthSource: null,
};

// Источник сбрасывает выбор только если активным был именно он: данные второго
// источника в этот момент могут быть ещё готовы к запуску
function releaseAuthSource(state, source) {
  return state.activeAuthSource === source ? null : state.activeAuthSource;
}

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
        // Последний полученный источник становится активным; явный выбор пользователя
        // в панели может быть сделан и после этого
        activeAuthSource: "rest",
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
        activeAuthSource: releaseAuthSource(state, "rest"),
      };
    }

    case AUTHCTL_CLEAR:
      return {
        ...state,
        status: "idle",
        displayAuthPad: false,
        responseData: null,
        errText: "",
        activeAuthSource: releaseAuthSource(state, "rest"),
      };

    case AUTHCTL_STORE_VALUE:
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      };

    case AUTHCTL_SELECT_AUTH_SOURCE:
      return {
        ...state,
        activeAuthSource: action.payload.source || null,
      };

    case AUTHCTL_OIDC_REQUEST:
      return {
        ...state,
        oidcStatus: "loading",
        oidcErrText: "",
      };

    case AUTHCTL_OIDC_READY:
      return {
        ...state,
        oidcStatus: "ready",
        oidcErrText: "",
        // Issuer приходит из auth_metadata MAS и кэшируется сервисом; в сторе он нужен
        // для подписи источника до следующего discovery
        oidcIssuer: action.payload?.issuer || state.oidcIssuer,
        // Форма ушла в редирект, поэтому её закрываем, а панель с готовым тумблером
        // открываем — запуск сессии остаётся за кликом пользователя (3b)
        displayOidc: false,
        displayAuthPad: true,
        activeAuthSource: "oidc",
      };

    case AUTHCTL_OIDC_SUCCESS:
      return {
        ...state,
        oidcStatus: "success",
        oidcErrText: "",
        displayOidc: false,
      };

    case AUTHCTL_OIDC_ERROR: {
      const errText = action.payload.errText || "Ошибка";
      return {
        ...state,
        oidcStatus: "error",
        // Ошибку показывает форма, поэтому открываем её: при возврате из MAS
        // её никто не открывал, а после неудачного запуска токенов перезапуск — здесь
        displayOidc: true,
        oidcErrText: errText,
        activeAuthSource: releaseAuthSource(state, "oidc"),
      };
    }

    case AUTHCTL_OIDC_CLEAR: {
      // Готовые токены закрытие формы не отменяет: окно могли открыть только чтобы посмотреть
      // статус источника. Ошибку и прочие состояния закрытие сбрасывает
      const keepReady = state.oidcStatus === "ready";

      return {
        ...state,
        displayOidc: false,
        oidcStatus: keepReady ? "ready" : "idle",
        oidcErrText: "",
        activeAuthSource: keepReady ? state.activeAuthSource : releaseAuthSource(state, "oidc"),
      };
    }

    default:
      return state;
  }
}
