import { Grid } from "@mui/material";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
// Actions
import * as mtrxActions from "../actions/mtrxControlActions.js";

// Components
import MtrxReg from "../components/MtrxReg.jsx";
import { playMessageSound, preloadMessageSound } from "../components/utils/messageSound.js";
// Services
import * as matrixRooms from "../services/matrixRooms.js";
import MtrxPadContainer from "./MtrxPadContainer.jsx";

// Контейнер среза Matrix: форма входа MtrxReg и мессенджер MtrxPadContainer.
// AD-вход (AuthAd) относится к authControlRdcr — его рендерит AuthContainer.
const MtrxContainer = () => {
  const dispatch = useDispatch();

  const mtrxControlRdcr = useSelector((state) => state.mtrxControlRdcr);

  const mtrxControlActions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch]);

  // Сохранённые адрес и логин только предзаполняют форму входа: сессию при старте
  // не восстанавливаем — приложение всегда требует авторизацию
  useEffect(() => {
    mtrxControlActions.handleHydrateStoredMatrixData();
  }, [mtrxControlActions]);

  const { displayReg, displayPad, status, selectedRoomId } = mtrxControlRdcr;

  // Индекс комнат (счётчики непрочитанного в roomsMeta) нужен шапке: суммарный
  // бейдж рисует MtrxIco, а он виден и при скрытом мессенджере. Держим подписку
  // здесь, а не в MtrxPadContainer: тот размонтируется по displayPad = false,
  // и без дельт watchRoomList бейдж оставался бы пустым.
  useEffect(() => {
    if (status !== "success") return undefined;

    mtrxControlActions.handleStartRoomWatch();
    return () => mtrxControlActions.handleStopRoomWatch();
  }, [status, mtrxControlActions]);

  // Звук нового сообщения: событие даёт сервис, а решение играть — здесь, потому
  // что кроме Matrix нужны UI-состояние (фокус окна) и то, видна ли сейчас комната.
  // Условие «на экране» считаем как в Cinny, но с поправкой на наш стор: у него
  // выбранная комната живёт в URL и пропадает при уходе с экрана, а у нас
  // selectedRoomId остаётся после displayPad = false — иначе скрытый мессенджер
  // молчал бы.
  useEffect(() => {
    if (status !== "success") return undefined;

    preloadMessageSound();

    return matrixRooms.watchMessageNotifications(({ roomId }) => {
      const isRoomOnScreen = displayPad && selectedRoomId === roomId;
      if (document.hasFocus() && isRoomOnScreen) return;

      playMessageSound();
    });
  }, [status, selectedRoomId, displayPad]);

  // Форма входа — модальный Dialog (портал), в потоке документа она места не занимает,
  // поэтому мессенджер под ней не сдвигается
  return (
    <>
      {displayReg && <MtrxReg mtrxControlRdcr={mtrxControlRdcr} mtrxControlActions={mtrxControlActions} />}

      <Grid
        container
        spacing={2}
        sx={{
          justifyContent: "center",
          alignItems: "start",
          width: "100%",
        }}
      >
        {/* Мессенджер */}
        {displayPad && (
          <Grid size={{ xs: 12 }}>
            <MtrxPadContainer />
          </Grid>
        )}
      </Grid>
    </>
  );
};

export default MtrxContainer;
