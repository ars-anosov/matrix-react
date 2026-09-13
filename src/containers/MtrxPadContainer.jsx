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

  const { roomIds, roomsMeta, selectedRoomId, status } = useSelector((state) => state.mtrxControlRdcr);

  const messages = useRoomMessages(selectedRoomId);

  useEffect(() => {
    if (status !== "success") return undefined;

    actions.handleStartRoomWatch();
    return () => actions.handleStopRoomWatch();
  }, [status, actions]);

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
      messages,
    };
  }, [selectedRoomId, roomsMeta, messages]);

  return (
    <MtrxPad
      rooms={rooms}
      selectedRoomId={selectedRoomId}
      selectedRoom={selectedRoom}
      onSelectRoom={(roomId) => actions.handleSelectRoom(roomId)}
      onClose={() => actions.handleChangeStore("displayPad", false)}
    />
  );
};

export default MtrxPadContainer;
