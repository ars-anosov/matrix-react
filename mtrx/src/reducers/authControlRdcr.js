import {
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_CLEAR,
  AUTHCTL_STORE_VALUE,
  AUTHCTL_ERROR_ALERT,
} from '../constants/redux'

import { AD_URI_AUTH_KEY } from '../constants/storage'

const initialState = {
  displayAd: false,
  displayControl: false,
  uriAdAuth: localStorage.getItem(AD_URI_AUTH_KEY) || '',
  status: 'idle', // 'idle' | 'loading' | 'success' | 'error'
  responseData: null,
  errComponent: '',
  errText: '',
}

export default function authControlRdcr(state = initialState, action) {
  switch (action.type) {
    case AUTHCTL_SUBMIT_REQUEST:
      return {
        ...state,
        status: 'loading',
        displayAd: true,
        responseData: null,
        errComponent: '',
        errText: '',
      }

    case AUTHCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status: 'success',
        displayAd: false,
        responseData: action.payload.responseData,
        errComponent: '',
        errText: '',
      }

    case AUTHCTL_SUBMIT_ERROR: {
      const errText = action.payload.errText || 'Ошибка'
      return {
        ...state,
        status: 'error',
        displayAd: true,
        responseData: null,
        errComponent: 'AuthAd',
        errText,
      }
    }

    case AUTHCTL_CLEAR:
      return {
        ...state,
        status: 'idle',
        responseData: null,
        errComponent: '',
        errText: '',
      }

    case AUTHCTL_STORE_VALUE:
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      }

    case AUTHCTL_ERROR_ALERT:
      return {
        ...state,
        errComponent: action.payload.errComponent,
        errText: action.payload.errText,
      }

    default:
      return state
  }
}
