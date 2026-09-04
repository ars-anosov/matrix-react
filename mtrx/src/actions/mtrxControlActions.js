import {
  getMatrixErrorMessage
} from './utils/matrixError'
import {
  loginMatrix,
  restoreMatrixSession,
  getActiveMatrixSession,
  logoutMatrix,
  invalidateMatrixSession,
  watchMatrixSession,
} from '../services/matrixClient'

import {
  MTRXCTL_STORE_VALUE,
  MTRXCTL_SUBMIT_REQUEST,
  MTRXCTL_SUBMIT_SUCCESS,
  MTRXCTL_SUBMIT_ERROR,
  MTRXCTL_CLEAR,
} from '../constants/redux'

let restoreSessionPromise = null
let sessionOperationId = 0

function dispatchMatrixSuccess(dispatch, session) {
  dispatch({
    type: MTRXCTL_SUBMIT_SUCCESS,
    payload: {
      responseData: {
        user_id: session.userId,
        display_name: session.displayName || session.userId,
        device_id: session.deviceId,
      },
    },
  })
}

function dispatchMtrxRegError(dispatch, errText) {
  dispatch({
    type: MTRXCTL_SUBMIT_ERROR,
    payload: { errText },
  })
}

function watchSessionAndDispatchClear(dispatch, operationId, client) {
  if (!client) return 

  watchMatrixSession(client, () => {
    if (operationId !== sessionOperationId) return
    invalidateMatrixSession().finally(() => {
      if (operationId === sessionOperationId) dispatch({ type: MTRXCTL_CLEAR })
    })
  })
}

const handleRegister = function(formData = {}) {
  return async (dispatch) => {
    const operationId = ++sessionOperationId
    const login = typeof formData.login === 'string' ? formData.login.trim() : ''
    const password = typeof formData.password === 'string' ? formData.password : ''
    const uriMatrix = typeof formData.uriMatrix === 'string' ? formData.uriMatrix.trim() : ''

    if (!login || !password) {
      dispatchMtrxRegError(dispatch, 'Заполните логин и пароль.')
      return
    }

    dispatch({ type: MTRXCTL_SUBMIT_REQUEST })

    try {
      const session = await loginMatrix({ login, password, uriMatrix })
      if (operationId !== sessionOperationId) return

      watchSessionAndDispatchClear(dispatch, operationId, session.client)
      dispatchMatrixSuccess(dispatch, session)
    } catch (error) {
      if (operationId === sessionOperationId) {
        dispatchMtrxRegError(dispatch, getMatrixErrorMessage(error))
      }
    }
  }
}

const handleRegClear = function() {
  return async (dispatch) => {
    sessionOperationId += 1
    restoreSessionPromise = null
    await logoutMatrix()
    dispatch({ type: MTRXCTL_CLEAR })
  }
}

const handleRestoreSession = function() {
  return (dispatch, getState) => {
    // Если в Redux статус уже success — ничего не делаем
    if (getState().mtrxControlRdcr.status === 'success') return
    // Если промис восстановления уже запущен — возвращаем его, избегая дублирования
    if (restoreSessionPromise) return restoreSessionPromise

    const operationId = ++sessionOperationId

    // Проверяем синхронную активную сессию
    const activeSession = getActiveMatrixSession()
    if (activeSession) {
      // Обязательно подписываемся на события даже активной сессии
      watchSessionAndDispatchClear(dispatch, operationId, activeSession.client)
      dispatchMatrixSuccess(dispatch, activeSession)
      return
    }

    // Если активной сессии в памяти нет (перезагрузка страницы), запускаем асинхронное восстановление из хранилища
    restoreSessionPromise = (async () => {
      try {
        const session = await restoreMatrixSession()
        
        if (operationId !== sessionOperationId) return

        if (session) {
          watchSessionAndDispatchClear(dispatch, operationId, session.client)
          dispatchMatrixSuccess(dispatch, session)
        } else {
          // Если сохраненных токенов нет или они невалидны
          dispatch({ type: MTRXCTL_CLEAR })
        }
      } catch (error) {
        console.error("Ошибка восстановления сессии Matrix:", error)
        if (operationId === sessionOperationId) {
          dispatch({ type: MTRXCTL_CLEAR })
        }
      } finally {
        restoreSessionPromise = null
      }
    })()

    return restoreSessionPromise
  }
}

const handleChangeStore = function(storeDataKey, storeDataValue) {
  return (dispatch) => {
    dispatch({
      type: MTRXCTL_STORE_VALUE,
      payload: { storeDataKey, storeDataValue },
    })
  }
}

export {
  handleRegister,
  handleRegClear,
  handleRestoreSession,
  handleChangeStore,
}
