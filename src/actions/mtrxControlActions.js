import {
  MTRXCTL_CLEAR,
  MTRXCTL_DEVICE_VERIFICATION_STORE,
  MTRXCTL_ROOM_LIST_DELETE,
  MTRXCTL_ROOM_LIST_INITIALIZE,
  MTRXCTL_ROOM_LIST_PUT,
  MTRXCTL_ROOM_META_STORE,
  MTRXCTL_SET_SELECTED_ROOM,
  MTRXCTL_STORE_MATRIX_DATA,
  MTRXCTL_STORE_VALUE,
  MTRXCTL_SUBMIT_ERROR,
  MTRXCTL_SUBMIT_REQUEST,
  MTRXCTL_SUBMIT_SUCCESS,
} from "../constants/redux";
import { VERIFICATION_ERR } from "../constants/verification";
import * as matrixClient from "../services/matrixClient";
import * as matrixRooms from "../services/matrixRooms";
import { getMatrixErrorMessage } from "./utils/matrixError";

let sessionOperationId = 0;
let unsubscribeRoomList = null;
let unsubscribeDeviceVerification = null;

function dispatchDeviceVerification(dispatch, payload = {}) {
  dispatch({
    type: MTRXCTL_DEVICE_VERIFICATION_STORE,
    payload,
  });
}

function watchDeviceVerificationAndDispatch(dispatch) {
  unsubscribeDeviceVerification?.();
  unsubscribeDeviceVerification = matrixClient.watchDeviceVerification((snapshot) => dispatchDeviceVerification(dispatch, snapshot));
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
      // Принудительный logout со стороны сервера — это потеря авторизации (красный тумблер)
      if (operationId === sessionOperationId) {
        dispatch({ type: MTRXCTL_CLEAR, payload: { authLost: true } });
      }
    });
  });
}

const handleRegister =
  (formData = {}) =>
  async (dispatch) => {
    const operationId = ++sessionOperationId;
    const login = typeof formData.login === "string" ? formData.login.trim() : "";
    const password = typeof formData.password === "string" ? formData.password : "";
    const uriMatrix = typeof formData.uriMatrix === "string" ? formData.uriMatrix.trim() : "";

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
  unsubscribeDeviceVerification?.();
  unsubscribeDeviceVerification = null;
  await matrixClient.logoutMatrix();
  dispatch({ type: MTRXCTL_CLEAR });
};

// Читает из localStorage адрес homeserver и логин: форма входа предзаполняется ими,
// сама сессия не поднимается — при старте приложение всегда требует авторизацию
const handleHydrateStoredMatrixData = () => (dispatch) => {
  const { uriMatrix, login } = matrixClient.getStoredMatrixData();
  dispatch({
    type: MTRXCTL_STORE_MATRIX_DATA,
    payload: { uriMatrix, login },
  });
};

const handleLoadDeviceVerification = () => async (dispatch) => {
  try {
    watchDeviceVerificationAndDispatch(dispatch);
    // getDeviceVerificationState, а не getCurrentDeviceVerification: второе вернуло
    // бы только статус кросс-подписи и затёрло фазу пришедшего запроса SAS
    dispatchDeviceVerification(dispatch, await matrixClient.getDeviceVerificationState());
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
    const snapshot = await matrixClient.requestCurrentDeviceVerification((nextSnapshot) => dispatchDeviceVerification(dispatch, nextSnapshot));
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
    const snapshot = await matrixClient.startCurrentDeviceVerification((nextSnapshot) => dispatchDeviceVerification(dispatch, nextSnapshot));
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
  dispatchDeviceVerification(dispatch, { status: "loading", errText: "", errCode: "", recoveryKey: "" });
  try {
    const verification = await matrixClient.verifyCurrentDeviceWithRecoveryKey(recoveryKey);
    dispatchDeviceVerification(dispatch, verification);
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
      // Код причины — по нему MtrxDeviceVerification выбирает подсказку и действие
      errCode: error?.code || "",
    });
  }
};

// Создание Secret Storage в аккаунте, где его нет: показываем пользователю новый
// recovery key, статус проверки при этом не подменяем (его читает MtrxInfo/MtrxPad)
const handleCreateSecretStorage = () => async (dispatch) => {
  dispatchDeviceVerification(dispatch, { status: "loading", errText: "", errCode: "", recoveryKey: "" });
  try {
    const { recoveryKey, verification } = await matrixClient.createNewSecretStorage();
    dispatchDeviceVerification(dispatch, {
      ...verification,
      status: verification.verified ? "success" : "idle",
      recoveryKey,
      errText: "",
      errCode: "",
    });
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
      errCode: error?.code || "",
    });
  }
};

// Сброс шифрования: новая кросс-подпись (устройство становится доверенным),
// новый Secret Storage и новый recovery key. Пароль нужен серверу для UIA
const handleResetEncryption = (password) => async (dispatch) => {
  dispatchDeviceVerification(dispatch, { status: "loading", errText: "", errCode: "", recoveryKey: "" });
  try {
    const { recoveryKey, verification } = await matrixClient.resetOwnEncryption(password);
    dispatchDeviceVerification(dispatch, {
      ...verification,
      status: verification.verified ? "success" : "idle",
      recoveryKey,
      errText: "",
      errCode: "",
    });
  } catch (error) {
    dispatchDeviceVerification(dispatch, {
      status: "error",
      errText: getMatrixErrorMessage(error),
      // Без кода оставляем сброс доступным: ошибка сброса — не повод терять кнопку
      errCode: error?.code || VERIFICATION_ERR.RESET_FAILED,
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

const handleLoadRoomMeta = (roomId) => async (dispatch) => {
  try {
    const meta = await matrixRooms.getRoomMeta(roomId);
    if (meta) {
      dispatch({ type: MTRXCTL_ROOM_META_STORE, payload: { roomId, meta } });
    }
  } catch {
    // Игнорируем: список остаётся, метаданные подтянем при следующем событии.
  }
};

const handleRoomListInitialize = (rooms) => (dispatch) => {
  dispatch({ type: MTRXCTL_ROOM_LIST_INITIALIZE, payload: { rooms } });
  rooms.forEach(({ roomId }) => {
    dispatch(handleLoadRoomMeta(roomId));
  });
};

const handleRoomListPut = (roomId, membership, isSpace, unread, highlight) => (dispatch) => {
  dispatch({ type: MTRXCTL_ROOM_LIST_PUT, payload: { roomId, membership, isSpace, unread, highlight } });
  dispatch(handleLoadRoomMeta(roomId));
};

const handleRoomListDelete = (roomId) => (dispatch) => {
  dispatch({ type: MTRXCTL_ROOM_LIST_DELETE, payload: { roomId } });
};

const handleStartRoomWatch = () => (dispatch) => {
  if (unsubscribeRoomList) return;

  unsubscribeRoomList = matrixRooms.watchRoomList((delta) => {
    if (delta.type === "INITIALIZE") {
      dispatch(handleRoomListInitialize(delta.rooms));
    } else if (delta.type === "PUT") {
      dispatch(handleRoomListPut(delta.roomId, delta.membership, delta.isSpace, delta.unread, delta.highlight));
    } else if (delta.type === "DELETE") {
      dispatch(handleRoomListDelete(delta.roomId));
    }
  });
};

const handleStopRoomWatch = () => () => {
  unsubscribeRoomList?.();
  unsubscribeRoomList = null;
};

const handleSelectRoom = (roomId) => (dispatch) => {
  dispatch({ type: MTRXCTL_SET_SELECTED_ROOM, payload: { roomId } });
  // Клик по комнате = прочитано: без read receipt сервер не сбросит счётчик
  matrixRooms.markRoomRead(roomId);
};

const handleJoinRoom = (roomId) => async (dispatch) => {
  try {
    const result = await matrixRooms.joinRoom(roomId);
    // Оптимистично снимаем приглашение: сервер вход уже подтвердил, а /sync
    // с обновлённым состоянием комнаты может прийти заметно позже
    dispatch({
      type: MTRXCTL_ROOM_LIST_PUT,
      payload: { roomId, membership: "join" },
    });
    return result;
  } catch (error) {
    throw new Error(getMatrixErrorMessage(error, "Не удалось принять приглашение."), { cause: error });
  }
};

const handleLeaveRoom = (roomId) => async (dispatch) => {
  try {
    const result = await matrixRooms.leaveRoom(roomId);
    dispatch(handleRoomListDelete(roomId));
    return result;
  } catch (error) {
    throw new Error(getMatrixErrorMessage(error, "Не удалось выйти из комнаты."), { cause: error });
  }
};

const handleSendMessage = (roomId, body) => async () => {
  try {
    return await matrixRooms.sendRoomMessage(roomId, body);
  } catch (error) {
    throw new Error(getMatrixErrorMessage(error, "Не удалось отправить сообщение."), { cause: error });
  }
};

// Вложение: текст из поля ввода уезжает подписью (caption) к файлу
const handleSendFile =
  (roomId, file, { caption = "", onProgress } = {}) =>
  async () => {
    try {
      return await matrixRooms.sendRoomFile(roomId, file, { caption, onProgress });
    } catch (error) {
      throw new Error(getMatrixErrorMessage(error, "Не удалось отправить файл."), { cause: error });
    }
  };

const handleDownloadFile = (media, filename) => async () => {
  try {
    return await matrixRooms.downloadRoomFile(media, filename);
  } catch (error) {
    throw new Error(getMatrixErrorMessage(error, "Не удалось скачать файл."), { cause: error });
  }
};

const handleCreateRoom =
  (formData = {}) =>
  async (dispatch) => {
    try {
      const { roomId, name, peerId = "" } = await matrixRooms.createRoom(formData);

      // Комната придёт в /sync позже: показываем её сразу с готовым именем
      // (название комнаты или имя собеседника), иначе до следующего sync
      // в списке висел бы только roomId
      dispatch({
        type: MTRXCTL_ROOM_LIST_PUT,
        payload: { roomId, membership: "join", isSpace: false },
      });
      dispatch({
        type: MTRXCTL_ROOM_META_STORE,
        payload: {
          roomId,
          meta: { roomId, name, avatarUrl: "", subtitle: "", peerId, membership: "join", isSpace: false, children: [] },
        },
      });
      dispatch(handleSelectRoom(roomId));

      return { roomId, name };
    } catch (error) {
      throw new Error(getMatrixErrorMessage(error, "Не удалось создать комнату."), { cause: error });
    }
  };

export {
  handleAcceptDeviceVerification,
  handleCancelDeviceVerification,
  handleChangeStore,
  handleClearDeviceVerification,
  handleConfirmDeviceVerification,
  handleCreateRoom,
  handleCreateSecretStorage,
  handleDownloadFile,
  handleHydrateStoredMatrixData,
  handleJoinRoom,
  handleLeaveRoom,
  handleLoadDeviceVerification,
  handleLoadRoomMeta,
  handleRegClear,
  handleRegister,
  handleRequestDeviceVerification,
  handleResetEncryption,
  handleSelectRoom,
  handleSendFile,
  handleSendMessage,
  handleStartDeviceVerification,
  handleStartRoomWatch,
  handleStopRoomWatch,
  handleVerifyDeviceWithRecoveryKey,
};
