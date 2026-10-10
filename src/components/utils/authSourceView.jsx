import { AdminPanelSettings, HowToReg, PersonOff, Sync, VpnKey } from "@mui/icons-material";
import { AUTH_SOURCE_OIDC } from "../../constants/authSource.js";

// Подпись, цвет и иконка источника матричных учётных данных — общие для панели AuthPad и
// индикатора в шапке AuthIco, чтобы статус в панели и в шапке читался одинаково.
// Цвет — семантический токен палитры MUI; "inherit" означает «источник не подключён».

// REST: success с полной матричной парой — готовность к запуску (ready), success без пары —
// неполный ответ, session — сессия Matrix поднята именно этим источником
function getRestSourceView(source) {
  switch (source.state) {
    case "loading":
      return { label: "Авторизация…", color: "warning", icon: <Sync /> };
    case "success":
      if (!source.ready) return { label: "Нет матричной пары", color: "warning", icon: <PersonOff /> };
      return source.session
        ? { label: "Сессия Matrix активна", color: "success", icon: <HowToReg /> }
        : { label: "Данные получены", color: "success", icon: <HowToReg /> };
    case "error":
      return { label: "Ошибка авторизации", color: "error", icon: <PersonOff /> };
    default:
      return { label: "Не подключено", color: "inherit", icon: <AdminPanelSettings /> };
  }
}

// authentik: ready — токен получен и ждёт запуска, success — сессия по токену поднята
// (токен израсходован), success без сессии — токен потратили, вход нужно повторять
function getOidcSourceView(source) {
  switch (source.state) {
    case "loading":
      return { label: "Переход в authentik…", color: "warning", icon: <Sync /> };
    case "ready":
      return { label: "Токен получен", color: "success", icon: <VpnKey /> };
    case "success":
      return source.session
        ? { label: "Сессия Matrix активна", color: "success", icon: <HowToReg /> }
        : { label: "Токен использован", color: "warning", icon: <VpnKey /> };
    case "error":
      return { label: "Ошибка входа", color: "error", icon: <PersonOff /> };
    default:
      return { label: "Не подключено", color: "inherit", icon: <VpnKey /> };
  }
}

/**
 * @param {{kind: string, state: string, ready?: boolean, session?: boolean}} source
 * @returns {{label: string, color: string, icon: import("react").ReactNode}}
 */
export function getAuthSourceView(source) {
  if (!source) return { label: "Не подключено", color: "inherit", icon: <AdminPanelSettings /> };

  return source.kind === AUTH_SOURCE_OIDC ? getOidcSourceView(source) : getRestSourceView(source);
}
