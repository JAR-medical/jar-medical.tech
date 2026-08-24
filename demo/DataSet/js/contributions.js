import { apiUrl } from "./api.js";

export const CONSENT_VERSION = "2026-08-24-v1";
const REQUEST_TIMEOUT_MS = 12_000;
const STORED_SESSION_KEY = "medicraft.contribution.session";

function readStoredSession() {
  try {
    const raw = sessionStorage.getItem(STORED_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || typeof session !== "object" || !session.sessionId || !session.contributorId) return null;
    return session;
  } catch {
    return null;
  }
}

function storeSession(session) {
  try {
    if (session) sessionStorage.setItem(STORED_SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORED_SESSION_KEY);
  } catch {
    // Private browsing can disable storage; the in-memory session still works.
  }
}

async function jsonRequest(path, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(apiUrl(path), {
      credentials: "include",
      ...fetchOptions,
      signal: controller?.signal,
      headers: {
        ...(fetchOptions.body && typeof fetchOptions.body === "string" ? { "Content-Type": "application/json" } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.detail || `HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Der Server antwortet nicht. Bitte prüfe die Verbindung und versuche es erneut.");
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ContributionClient {
  constructor() {
    // Some mobile browsers block the backend's cross-site HttpOnly cookie even
    // after a successful consent response. Keep the pseudonymous session in
    // this tab as a header fallback; the cookie remains the normal path.
    this.session = readStoredSession();
    this.summary = null;
    this.recoveryCode = null;
  }

  _request(path, options = {}) {
    const token = this.session?.contributorToken;
    const headers = { ...(options.headers || {}) };
    if (token) headers["X-Medicraft-Contributor-Token"] = token;
    return jsonRequest(path, { ...options, headers });
  }

  async startSession({ ageBand = "16+", locale = "de-DE", mode = "campaign" } = {}) {
    const result = await this._request("/api/contribution-sessions", {
      method: "POST",
      body: JSON.stringify({ consent_version: CONSENT_VERSION, age_band: ageBand, locale, mode }),
    });
    this.session = {
      contributorId: result.contributor_id,
      sessionId: result.session_id,
      consentVersion: result.consent_version,
      contributorToken: result.contributor_token || this.session?.contributorToken || null,
    };
    storeSession(this.session);
    this.summary = result.summary || null;
    this.recoveryCode = result.recovery_code || null;
    return result;
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
    return this._request("/api/contribution-events", {
      method: "POST",
      keepalive: true,
      body: JSON.stringify({
        session_id: this.session.sessionId,
        event_name: eventName,
        payload,
      }),
    }).then(() => true).catch(() => false);
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
    const result = await this._request("/api/contributors/me/withdraw", {
      method: "POST",
      body: "{}",
    });
    this.session = null;
    this.summary = null;
    storeSession(null);
    return result;
  }

  async withdrawByCode(recoveryCode) {
    const result = await this._request("/api/contributors/withdraw-by-code", {
      method: "POST",
      body: JSON.stringify({ recovery_code: String(recoveryCode || "").trim() }),
    });
    this.session = null;
    this.summary = null;
    this.recoveryCode = null;
    storeSession(null);
    return result;
  }

  recordingContext(prompt, context = {}) {
    if (!this.session) throw new Error("Keine aktive Beitragssitzung.");
    return {
      contributionMode: true,
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
