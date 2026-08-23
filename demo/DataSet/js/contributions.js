import { apiUrl } from "./api.js";

export const CONSENT_VERSION = "2026-08-23";
const REQUEST_TIMEOUT_MS = 12_000;

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
    this.session = null;
    this.summary = null;
    this.recoveryCode = null;
  }

  async startSession({ ageBand = "16+", locale = "de-DE", mode = "campaign" } = {}) {
    const result = await jsonRequest("/api/contribution-sessions", {
      method: "POST",
      body: JSON.stringify({ consent_version: CONSENT_VERSION, age_band: ageBand, locale, mode }),
    });
    this.session = {
      contributorId: result.contributor_id,
      sessionId: result.session_id,
      consentVersion: result.consent_version,
    };
    this.summary = result.summary || null;
    this.recoveryCode = result.recovery_code || null;
    return result;
  }

  async nextPrompt(stage = "campaign") {
    const result = await jsonRequest(`/api/prompts/next?stage=${encodeURIComponent(stage)}`);
    return result.prompt;
  }

  async refreshSummary() {
    const result = await jsonRequest("/api/contributors/me/summary");
    this.summary = result;
    return result;
  }

  track(eventName, payload = {}) {
    if (!this.session) return Promise.resolve(false);
    return jsonRequest("/api/contribution-events", {
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
    const result = await jsonRequest(`/api/contribution-sessions/${encodeURIComponent(this.session.sessionId)}/complete`, {
      method: "POST",
      body: "{}",
    });
    this.summary = result;
    return result;
  }

  async withdraw() {
    const result = await jsonRequest("/api/contributors/me/withdraw", {
      method: "POST",
      body: "{}",
    });
    this.session = null;
    this.summary = null;
    return result;
  }

  recordingContext(prompt, context = {}) {
    if (!this.session) throw new Error("Keine aktive Beitragssitzung.");
    return {
      contributionMode: true,
      contributionSessionId: this.session.sessionId,
      contributorId: this.session.contributorId,
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
