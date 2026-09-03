import {
  createMatrixClientFromSession,
  createTempMatrixClient,
  destroyMatrixClient,
  clearMatrixClientStores,
  getMatrixClient,
  resolveHomeserverUrl,
  persistMatrixSession,
  clearMatrixSession,
  fetchDisplayName,
  startMatrixSync,
  watchMatrixSession,
} from './matrixClient.js'

import {
  MTRX_HS_URL_KEY,
  MTRX_LOGIN_KEY,
  MTRX_ACCESS_TOKEN_KEY,
  MTRX_USER_ID_KEY,
  MTRX_DEVICE_ID_KEY,
  MTRX_REFRESH_TOKEN_KEY,
} from '../constants/storage.js'

const DEVICE_DISPLAY_NAME = 'matrix-react'


function getStoredMatrixLogin() {
  const login = localStorage.getItem(MTRX_LOGIN_KEY) || ''
  const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY) || ''

  return { login, deviceId }
}


async function loginMatrix({ login, password, uriMatrix }) {
  const homeserverUrl = resolveHomeserverUrl(uriMatrix)
  const tempClient = await createTempMatrixClient(homeserverUrl)

  const { login: storedLogin, deviceId: storedLoginDeviceId } = getStoredMatrixLogin()
  const storedDeviceId = storedLogin === login
    ? storedLoginDeviceId || undefined
    : undefined

  const loginResponse = await tempClient.loginRequest({
    type: 'm.login.password',
    identifier: {
      type: 'm.id.user',
      user: login,
    },
    password,
    device_id: storedDeviceId,
    initial_device_display_name: DEVICE_DISPLAY_NAME,
    refresh_token: true,
  })
  
  if (typeof tempClient.stopClient === 'function') {
    tempClient.stopClient()
  }

  let client = null
  try {
    client = await createMatrixClientFromSession({
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

    return {
      client,
      homeserverUrl,
      userId: loginResponse.user_id,
      deviceId: loginResponse.device_id,
      displayName: await fetchDisplayName(client, loginResponse.user_id).catch(() => loginResponse.user_id),
    }
  } catch (error) {
    destroyMatrixClient()
    clearMatrixSession()
    throw error
  }
}


function getStoredMatrixSession() {
  const homeserverUrl = (localStorage.getItem(MTRX_HS_URL_KEY) || '').trim()
  const accessToken = localStorage.getItem(MTRX_ACCESS_TOKEN_KEY)
  const userId = localStorage.getItem(MTRX_USER_ID_KEY)
  const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY)
  const refreshToken = localStorage.getItem(MTRX_REFRESH_TOKEN_KEY)

  if (
    !homeserverUrl || homeserverUrl === 'undefined' ||
    !accessToken || accessToken === 'undefined' ||
    !userId || userId === 'undefined' || !userId.startsWith('@')
  ) {
    return null
  }

  return {
    baseUrl: homeserverUrl, // Читаем из localStorage homeserverUrl, но возвращаем как baseUrl!
    accessToken,
    userId,
    deviceId: deviceId === 'undefined' ? '' : (deviceId || ''),
    refreshToken: refreshToken === 'undefined' ? '' : (refreshToken || ''),
  }
}


async function restoreMatrixSession() {
  const session = getStoredMatrixSession()
  if (!session) return null

  let client = null
  try {
    client = await createMatrixClientFromSession(session)
    await startMatrixSync(client)
  } catch (error) {
    console.error("Критическая ошибка восстановления клиента Matrix:", error)
    destroyMatrixClient()
    clearMatrixSession()
    throw error
  }

  const finalUserId = client.getUserId() || session.userId

  return {
    client,
    homeserverUrl: session.baseUrl, // Меняем обращение с session.homeserverUrl на session.baseUrl
    userId: finalUserId,
    deviceId: session.deviceId || client.getDeviceId() || '',
    displayName: await fetchDisplayName(client, finalUserId).catch(() => finalUserId),
  }
}


function getActiveMatrixSession() {
  const client = getMatrixClient()
  if (!client?.clientRunning) return null

  return {
    client,
    homeserverUrl: (localStorage.getItem(MTRX_HS_URL_KEY) || '').trim(),
    userId: client.getUserId(),
    deviceId: localStorage.getItem(MTRX_DEVICE_ID_KEY) || client.getDeviceId() || '',
    displayName: null,
  }
}


async function logoutMatrix() {
  const client = getMatrixClient()

  if (client) {
    try {
      client.stopClient()
    } catch {
      // Игнорируем ошибки остановки
    }
    
    try {
      await client.logout()
    } catch {
      // Сессия на сервере могла уже истечь, игнорируем ошибку 401/403
    }
    await clearMatrixClientStores(client).catch(() => {})
    destroyMatrixClient()
  }

  clearMatrixSession()
}


async function invalidateMatrixSession() {
  const client = getMatrixClient()
  if (client) {
    await clearMatrixClientStores(client).catch(() => {})
  }
  destroyMatrixClient()
  clearMatrixSession()
}

export {
  loginMatrix,
  getStoredMatrixLogin,
  restoreMatrixSession,
  getActiveMatrixSession,
  logoutMatrix,
  invalidateMatrixSession,
  watchMatrixSession,
}
