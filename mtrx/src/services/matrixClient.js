import { loadMatrixSdk } from './matrixSdk.js'

let matrixClient = null

/**
 * Текущий авторизованный MatrixClient или null.
 */
export function getMatrixClient() {
  return matrixClient
}

/**
 * Временный клиент для loginRequest до создания сессии.
 */
export async function createTempMatrixClient(baseUrl) {
  const { createClient } = await loadMatrixSdk()
  return createClient({ baseUrl })
}

/**
 * Создаёт и сохраняет клиент из сохранённой сессии.
 */
export async function createMatrixClientFromSession({
  baseUrl,
  accessToken,
  userId,
  deviceId,
  refreshToken,
}) {
  const { createClient } = await loadMatrixSdk()
  destroyMatrixClient()

  const client = createClient({
    baseUrl,
    accessToken,
    userId,
    deviceId,
    refreshToken: refreshToken || undefined,
  })

  matrixClient = client
  return client
}

/**
 * Останавливает sync и сбрасывает singleton.
 */
export function destroyMatrixClient() {
  if (!matrixClient) return

  matrixClient.stopClient()
  matrixClient = null
}
