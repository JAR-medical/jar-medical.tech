// Where the Medicraft backend lives.
//
// Served from the Python server (local play, or a hosted deployment) the game
// and its /api/* routes share an origin, so the base is "" and every call stays
// relative. Published as static files — GitHub Pages at
// jar-medical.tech/demo/DataSet, for instance — there is no backend on the same
// origin, so a config.js next to index.html sets window.MEDICRAFT_API_BASE to an
// absolute backend URL before main.js loads.
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

// Static hosting means /api/* is simply absent unless a base is configured.
// Callers use this to degrade to typed reports instead of retrying forever.
export function hasBackend() {
  return apiBase() !== "" || (typeof location !== "undefined" && location.protocol !== "file:");
}
