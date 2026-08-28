import {
  MTRXCTL_STORE_VALUE,
  MTRXCTL_ERROR_ALERT,
} from '../constants/redux'

import { MTRX_STORAGE_KEY } from '../constants/storage'

const initialState = {
  // --- UI ---
  // MenuAppBar
  displayReg        : true,
  displayPad        : false,
  // MtrxReg form fields
  uriMatrix         : localStorage.getItem('uriMatrix') ? localStorage.getItem('uriMatrix') : '',
  // Error alert
  errComponent      : '',
  errText           : '',
}



export default function mtrxControlRdcr(state = initialState, action) {
  const stateClone = { ...state }

  switch (action.type) {

    case MTRXCTL_STORE_VALUE: {
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      }
    }

    case MTRXCTL_ERROR_ALERT:
      return { ...state,
        'errComponent'      : action.payload.errComponent,
        'errText'           : action.payload.errText,
      }

    default:
      return state;
  }

}
