import { apiBase, apiUrl, onApiBaseChange } from "./api.js";

export const CONSENT_VERSION = "2026-08-25-v3";
const REQUEST_TIMEOUT_MS = 12_000;
const STORED_SESSION_KEY = "medicraft.contribution.sessions";
const LEGACY_SESSION_KEY = "medicraft.contribution.session";
// Statuses worth sending the same request again for: the backend is there but
// busy, restarting, or behind a tunnel that dropped a connection.
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_REQUEST_ATTEMPTS = 4;
const RETRY_BASE_DELAY_MS = 600;
const MAX_RETRY_DELAY_MS = 8_000;
// A renewal mints a contribution session, so a burst of failures must not mint
// a burst of sessions. Concurrent renewals share one call; sequential ones
// inside this window reuse the session the first of them produced.
const RENEWAL_COOLDOWN_MS = 3_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Carries the status so callers can tell "session is gone" from "server is
// busy" from "this request was wrong", instead of pattern-matching German text.
export class ApiError extends Error {
  constructor(message, { status = 0, retryAfterMs = 0, transient = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.transient = transient;
  }
}

export function isSessionFailure(error) {
  const status = Number(error?.status) || 0;
  if (status === 401) return true;
  if (status !== 403) return false;
  return /beitrag|sitzung|session|zustimmung|consent|auth/i.test(String(error?.message || ""));
}

function retryAfterMs(response) {
  const header = response?.headers?.get?.("Retry-After");
  if (!header) return 0;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, Math.min(30, seconds)) * 1000;
  const when = Date.parse(header);
  return Number.isFinite(when) ? Math.max(0, Math.min(30_000, when - Date.now())) : 0;
}

function backoffMs(attempt, floorMs = 0) {
  const exponential = Math.min(MAX_RETRY_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** attempt);
  // Jitter so a classroom that all failed on the same server hiccup does not
  // all come back in the same millisecond.
  return Math.max(floorMs, exponential * (0.7 + Math.random() * 0.6));
}

// Sessions are stored per backend. config.js may list several and the game
// fails over between them; each keeps its own contributor database, so a token
// minted by one is not an identity on another. Keeping them apart means
// flapping between hosts reuses the identity that host already knows instead of
// minting a fresh contributor — and a fresh recovery code — every time.
function readStoredSessions() {
  const sessions = {};
  try {
    const raw = sessionStorage.getItem(STORED_SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      for (const [base, session] of Object.entries(parsed)) {
        if (session && typeof session === "object" && session.sessionId && session.contributorId) {
          sessions[base] = { ...session, apiBase: base };
        }
      }
    }
  } catch {
    // Private browsing can disable storage; the in-memory session still works.
  }
  try {
    const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY);
    const session = legacy ? JSON.parse(legacy) : null;
    if (session && typeof session === "object" && session.sessionId && session.contributorId) {
      const base = typeof session.apiBase === "string" ? session.apiBase : apiBase();
      if (!sessions[base]) sessions[base] = { ...session, apiBase: base };
    }
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // Same as above.
  }
  return sessions;
}

function storeSessions(sessions) {
  try {
    sessionStorage.setItem(STORED_SESSION_KEY, JSON.stringify(sessions));
  } catch {
    // Same as above.
  }
}

function requestCredentials(url) {
  try {
    const pageOrigin = globalThis.location?.origin;
    return pageOrigin && new URL(url, globalThis.location.href).origin === pageOrigin ? "include" : "omit";
  } catch {
    return "omit";
  }
}

async function jsonRequest(path, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const url = apiUrl(path);
    const response = await fetch(url, {
      // The public GitHub Pages copy is a different origin. Its pseudonymous
      // contributor token is sent in a header, so it must not depend on a
      // third-party cookie being accepted by the browser.
      credentials: requestCredentials(url),
      ...fetchOptions,
      signal: controller?.signal,
      headers: {
        ...(fetchOptions.body && typeof fetchOptions.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ApiError(body?.detail || `HTTP ${response.status}`, {
        status: response.status,
        retryAfterMs: retryAfterMs(response),
        transient: TRANSIENT_STATUSES.has(response.status),
      });
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === "AbortError") {
      throw new ApiError(
        "Der Server antwortet nicht. Bitte prüfe die Verbindung und versuche es erneut.",
        { transient: true },
      );
    }
    // A failed fetch is a transport problem — a dropped tunnel, a sleeping
    // laptop, a switched network. All of those come back.
    throw new ApiError(String(error?.message || error), { transient: true });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ContributionClient {
  constructor() {
    // Some mobile browsers block the backend's cross-site HttpOnly cookie even
    // after a successful consent response. Keep the pseudonymous session in
    // this tab as a header fallback; the cookie remains the normal path.
    this._sessions = readStoredSessions();
    this.session = this._sessions[apiBase()] || null;
    this.summary = null;
    this.recoveryCode = null;
    this._renewal = null;
    this._renewedAt = 0;
    // Failover swaps the whole backend, and with it the contributor database.
    // Swap the identity to match rather than presenting the old host's token to
    // the new one and taking a guaranteed 401 on the next take.
    this._unsubscribeBase = onApiBaseChange((base) => {
      this.session = this._sessions[base] || null;
    });
  }

  // The base this client's current session belongs to, or null when there is
  // none. Callers pin a recording to it so a take is never posted to a backend
  // that has never heard of its session.
  get sessionBase() {
    return this.session?.apiBase ?? null;
  }

  // Whether this tab has ever held a contribution session, on any backend.
  //
  // Renewing means posting a consent record, so it may only ever repair a
  // session the player already agreed to. Without this, a 401 from the
  // summary call the game makes on the start screen — which is exactly what
  // "no session" looks like — would have minted a contributor and filed a
  // consent for someone who had not clicked anything yet.
  get hasSession() {
    return Boolean(this.session) || Object.keys(this._sessions).length > 0;
  }

  _rememberSession(session) {
    if (!session?.apiBase && session?.apiBase !== "") return;
    this._sessions = { ...this._sessions, [session.apiBase]: session };
    storeSessions(this._sessions);
  }

  _forgetSession(base) {
    const key = base ?? apiBase();
    const { [key]: _dropped, ...rest } = this._sessions;
    this._sessions = rest;
    storeSessions(this._sessions);
  }

  // One place where every contribution call gets its retries, so a busy or
  // restarting backend costs a pause rather than a lost mission.
  //
  // `renew` is off for the calls that create or destroy the identity itself:
  // renewing inside startSession would recurse, and renewing inside a
  // withdrawal would immediately mint back the contributor just deleted.
  async _request(path, options = {}, { renew = true, attempts = MAX_REQUEST_ATTEMPTS } = {}) {
    let renewed = false;
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const token = this.session?.contributorToken;
      const headers = { ...(options.headers || {}) };
      if (token) headers["X-Medicraft-Contributor-Token"] = token;
      try {
        return await jsonRequest(path, { ...options, headers });
      } catch (error) {
        lastError = error;
        if (renew && !renewed && this.hasSession && isSessionFailure(error)) {
          // The backend no longer knows this session — restarted onto a fresh
          // volume, restored from a backup, or the token belongs to a host we
          // have since failed over from. Consent is on file either way.
          renewed = true;
          try {
            // Not forced: if another call already renewed a moment ago, this
            // one replays against that session instead of minting a second
            // contributor for the same outage.
            await this.renewSession();
            continue;
          } catch {
            throw error;
          }
        }
        if (!error?.transient || attempt + 1 >= attempts) throw error;
        await sleep(backoffMs(attempt, error.retryAfterMs));
      }
    }
    throw lastError;
  }

  async startSession({ ageBand = "16+", locale = "de-DE", mode = "campaign", medicContext = false } = {}) {
    // Whichever host answers owns the session that comes back, so bind the
    // result to the base in force for this call rather than to whatever the
    // base happens to be by the time a later take is uploaded.
    const base = apiBase();
    const result = await this._request(
      "/api/contribution-sessions",
      {
        method: "POST",
        body: JSON.stringify({
          consent_version: CONSENT_VERSION,
          age_band: ageBand,
          locale,
          mode,
          medic_context: Boolean(medicContext),
        }),
      },
      // One retry, not the full ladder: a player waiting on the start screen
      // must reach the offline mode quickly when the backend is simply down.
      { renew: false, attempts: 2 },
    );
    const previous = this._sessions[base] || null;
    this.session = {
      apiBase: base,
      contributorId: result.contributor_id,
      sessionId: result.session_id,
      consentVersion: result.consent_version,
      contributorToken: result.contributor_token || previous?.contributorToken || null,
      ageBand,
      locale,
      mode,
      medicContext: Boolean(medicContext),
    };
    this._rememberSession(this.session);
    this._renewedAt = Date.now();
    this.summary = result.summary || null;
    // A returning contributor gets no new recovery code; keep the one this tab
    // was already showing instead of blanking the panel on every renewal.
    this.recoveryCode = result.recovery_code || this.recoveryCode || null;
    return result;
  }

  // A session can disappear while a tab is open (for example after the backend
  // data store is restored, or after failover to the other backend). Consent is
  // still valid, so create a new contribution session without asking the player
  // to leave the mission.
  //
  // Single-flight and rate-limited on purpose: a mission can have several takes
  // in flight, and without this each one that saw the same dead session would
  // mint its own contributor.
  renewSession({ force = false } = {}) {
    if (this._renewal) return this._renewal;
    const base = apiBase();
    const fresh = this.session
      && this.session.apiBase === base
      && Date.now() - this._renewedAt < RENEWAL_COOLDOWN_MS;
    if (fresh && !force) {
      return Promise.resolve({
        ok: true,
        reused: true,
        contributor_id: this.session.contributorId,
        session_id: this.session.sessionId,
        consent_version: this.session.consentVersion,
        summary: this.summary,
        recovery_code: this.recoveryCode,
      });
    }
    const previous = this.session || this._sessions[base] || {};
    this._renewal = this.startSession({
      ageBand: previous.ageBand || "16+",
      locale: previous.locale || "de-DE",
      mode: previous.mode || "campaign",
      medicContext: Boolean(previous.medicContext),
    }).finally(() => {
      this._renewal = null;
    });
    return this._renewal;
  }

  // Guarantee a session that belongs to the backend calls go to right now.
  // Cheap when nothing moved, which is the normal case.
  async ensureSession() {
    if (this.session && this.session.apiBase === apiBase()) return this.session;
    // Consent first, always: repairing a session is not the same as creating
    // one, and this must never be the call that files a consent record.
    if (!this.hasSession) return null;
    await this.renewSession({ force: true });
    return this.session;
  }

  // The backend may hand a take back under a different session than it was
  // posted with — it mints a replacement when the one presented is unknown.
  // Adopt it so the rest of the mission stops presenting a dead id.
  adoptSessionId(sessionId) {
    const id = String(sessionId || "").trim();
    if (!id || !this.session || this.session.sessionId === id) return false;
    this.session = { ...this.session, sessionId: id };
    this._rememberSession(this.session);
    return true;
  }

  async nextPrompt(stage = "campaign") {
    const result = await this._request(`/api/prompts/next?stage=${encodeURIComponent(stage)}`);
    return result.prompt;
  }

  async refreshSummary() {
    const result = await this._request("/api/contributors/me/summary");
    this.summary = result;
    return result;
  }

  track(eventName, payload = {}) {
    if (!this.session) return Promise.resolve(false);
    // Telemetry must never cost a mission a retry storm: one attempt, and a
    // failure is simply a lost event.
    return this._request("/api/contribution-events", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({
        session_id: this.session.sessionId,
        event_name: eventName,
        payload,
      }),
    }, { renew: false, attempts: 1 }).then(() => true).catch(() => false);
  }

  async completeShift() {
    if (!this.session) return null;
    const result = await this._request(`/api/contribution-sessions/${encodeURIComponent(this.session.sessionId)}/complete`, {
      method: "POST",
      body: "{}",
    });
    this.summary = result;
    return result;
  }

  async withdraw() {
    const base = this.sessionBase ?? apiBase();
    const result = await this._request("/api/contributors/me/withdraw", {
      method: "POST",
      body: "{}",
    }, { renew: false });
    this.session = null;
    this.summary = null;
    this.recoveryCode = null;
    this._forgetSession(base);
    return result;
  }

  async withdrawByCode(recoveryCode) {
    const base = this.sessionBase ?? apiBase();
    const result = await this._request("/api/contributors/withdraw-by-code", {
      method: "POST",
      body: JSON.stringify({ recovery_code: String(recoveryCode || "").trim() }),
    }, { renew: false });
    this.session = null;
    this.summary = null;
    this.recoveryCode = null;
    this._forgetSession(base);
    return result;
  }

  recordingContext(prompt, context = {}) {
    if (!this.session) throw new Error("Keine aktive Beitragssitzung.");
    return {
      contributionMode: true,
      apiBase: this.session.apiBase ?? apiBase(),
      contributionSessionId: this.session.sessionId,
      contributorId: this.session.contributorId,
      contributorToken: this.session.contributorToken || "",
      consentVersion: this.session.consentVersion,
      promptId: prompt.promptId,
      taskType: prompt.taskType,
      expectedText: prompt.expectedText || "",
      requiredConcepts: prompt.requiredConcepts || [],
      idempotencyKey: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ...context,
    };
  }
}
