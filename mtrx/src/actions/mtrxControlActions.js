import { getMatrixErrorMessage } from './utils/matrixError'
import {
  createMatrixClientFromSession,
  createTempMatrixClient,
  destroyMatrixClient,
  getMatrixClient,
} from '../services/matrixClient'

import {
  MTRXCTL_STORE_VALUE,
  MTRXCTL_SUBMIT_REQUEST,
  MTRXCTL_SUBMIT_SUCCESS,
  MTRXCTL_SUBMIT_ERROR,
  MTRXCTL_CLEAR,
} from '../constants/redux'

import {
  MTRX_HS_URL_KEY,
  MTRX_LOGIN_KEY,
  MTRX_ACCESS_TOKEN_KEY,
  MTRX_USER_ID_KEY,
  MTRX_DEVICE_ID_KEY,
  MTRX_REFRESH_TOKEN_KEY,
} from '../constants/storage'

const DEVICE_DISPLAY_NAME = 'mtrx-web'

// Защита от двойного восстановления сессии (React StrictMode в dev).
let restoreSessionPromise = null

function resolveHomeserverUrl(uriMatrix = '') {
  const url = (uriMatrix || localStorage.getItem(MTRX_HS_URL_KEY) || '').trim()
  if (!url) {
    throw new Error('Не задан URL homeserver Matrix.')
  }
  return url.replace(/\/$/, '')
}

function persistMatrixSession({
  homeserverUrl,
  login,
  accessToken,
  userId,
  deviceId,
  refreshToken,
}) {
  localStorage.setItem(MTRX_HS_URL_KEY, homeserverUrl)
  localStorage.setItem(MTRX_LOGIN_KEY, login)
  localStorage.setItem(MTRX_ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(MTRX_USER_ID_KEY, userId)

  if (deviceId) {
    localStorage.setItem(MTRX_DEVICE_ID_KEY, deviceId)
  } else {
    localStorage.removeItem(MTRX_DEVICE_ID_KEY)
  }

  if (refreshToken) {
    localStorage.setItem(MTRX_REFRESH_TOKEN_KEY, refreshToken)
  } else {
    localStorage.removeItem(MTRX_REFRESH_TOKEN_KEY)
  }
}

function clearMatrixSession() {
  localStorage.removeItem(MTRX_ACCESS_TOKEN_KEY)
  localStorage.removeItem(MTRX_USER_ID_KEY)
  localStorage.removeItem(MTRX_DEVICE_ID_KEY)
  localStorage.removeItem(MTRX_REFRESH_TOKEN_KEY)
}

async function fetchDisplayName(client, userId) {
  try {
    const profile = await client.getProfileInfo(userId)
    return profile.displayname || userId
  } catch {
    return userId
  }
}

async function startMatrixSync(client) {
  if (client.clientRunning) return
  await client.startClient({ initialSyncLimit: 10 })
}

async function dispatchRestoreSuccess(dispatch, client, homeserverUrl, deviceId = '') {
  const userId = client.getUserId()
  const displayName = await fetchDisplayName(client, userId)

  dispatch({
    type: MTRXCTL_SUBMIT_SUCCESS,
    payload: {
      uriMatrix: homeserverUrl,
      responseData: {
        user_id: userId,
        display_name: displayName,
        device_id: deviceId || client.getDeviceId() || '',
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

const handleRegister = function(formData = {}) {
  return async (dispatch) => {
    const login = typeof formData.login === 'string' ? formData.login.trim() : ''
    const password = typeof formData.password === 'string' ? formData.password : ''
    const uriMatrix = typeof formData.uriMatrix === 'string' ? formData.uriMatrix.trim() : ''

    if (!login || !password) {
      dispatchMtrxRegError(dispatch, 'Заполните логин и пароль.')
      return
    }

    let homeserverUrl = ''
    try {
      homeserverUrl = resolveHomeserverUrl(uriMatrix)
    } catch (error) {
      dispatchMtrxRegError(dispatch, error.message)
      return
    }

    dispatch({ type: MTRXCTL_SUBMIT_REQUEST })

    try {
      const tempClient = await createTempMatrixClient(homeserverUrl)

      const loginResponse = await tempClient.loginRequest({
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: login,
        },
        password,
        initial_device_display_name: DEVICE_DISPLAY_NAME,
        refresh_token: true,
      })

      const client = await createMatrixClientFromSession({
        baseUrl: homeserverUrl,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        refreshToken: loginResponse.refresh_token,
      })

      persistMatrixSession({
        homeserverUrl,
        login,
        accessToken: loginResponse.access_token,
        userId: loginResponse.user_id,
        deviceId: loginResponse.device_id,
        refreshToken: loginResponse.refresh_token,
      })

      await startMatrixSync(client)

      const displayName = await fetchDisplayName(client, loginResponse.user_id)

      dispatch({
        type: MTRXCTL_SUBMIT_SUCCESS,
        payload: {
          uriMatrix: homeserverUrl,
          responseData: {
            user_id: loginResponse.user_id,
            display_name: displayName,
            device_id: loginResponse.device_id,
          },
        },
      })
    } catch (error) {
      destroyMatrixClient()
      clearMatrixSession()

      dispatchMtrxRegError(dispatch, getMatrixErrorMessage(error))
    }
  }
}

const handleRegClear = function() {
  return async (dispatch) => {
    const client = getMatrixClient()

    if (client) {
      try {
        await client.logout()
      } catch {
        // Сессия на сервере могла уже истечь — локально всё равно очищаем.
      }
      destroyMatrixClient()
    }

    clearMatrixSession()

    restoreSessionPromise = null
    dispatch({ type: MTRXCTL_CLEAR })
  }
}

const handleRestoreSession = function() {
  return (dispatch, getState) => {
    const { status } = getState().mtrxControlRdcr
    if (status === 'success') return

    if (restoreSessionPromise) {
      return restoreSessionPromise
    }

    const existingClient = getMatrixClient()
    if (existingClient?.clientRunning) {
      const homeserverUrl = (localStorage.getItem(MTRX_HS_URL_KEY) || '').trim()
      const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY) || ''
      return dispatchRestoreSuccess(dispatch, existingClient, homeserverUrl, deviceId)
    }

    const homeserverUrl = (localStorage.getItem(MTRX_HS_URL_KEY) || '').trim()
    const accessToken = localStorage.getItem(MTRX_ACCESS_TOKEN_KEY)
    const userId = localStorage.getItem(MTRX_USER_ID_KEY)
    const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY)
    const refreshToken = localStorage.getItem(MTRX_REFRESH_TOKEN_KEY)

    if (!homeserverUrl || !accessToken || !userId) return

    restoreSessionPromise = (async () => {
      try {
        const client = await createMatrixClientFromSession({
          baseUrl: homeserverUrl,
          accessToken,
          userId,
          deviceId,
          refreshToken,
        })

        await client.whoami()
        await startMatrixSync(client)
        await dispatchRestoreSuccess(dispatch, client, homeserverUrl, deviceId)
      } catch {
        destroyMatrixClient()
        clearMatrixSession()
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
