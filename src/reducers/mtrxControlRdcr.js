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

const initialState = {
  // --- UI ---
  displayReg: false,
  displayPad: false,
  displayControl: true,
  // --- Auth ---
  status: "idle", // 'idle' | 'loading' | 'success' | 'error'
  authLost: false, // вынужденная потеря сессии (401 / logout сервером) → красный тумблер
  responseData: null,
  // --- Stored matrix data ---
  uriMatrix: "",
  login: "",
  // --- Индекс комнат (данные — в SDK) ---
  roomIds: [],
  selectedRoomId: "",
  roomsMeta: {},
  // Логин для нового чата: лежит в Redux, чтобы поле мог заполнить любой компонент
  newRoomLogin: "",
  deviceVerification: {
    status: "idle", // 'idle' | 'loading' | 'requested' | 'ready' | 'started' | 'success' | 'cancelled' | 'error'
    verified: false,
    supported: true,
    initiatedByMe: false,
    sas: null,
    errText: "",
    // Код причины ошибки (constants/verification.js): по нему UI выбирает подсказку
    errCode: "",
    // Новый recovery key после создания Secret Storage: показывается до конца сессии,
    // чтобы ключ не потерялся, если окно закрыли сразу после создания
    recoveryKey: "",
  },
  // Error alert
  errText: "",
};

const emptyRooms = {
  roomIds: [],
  selectedRoomId: "",
  roomsMeta: {},
};

export default function mtrxControlRdcr(state = initialState, action) {
  switch (action.type) {
    case MTRXCTL_SUBMIT_REQUEST:
      return {
        ...state,
        status: "loading",
        // displayReg не трогаем: форма уже открыта, если запрос пришёл из MtrxReg,
        // а попытка входа с тумблера AuthPad не должна её открывать.
        displayPad: false,
        responseData: null,
        ...emptyRooms,
        deviceVerification: initialState.deviceVerification,
        errText: "",
      };

    case MTRXCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status: "success",
        authLost: false,
        displayReg: false,
        displayPad: true,
        responseData: action.payload.responseData,
        ...emptyRooms,
        errText: "",
      };

    case MTRXCTL_SUBMIT_ERROR: {
      const errText = action.payload.errText || "Ошибка";
      return {
        ...state,
        status: "error",
        // Ошибка не открывает форму: неудачный вход с тумблера AuthPad оставляет
        // открытым только его красное состояние, а форма MtrxReg (если была открыта)
        // показывает errText своим Alert.
        displayPad: false,
        responseData: null,
        ...emptyRooms,
        errText,
      };
    }

    case MTRXCTL_CLEAR:
      return {
        ...state,
        status: "idle",
        // Красный тумблер — только при вынужденной потере (401 / logout сервером):
        // этот CLEAR приходит с payload.authLost. Пользовательский сброс (тумблер или
        // «Выйти» в MtrxReg) и старт без сессии возвращают тумблер в исходное — откл.
        authLost: Boolean(action.payload?.authLost),
        displayReg: false,
        displayPad: false,
        responseData: null,
        ...emptyRooms,
        newRoomLogin: "",
        deviceVerification: initialState.deviceVerification,
        errText: "",
      };

    case MTRXCTL_STORE_VALUE:
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      };

    case MTRXCTL_STORE_MATRIX_DATA:
      return {
        ...state,
        uriMatrix: action.payload.uriMatrix,
        login: action.payload.login,
      };

    case MTRXCTL_ROOM_LIST_INITIALIZE: {
      // membership и тип комнаты кладём в индекс сразу: от них зависит UI,
      // а полные метаданные приходят асинхронно (getRoomMeta)
      const roomsMeta = {};
      action.payload.rooms.forEach((room) => {
        roomsMeta[room.roomId] = {
          ...state.roomsMeta[room.roomId],
          membership: room.membership,
          isSpace: room.isSpace,
          unread: room.unread || 0,
          highlight: room.highlight || 0,
        };
      });

      return {
        ...state,
        roomIds: action.payload.rooms.map((room) => room.roomId),
        roomsMeta,
      };
    }

    case MTRXCTL_ROOM_LIST_PUT: {
      const { roomId, membership, isSpace, unread, highlight } = action.payload;
      // Патчим только пришедшие поля: у PUT от SDK они есть, у оптимистичных — нет
      const patch = {
        ...(membership ? { membership } : {}),
        ...(typeof isSpace === "boolean" ? { isSpace } : {}),
        ...(typeof unread === "number" ? { unread } : {}),
        ...(typeof highlight === "number" ? { highlight } : {}),
      };
      const roomsMeta = Object.keys(patch).length
        ? {
            ...state.roomsMeta,
            [roomId]: { ...state.roomsMeta[roomId], ...patch },
          }
        : state.roomsMeta;

      if (state.roomIds.includes(roomId)) {
        return roomsMeta === state.roomsMeta ? state : { ...state, roomsMeta };
      }

      // Приглашения держим в начале списка — их важно увидеть первыми
      const roomIds = membership === "invite" ? [roomId, ...state.roomIds] : [...state.roomIds, roomId];

      return {
        ...state,
        roomIds,
        roomsMeta,
      };
    }

    case MTRXCTL_ROOM_LIST_DELETE: {
      const roomId = action.payload.roomId;
      const roomsMeta = { ...state.roomsMeta };
      delete roomsMeta[roomId];

      return {
        ...state,
        roomIds: state.roomIds.filter((id) => id !== roomId),
        selectedRoomId: state.selectedRoomId === roomId ? "" : state.selectedRoomId,
        roomsMeta,
      };
    }

    case MTRXCTL_ROOM_META_STORE: {
      const { roomId, meta } = action.payload;
      return {
        ...state,
        roomsMeta: {
          ...state.roomsMeta,
          [roomId]: meta,
        },
      };
    }

    case MTRXCTL_SET_SELECTED_ROOM:
      return {
        ...state,
        selectedRoomId: action.payload.roomId,
      };

    case MTRXCTL_DEVICE_VERIFICATION_STORE:
      return {
        ...state,
        deviceVerification: {
          ...state.deviceVerification,
          ...action.payload,
        },
      };

    default:
      return state;
  }
}
