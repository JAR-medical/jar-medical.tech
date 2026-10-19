// Portal configuration. Both Supabase values are public by design: the
// publishable key (sb_publishable_…, or the legacy "anon" key) only grants what
// the row-level-security policies in supabase/schema.sql allow.
// Never put the secret key (sb_secret_…) or the legacy service_role key here.
//
// Leave SUPABASE_URL empty to run the portal in demo mode (data stays in this
// browser's localStorage, no real authentication). See README.md for setup.
export const CONFIG = {
  SUPABASE_URL: "https://kocfxyrqajrleihfbevq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_cJxJTjEmeBrrjnh9lu7ABA_Ps0wzLYz",

  // OAuth providers enabled in the Supabase dashboard (Authentication → Providers).
  // Each entry shows a "Continue with …" button on the sign-in page.
  // Supported ids: "google", "azure" (Microsoft), "github", "apple".
  OAUTH_PROVIDERS: [],

  // Where clients send questions about access; shown in the dashboard.
  CONTACT_EMAIL: "kontakt@jar-medical.tech",

  // Cloudflare Tunnel URL pointing to the J.A.R. model computer running the
  // transcription + speaker diarization server (e.g. "https://jar-stt.trycloudflare.com"
  // or "https://stt.jar-medical.tech"). While empty, the transcription course
  // lets users paste a tunnel URL in the UI, tries 127.0.0.1:8765 locally, and
  // provides an interactive diarized preview fallback after recording voice.
  TRANSCRIPTION_TUNNEL_URL: "",

  // Demo mode only: signing in with this address gives the admin role.
  DEMO_ADMIN_EMAIL: "admin@jar-medical.tech",
};

function detectLocalPreview() {
  try {
    if (typeof location === "undefined") return false;
    const q = new URLSearchParams(location.search).get("demo");
    if (q === "1") {
      globalThis.sessionStorage?.setItem("jarCorporatePreview", "1");
      return true;
    }
    if (q === "0") {
      globalThis.sessionStorage?.removeItem("jarCorporatePreview");
      return false;
    }
    return globalThis.sessionStorage?.getItem("jarCorporatePreview") === "1";
  } catch {
    return false;
  }
}

export const IS_PREVIEW = detectLocalPreview();
export const IS_DEMO = IS_PREVIEW || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
