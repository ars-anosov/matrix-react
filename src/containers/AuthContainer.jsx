import { useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
import * as authActions from "../actions/authControlActions.js";
import * as mtrxActions from "../actions/mtrxControlActions.js";
import AuthPad from "../components/AuthPad.jsx";

// Ключ пары матричных реквизитов: защищает от повторных dispatch на каждый ререндер
const buildMtrxKey = (mtrxLogin, mtrxPassword) => `${mtrxLogin}\u0000${mtrxPassword}`;

// Мост к сервисам (AD → Matrix). Thunk-и namespace-чистые: authControlActions не
// диспатчит MTRXCTL_, mtrxControlActions — AUTHCTL_. Все переходы между срезами
// (AUTHCTL_ ↔ MTRXCTL_) живут только здесь.
const AuthContainer = () => {
  const dispatch = useDispatch();

  const authControlRdcr = useSelector((state) => state.authControlRdcr);
  const mtrxControlRdcr = useSelector((state) => state.mtrxControlRdcr);

  const authControlActions = useMemo(() => bindActionCreators(authActions, dispatch), [dispatch]);
  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch]);

  const { responseData, displayAuthPad, status: authStatus } = authControlRdcr;
  const { uriMatrix, status: mtrxStatus, authLost: mtrxAuthLost } = mtrxControlRdcr;

  // Реквизиты Matrix из ответа AD (см. README → AuthAd.jsx)
  const mtrxLogin = responseData?.mtrx_login || "";
  const mtrxPassword = responseData?.mtrx_password || "";
  const mtrxUserId = mtrxControlRdcr.responseData?.user_id || "";

  // Ключ уже подставленных в MtrxReg AD-данных: защищает от повторных dispatch
  const filledKeyRef = useRef("");
  // Форсируем показ AuthPad только на переходе в authLost, чтобы ✕ не открывал панель снова
  const authLostForcedRef = useRef(false);

  // Мост к сервисам (AUTHCTL_ → MTRXCTL_): AD-вход заполняет поле логина формы MtrxReg.
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
  // Красный (authLost) и зелёный (авторизован) — клик сбрасывает текущую сессию.
  // Откл (сессии нет) — клик запускает автоматическую авторизацию данными AD.
  const handleToggleMtrx = () => {
    if (mtrxAuthLost || mtrxStatus === "success") {
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

  // Мост к сервисам (MTRXCTL_ → AUTHCTL_): AuthAdInfo читает матричный идентификатор.
  // Только в рамках активного AD-сеанса, иначе после AD-выхода responseData заполнится снова.
  useEffect(() => {
    if (authStatus !== "success" || mtrxStatus !== "success" || !mtrxUserId) return;
    if (responseData?.mtrx_user_id === mtrxUserId) return;

    authControlActions.handleChangeStore("responseData", {
      ...(responseData || {}),
      mtrx_user_id: mtrxUserId,
    });
  }, [authStatus, mtrxStatus, mtrxUserId, responseData, authControlActions]);

  // AuthPad показывается по флагу меню; без AD-данных она информирует об этом
  if (!displayAuthPad) return null;

  return (
    <AuthPad
      authControlRdcr={authControlRdcr}
      mtrxControlRdcr={mtrxControlRdcr}
      onToggleMtrx={handleToggleMtrx}
      onClose={handleCloseAuthPad}
    />
  );
};

export default AuthContainer;
