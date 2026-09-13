import {
  MTRXCTL_CLEAR,
  MTRXCTL_DEVICE_VERIFICATION_STORE,
  MTRXCTL_ERROR_ALERT,
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
  displayReg: true,
  displayPad: false,
  displayControl: true,
  // --- Auth ---
  status: "idle", // 'idle' | 'loading' | 'success' | 'error'
  responseData: null,
  // --- Stored matrix data ---
  uriMatrix: "",
  login: "",
  // --- Индекс комнат (данные — в SDK) ---
  roomIds: [],
  selectedRoomId: "",
  roomsMeta: {},
  deviceVerification: {
    status: "idle", // 'idle' | 'loading' | 'requested' | 'ready' | 'started' | 'success' | 'cancelled' | 'error'
    verified: false,
    supported: true,
    initiatedByMe: false,
    sas: null,
    errText: "",
  },
  // Error alert
  errComponent: "",
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
        displayReg: true,
        displayPad: false,
        responseData: null,
        ...emptyRooms,
        deviceVerification: initialState.deviceVerification,
        errComponent: "",
        errText: "",
      };

    case MTRXCTL_SUBMIT_SUCCESS:
      return {
        ...state,
        status: "success",
        displayReg: false,
        displayPad: true,
        responseData: action.payload.responseData,
        ...emptyRooms,
        errComponent: "",
        errText: "",
      };

    case MTRXCTL_SUBMIT_ERROR: {
      const errText = action.payload.errText || "Ошибка";
      return {
        ...state,
        status: "error",
        displayReg: true,
        displayPad: false,
        responseData: null,
        ...emptyRooms,
        errComponent: "MtrxReg",
        errText,
      };
    }

    case MTRXCTL_CLEAR:
      return {
        ...state,
        status: "idle",
        displayReg: true,
        displayPad: false,
        responseData: null,
        ...emptyRooms,
        deviceVerification: initialState.deviceVerification,
        errComponent: "",
        errText: "",
      };

    case MTRXCTL_STORE_VALUE:
      return {
        ...state,
        [action.payload.storeDataKey]: action.payload.storeDataValue,
      };

    case MTRXCTL_ERROR_ALERT:
      return {
        ...state,
        errComponent: action.payload.errComponent,
        errText: action.payload.errText,
      };

    case MTRXCTL_STORE_MATRIX_DATA:
      return {
        ...state,
        uriMatrix: action.payload.uriMatrix,
        login: action.payload.login,
      };

    case MTRXCTL_ROOM_LIST_INITIALIZE:
      return {
        ...state,
        roomIds: action.payload.roomIds,
      };

    case MTRXCTL_ROOM_LIST_PUT: {
      const roomId = action.payload.roomId;
      if (state.roomIds.includes(roomId)) return state;
      return {
        ...state,
        roomIds: [...state.roomIds, roomId],
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
