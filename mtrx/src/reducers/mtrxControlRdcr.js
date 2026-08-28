import {
  MTRXCTL_STORE_VALUE,
  MTRXCTL_ERROR_ALERT,
  MTRXCTL_SUBMIT_REQUEST,
  MTRXCTL_SUBMIT_SUCCESS,
  MTRXCTL_SUBMIT_ERROR,
  MTRXCTL_CLEAR,
} from '../constants/redux'

import { MTRX_HS_URL_KEY } from '../constants/storage'

const initialState = {
  // --- UI ---
  displayReg: true,
  displayPad: false,
  displayControl: true,
  uriMatrix: localStorage.getItem(MTRX_HS_URL_KEY) || '',
  // --- Auth ---
  status: 'idle', // 'idle' | 'loading' | 'success' | 'error'
  responseData: null,
  // Error alert
  errComponent: '',
  errText: '',
}

export default function mtrxControlRdcr(state = initialState, action) {
  switch (action.type) {
    case MTRXCTL_SUBMIT_REQUEST:
      return {
        ...state,
        status: 'loading',
        displayReg: true,
        displayPad: false,
        responseData: null,
        errComponent: '',
        errText: '',
      }

    case MTRXCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status: 'success',
        displayReg: false,
        displayPad: true,
        responseData: action.payload.responseData,
        uriMatrix: action.payload.uriMatrix || state.uriMatrix,
        errComponent: '',
        errText: '',
      }

    case MTRXCTL_SUBMIT_ERROR: {
      const errText = action.payload.errText || 'Ошибка'
      return {
        ...state,
        status: 'error',
        displayReg: true,
        displayPad: false,
        responseData: null,
        errComponent: 'MtrxReg',
        errText,
      }
    }

    case MTRXCTL_CLEAR:
      return {
        ...state,
        status: 'idle',
        displayPad: false,
        responseData: null,
        errComponent: '',
        errText: '',
      }

    case MTRXCTL_STORE_VALUE:
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      }

    case MTRXCTL_ERROR_ALERT:
      return {
        ...state,
        errComponent: action.payload.errComponent,
        errText: action.payload.errText,
      }

    default:
      return state
  }
}
