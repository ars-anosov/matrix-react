import { AUTHCTL_CLEAR, AUTHCTL_STORE_VALUE, AUTHCTL_SUBMIT_ERROR, AUTHCTL_SUBMIT_REQUEST, AUTHCTL_SUBMIT_SUCCESS } from "../constants/redux";
import * as restAuth from "../services/restAuth";
import { getApiErrorMessage } from "./utils/kyError";

// Namespace-инвариант: thunk-и AUTHCTL_ не трогают MTRXCTL_ (и наоборот).
// Мост к сервисам живёт в контейнере AuthContainer.

function dispatchRestAuthError(dispatch, errText) {
  dispatch({
    type: AUTHCTL_SUBMIT_ERROR,
    payload: { errText },
  });
}

const handleRestRegister =
  (formData = {}) =>
  async (dispatch) => {
    const login = typeof formData.login === "string" ? formData.login.trim() : "";
    // Пароль не тримим: пробелы могут быть частью учётных данных.
    const password = typeof formData.password === "string" ? formData.password : "";
    const uriRestAuth = typeof formData.uriRestAuth === "string" ? formData.uriRestAuth.trim() : "";

    if (!login || !password) {
      dispatchRestAuthError(dispatch, "Заполните логин и пароль.");
      return;
    }

    if (!uriRestAuth) {
      dispatchRestAuthError(dispatch, "Не задан адрес сервиса авторизации REST.");
      return;
    }

    dispatch({ type: AUTHCTL_SUBMIT_REQUEST });

    try {
      // Сервис сам валидирует адрес (https) и сохраняет сессию.
      const responseData = await restAuth.loginRest({ login, password, uriRestAuth });

      dispatch({
        type: AUTHCTL_SUBMIT_SUCCESS,
        payload: { responseData },
      });
    } catch (error) {
      const detailMessage = await getApiErrorMessage(error);
      dispatchRestAuthError(dispatch, detailMessage);
    }
  };

const handleRestAuthClear = () => (dispatch) => {
  restAuth.clearRestAuthSession();
  dispatch({ type: AUTHCTL_CLEAR });
};

const handleChangeStore = (storeDataKey, storeDataValue) => (dispatch) => {
  dispatch({
    type: AUTHCTL_STORE_VALUE,
    payload: { storeDataKey, storeDataValue },
  });
};

export { handleChangeStore, handleRestAuthClear, handleRestRegister };
