import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bindActionCreators } from "redux";
import * as mtrxActions from "../actions/mtrxControlActions.js";
import MtrxPad from "../components/MtrxPad.jsx";
import { ROOM_STATUS_REFRESH_MS } from "../constants/ui.js";
import * as matrixRooms from "../services/matrixRooms.js";

// Читает сообщения активной комнаты из сервиса (SDK — источник истины),
// а не из Redux. Компоненты остаются глупыми, данные не сериализуются в стор.
function useRoomMessages(roomId) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      return undefined;
    }

    return matrixRooms.watchRoomMessages(roomId, setMessages);
  }, [roomId]);

  return messages;
}

const MtrxPadContainer = () => {
  const dispatch = useDispatch();
  const actions = useMemo(() => bindActionCreators(mtrxActions, dispatch), [dispatch]);

  const { roomIds, roomsMeta, selectedRoomId, newRoomLogin, status, login: sessionLogin, deviceVerification } = useSelector((state) => state.mtrxControlRdcr);

  const messages = useRoomMessages(selectedRoomId);

  useEffect(() => {
    if (!selectedRoomId || status !== "success") return undefined;

    const refresh = () => actions.handleLoadRoomMeta(selectedRoomId);
    refresh();
    const timer = window.setInterval(refresh, ROOM_STATUS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [selectedRoomId, status, actions]);

  const rooms = useMemo(
    () =>
      roomIds.map((roomId) => ({
        roomId,
        name: roomsMeta[roomId]?.name || roomId,
        avatarUrl: roomsMeta[roomId]?.avatarUrl || "",
        subtitle: roomsMeta[roomId]?.subtitle || "",
        membership: roomsMeta[roomId]?.membership || "",
        isSpace: Boolean(roomsMeta[roomId]?.isSpace),
        // presence собеседника: по нему список красит строку online-комнаты
        presence: roomsMeta[roomId]?.presence || "",
        peerId: roomsMeta[roomId]?.peerId || "",
        unread: roomsMeta[roomId]?.unread || 0,
        highlight: roomsMeta[roomId]?.highlight || 0,
      })),
    [roomIds, roomsMeta],
  );

  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;

    const meta = roomsMeta[selectedRoomId];
    return {
      roomId: selectedRoomId,
      name: meta?.name || selectedRoomId,
      avatarUrl: meta?.avatarUrl || "",
      subtitle: meta?.subtitle || "",
      membership: meta?.membership || "",
      isSpace: Boolean(meta?.isSpace),
      // presence собеседника: по нему шапка комнаты красит плашку статуса
      presence: meta?.presence || "",
      children: meta?.children || [],
      messages,
    };
  }, [selectedRoomId, roomsMeta, messages]);

  return (
    <MtrxPad
      rooms={rooms}
      selectedRoomId={selectedRoomId}
      selectedRoom={selectedRoom}
      newRoomLogin={newRoomLogin}
      status={status}
      sessionLogin={sessionLogin}
      deviceVerification={deviceVerification}
      // Снимок и экшены проверки устройства нужны карточке авторизации в правой
      // панели чата (как MtrxInfo получал их в попапе меню)
      mtrxControlActions={actions}
      onNewRoomLoginChange={(value) => actions.handleChangeStore("newRoomLogin", value)}
      onSelectRoom={(roomId) => actions.handleSelectRoom(roomId)}
      onClose={() => actions.handleChangeStore("displayPad", false)}
      // Кнопка состояния в подвале панели открывает форму входа Matrix
      onOpenReg={() => actions.handleChangeStore("displayReg", true)}
      // Один логин — личный чат: названия у него нет, имя даёт профиль собеседника
      onCreateRoom={(login) => actions.handleCreateRoom({ invitees: [login] })}
      onSendMessage={(body) => actions.handleSendMessage(selectedRoomId, body)}
      onSendFile={(file, options) => actions.handleSendFile(selectedRoomId, file, options)}
      onDownloadFile={(message) => actions.handleDownloadFile(message.media, message.filename)}
      onAcceptInvite={() => actions.handleJoinRoom(selectedRoomId)}
      onDeclineInvite={() => actions.handleLeaveRoom(selectedRoomId)}
      onLeaveRoom={() => actions.handleLeaveRoom(selectedRoomId)}
    />
  );
};

export default MtrxPadContainer;
