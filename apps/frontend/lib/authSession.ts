/**
 * In-memory access token storage (never persisted to localStorage).
 * Long-lived session is maintained via httpOnly refresh cookie on /api/auth/*.
 */

const LEGACY_TOKEN_KEY = "omni_token";
export const AUTH_SESSION_EXPIRED_EVENT = "auth:session-expired";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function purgeLegacyTokenStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function clearAuthStorage(): void {
  accessToken = null;
  purgeLegacyTokenStorage();
}

export function notifySessionExpired(): void {
  clearAuthStorage();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
  }
}

export function isAccessTokenExpired(token: string, skewSeconds = 30): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp !== "number") return true;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

export async function refreshAccessToken(silent = false): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        clearAuthStorage();
        if (!silent) {
          window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
        }
        return null;
      }
      const data = (await res.json()) as { access_token: string };
      setAccessToken(data.access_token);
      return data.access_token;
    } catch {
      clearAuthStorage();
      if (!silent) {
        window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function getValidAccessToken(): Promise<string | null> {
  const current = getAccessToken();
  if (current && !isAccessTokenExpired(current)) {
    return current;
  }
  if (current) setAccessToken(null);
  return refreshAccessToken(true);
}

export async function bootstrapSession(): Promise<string | null> {
  purgeLegacyTokenStorage();
  return refreshAccessToken(true);
}
