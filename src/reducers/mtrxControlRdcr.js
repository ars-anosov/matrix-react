import {
  MTRXCTL_CLEAR,
  MTRXCTL_ERROR_ALERT,
  MTRXCTL_SET_ROOMS,
  MTRXCTL_STORE_MATRIX_DATA,
  MTRXCTL_STORE_VALUE,
  MTRXCTL_SUBMIT_ERROR,
  MTRXCTL_SUBMIT_REQUEST,
  MTRXCTL_SUBMIT_SUCCESS,
} from "../constants/redux";

const initialState = {
  // --- UI ---
  displayReg: true,
  displayPad: false,
  displayControl: true,
  // --- Auth ---
  status: "idle", // 'idle' | 'loading' | 'success' | 'error'
  responseData: null,
  // --- Stored matrix data / rooms ---
  uriMatrix: "",
  login: "",
  rooms: [],
  // Error alert
  errComponent: "",
  errText: "",
};

export default function mtrxControlRdcr(state = initialState, action) {
  switch (action.type) {
    case MTRXCTL_SUBMIT_REQUEST:
      return {
        ...state,
        status: "loading",
        displayReg: true,
        displayPad: false,
        responseData: null,
        rooms: [],
        errComponent: "",
        errText: "",
      };

    case MTRXCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status: "success",
        displayReg: false,
        displayPad: true,
        responseData: action.payload.responseData,
        rooms: [],
        errComponent: "",
        errText: "",
      };

    case MTRXCTL_SUBMIT_ERROR: {
      const errText = action.payload.errText || "Ошибка";
      return {
        ...state,
        status: "error",
        displayReg: true,
        displayPad: false,
        responseData: null,
        rooms: [],
        errComponent: "MtrxReg",
        errText,
      };
    }

    case MTRXCTL_CLEAR:
      return {
        ...state,
        status: "idle",
        displayReg: true,
        displayPad: false,
        responseData: null,
        rooms: [],
        errComponent: "",
        errText: "",
      };

    case MTRXCTL_STORE_VALUE:
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      };

    case MTRXCTL_ERROR_ALERT:
      return {
        ...state,
        errComponent: action.payload.errComponent,
        errText: action.payload.errText,
      };

    case MTRXCTL_STORE_MATRIX_DATA:
      return {
        ...state,
        uriMatrix: action.payload.uriMatrix,
        login: action.payload.login,
      };

    case MTRXCTL_SET_ROOMS:
      return {
        ...state,
        rooms: action.payload.rooms,
      };

    default:
      return state;
  }
}
