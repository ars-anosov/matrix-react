import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
import * as authActions from "../actions/authControlActions.js";
import * as mtrxActions from "../actions/mtrxControlActions.js";
import AuthLinks from "../components/AuthLinks.jsx";
import AuthOidc from "../components/AuthOidc.jsx";
import AuthPad from "../components/AuthPad.jsx";
import AuthRest from "../components/AuthRest.jsx";

// Ключ пары матричных реквизитов: защищает от повторных dispatch на каждый ререндер
const buildMtrxKey = (mtrxLogin, mtrxPassword) => `${mtrxLogin}\u0000${mtrxPassword}`;

// Мост к сервисам (REST → Matrix). Thunk-и namespace-чистые: authControlActions не
// диспатчит MTRXCTL_, mtrxControlActions — AUTHCTL_. Все переходы между срезами
// (AUTHCTL_ ↔ MTRXCTL_) живут только здесь.
const AuthContainer = () => {
  const dispatch = useDispatch();

  const authControlRdcr = useSelector((state) => state.authControlRdcr);
  const mtrxControlRdcr = useSelector((state) => state.mtrxControlRdcr);

  const authControlActions = useMemo(() => bindActionCreators(authActions, dispatch), [dispatch]);
  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch]);

  const { responseData, displayRest, displayAuthPad, displayOidc, oidcIdpId, oidcStatus, status: authStatus } = authControlRdcr;
  const { uriMatrix, status: mtrxStatus, authLost: mtrxAuthLost } = mtrxControlRdcr;

  // Реквизиты Matrix из ответа REST (см. README → AuthRest.jsx)
  const mtrxLogin = responseData?.mtrx_login || "";
  const mtrxPassword = responseData?.mtrx_password || "";
  const mtrxUserId = mtrxControlRdcr.responseData?.user_id || "";

  // Ключ уже подставленных в MtrxReg REST-данных: защищает от повторных dispatch
  const filledKeyRef = useRef("");
  // Форсируем показ AuthPad только на переходе в authLost, чтобы ✕ не открывал панель снова
  const authLostForcedRef = useRef(false);

  // Мост к сервисам (AUTHCTL_ → MTRXCTL_): REST-вход заполняет поле логина формы MtrxReg.
  // Пароль в стор не кладём — он уходит в thunk только по клику тумблера.
  useEffect(() => {
    if (!mtrxLogin) {
      filledKeyRef.current = "";
      return;
    }

    const mtrxKey = buildMtrxKey(mtrxLogin, mtrxPassword);
    if (filledKeyRef.current === mtrxKey) return;

    filledKeyRef.current = mtrxKey;
    mtrxControlActions.handleChangeStore("login", mtrxLogin);
  }, [mtrxLogin, mtrxPassword, mtrxControlActions]);

  // Мост к сервисам (MTRXCTL_ → AUTHCTL_): потеря авторизации Matrix форсирует показ
  // AuthPad с красным тумблером (раньше в этом случае форсировался MtrxReg).
  useEffect(() => {
    if (!mtrxAuthLost) {
      authLostForcedRef.current = false;
      return;
    }
    if (authLostForcedRef.current) return;

    authLostForcedRef.current = true;
    authControlActions.handleChangeStore("displayAuthPad", true);
  }, [mtrxAuthLost, authControlActions]);

  // Мост к сервисам: тумблер AuthPad — индикатор состояния сессии Matrix и действие.
  // Красный (authLost / status === "error") и зелёный (авторизован) — клик сбрасывает
  // текущую сессию. Откл (сессии нет) — клик запускает автоматическую авторизацию данными REST.
  const handleToggleMtrx = () => {
    if (mtrxAuthLost || mtrxStatus === "success" || mtrxStatus === "error") {
      mtrxControlActions.handleRegClear();
      return;
    }

    if (!mtrxLogin || !mtrxPassword) return;
    if (mtrxStatus === "loading") return;

    mtrxControlActions.handleRegister({
      login: mtrxLogin,
      password: mtrxPassword,
      uriMatrix,
    });
  };

  // Мост к сервисам: ✕ на AuthPad снимает флаг показа
  const handleCloseAuthPad = () => {
    authControlActions.handleChangeStore("displayAuthPad", false);
  };

  // Стартовый экран: ссылки открывают формы своего среза (переходов между срезами нет —
  // каждый вызов пишет только в свой)
  const handleOpenRest = () => {
    authControlActions.handleChangeStore("displayRest", true);
  };

  const handleOpenMtrx = () => {
    mtrxControlActions.handleChangeStore("displayReg", true);
  };

  // Вход через OIDC (authentik): форма AUTH-среза собирает адрес ресурса IdP и запускает
  // флоу; открытие формы пишет только в свой срез
  const handleOpenOidc = () => {
    authControlActions.handleChangeStore("displayOidc", true);
  };

  // Мост к сервисам (AUTHCTL_ → MTRXCTL_): OIDC-вход AUTH-срез доводит только до loginToken,
  // сессию Matrix по нему поднимает MTRXCTL_ — он же включает чат (MTRXCTL_SUBMIT_SUCCESS).
  // Успех формы и ошибку подъёма сессии возвращаем в AUTHCTL_, где живёт форма.
  const handleOidcLogin = async ({ uriOidcAuth }) => {
    const loginToken = await authControlActions.handleOidcLogin({ uriOidcAuth, idpId: oidcIdpId, uriMatrix });
    if (!loginToken) return;

    try {
      const session = await mtrxControlActions.handleLoginWithToken({ loginToken, uriMatrix });
      if (!session) return;

      authControlActions.handleOidcSuccess({ user_id: session.userId, display_name: session.displayName });
    } catch (error) {
      authControlActions.handleOidcError(error.message);
    }
  };

  // «Выйти» на форме OIDC — тоже мост: выход из Matrix (MTRXCTL_) и сброс статуса
  // OIDC-входа в своём срезе
  const handleOidcLogout = () => {
    authControlActions.handleOidcClear();
    mtrxControlActions.handleRegClear();
  };

  // Мост к сервисам (MTRXCTL_ → AUTHCTL_): успех OIDC-входа действителен, пока активна
  // Matrix-сессия. Иначе после выхода или потери сессии форма снова открылась бы с «Выйти»
  // и чужим display_name (до переноса этот статус сбрасывал MTRXCTL_CLEAR).
  useEffect(() => {
    if (oidcStatus !== "success" || mtrxStatus === "success") return;
    authControlActions.handleOidcClear();
  }, [oidcStatus, mtrxStatus, authControlActions]);

  // Мост к сервисам (MTRXCTL_ → AUTHCTL_): AuthRestInfo читает матричный идентификатор.
  // Только в рамках активного REST-сеанса, иначе после REST-выхода responseData заполнится снова.
  useEffect(() => {
    if (authStatus !== "success" || mtrxStatus !== "success" || !mtrxUserId) return;
    if (responseData?.mtrx_user_id === mtrxUserId) return;

    authControlActions.handleChangeStore("responseData", {
      ...(responseData || {}),
      mtrx_user_id: mtrxUserId,
    });
  }, [authStatus, mtrxStatus, mtrxUserId, responseData, authControlActions]);

  // Стартовый экран — ссылки на обе формы, пока ни одна авторизация не прошла.
  // Дальше: успех REST → мост AuthPad, успех Matrix → чат MtrxPadContainer (MtrxContainer)
  const showAuthLinks = authStatus !== "success" && mtrxStatus !== "success";

  // Оба блока REST-домена: форма входа (displayRest) и мост к сервисам (displayAuthPad).
  // Форма — модальный Dialog (портал), в потоке документа она места не занимает
  return (
    <>
      {showAuthLinks && <AuthLinks onOpenRest={handleOpenRest} onOpenMtrx={handleOpenMtrx} onOpenOidc={handleOpenOidc} />}

      {displayRest && <AuthRest authControlRdcr={authControlRdcr} authControlActions={authControlActions} />}

      {displayOidc && (
        <AuthOidc
          authControlRdcr={authControlRdcr}
          authControlActions={authControlActions}
          onLogin={handleOidcLogin}
          onLogout={handleOidcLogout}
          isMatrixUriMissing={import.meta.env.DEV && !uriMatrix.trim()}
        />
      )}

      {displayAuthPad && (
        <AuthPad
          authControlRdcr={authControlRdcr}
          mtrxControlRdcr={mtrxControlRdcr}
          onToggleMtrx={handleToggleMtrx}
          onOpenRest={handleOpenRest}
          onClose={handleCloseAuthPad}
        />
      )}
    </>
  );
};

export default AuthContainer;
