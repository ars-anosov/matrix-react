import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
import * as authActions from "../actions/authControlActions.js";
import * as mtrxActions from "../actions/mtrxControlActions.js";
import AuthLinks from "../components/AuthLinks.jsx";
import AuthOidc from "../components/AuthOidc.jsx";
import AuthPad from "../components/AuthPad.jsx";
import AuthRest from "../components/AuthRest.jsx";
import { AUTH_SOURCE_OIDC } from "../constants/authSource.js";
import { consumeLoginToken } from "../services/oidcAuth.js";
import { buildMtrxAuthInfo, buildMtrxAuthSources, pickActiveAuthSource } from "./utils/authSources.js";

// Ключ пары матричных реквизитов: защищает от повторных dispatch на каждый ререндер
const buildMtrxKey = (mtrxLogin, mtrxPassword) => `${mtrxLogin}\u0000${mtrxPassword}`;

// Мост к сервисам (REST/OIDC → Matrix). Thunk-и namespace-чистые: authControlActions не
// диспатчит MTRXCTL_, mtrxControlActions — AUTHCTL_. Все переходы между срезами
// (AUTHCTL_ ↔ MTRXCTL_) живут только здесь.
const AuthContainer = () => {
  const dispatch = useDispatch();

  const authControlRdcr = useSelector((state) => state.authControlRdcr);
  const mtrxControlRdcr = useSelector((state) => state.mtrxControlRdcr);

  const authControlActions = useMemo(() => bindActionCreators(authActions, dispatch), [dispatch]);
  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch]);

  const { responseData, displayRest, displayAuthPad, displayOidc, oidcIdpId, oidcStatus, status: authStatus, activeAuthSource } = authControlRdcr;
  const { uriMatrix, status: mtrxStatus, authLost: mtrxAuthLost } = mtrxControlRdcr;

  // Реквизиты Matrix из ответа REST (см. README → AuthRest.jsx)
  const mtrxLogin = responseData?.mtrx_login || "";
  const mtrxPassword = responseData?.mtrx_password || "";
  const mtrxUserId = mtrxControlRdcr.responseData?.user_id || "";

  // Два источника матричных учётных данных и явно выбранный из них — общая логика с шапкой
  const sources = useMemo(() => buildMtrxAuthSources(authControlRdcr, mtrxControlRdcr), [authControlRdcr, mtrxControlRdcr]);
  const activeSourceKind = pickActiveAuthSource(sources, activeAuthSource);
  const activeSource = sources.find((source) => source.kind === activeSourceKind) || null;
  const authInfo = useMemo(() => buildMtrxAuthInfo({ sources, activeSource, authControlRdcr }), [sources, activeSource, authControlRdcr]);

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

  // Мост к сервисам (AUTHCTL_ → MTRXCTL_): сессию по loginToken поднимает MTRXCTL_, а
  // AUTHCTL_ узнаёт об успехе — там живёт форма и статус источника. Ошибку подъёма
  // возвращаем туда же: токен израсходован, вход нужно повторить.
  const startOidcSession = async (loginToken) => {
    try {
      const session = await mtrxControlActions.handleLoginWithToken({ loginToken, uriMatrix });
      if (!session) return;

      authControlActions.handleOidcSuccess();
    } catch (error) {
      authControlActions.handleOidcError(error.message);
    }
  };

  // Мост к сервисам: тумблер AuthPad — индикатор состояния сессии Matrix и действие.
  // Красный (authLost / status === "error") и зелёный (авторизован) — клик сбрасывает
  // текущую сессию. Откл (сессии нет) — клик поднимает сессию выбранным источником:
  // матричной парой REST либо готовым loginToken authentik.
  const handleToggleMtrx = () => {
    if (mtrxAuthLost || mtrxStatus === "success" || mtrxStatus === "error") {
      mtrxControlActions.handleRegClear();
      return;
    }

    if (mtrxStatus === "loading") return;
    // Тумблер выключен, пока выбранный источник не готов: сюда такой клик не доходит
    if (!activeSource?.ready) return;

    if (activeSource.kind === AUTH_SOURCE_OIDC) {
      const loginToken = consumeLoginToken();
      if (!loginToken) {
        authControlActions.handleOidcError("Токен входа authentik утерян: войдите заново.");
        return;
      }

      startOidcSession(loginToken);
      return;
    }

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

  // Вход через OIDC (authentik): форма AUTH-среза собирает адрес ресурса IdP и уводит
  // браузер на SSO-редирект Synapse; открытие формы пишет только в свой срез
  const handleOpenOidc = () => {
    authControlActions.handleChangeStore("displayOidc", true);
  };

  // Мост к сервисам (AUTHCTL_ → MTRXCTL_): OIDC-вход AUTH-срез доводит только до
  // готовности токена, сессию по нему поднимает MTRXCTL_ — он же включает чат.
  const handleOidcRedirect = ({ uriOidcAuth }) => {
    authControlActions.handleOidcRedirect({ uriOidcAuth, idpId: oidcIdpId, uriMatrix });
  };

  // Выбор источника для запуска сессии (радио в AuthPad) — состояние своего среза
  const handleSelectAuthSource = (kind) => {
    authControlActions.handleSelectAuthSource(kind);
  };

  // Кнопка подвала AuthPad ведёт в форму активного источника
  const handleOpenActiveAuth = () => {
    if (activeSourceKind === AUTH_SOURCE_OIDC) {
      authControlActions.handleChangeStore("displayOidc", true);
      return;
    }

    handleOpenRest();
  };

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

  // Стартовый экран — ссылки на формы, пока нет ни сессии Matrix, ни готового источника:
  // успех REST открывает мост AuthPad, готовый токен authentik — тоже
  const showAuthLinks = authStatus !== "success" && mtrxStatus !== "success" && oidcStatus !== "ready";

  // Оба блока AUTH-домена: формы входа (displayRest, displayOidc) и мост к сервисам
  // (displayAuthPad). Формы — модальные Dialog (портал), в потоке документа они места не занимают
  return (
    <>
      {showAuthLinks && <AuthLinks onOpenRest={handleOpenRest} onOpenMtrx={handleOpenMtrx} onOpenOidc={handleOpenOidc} />}

      {displayRest && <AuthRest authControlRdcr={authControlRdcr} authControlActions={authControlActions} />}

      {displayOidc && (
        <AuthOidc
          authControlRdcr={authControlRdcr}
          authControlActions={authControlActions}
          onLogin={handleOidcRedirect}
          isMatrixUriMissing={import.meta.env.DEV && !uriMatrix.trim()}
        />
      )}

      {displayAuthPad && (
        <AuthPad
          mtrxControlRdcr={mtrxControlRdcr}
          sources={sources}
          activeSourceKind={activeSourceKind}
          info={authInfo}
          onSelectSource={handleSelectAuthSource}
          onToggleMtrx={handleToggleMtrx}
          onOpenActiveAuth={handleOpenActiveAuth}
          onClose={handleCloseAuthPad}
        />
      )}
    </>
  );
};

export default AuthContainer;
