// Medicraft backend location for the statically-hosted copy of the game.
//
// GitHub Pages serves files, not Python, so the /api/* routes do not exist on
// this origin. Point this at a running Medicraft server and the game gets voice
// transcription, server-side report validation, and dataset logging. Leave it
// empty and the game still runs — voxel world, patients, charts, typed reports
// and local scoring all work; only the voice/LLM/logging parts go quiet.
//
// The backend sends Access-Control-Allow-Origin: *, so cross-origin is fine.
//
// Both entries are Tailscale Funnel hosts on Alex's GPU workstations. They are
// probed in order and the first whose /api/health answers wins. elrsisbest is
// the machine that also serves the recording page (mitmachen-aufnahme.html);
// desktop-tt1pi2m was the original host and stays listed as a fallback. If
// voice stops working, check `tailscale status` for which machine is online.
window.MEDICRAFT_API_BASES = [
  "https://elrsisbest.tailb58b58.ts.net",
  "https://desktop-tt1pi2m.tailb58b58.ts.net",
];
window.MEDICRAFT_API_BASE = window.MEDICRAFT_API_BASES[0];
