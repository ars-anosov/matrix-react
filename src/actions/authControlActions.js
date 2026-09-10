import {
  AUTHCTL_CLEAR,
  AUTHCTL_STORE_VALUE,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
} from "../constants/redux";
import * as adAuth from "../services/adAuth";
import { getApiErrorMessage } from "./utils/kyError";

function dispatchAdAuthError(dispatch, errText) {
  dispatch({
    type: AUTHCTL_SUBMIT_ERROR,
    payload: { errText },
  });
}

const handleAdRegister =
  (formData = {}) =>
  async (dispatch) => {
    const login =
      typeof formData.login === "string" ? formData.login.trim() : "";
    // Пароль не тримим: пробелы могут быть частью учётных данных.
    const password =
      typeof formData.password === "string" ? formData.password : "";
    const uriAdAuth =
      typeof formData.uriAdAuth === "string" ? formData.uriAdAuth.trim() : "";

    if (!login || !password) {
      dispatchAdAuthError(dispatch, "Заполните логин и пароль.");
      return;
    }

    if (!uriAdAuth) {
      dispatchAdAuthError(dispatch, "Не задан адрес сервиса авторизации AD.");
      return;
    }

    dispatch({ type: AUTHCTL_SUBMIT_REQUEST });

    try {
      // Сервис сам валидирует адрес (https) и сохраняет сессию.
      const responseData = await adAuth.loginAd({ login, password, uriAdAuth });

      dispatch({
        type: AUTHCTL_SUBMIT_SUCCESS,
        payload: { responseData },
      });
    } catch (error) {
      const detailMessage = await getApiErrorMessage(error);
      dispatchAdAuthError(dispatch, detailMessage);
    }
  };

const handleAdAuthClear = () => (dispatch) => {
  adAuth.clearAdAuthSession();
  dispatch({ type: AUTHCTL_CLEAR });
};

const handleChangeStore = (storeDataKey, storeDataValue) => (dispatch) => {
  dispatch({
    type: AUTHCTL_STORE_VALUE,
    payload: { storeDataKey, storeDataValue },
  });
};

export { handleAdAuthClear, handleAdRegister, handleChangeStore };
