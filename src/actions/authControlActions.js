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
import { beginMasRedirect, clearMasCredentials, completeMasAuth, takeMasReturn } from "../services/masAuth";
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
// 'oidc' — токены, полученные от MAS в браузере
const handleSelectAuthSource = (source) => (dispatch) => {
  dispatch({
    type: AUTHCTL_SELECT_AUTH_SOURCE,
    payload: { source },
  });
};

// Текст ошибки входа через MAS: у OAuth-ошибок причина в error_description, у сервиса
// (discovery, регистрация, возврат без кода) — в message. Отдельного кода UI не разбирает.
function getOidcErrorMessage(error) {
  const description = typeof error?.error_description === "string" ? error.error_description.trim() : "";
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  return description || message || "Не удалось войти через MAS.";
}

// OIDC — вход, общий для приложения, поэтому его ведёт AUTHCTL_: здесь браузер уходит на
// authorization_endpoint MAS (полностранично, без popup). Discovery и PKCE — в
// services/masAuth.js, сессию Matrix по полученным токенам поднимает MTRXCTL_
// (handleLoginWithOAuth), а связывает шаги мост — AuthContainer.
const handleOidcRedirect =
  (formData = {}) =>
  async (dispatch) => {
    const uriMatrix = typeof formData.uriMatrix === "string" ? formData.uriMatrix.trim() : "";

    dispatch({ type: AUTHCTL_OIDC_REQUEST });

    try {
      // Успешный вызов уводит браузер в MAS: дальше приложение стартует заново.
      // Issuer сохраняется в localStorage и подставится сидом стора на возврате.
      await beginMasRedirect({ uriMatrix });
    } catch (error) {
      dispatchOidcError(dispatch, getOidcErrorMessage(error));
    }
  };

// Возврат из MAS разбирается до первой отрисовки (main.jsx → store/bootstrap.js):
// обмен кода на токены идёт здесь, токены остаются в services/masAuth.js.
const handleOidcReturn = () => async (dispatch) => {
  const result = takeMasReturn();

  if (result.kind === "code") {
    dispatch({ type: AUTHCTL_OIDC_REQUEST });

    try {
      const { oauth } = await completeMasAuth({ code: result.code, state: result.state });
      // Токены готовы, но сессию поднимает клик тумблера в панели — это мост в AuthContainer
      dispatch({ type: AUTHCTL_OIDC_READY, payload: { issuer: oauth.issuer } });
    } catch (error) {
      dispatchOidcError(dispatch, getOidcErrorMessage(error));
    }
    return;
  }

  if (result.kind === "error") {
    dispatchOidcError(dispatch, result.errorText);
    return;
  }

  if (result.kind === "pending") {
    // Вернулись без кода: страница ошибки MAS либо пользователь нажал «назад»
    dispatchOidcError(dispatch, "Вход через MAS не завершён: выполните вход заново.");
  }
};

// Успех OIDC оформляет мост (AuthContainer) — уже после того, как MTRXCTL_ поднял сессию:
// статус говорит, что токены израсходованы и повторно ими сессию не поднять
const handleOidcSuccess = () => (dispatch) => {
  dispatch({ type: AUTHCTL_OIDC_SUCCESS });
};

// Ошибку подъёма сессии по токенам MAS приносит мост: показать её должна форма OIDC
const handleOidcError = (errText) => (dispatch) => {
  dispatchOidcError(dispatch, errText || "Не удалось войти через MAS.");
};

const handleOidcClear = () => (dispatch, getState) => {
  // Готовые токены закрытие формы не отменяет: окно могли открыть только чтобы посмотреть
  // статус источника. Израсходованные или ошибочные токены при закрытии забываем
  if (getState().authControlRdcr.oidcStatus !== "ready") clearMasCredentials();

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
