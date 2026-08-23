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
// NOTE: the URL below is a Cloudflare quick tunnel to the workstation that holds
// the GPU. Quick-tunnel hostnames are regenerated whenever the tunnel restarts,
// so if voice stops working this is the line to update. For a permanent address,
// deploy the backend (see medicraft/DEPLOY.md — render.yaml is ready to go) and
// put that hostname here instead.
window.MEDICRAFT_API_BASES = ["https://webster-just-singing-electrical.trycloudflare.com"];
window.MEDICRAFT_API_BASE = window.MEDICRAFT_API_BASES[0];
