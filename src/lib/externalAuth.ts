/**
 * Landing-page → app session handoff (real backend flow).
 *
 * After a successful login/signup on the SellSync landing site, the landing
 * page sets a cookie named `sellsync_token` containing the REAL backend JWT
 * (the same JWT the API returns in the login body; the backend `protect`
 * middleware also accepts it from this exact cookie name).
 *
 * On app boot we consume that cookie, persist the token locally, and clear it
 * so it is one-time. The actual account + store + data hydration then happens
 * against the backend (see StoreProvider / db.ts).
 *
 * A legacy mock cookie (`sellsync_session`, HMAC-signed) is also consumed and
 * discarded — mock identity seeding is gone; DB is the source of truth.
 */
import { setToken } from "./db";

const AUTH_COOKIE = import.meta.env.VITE_AUTH_COOKIE_NAME || "sellsync_token";
const LEGACY_MOCK_COOKIE = "sellsync_session";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`;
}

function consumeHandoffTokenFromUrl(): string | null {
  const match = (window.location.hash || "").match(/[#&]token=([^&]+)/);
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  // Remove the token from the address bar/history immediately.
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
  return token;
}

/**
 * Consumes a landing-page handoff token if present. Returns the JWT token
 * that was captured (or null when no handoff happened). Supports both the
 * URL fragment (works across Vercel domains) and the legacy same-domain
 * cookie.
 */
export function consumeHandoffCookie(): string | null {
  // Discard the legacy HMAC cookie if the landing app still drops one.
  if (getCookie(LEGACY_MOCK_COOKIE)) clearCookie(LEGACY_MOCK_COOKIE);

  const urlToken = consumeHandoffTokenFromUrl();
  if (urlToken) {
    setToken(urlToken);
    return urlToken;
  }

  const token = getCookie(AUTH_COOKIE);
  if (!token) return null;

  clearCookie(AUTH_COOKIE);
  setToken(token);
  return token;
}