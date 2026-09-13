let matrixSdkPromise = null;

/**
 * Ленивая загрузка matrix-js-sdk (отдельный chunk при сборке).
 *
 * @see https://matrix-org.github.io/matrix-js-sdk/
 */
export function loadMatrixSdk() {
  if (!matrixSdkPromise) {
    matrixSdkPromise = import("matrix-js-sdk");
  }
  return matrixSdkPromise;
}
