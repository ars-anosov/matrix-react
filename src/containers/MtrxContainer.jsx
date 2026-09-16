import { Grid } from "@mui/material";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
// Actions
import * as mtrxActions from "../actions/mtrxControlActions.js";

// Components
import MtrxReg from "../components/MtrxReg.jsx";
import MtrxPadContainer from "./MtrxPadContainer.jsx";

// Контейнер среза Matrix: форма входа MtrxReg и мессенджер MtrxPadContainer.
// AD-вход (AuthAd) относится к authControlRdcr — его рендерит AuthContainer.
const MtrxContainer = () => {
  const dispatch = useDispatch();

  const mtrxControlRdcr = useSelector((state) => state.mtrxControlRdcr);

  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch]);

  useEffect(() => {
    mtrxControlActions.handleRestoreSession();
  }, [mtrxControlActions]);

  const { displayReg, displayPad, errComponent } = mtrxControlRdcr;

  // Форма входа — модальный Dialog (портал), в потоке документа она места не занимает,
  // поэтому мессенджер под ней не сдвигается
  return (
    <>
      {(displayReg || errComponent === "MtrxReg") && <MtrxReg mtrxControlRdcr={mtrxControlRdcr} mtrxControlActions={mtrxControlActions} />}

      <Grid
        container
        spacing={2}
        sx={{
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Мессенджер */}
        {(displayPad || errComponent === "MtrxPad") && (
          <Grid size={{ xs: 12, md: "auto" }}>
            <MtrxPadContainer />
          </Grid>
        )}
      </Grid>
    </>
  );
};

export default MtrxContainer;
