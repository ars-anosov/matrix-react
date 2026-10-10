import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
import * as authActions from "../actions/authControlActions.js";
import * as mtrxActions from "../actions/mtrxControlActions.js";
import MenuAppBar from "../components/MenuAppBar.jsx";
import { buildMtrxAuthSources, pickActiveAuthSource } from "./utils/authSources.js";

const MenuAppContainer = () => {
  const dispatch = useDispatch();

  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch]);
  const authControlActions = useMemo(() => bindActionCreators(authActions, dispatch), [dispatch]);

  const mtrxControlRdcr = useSelector((state) => state.mtrxControlRdcr);
  const authControlRdcr = useSelector((state) => state.authControlRdcr);

  // Те же производные источники, что в панели AuthPad: статус в шапке и в панели не расходится
  const authSources = useMemo(() => buildMtrxAuthSources(authControlRdcr, mtrxControlRdcr), [authControlRdcr, mtrxControlRdcr]);
  const activeSourceKind = pickActiveAuthSource(authSources, authControlRdcr.activeAuthSource);
  const activeSource = authSources.find((source) => source.kind === activeSourceKind) || null;
  const sessionUser = mtrxControlRdcr?.responseData?.display_name || mtrxControlRdcr?.responseData?.user_id || "";
  // Подпись у кругляша: у живой сессии — имя из Matrix, иначе логин или адрес ресурса источника
  const authCaption = activeSource?.session && sessionUser ? sessionUser : activeSource?.detail || "";

  // Передаем переменные напрямую как пропсы, а не единым объектом commonProps
  return (
    <MenuAppBar
      mtrxControlRdcr={mtrxControlRdcr}
      mtrxControlActions={mtrxControlActions}
      authControlRdcr={authControlRdcr}
      authControlActions={authControlActions}
      authSources={authSources}
      activeSourceKind={activeSourceKind}
      authCaption={authCaption}
    />
  );
};

export default MenuAppContainer;
