import * as authControlActions from "../actions/authControlActions.js";

/**
 * Точка старта приложения: разбирает параметры возврата из authentik (`?loginToken`, `?error`)
 * до первой отрисовки. Так токен не остаётся в адресной строке, а панель сразу знает о готовом
 * источнике. Разбор и хранение токена — в services/oidcAuth.js, решение о статусах — в AUTHCTL_.
 *
 * @param {import("redux").Store} store
 */
export default function bootstrapStore(store) {
  store.dispatch(authControlActions.handleOidcReturn());
}
