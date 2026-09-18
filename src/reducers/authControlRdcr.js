import { AUTHCTL_CLEAR, AUTHCTL_STORE_VALUE, AUTHCTL_SUBMIT_ERROR, AUTHCTL_SUBMIT_REQUEST, AUTHCTL_SUBMIT_SUCCESS } from "../constants/redux";

// Только UI-дефолты: сохранённые значения (uriAdAuth) подставляет сид стора —
// store/preloadedState.js → preloadedState в configureStore.
export const initialState = {
  displayAd: false,
  // Мост к сервисам показываем после успешной AD-авторизации (AUTHCTL_SUBMIT_SUCCESS);
  // на старте вместо него — ссылки на обе формы авторизации (AuthLinks)
  displayAuthPad: false,
  displayControl: false,
  uriAdAuth: "",
  status: "idle", // 'idle' | 'loading' | 'success' | 'error'
  responseData: null,
  errText: "",
};

export default function authControlRdcr(state = initialState, action) {
  switch (action.type) {
    case AUTHCTL_SUBMIT_REQUEST:
      return {
        ...state,
        status: "loading",
        displayAd: true,
        responseData: null,
        errText: "",
      };

    case AUTHCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status: "success",
        displayAd: false,
        displayAuthPad: true,
        responseData: action.payload.responseData,
        errText: "",
      };

    case AUTHCTL_SUBMIT_ERROR: {
      const errText = action.payload.errText || "Ошибка";
      return {
        ...state,
        status: "error",
        // Форму открывает только displayAd — других флагов, удерживающих окно,
        // нет, поэтому ✕, Escape и клик по подложке её закрывают.
        displayAd: true,
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

    default:
      return state;
  }
}
