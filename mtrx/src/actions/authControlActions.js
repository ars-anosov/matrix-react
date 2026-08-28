import ky from 'ky'
import { getApiErrorMessage } from './utils/kyError'

import {
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_CLEAR,
  AUTHCTL_STORE_VALUE,
  
  MTRXCTL_STORE_VALUE,
} from '../constants/redux'

const handleAdRegister = function(formData = {}) {
  return async (dispatch, getState) => {
    const login = typeof formData.login === 'string' ? formData.login.trim() : ''
    const password = typeof formData.password === 'string' ? formData.password.trim() : ''
    const uriAdAuth = typeof formData.uriAdAuth === 'string' ? formData.uriAdAuth.trim() : ''

    if (!login || !password) {
      dispatch({
        type: AUTHCTL_SUBMIT_ERROR,
        payload: { message: 'Заполните логин и пароль.' },
      })
      return
    }

    if (!uriAdAuth) {
      dispatch({
        type: AUTHCTL_SUBMIT_ERROR,
        payload: { message: 'Не задан uriAdAuth.' },
      })
      return
    }
    localStorage.setItem('uriAdAuth', uriAdAuth)

    dispatch({ type: AUTHCTL_SUBMIT_REQUEST })

    try {
      const responseData = await ky.post(uriAdAuth, { 
        json: { login, password }, 
        timeout: 5000 
      }).json()

      localStorage.setItem('adLogin', login)
      const expireTime = Date.now() + 24 * 60 * 60 * 1000
      localStorage.setItem('adAuthExpireTime', expireTime)

      dispatch({
        type: AUTHCTL_SUBMIT_SUCCESS,
        payload: {
          message: 'Успешно',
          responseData: responseData,
        },
      })

      // Воздействие на компоненту MtrxReg
      const state = getState()
      // dispatch()...
      // END OF Воздействие на компоненту MtrxReg

    } catch (error) {
      const detailMessage = await getApiErrorMessage(error)
      
      dispatch({
        type: AUTHCTL_SUBMIT_ERROR,
        payload: { message: detailMessage },
      })
    }
  }
}

const handleAdAuthClear = function() {
  return (dispatch) => {
    // localStorage.removeItem('adLogin')
    localStorage.removeItem('adAuthExpireTime')
    dispatch({ type: AUTHCTL_CLEAR })
  }
}

const handleChangeStore = function(storeDataKey, storeDataValue) {
  return (dispatch) => {
    dispatch({
      type: AUTHCTL_STORE_VALUE,
      payload: { 'storeDataKey': storeDataKey, 'storeDataValue': storeDataValue }
    })
  }
}

export {
  handleAdRegister,
  handleAdAuthClear,
  handleChangeStore
}
