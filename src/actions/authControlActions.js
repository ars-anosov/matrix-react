import ky from "ky";
import {
  AUTHCTL_CLEAR,
  AUTHCTL_STORE_VALUE,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
} from "../constants/redux";
import {
  AD_AUTH_EXPIRE_TIME_KEY,
  AD_LOGIN_KEY,
  AD_URI_AUTH_KEY,
} from "../constants/storage";
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
    const password =
      typeof formData.password === "string" ? formData.password.trim() : "";
    const uriAdAuth =
      typeof formData.uriAdAuth === "string" ? formData.uriAdAuth.trim() : "";

    if (!login || !password) {
      dispatchAdAuthError(dispatch, "Заполните логин и пароль.");
      return;
    }

    if (!uriAdAuth) {
      dispatchAdAuthError(dispatch, "Не задан uriAdAuth.");
      return;
    }
    localStorage.setItem(AD_URI_AUTH_KEY, uriAdAuth);

    dispatch({ type: AUTHCTL_SUBMIT_REQUEST });

    try {
      const responseData = await ky
        .post(uriAdAuth, {
          json: { login, password },
          timeout: 5000,
        })
        .json();

      localStorage.setItem(AD_LOGIN_KEY, login);
      const expireTime = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem(AD_AUTH_EXPIRE_TIME_KEY, expireTime);

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
  localStorage.removeItem(AD_AUTH_EXPIRE_TIME_KEY);
  dispatch({ type: AUTHCTL_CLEAR });
};

const handleChangeStore = (storeDataKey, storeDataValue) => (dispatch) => {
  dispatch({
    type: AUTHCTL_STORE_VALUE,
    payload: { storeDataKey, storeDataValue },
  });
};

export { handleAdAuthClear, handleAdRegister, handleChangeStore };
