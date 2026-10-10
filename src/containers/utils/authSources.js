// Производные данные двух источников матричных учётных данных — матричной пары из ответа REST
// и loginToken authentik. Их считают оба контейнера (AuthContainer и MenuAppContainer) одной
// функцией, чтобы статус в панели AuthPad и в индикаторе шапки не расходились.
//
// Смысловые состояния источников (поле state):
//   rest:  idle | loading | success | error — статус REST-сессии; success с полной парой
//          означает готовность к запуску (ready), success без пары — неполный ответ;
//   oidc:  idle | loading | ready | success | error — ready это полученный и ещё не
//          потраченный loginToken, success — сессия по нему уже поднята (токен израсходован).

import { AUTH_SOURCE_OIDC, AUTH_SOURCE_REST } from "../../constants/authSource.js";

/**
 * @returns {Array<{kind: string, label: string, detail: string, state: string, ready: boolean, session: boolean}>}
 */
export function buildMtrxAuthSources(authControlRdcr, mtrxControlRdcr) {
  const responseData = authControlRdcr?.responseData || null;
  const mtrxLogin = responseData?.mtrx_login || "";
  const mtrxPassword = responseData?.mtrx_password || "";
  const restStatus = authControlRdcr?.status || "idle";
  const oidcStatus = authControlRdcr?.oidcStatus || "idle";
  // Живая сессия принадлежит тому источнику, которым её подняли
  const sessionSource = mtrxControlRdcr?.status === "success" ? authControlRdcr?.activeAuthSource : null;

  return [
    {
      kind: AUTH_SOURCE_REST,
      label: "REST",
      detail: responseData?.ad_login || mtrxLogin,
      state: restStatus,
      // Запускать сессию REST-источником можно только полной матричной парой
      ready: Boolean(mtrxLogin && mtrxPassword),
      session: sessionSource === AUTH_SOURCE_REST,
    },
    {
      kind: AUTH_SOURCE_OIDC,
      label: "authentik",
      detail: authControlRdcr?.uriOidcAuth || "",
      state: oidcStatus,
      ready: oidcStatus === "ready",
      session: sessionSource === AUTH_SOURCE_OIDC,
    },
  ];
}

/**
 * Активный источник: явный выбор пользователя; пока его нет — готовый к запуску, затем
 * источник с непустым состоянием, чтобы в панели был виден его статус (ошибка, потраченный токен).
 */
export function pickActiveAuthSource(sources, activeAuthSource = null) {
  if (sources.some((source) => source.kind === activeAuthSource)) return activeAuthSource;

  const fallback = sources.find((source) => source.ready || source.session) || sources.find((source) => source.state !== "idle");

  return fallback?.kind || null;
}

/**
 * Подпись под тумблером AuthPad: объясняет, чего не хватает для запуска сессии.
 *
 * @returns {{text: string, isError: boolean}}
 */
export function buildMtrxAuthInfo({ sources, activeSource, authControlRdcr }) {
  const state = activeSource?.state || "idle";

  if (activeSource?.kind === AUTH_SOURCE_OIDC) {
    if (state === "error") return { text: authControlRdcr?.oidcErrText || "Ошибка входа через authentik.", isError: true };
    if (state === "loading") return { text: "Переходим в authentik…", isError: false };
    if (state === "ready") return { text: "Токен authentik получен: включите тумблер, чтобы войти в Matrix.", isError: false };
    if (state === "success" && !activeSource.session) return { text: "Токен authentik использован: войдите заново.", isError: false };
  }

  if (activeSource?.kind === AUTH_SOURCE_REST && state === "success" && !activeSource.ready) {
    const responseData = authControlRdcr?.responseData || {};
    const missing = [];
    if (!responseData.mtrx_login) missing.push("mtrx_login");
    if (!responseData.mtrx_password) missing.push("mtrx_password");

    return { text: `REST не вернул: ${missing.join(", ")}.`, isError: false };
  }

  if (!sources.some((source) => source.ready) && !sources.some((source) => source.session)) {
    return { text: "Авторизуйтесь в REST или войдите через authentik.", isError: false };
  }

  return { text: "", isError: false };
}
