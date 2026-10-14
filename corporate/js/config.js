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

  // Demo mode only: signing in with this address gives the admin role.
  DEMO_ADMIN_EMAIL: "admin@jar-medical.tech",
};

export const IS_DEMO = !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY;
