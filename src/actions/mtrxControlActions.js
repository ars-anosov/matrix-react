import {
  MTRXCTL_CLEAR,
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
  handleChangeStore,
  handleHydrateStoredMatrixData,
  handleLoadRooms,
  handleRegClear,
  handleRegister,
  handleRestoreSession,
  handleStartRoomWatch,
  handleStopRoomWatch,
};
