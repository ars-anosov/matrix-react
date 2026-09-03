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

const DEVICE_DISPLAY_NAME = 'mtrx-web'

/**
 * Возвращает сохранённые логин и device_id из одного места, чтобы не
 * дублировать чтение из localStorage в разных местах. deviceId возвращается,
 * только если он относится к тому же login (на случай, если раньше в этом
 * браузере логинился другой пользователь).
 */
function getStoredMatrixLogin() {
  const login = localStorage.getItem(MTRX_LOGIN_KEY) || ''
  const deviceId = localStorage.getItem(MTRX_DEVICE_ID_KEY) || ''

  return { login, deviceId }
}

async function loginMatrix({ login, password, uriMatrix }) {
  const homeserverUrl = resolveHomeserverUrl(uriMatrix)
  const tempClient = await createTempMatrixClient(homeserverUrl)

  // Если для этого логина уже сохранён device_id (тот же браузер,
  // повторный вход после logout/истечения токена) — передаём его серверу,
  // чтобы он переиспользовал существующее устройство, а не плодил новое.
  // Без этого /login каждый раз создаёт НОВОЕ устройство, а локальная
  // rust-crypto база (общая, с фиксированным именем) остаётся привязана
  // к старому device_id — отсюда бесконечный mismatch при initRustCrypto().
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
  tempClient.stopClient?.()

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
      displayName: await fetchDisplayName(client, loginResponse.user_id),
    }
  } catch (error) {
    destroyMatrixClient()
    clearMatrixSession()
    throw error
  }
}

function getStoredMatrixSession() {
  const session = {
    homeserverUrl: (localStorage.getItem(MTRX_HS_URL_KEY) || '').trim(),
    accessToken: localStorage.getItem(MTRX_ACCESS_TOKEN_KEY),
    userId: localStorage.getItem(MTRX_USER_ID_KEY),
    deviceId: localStorage.getItem(MTRX_DEVICE_ID_KEY),
    refreshToken: localStorage.getItem(MTRX_REFRESH_TOKEN_KEY),
  }

  if (!session.homeserverUrl || !session.accessToken || !session.userId) return null
  return session
}

async function restoreMatrixSession() {
  const session = getStoredMatrixSession()
  if (!session) return null

  let client = null
  try {
    client = await createMatrixClientFromSession(session)
    await client.whoami()
    await startMatrixSync(client)
  } catch (error) {
    destroyMatrixClient()
    clearMatrixSession()
    throw error
  }

  return {
    client,
    homeserverUrl: session.homeserverUrl,
    userId: client.getUserId(),
    deviceId: session.deviceId || client.getDeviceId() || '',
    displayName: await fetchDisplayName(client, client.getUserId()),
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
    client.stopClient()
    try {
      await client.logout()
    } catch {
      // Сессия на сервере могла уже истечь.
    }
    await clearMatrixClientStores(client).catch(() => {})
    destroyMatrixClient()
  }

  clearMatrixSession()
}

async function invalidateMatrixSession() {
  const client = getMatrixClient()
  await clearMatrixClientStores(client).catch(() => {})
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