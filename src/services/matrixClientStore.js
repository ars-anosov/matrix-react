let matrixClient = null;

function getMatrixClient() {
  return matrixClient;
}

function setMatrixClient(client) {
  matrixClient = client;
}

function clearMatrixClient() {
  matrixClient = null;
}

export { clearMatrixClient, getMatrixClient, setMatrixClient };
