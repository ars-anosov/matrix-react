import { loadMatrixSdk } from './matrixSdk.js'

import {
  MTRX_HS_URL_KEY,
  MTRX_LOGIN_KEY,
  MTRX_ACCESS_TOKEN_KEY,
  MTRX_USER_ID_KEY,
  MTRX_DEVICE_ID_KEY,
  MTRX_REFRESH_TOKEN_KEY,
} from '../constants/storage'
const DEVICE_DISPLAY_NAME = 'matrix-react'

let matrixClient = null
let matrixSessionCleanup = null


function getMatrixClient() {
  return matrixClient
}


async function createTempMatrixClient(baseUrl) {
  const { createClient } = await loadMatrixSdk()
  return createClient({ baseUrl })
}

function buildStoreKey(userId, deviceId) {
  // return deviceId ? `${userId}::${deviceId}` : userId
  return deviceId ? deviceId : userId
}


async function createMatrixClientFromSession({
  baseUrl,
  accessToken,
  userId,
  deviceId,
  refreshToken,
}) {

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error(`[createMatrixClientFromSession] Невалидный baseUrl: ${baseUrl}`);
  }

  const { createClient, IndexedDBStore, IndexedDBCryptoStore } = await loadMatrixSdk()
  destroyMatrixClient()

  const clientOptions = {
    baseUrl,
    accessToken,
    userId,
    deviceId,
    refreshToken: refreshToken || undefined,
    useAuthorizationHeader: true,
    cryptoBackend: "rust",
  }

  const storeKey = buildStoreKey(userId, deviceId)

  if (typeof indexedDB !== 'undefined' && IndexedDBStore && IndexedDBCryptoStore) {
    clientOptions.store = new IndexedDBStore({
      indexedDB,
      localStorage,
      dbName: `mx-sync-${storeKey}`,
    })
    clientOptions.cryptoStore = new IndexedDBCryptoStore(indexedDB, `mx-crypto-${storeKey}`)
  }

  if (refreshToken) {
    clientOptions.tokenRefreshFunction = async (currentRefreshToken) => {
      try {
        const response = await fetch(`${baseUrl}/_matrix/client/v3/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: currentRefreshToken }),
        })

        // === ПРОВЕРКА ВАЛИДНОСТИ ТОКЕНА ===
        if (response.status === 401) {
          console.warn('[tokenRefreshFunction] Рефреш-токен протух (401). Закрываем соединения и чистим хранилища...')
          deleteMatrixLocalStores()
          deleteMatrixIndexedDbStores(storeKey)
          throw new Error('REFRESH_TOKEN_EXPIRED: Store cleared')
        }

        if (!response.ok) {
          throw new Error(`REFRESH_ERROR: ${response.status}`)
        }

        const tokenData = await response.json()
        if (!tokenData.access_token) throw new Error('Homeserver не вернул access token.')

        persistMatrixSession({
          homeserverUrl: baseUrl,
          login: localStorage.getItem(MTRX_LOGIN_KEY) || '',
          accessToken: tokenData.access_token,
          userId,
          deviceId,
          refreshToken: tokenData.refresh_token || currentRefreshToken,
        })

        return {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || currentRefreshToken,
          expiry: tokenData.expires_in_ms
            ? new Date(Date.now() + tokenData.expires_in_ms)
            : undefined,
        }
      } catch (error) {
        throw error
      }
    }
  }

  const client = createClient(clientOptions)

  if (clientOptions.store) {
    await clientOptions.store.startup()

    if (typeof client.initRustCrypto === 'function') {
      try {
        await client.initRustCrypto({
          useIndexedDB: true,
          cryptoDatabasePrefix: `mx-crypto-${storeKey}`,
        })
      } catch (err) {
        const message = String(err?.message || '')

        if (message.includes("doesn't match the account in the constructor")) {
          if (import.meta.env.DEV) {
            console.warn('[matrixClient] обнаружено рассогласование device_id in IndexedDB, чищу store и пробую снова', err)
          }

          await deleteMatrixIndexedDbStores(storeKey)
          await clientOptions.store.startup()
          
          await client.initRustCrypto({
            useIndexedDB: true,
            cryptoDatabasePrefix: `mx-crypto-${storeKey}`,
          })
        } else {
          throw err
        }
      }
    }
  }

  // === ПРОВЕРКА ВАЛИДНОСТИ ТОКЕНА ===
  try {
    await client.whoami()
  } catch (err) {
    if (err.httpStatus === 401) {
      console.warn('[matrixClient] Сессия окончательно мертва. Завершаем уничтожение инстанса.')
      deleteMatrixLocalStores()
      clearMatrixClientStores(client)
      destroyMatrixClient()
      throw new Error('MATRIX_UNAUTHORIZED')
    }
    
    // Ошибки сети (502, Тimeout) пропускаем
    console.warn('[matrixClient] Не удалось проверить токен (возможно нет сети):', err)
  }

  matrixClient = client
  return client
}


async function deleteMatrixIndexedDbStores(storeKey) {
  if (typeof indexedDB === 'undefined' || !storeKey) return

  const dbNames = [
    `matrix-js-sdk:mx-sync-${storeKey}`,
    `mx-crypto-${storeKey}::matrix-sdk-crypto`
  ]
  // console.log('--- [deleteMatrixIndexedDbStores] --- dbNames :', dbNames)

  await Promise.all(
    dbNames.map(
      name =>
        new Promise(resolve => {
          const request = indexedDB.deleteDatabase(name)
          request.onsuccess = () => resolve()
          request.onerror = () => resolve()
          request.onblocked = () => resolve()
        }),
    ),
  )
}


function destroyMatrixClient() {
  if (!matrixClient) return

  matrixSessionCleanup?.()
  matrixSessionCleanup = null
  matrixClient.stopClient()
  matrixClient = null
}


async function clearMatrixClientStores(client) {
  // console.log('--- [clearMatrixClientStores] --- client :', client)
  if (!client) return

  await client.clearStores?.()

  const userId = client.getUserId?.()
  const deviceId = client.getDeviceId?.()

  if (userId) {
    const storeKey = buildStoreKey(userId, deviceId)
    await deleteMatrixIndexedDbStores(storeKey)
  }
}

function watchMatrixSession(client, onLoggedOut) {
  if (!client || typeof client.on !== 'function') return () => {}

  const handleLoggedOut = () => onLoggedOut?.()
  client.on('Session.logged_out', handleLoggedOut)

  const cleanup = () => {
    client.removeListener?.('Session.logged_out', handleLoggedOut)
  }

  matrixSessionCleanup = cleanup
  return cleanup
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

function deleteMatrixLocalStores() {
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

function getRoomDisplayName(room) {
  if (!room) return 'Без названия'

  if (typeof room.name === 'string' && room.name.trim()) return room.name

  if (typeof room.getName === 'function') {
    const name = room.getName()
    if (typeof name === 'string' && name.trim()) return name
  }

  if (typeof room.getCanonicalAlias === 'function') {
    const alias = room.getCanonicalAlias()
    if (typeof alias === 'string' && alias.trim()) return alias
  }

  return room.roomId || 'Без названия'
}

function getRoomMxcAvatarUrl(room) {
  if (!room) return ''

  if (typeof room.getMxcAvatarUrl === 'function') {
    const mxcUrl = room.getMxcAvatarUrl()
    if (typeof mxcUrl === 'string' && mxcUrl.trim()) return mxcUrl
  }

  if (typeof room.getAvatarUrl === 'function') {
    const avatarUrl = room.getAvatarUrl(undefined, 64, 64, 'scale', false, true)
    if (typeof avatarUrl === 'string' && avatarUrl.trim()) return avatarUrl
  }

  // Фолбэк: для DM без явного аватара комнаты берём аватар собеседника
  if (typeof room.getAvatarFallbackMember === 'function') {
    const fallbackMember = room.getAvatarFallbackMember()
    const memberMxcUrl = fallbackMember?.getMxcAvatarUrl?.()
    if (typeof memberMxcUrl === 'string' && memberMxcUrl.trim()) return memberMxcUrl
  }

  return ''
}

// Кэш резолвнутых аватарок, чтобы не фетчить одно и то же на каждый sync
// и не плодить blob-URL без revoke.
const avatarUrlCache = new Map() // mxcUrl -> objectURL (или '' если резолв не удался)

async function resolveRoomAvatarUrl(client, room) {
  if (!client || !room) return ''

  const mxcUrl = getRoomMxcAvatarUrl(room)
  if (!mxcUrl || typeof client.mxcUrlToHttp !== 'function') return ''

  if (avatarUrlCache.has(mxcUrl)) {
    return avatarUrlCache.get(mxcUrl)
  }

  const accessToken = client.getAccessToken?.()
  const authHeaders = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined

  // Сначала пробуем без авторизации (работает на большинстве серверов),
  // затем — с авторизацией (нужно для серверов с MSC3916 / authenticated media).
  const attempts = [
    { url: client.mxcUrlToHttp(mxcUrl, 64, 64, 'scale', false, true, false), headers: undefined },
    { url: client.mxcUrlToHttp(mxcUrl, 64, 64, 'scale', false, true, true), headers: authHeaders },
  ].filter(a => a.url)

  for (const { url, headers } of attempts) {
    try {
      const response = await fetch(url, { headers })
      if (!response.ok) {
        if (import.meta.env.DEV) {
          console.warn('[matrixClient] avatar fetch failed', room.roomId, url, response.status)
        }
        continue
      }
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      avatarUrlCache.set(mxcUrl, objectUrl)
      return objectUrl
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[matrixClient] avatar fetch error', room.roomId, url, err)
      }
      continue
    }
  }

  avatarUrlCache.set(mxcUrl, '') // чтобы не долбить сервер повторно на каждый sync
  return ''
}

async function getJoinedRooms() {
  const client = getMatrixClient()
  if (!client || !client.getRooms) return []

  const rooms = client.getRooms()
    .filter(room => room && room.getMyMembership && room.getMyMembership() === 'join')
    .sort((a, b) => getRoomDisplayName(a).localeCompare(getRoomDisplayName(b), undefined, { sensitivity: 'base' }))

  const resolvedRooms = []

  for (const room of rooms) {
    resolvedRooms.push({
      roomId: room.roomId,
      name: getRoomDisplayName(room),
      avatarUrl: await resolveRoomAvatarUrl(client, room),
    })
  }

  return resolvedRooms
}

function watchRoomChanges(onChange) {
  const client = getMatrixClient()
  if (!client) return () => {}

  const handleSync = (state) => {
    if (['PREPARED', 'SYNCING', 'CATCHUP', 'ERROR'].includes(state)) {
      onChange?.()
    }
  }

  const handleRoom = () => {
    onChange?.()
  }

  client.on('sync', handleSync)
  client.on('Room', handleRoom)

  return () => {
    client.removeListener('sync', handleSync)
    client.removeListener('Room', handleRoom)
  }
}



function getStoredMatrixData() {
  const uriMatrix = localStorage.getItem(MTRX_HS_URL_KEY) || ''
  const login     = localStorage.getItem(MTRX_LOGIN_KEY) || ''
  const deviceId  = localStorage.getItem(MTRX_DEVICE_ID_KEY) || ''

  return { uriMatrix, login, deviceId }
}


function resolveHomeserverUrl(uriMatrix = '') {
  const url = (uriMatrix || localStorage.getItem(MTRX_HS_URL_KEY) || '').trim()
  if (!url) {
    throw new Error('Не задан URL homeserver Matrix.')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('URL homeserver Matrix указан некорректно.')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
    throw new Error('Homeserver должен использовать URL http или https без учетных данных.')
  }

  return parsedUrl.toString().replace(/\/$/, '')
}


async function loginMatrix({ login, password, uriMatrix }) {
  const homeserverUrl = resolveHomeserverUrl(uriMatrix)
  const tempClient = await createTempMatrixClient(homeserverUrl)

  const { login: storedLogin, deviceId: storedLoginDeviceId } = getStoredMatrixData()
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
    deleteMatrixLocalStores()
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
    deleteMatrixLocalStores()
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


/*
  clearMatrixClientStores(client)
    > client.clearStores?.()
    > deleteMatrixIndexedDbStores(client > storeKey)
  destroyMatrixClient()
    > matrixSessionCleanup?.()
    > matrixClient.stopClient()
*/
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

  deleteMatrixLocalStores()
}


async function invalidateMatrixSession() {
  const client = getMatrixClient()
  if (client) {
    await clearMatrixClientStores(client).catch(() => {})
  }
  destroyMatrixClient()
  deleteMatrixLocalStores()
}


export {
  getMatrixClient,
  createTempMatrixClient,
  createMatrixClientFromSession,
  destroyMatrixClient,
  clearMatrixClientStores,
  persistMatrixSession,
  deleteMatrixLocalStores,
  fetchDisplayName,
  startMatrixSync,
  watchMatrixSession,
  getRoomDisplayName,
  getRoomMxcAvatarUrl,
  resolveRoomAvatarUrl,
  getJoinedRooms,
  watchRoomChanges,

  loginMatrix,
  getStoredMatrixData,
  restoreMatrixSession,
  getActiveMatrixSession,
  logoutMatrix,
  invalidateMatrixSession,
}