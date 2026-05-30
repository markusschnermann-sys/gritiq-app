/**
 * GritIQ Auth Store
 * =================
 * Manages the access token in memory (never localStorage).
 * The refresh token is stored in sessionStorage (NOT localStorage — localStorage
 * is blocked in cross-origin iframes, sessionStorage is NOT blocked).
 * The server also sets an HttpOnly cookie as a secondary fallback.
 *
 * Token lifecycle:
 *  - On app load: call initAuth() → tries sessionStorage refresh token first,
 *    then falls back to HttpOnly cookie via /api/auth/me
 *  - Every 14 min: auto-refresh via setInterval
 *  - On any 401 TOKEN_EXPIRED: call refreshAccessToken() then retry once
 *  - On logout: call logout() → clears cookie server-side + clears sessionStorage
 *
 * IMPORTANT: All fetch() calls must use API_BASE prefix so that the deployed
 * app routes through the port proxy (deploy_website replaces __PORT_5000__
 * with the proxy path). Without this, API calls hit sites.pplx.app directly
 * and return 404.
 *
 * BUG-1 FIX: sessionStorage survives page reload within the same tab and is
 * NOT blocked by cross-origin iframe policies (unlike localStorage).
 */

// Mirror the API_BASE pattern from queryClient.ts — deploy_website replaces
// __PORT_5000__ with the actual proxy prefix at upload time.
const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  hasMaxes: boolean;
};

type AuthState = {
  accessToken: string | null;
  user: AuthUser | null;
  loading: boolean;
};

// In-memory state — never persisted (access token is short-lived by design)
let state: AuthState = { accessToken: null, user: null, loading: true };
let refreshTimer: ReturnType<typeof setInterval> | null = null;
// In-memory refresh token — mirrors sessionStorage for the current JS execution context
let _inMemoryRefreshToken: string | null = null;

// ── sessionStorage helpers (BUG-1 fix) ───────────────────────────────────────
// sessionStorage survives page reload within the same tab, and is NOT blocked
// by cross-origin iframe third-party cookie policies (unlike localStorage).
const SS_KEY = 'gritiq_rt';

function saveRefreshToken(token: string) {
  _inMemoryRefreshToken = token;
  try { sessionStorage.setItem(SS_KEY, token); } catch { /* silently skip if blocked */ }
}

function loadStoredRefreshToken(): string | null {
  if (_inMemoryRefreshToken) return _inMemoryRefreshToken;
  try { return sessionStorage.getItem(SS_KEY); } catch { return null; }
}

function clearRefreshToken() {
  _inMemoryRefreshToken = null;
  try { sessionStorage.removeItem(SS_KEY); } catch { /* silently skip */ }
}

const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach(fn => fn());
}

export function getState(): Readonly<AuthState> {
  return state;
}

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  notify();
}

// ── Token refresh ─────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 14 * 60 * 1000; // 14 min (access token is 15 min)

export async function refreshAccessToken(explicitToken?: string): Promise<string | null> {
  try {
    const body: Record<string, string> = {};
    // Prefer explicitly passed token (from initAuth sessionStorage restore),
    // then fall back to the in-memory token.
    const rt = explicitToken ?? loadStoredRefreshToken();
    if (rt) body.refreshToken = rt;

    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      // Refresh token expired or revoked — force logout
      clearRefreshToken();
      setState({ accessToken: null, user: null, loading: false });
      stopRefreshTimer();
      return null;
    }
    const data = await res.json();
    // Token rotation: persist the new refresh token (replaces old one)
    if (data.refreshToken) saveRefreshToken(data.refreshToken);
    if (data.user) setState({ user: data.user });
    setState({ accessToken: data.accessToken });
    return data.accessToken;
  } catch {
    return null;
  }
}

function startRefreshTimer() {
  stopRefreshTimer();
  refreshTimer = setInterval(refreshAccessToken, REFRESH_INTERVAL_MS);
}

function stopRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

/** Called once on app load. Tries to rehydrate session.
 *
 * Strategy (BUG-1 fix):
 *  1. Check sessionStorage for a refresh token (survives reload, not iframe-blocked)
 *  2. If found, call /api/auth/refresh with it in the body to get a fresh access token
 *  3. If that succeeds, the user is restored — skip /api/auth/me entirely
 *  4. If no sessionStorage token or refresh fails, fall back to /api/auth/me
 *     (works when the HttpOnly cookie is not blocked, e.g. same-origin)
 *
 * PERF-P3: /api/auth/me returns 200 + { user: null } for unauthenticated
 * sessions instead of 401, so Lighthouse Best Practices never sees a 4xx.
 */
export async function initAuth(): Promise<AuthState> {
  setState({ loading: true });
  try {
    // Step 1: Try to restore from sessionStorage refresh token (primary path in iframe)
    const storedRt = loadStoredRefreshToken();
    if (storedRt) {
      const newToken = await refreshAccessToken(storedRt);
      if (newToken && state.user) {
        // Session restored via refresh — start the timer and return
        startRefreshTimer();
        setState({ loading: false });
        return state;
      }
    }

    // Step 2: Fallback — try /api/auth/me (works when HttpOnly cookie is available)
    const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      if (data.user && data.accessToken) {
        // Authenticated via cookie — hydrate state and start the silent refresh timer
        setState({ accessToken: data.accessToken, user: data.user, loading: false });
        startRefreshTimer();
      } else {
        // Server returned 200 + { user: null } — genuinely unauthenticated
        setState({ accessToken: null, user: null, loading: false });
      }
    } else {
      setState({ accessToken: null, user: null, loading: false });
    }
  } catch {
    setState({ accessToken: null, user: null, loading: false });
  }
  return state;
}

// ── Onboarding helper ────────────────────────────────────────────────────────

/**
 * Called when the user completes onboarding and has set their 1RMs.
 * Updates hasMaxes in the local auth state immediately — no server round-trip.
 * This avoids the initAuth() re-call which fails in cross-origin iframes
 * because the HttpOnly cookie is blocked, causing the app to show the login page.
 */
export function markOnboardingComplete() {
  if (state.user) {
    setState({ user: { ...state.user, hasMaxes: true } });
  }
}

// ── Login / Register / Logout ─────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Login failed" }));
    throw new Error(err.message ?? "Login failed");
  }
  const data = await res.json();
  // Persist refresh token to sessionStorage (survives reload, not blocked in iframe)
  if (data.refreshToken) saveRefreshToken(data.refreshToken);
  setState({ accessToken: data.accessToken, user: data.user, loading: false });
  startRefreshTimer();
}

export async function register(email: string, password: string, name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Registration failed" }));
    throw new Error(err.message ?? "Registration failed");
  }
  const data = await res.json();
  // Persist refresh token to sessionStorage (survives reload, not blocked in iframe)
  if (data.refreshToken) saveRefreshToken(data.refreshToken);
  setState({ accessToken: data.accessToken, user: data.user, loading: false });
  startRefreshTimer();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  stopRefreshTimer();
  clearRefreshToken(); // BUG-1 + BUG-3: clear sessionStorage and reset hash
  setState({ accessToken: null, user: null, loading: false });
  // BUG-3 fix: reset hash to root so re-login lands on Dashboard, not the last route
  window.location.hash = '/';
}

// ── Authenticated fetch helper ────────────────────────────────────────────────

/**
 * Makes an authenticated API request. Automatically refreshes the access token
 * on 401 TOKEN_EXPIRED and retries once. Use this instead of raw fetch for all
 * /api/* calls (except /api/auth/*).
 */
export async function authFetch(url: string, init?: RequestInit): Promise<Response> {
  let token = state.accessToken;

  const doFetch = (t: string | null) =>
    fetch(url.startsWith('/api') ? `${API_BASE}${url}` : url, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.headers ?? {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
    });

  let res = await doFetch(token);

  // On TOKEN_EXPIRED, refresh once and retry
  if (res.status === 401) {
    const body = await res.clone().json().catch(() => ({}));
    if (body.code === "TOKEN_EXPIRED") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await doFetch(newToken);
      }
    }
  }

  return res;
}
