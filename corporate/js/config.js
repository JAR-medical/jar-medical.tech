// Portal configuration. Both Supabase values are public by design: the
// publishable key (sb_publishable_…, or the legacy "anon" key) only grants what
// the row-level-security policies in supabase/schema.sql allow.
// Never put the secret key (sb_secret_…) or the legacy service_role key here.
//
// Leave SUPABASE_URL empty to run the portal in demo mode (data stays in this
// browser's localStorage, no real authentication). Setup: private repo
// JAR-medical/website_setup → corporate/README.md.
export const CONFIG = {
  SUPABASE_URL: "https://kocfxyrqajrleihfbevq.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_cJxJTjEmeBrrjnh9lu7ABA_Ps0wzLYz",

  // OAuth providers enabled in the Supabase dashboard (Authentication → Providers).
  // Each entry shows a "Continue with …" button on the sign-in page.
  // Supported ids: "google", "azure" (Microsoft), "github", "apple".
  OAUTH_PROVIDERS: [],

  // Where clients send questions about access; shown in the dashboard.
  CONTACT_EMAIL: "kontakt@jar-medical.tech",

  // Release switch for the courses. While false, only administrators see and
  // open courses (preview); clients see none, even courses granted to them.
  // Grants made meanwhile are kept and show up once this is set to true.
  COURSES_FOR_CLIENTS: false,

  // Base URL of the J.A.R. transcription server (WhisperX with speaker
  // diarization, reached through a Cloudflare Tunnel), e.g.
  // "https://stt.jar-medical.tech". The "Transkription" demo course POSTs the
  // recording to `${TRANSCRIPTION_ENDPOINT}/transcribe` (contract and server
  // setup in the private repo JAR-medical/website_setup). While empty, the
  // demo records and plays back locally and says that no server is connected
  // yet.
  TRANSCRIPTION_ENDPOINT: "",

  // Demo mode only: signing in with this address gives the admin role.
  DEMO_ADMIN_EMAIL: "admin@jar-medical.tech",
};

// Local preview: on a local dev host only, `?demo=1` switches this browser tab
// to demo mode (fake accounts in localStorage) so courses can be tested without
// touching the real Supabase project; `?demo=0` switches back. Never active on
// jar-medical.tech.
function localPreview() {
  try {
    if (typeof location === "undefined") return false;
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return false;
    const q = new URLSearchParams(location.search).get("demo");
    if (q === "1") sessionStorage.setItem("jarCorporatePreview", "1");
    if (q === "0") sessionStorage.removeItem("jarCorporatePreview");
    return sessionStorage.getItem("jarCorporatePreview") === "1";
  } catch {
    return false;
  }
}

export const IS_DEMO = localPreview() || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
