// Where the Medicraft backend lives.
//
// Served from the Python server (local play, or a hosted deployment) the game
// and its /api/* routes share an origin, so the base is "" and every call stays
// relative. Published as static files — GitHub Pages at
// jar-medical.tech/demo/DataSet, for instance — there is no backend on the same
// origin, so a config.js next to index.html sets window.MEDICRAFT_API_BASE to an
// absolute backend URL before main.js loads. index.html loads that file with a
// plain <script> tag so it runs ahead of the deferred module entry point —
// without the tag the base stays undefined and every /api/* call silently goes
// to the static host, which answers 404 for GET and 405 for POST.
//
// The backend sends Access-Control-Allow-Origin: *, so cross-origin works.

export function apiBase() {
  const configured = typeof window !== "undefined" ? window.MEDICRAFT_API_BASE : null;
  if (typeof configured !== "string" || !configured.trim()) return "";
  return configured.trim().replace(/\/+$/, "");
}

export function apiUrl(path) {
  return `${apiBase()}${path}`;
}

// True only when config.js actually named a backend. An unset base is not the
// same as "no backend": served by stt_server.py it means same origin and is
// right, while on a static host it means every /api/* call lands on the CDN.
export function apiBaseConfigured() {
  return apiBase() !== "";
}

// Where an /api/* call will really go — for error messages that name the host
// that answered rather than repeating a bare status code.
export function apiOrigin() {
  return apiBase() || (typeof location !== "undefined" ? location.origin : "");
}

// Static hosting means /api/* is simply absent unless a base is configured.
// Callers use this to degrade to typed reports instead of retrying forever.
export function hasBackend() {
  return apiBase() !== "" || (typeof location !== "undefined" && location.protocol !== "file:");
}
