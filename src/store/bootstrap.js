import * as authControlActions from "../actions/authControlActions.js";

/**
 * Точка старта приложения: разбирает параметры возврата из MAS (`?code&state`, `?error`)
 * до первой отрисовки. Так код не остаётся в адресной строке, а панель сразу знает о готовом
 * источнике. Разбор, обмен кода и хранение токенов — в services/masAuth.js, решение о
 * статусах — в AUTHCTL_.
 *
 * @param {import("redux").Store} store
 */
export default function bootstrapStore(store) {
  store.dispatch(authControlActions.handleOidcReturn());
}
