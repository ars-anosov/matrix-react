import {
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_CLEAR,
  AUTHCTL_STORE_VALUE,
} from '../constants/redux'

const initialState = {
  displayAd       : false,
  displayControl  : false,
  uriAdAuth       : localStorage.getItem('uriAdAuth') || '',
  status          : 'idle', // 'idle' | 'loading' | 'success' | 'error'
  message         : '',
  responseData    : null,
}

export default function authControlRdcr(state = initialState, action) {
  switch (action.type) {
    case AUTHCTL_SUBMIT_REQUEST:
      return {
        ...state,
        status         : 'loading',
        displayAd      : true,
        message        : '',
        responseData   : null,
      }

    case AUTHCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status         : 'success',
        displayAd      : false,
        message        : action.payload.message || 'Успешно',
        responseData   : action.payload.responseData,
      }

    case AUTHCTL_SUBMIT_ERROR:
      return {
        ...state,
        status         : 'error',
        displayAd      : true,
        message        : action.payload.message || 'Ошибка',
        responseData   : null,
      }

    case AUTHCTL_CLEAR:
      return {
        ...state,
        status          : 'idle',
        message         : '',
        responseData    : null,
      }

    case AUTHCTL_STORE_VALUE:
      return { 
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue
      }

    default:
      return state
  }
}
