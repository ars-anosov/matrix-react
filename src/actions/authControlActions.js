import {
  AUTHCTL_CLEAR,
  AUTHCTL_OIDC_CLEAR,
  AUTHCTL_OIDC_ERROR,
  AUTHCTL_OIDC_REQUEST,
  AUTHCTL_OIDC_SUCCESS,
  AUTHCTL_STORE_VALUE,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
} from "../constants/redux";
import { buildSsoLoginUrl } from "../services/matrixClient";
import { DEFAULT_OIDC_IDP_ID, startOidcLogin } from "../services/oidcAuth";
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

function dispatchOidcError(dispatch, errText) {
  dispatch({
    type: AUTHCTL_OIDC_ERROR,
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
  dispatch({ type: AUTHCTL_CLEAR });
};

const handleChangeStore = (storeDataKey, storeDataValue) => (dispatch) => {
  dispatch({
    type: AUTHCTL_STORE_VALUE,
    payload: { storeDataKey, storeDataValue },
  });
};

// Текст ошибки входа через authentik: у ошибок сервиса (адрес ресурса, popup, таймаут)
// причина в message, отдельного кода UI не разбирает
function getOidcErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return message || "Не удалось войти через authentik.";
}

// Активная попытка OIDC: закрытие формы или новая попытка должны прервать ожидание
// loginToken, иначе форма осталась бы в вечном loading с недоступным крестиком
let oidcAttempt = null;

// OIDC — вход, общий для приложения, поэтому его ведёт AUTHCTL_: здесь добывается
// loginToken (popup → Synapse → authentik). Сессию Matrix по токену поднимает MTRXCTL_
// (handleLoginWithToken), а связывает шаги мост — AuthContainer.
// Абсолютный адрес SSO-редиректа строит matrixClient: Matrix-URL — зона services/.
const handleOidcLogin =
  (formData = {}) =>
  async (dispatch) => {
    const uriOidcAuth = typeof formData.uriOidcAuth === "string" ? formData.uriOidcAuth.trim() : "";
    const uriMatrix = typeof formData.uriMatrix === "string" ? formData.uriMatrix.trim() : "";
    const idpId = typeof formData.idpId === "string" && formData.idpId.trim() ? formData.idpId.trim() : DEFAULT_OIDC_IDP_ID;

    oidcAttempt?.abort();
    const controller = new AbortController();
    oidcAttempt = controller;

    dispatch({ type: AUTHCTL_OIDC_REQUEST });

    try {
      // startOidcLogin открывает popup синхронно, поэтому вызов идёт до первого await
      const { loginToken } = await startOidcLogin({
        uriOidcAuth,
        idpId,
        signal: controller.signal,
        buildSsoLoginUrl: (redirectUrl, ssoIdpId) => buildSsoLoginUrl({ uriMatrix, redirectUrl, idpId: ssoIdpId }),
      });
      return loginToken;
    } catch (error) {
      // Отмена (закрытие формы или новая попытка) — не ошибка: статус сбрасывает инициатор
      if (controller.signal.aborted) return null;
      dispatchOidcError(dispatch, getOidcErrorMessage(error));
      return null;
    } finally {
      if (oidcAttempt === controller) oidcAttempt = null;
    }
  };

// Успех OIDC оформляет мост (AuthContainer) — уже после того, как MTRXCTL_ поднял сессию:
// форма показывает её display_name, а факт входа подтверждает MTRXCTL_SUBMIT_SUCCESS
const handleOidcSuccess = (responseData) => (dispatch) => {
  dispatch({
    type: AUTHCTL_OIDC_SUCCESS,
    payload: { responseData },
  });
};

// Ошибку подъёма сессии по loginToken приносит мост: показать её должна форма OIDC
const handleOidcError = (errText) => (dispatch) => {
  dispatchOidcError(dispatch, errText || "Не удалось войти через authentik.");
};

const handleOidcClear = () => (dispatch) => {
  // Закрытие формы или «Выйти»: незавершённое ожидание loginToken прерываем
  oidcAttempt?.abort();
  oidcAttempt = null;
  dispatch({ type: AUTHCTL_OIDC_CLEAR });
};

export { handleChangeStore, handleOidcClear, handleOidcError, handleOidcLogin, handleOidcSuccess, handleRestAuthClear, handleRestRegister };
