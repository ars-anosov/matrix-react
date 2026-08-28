let matrixSdkPromise = null

/**
 * Ленивая загрузка matrix-js-sdk (отдельный chunk при сборке).
 */
export function loadMatrixSdk() {
  if (!matrixSdkPromise) {
    matrixSdkPromise = import('matrix-js-sdk')
  }
  return matrixSdkPromise
}
