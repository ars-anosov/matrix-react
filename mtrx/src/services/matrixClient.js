import { loadMatrixSdk } from './matrixSdk.js'

import {
  MTRX_HS_URL_KEY,
  MTRX_LOGIN_KEY,
  MTRX_ACCESS_TOKEN_KEY,
  MTRX_USER_ID_KEY,
  MTRX_DEVICE_ID_KEY,
  MTRX_REFRESH_TOKEN_KEY,
} from '../constants/storage'

let matrixClient = null
let matrixSessionCleanup = null

/**
 * Текущий авторизованный MatrixClient или null.
 */
function getMatrixClient() {
  return matrixClient
}

/**
 * Временный клиент для loginRequest до создания сессии.
 */
async function createTempMatrixClient(baseUrl) {
  const { createClient } = await loadMatrixSdk()
  return createClient({ baseUrl })
}

/**
 * Создаёт и сохраняет клиент из сохранённой сессии.
 */
async function createMatrixClientFromSession({
  baseUrl,
  accessToken,
  userId,
  deviceId,
  refreshToken,
}) {
  const { createClient, IndexedDBStore, IndexedDBCryptoStore } = await loadMatrixSdk()
  destroyMatrixClient()

  const clientOptions = {
    baseUrl,
    accessToken,
    userId,
    deviceId,
    refreshToken: refreshToken || undefined,
  }

  if (typeof indexedDB !== 'undefined' && IndexedDBStore && IndexedDBCryptoStore) {
    clientOptions.store = new IndexedDBStore({
      indexedDB,
      localStorage,
      dbName: `mtrx-sync-${userId}`,
    })
    clientOptions.cryptoStore = new IndexedDBCryptoStore(indexedDB, `mtrx-crypto-${userId}`)
  }

  if (refreshToken) {
    clientOptions.tokenRefreshFunction = async (currentRefreshToken) => {
      const response = await fetch(`${baseUrl}/_matrix/client/v3/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: currentRefreshToken }),
      })

      if (!response.ok) {
        throw new Error(`Обновление Matrix-сессии завершилось с ошибкой: ${response.status}`)
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
    }
  }

  const client = createClient(clientOptions)

  if (clientOptions.store) {
    await clientOptions.store.startup()
    if (typeof client.initRustCrypto === 'function') {
      await client.initRustCrypto()
    }
  }

  matrixClient = client
  return client
}

/**
 * Останавливает sync и сбрасывает singleton.
 */
function destroyMatrixClient() {
  if (!matrixClient) return

  matrixSessionCleanup?.()
  matrixSessionCleanup = null
  matrixClient.stopClient()
  matrixClient = null
}

async function clearMatrixClientStores(client) {
  if (!client?.clearStores) return
  await client.clearStores()
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



// Комнаты


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

  return ''
}

async function resolveRoomAvatarUrl(client, room) {
  if (!client || !room) return ''

  const mxcUrl = getRoomMxcAvatarUrl(room)
  if (!mxcUrl || typeof client.mxcUrlToHttp !== 'function') return ''

  const accessToken = client.getAccessToken?.()
  const headers = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : undefined

  const mediaUrls = [
    client.mxcUrlToHttp(mxcUrl, 64, 64, 'scale', false, true, true),
    client.mxcUrlToHttp(mxcUrl, undefined, undefined, undefined, false, true, true),
  ].filter(Boolean)

  for (const mediaUrl of mediaUrls) {
    try {
      const response = await fetch(mediaUrl, { headers })
      if (!response.ok) continue

      const blob = await response.blob()
      return URL.createObjectURL(blob)
    } catch {
      continue
    }
  }

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



export {
  getMatrixClient,
  createTempMatrixClient,
  createMatrixClientFromSession,
  destroyMatrixClient,
  clearMatrixClientStores,
  resolveHomeserverUrl,
  persistMatrixSession,
  clearMatrixSession,
  fetchDisplayName,
  startMatrixSync,
  watchMatrixSession,
  getRoomDisplayName,
  getRoomMxcAvatarUrl,
  resolveRoomAvatarUrl,
  getJoinedRooms,
  watchRoomChanges,
}
