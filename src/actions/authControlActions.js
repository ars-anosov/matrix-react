import {
  AUTHCTL_CLEAR,
  AUTHCTL_OIDC_CLEAR,
  AUTHCTL_OIDC_ERROR,
  AUTHCTL_OIDC_READY,
  AUTHCTL_OIDC_REQUEST,
  AUTHCTL_OIDC_SUCCESS,
  AUTHCTL_SELECT_AUTH_SOURCE,
  AUTHCTL_STORE_VALUE,
  AUTHCTL_SUBMIT_ERROR,
  AUTHCTL_SUBMIT_REQUEST,
  AUTHCTL_SUBMIT_SUCCESS,
} from "../constants/redux";
import { buildSsoLoginUrl } from "../services/matrixClient";
import { beginOidcRedirect, clearOidcCredentials, DEFAULT_OIDC_IDP_ID, takeOidcReturn } from "../services/oidcAuth";
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

// Явный выбор источника запуска в панели AuthPad: 'rest' — матричная пара из REST-ответа,
// 'oidc' — готовый loginToken authentik
const handleSelectAuthSource = (source) => (dispatch) => {
  dispatch({
    type: AUTHCTL_SELECT_AUTH_SOURCE,
    payload: { source },
  });
};

// Текст ошибки входа через authentik: у ошибок сервиса (адрес ресурса, возврат без токена)
// причина в message, отдельного кода UI не разбирает
function getOidcErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return message || "Не удалось войти через authentik.";
}

// OIDC — вход, общий для приложения, поэтому его ведёт AUTHCTL_: здесь браузер уходит на
// SSO-редирект Synapse (полностранично, без popup). Сессию Matrix по полученному токену
// поднимает MTRXCTL_ (handleLoginWithToken), а связывает шаги мост — AuthContainer.
// Абсолютный адрес SSO-редиректа строит matrixClient: Matrix-URL — зона services/.
const handleOidcRedirect =
  (formData = {}) =>
  (dispatch) => {
    const uriOidcAuth = typeof formData.uriOidcAuth === "string" ? formData.uriOidcAuth.trim() : "";
    const uriMatrix = typeof formData.uriMatrix === "string" ? formData.uriMatrix.trim() : "";
    const idpId = typeof formData.idpId === "string" && formData.idpId.trim() ? formData.idpId.trim() : DEFAULT_OIDC_IDP_ID;

    dispatch({ type: AUTHCTL_OIDC_REQUEST });

    try {
      // Успешный вызов уводит браузер в authentik: дальше приложение стартует заново
      beginOidcRedirect({
        uriOidcAuth,
        idpId,
        buildSsoLoginUrl: (redirectUrl, ssoIdpId) => buildSsoLoginUrl({ uriMatrix, redirectUrl, idpId: ssoIdpId }),
      });
    } catch (error) {
      dispatchOidcError(dispatch, getOidcErrorMessage(error));
    }
  };

// Возврат из authentik разбирается до первой отрисовки (main.jsx → store/bootstrap.js):
// токен остаётся в services/oidcAuth.js, сюда приходит только результат разбора
const handleOidcReturn = () => (dispatch) => {
  const result = takeOidcReturn();

  if (result.kind === "token") {
    // Токен готов, но сессию поднимает клик тумблера в панели — это мост в AuthContainer
    dispatch({ type: AUTHCTL_OIDC_READY });
    return;
  }

  if (result.kind === "error") {
    dispatchOidcError(dispatch, result.errorText);
    return;
  }

  if (result.kind === "pending") {
    // Вернулись без токена: Synapse отдал свою страницу ошибки либо пользователь нажал «назад»
    dispatchOidcError(dispatch, "Вход через authentik не завершён: выполните вход заново.");
  }
};

// Успех OIDC оформляет мост (AuthContainer) — уже после того, как MTRXCTL_ поднял сессию:
// статус говорит, что токен израсходован и повторно им сессию не поднять
const handleOidcSuccess = () => (dispatch) => {
  dispatch({ type: AUTHCTL_OIDC_SUCCESS });
};

// Ошибку подъёма сессии по loginToken приносит мост: показать её должна форма OIDC
const handleOidcError = (errText) => (dispatch) => {
  dispatchOidcError(dispatch, errText || "Не удалось войти через authentik.");
};

const handleOidcClear = () => (dispatch, getState) => {
  // Готовый токен закрытие формы не отменяет: окно могли открыть только чтобы посмотреть
  // статус источника. Израсходованный или ошибочный токен при закрытии забываем
  if (getState().authControlRdcr.oidcStatus !== "ready") clearOidcCredentials();

  dispatch({ type: AUTHCTL_OIDC_CLEAR });
};

export {
  handleChangeStore,
  handleOidcClear,
  handleOidcError,
  handleOidcRedirect,
  handleOidcReturn,
  handleOidcSuccess,
  handleRestAuthClear,
  handleRestRegister,
  handleSelectAuthSource,
};
