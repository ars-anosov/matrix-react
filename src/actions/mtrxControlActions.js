import {
  MTRXCTL_CLEAR,
  MTRXCTL_DEVICE_VERIFICATION_STORE,
  MTRXCTL_SET_ROOMS,
  MTRXCTL_STORE_MATRIX_DATA,
  MTRXCTL_STORE_VALUE,
  MTRXCTL_SUBMIT_ERROR,
  MTRXCTL_SUBMIT_REQUEST,
  MTRXCTL_SUBMIT_SUCCESS,
} from "../constants/redux";
import * as matrixClient from "../services/matrixClient";
import * as matrixRooms from "../services/matrixRooms";
import { getMatrixErrorMessage } from "./utils/matrixError";

let restoreSessionPromise = null;
let sessionOperationId = 0;
let unsubscribeRoomChanges = null;
let unsubscribeDeviceVerification = null;

function dispatchDeviceVerification(dispatch, payload = {}) {
  dispatch({
    type: MTRXCTL_DEVICE_VERIFICATION_STORE,
    payload,
  });
}

function watchDeviceVerificationAndDispatch(dispatch) {
  unsubscribeDeviceVerification?.();
  unsubscribeDeviceVerification = matrixClient.watchDeviceVerification(
    (snapshot) => dispatchDeviceVerification(dispatch, snapshot),
  );
}

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
  });
}

function dispatchMtrxRegError(dispatch, errText) {
  dispatch({
    type: MTRXCTL_SUBMIT_ERROR,
    payload: { errText },
  });
}

function watchSessionAndDispatchClear(dispatch, operationId) {
  matrixClient.watchMatrixSession(() => {
    if (operationId !== sessionOperationId) return;
    matrixClient.invalidateMatrixSession().finally(() => {
      if (operationId === sessionOperationId) dispatch({ type: MTRXCTL_CLEAR });
    });
  });
}

const handleRegister =
  (formData = {}) =>
  async (dispatch) => {
    const operationId = ++sessionOperationId;
    const login =
      typeof formData.login === "string" ? formData.login.trim() : "";
    const password =
      typeof formData.password === "string" ? formData.password : "";
    const uriMatrix =
      typeof formData.uriMatrix === "string" ? formData.uriMatrix.trim() : "";

    if (!login || !password) {
      dispatchMtrxRegError(dispatch, "Заполните логин и пароль.");
      return;
    }

    dispatch({ type: MTRXCTL_SUBMIT_REQUEST });

    try {
      const session = await matrixClient.loginMatrix({
        login,
        password,
        uriMatrix,
      });
      if (operationId !== sessionOperationId) return;

      watchSessionAndDispatchClear(dispatch, operationId);
      watchDeviceVerificationAndDispatch(dispatch);
      dispatchMatrixSuccess(dispatch, session);
    } catch (error) {
      if (operationId === sessionOperationId) {
        dispatchMtrxRegError(dispatch, getMatrixErrorMessage(error));
      }
    }
  };

const handleRegClear = () => async (dispatch) => {
  sessionOperationId += 1;
  restoreSessionPromise = null;
  unsubscribeDeviceVerification?.();
  unsubscribeDeviceVerification = null;
  await matrixClient.logoutMatrix();
  dispatch({ type: MTRXCTL_CLEAR });
};

const handleHydrateStoredMatrixData = () => (dispatch) => {
  const { uriMatrix, login } = matrixClient.getStoredMatrixData();
  dispatch({
    type: MTRXCTL_STORE_MATRIX_DATA,
    payload: { uriMatrix, login },
  });
};

const handleRestoreSession = () => (dispatch, getState) => {
  // Синхронно заполняем сохранённые uriMatrix/login до проверок статуса
  dispatch(handleHydrateStoredMatrixData());

  // Если в Redux статус уже success — ничего не делаем
  if (getState().mtrxControlRdcr.status === "success") return;
  // Если промис восстановления уже запущен — возвращаем его, избегая дублирования
  if (restoreSessionPromise) return restoreSessionPromise;

  const operationId = ++sessionOperationId;

  // Проверяем синхронную активную сессию
  const activeSession = matrixClient.getActiveMatrixSession();
  if (activeSession) {
    // Обязательно подписываемся на события даже активной сессии
    watchSessionAndDispatchClear(dispatch, operationId);
    watchDeviceVerificationAndDispatch(dispatch);
    dispatchMatrixSuccess(dispatch, activeSession);
    return;
  }

  // Если активной сессии в памяти нет (перезагрузка страницы), запускаем асинхронное восстановление из хранилища
  restoreSessionPromise = (async () => {
    try {
      const session = await matrixClient.restoreMatrixSession();

      if (operationId !== sessionOperationId) return;

      if (session) {
        watchSessionAndDispatchClear(dispatch, operationId);
        watchDeviceVerificationAndDispatch(dispatch);
        dispatchMatrixSuccess(dispatch, session);
      } else {
        // Если сохраненных токенов нет или они невалидны
        dispatch({ type: MTRXCTL_CLEAR });
      }
    } catch (error) {
      console.error("Ошибка восстановления сессии Matrix:", error);
      if (operationId === sessionOperationId) {
        dispatch({ type: MTRXCTL_CLEAR });
      }
    } finally {
      restoreSessionPromise = null;
    }
  })();

  return restoreSessionPromise;
};

const handleLoadDeviceVerification = () => async (dispatch) => {
  try {
    watchDeviceVerificationAndDispatch(dispatch);
    const verification = await matrixClient.getCurrentDeviceVerification();
    dispatchDeviceVerification(dispatch, verification);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
    });
  }
};

const handleRequestDeviceVerification = () => async (dispatch) => {
  dispatchDeviceVerification(dispatch, { status: "loading", errText: "" });
  try {
    const snapshot = await matrixClient.requestCurrentDeviceVerification(
      (nextSnapshot) => dispatchDeviceVerification(dispatch, nextSnapshot),
    );
    dispatchDeviceVerification(dispatch, snapshot);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
    });
  }
};

const handleAcceptDeviceVerification = () => async (dispatch) => {
  try {
    const snapshot = await matrixClient.acceptCurrentDeviceVerification();
    dispatchDeviceVerification(dispatch, snapshot);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
    });
  }
};

const handleStartDeviceVerification = () => async (dispatch) => {
  try {
    const snapshot = await matrixClient.startCurrentDeviceVerification(
      (nextSnapshot) => dispatchDeviceVerification(dispatch, nextSnapshot),
    );
    dispatchDeviceVerification(dispatch, snapshot);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
    });
  }
};

const handleConfirmDeviceVerification = () => async (dispatch) => {
  try {
    const snapshot = await matrixClient.confirmCurrentDeviceVerification();
    dispatchDeviceVerification(dispatch, snapshot);
    const verification = await matrixClient.getCurrentDeviceVerification();
    dispatchDeviceVerification(dispatch, verification);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
    });
  }
};

const handleVerifyDeviceWithRecoveryKey = (recoveryKey) => async (dispatch) => {
  dispatchDeviceVerification(dispatch, { status: "loading", errText: "" });
  try {
    const verification =
      await matrixClient.verifyCurrentDeviceWithRecoveryKey(recoveryKey);
    dispatchDeviceVerification(dispatch, verification);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
    });
  }
};

const handleCancelDeviceVerification = () => async (dispatch) => {
  try {
    const snapshot = await matrixClient.cancelCurrentDeviceVerification();
    dispatchDeviceVerification(dispatch, snapshot);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
    });
  }
};

const handleClearDeviceVerification = () => async (dispatch) => {
  matrixClient.clearCurrentDeviceVerification();

  try {
    const snapshot = await matrixClient.getCurrentDeviceVerification();
    dispatchDeviceVerification(dispatch, {
      ...snapshot,
      status: snapshot.verified ? "success" : "idle",
      initiatedByMe: false,
      sas: null,
      errText: "",
    });
  } catch {
    dispatchDeviceVerification(dispatch, {
      status: "idle",
      verified: false,
      initiatedByMe: false,
      sas: null,
      errText: "",
    });
  }
};

const handleChangeStore = (storeDataKey, storeDataValue) => (dispatch) => {
  dispatch({
    type: MTRXCTL_STORE_VALUE,
    payload: { storeDataKey, storeDataValue },
  });
};

const handleLoadRooms = () => async (dispatch) => {
  try {
    const rooms = await matrixRooms.getJoinedRooms();
    dispatch({ type: MTRXCTL_SET_ROOMS, payload: { rooms } });
  } catch {
    dispatch({ type: MTRXCTL_SET_ROOMS, payload: { rooms: [] } });
  }
};

const handleStartRoomWatch = () => (dispatch) => {
  if (unsubscribeRoomChanges) return;

  unsubscribeRoomChanges = matrixRooms.watchRoomChanges(() => {
    dispatch(handleLoadRooms());
  });
};

const handleStopRoomWatch = () => () => {
  unsubscribeRoomChanges?.();
  unsubscribeRoomChanges = null;
};

export {
  handleAcceptDeviceVerification,
  handleCancelDeviceVerification,
  handleChangeStore,
  handleClearDeviceVerification,
  handleConfirmDeviceVerification,
  handleHydrateStoredMatrixData,
  handleLoadDeviceVerification,
  handleLoadRooms,
  handleRegClear,
  handleRegister,
  handleRequestDeviceVerification,
  handleRestoreSession,
  handleStartDeviceVerification,
  handleStartRoomWatch,
  handleStopRoomWatch,
  handleVerifyDeviceWithRecoveryKey,
};
