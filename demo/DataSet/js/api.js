// Where the Medicraft backend lives.
//
// Served from the Python server (local play, or a hosted deployment) the game
// and its /api/* routes share an origin, so the base is "" and every call stays
// relative. Published as static files — GitHub Pages at
// jar-medical.tech/demo/DataSet, for instance — there is no backend on the same
// origin, so config.js next to index.html names one. index.html loads that file
// with a plain <script> tag so it runs ahead of the deferred module entry
// point; without the tag the base stays undefined and every /api/* call
// silently goes to the static host, which answers 404 for GET and 405 for POST.
//
// config.js may name several backends. They are probed in order at startup and
// the first one whose /api/health answers wins, so a permanent host can be
// listed ahead of a temporary tunnel and neither going down takes the game with
// it. A Cloudflare quick-tunnel hostname in particular is regenerated on every
// restart, and a single pinned base makes that an outage.
//
// The backend explicitly allows the published site's origin, so cross-origin
// API probes and requests remain safe and predictable.

const HEALTH_TIMEOUT_MS = 6000;

function normalize(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().replace(/\/+$/, "");
}

// Every base config.js offered, in preference order. An empty string is a
// legitimate entry: it means "same origin".
export function apiBases() {
  const configured = typeof window !== "undefined" ? window.MEDICRAFT_API_BASES : null;
  const single = typeof window !== "undefined" ? window.MEDICRAFT_API_BASE : null;
  const list = Array.isArray(configured) ? configured : [single];
  const bases = [];
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const base = normalize(entry) ?? "";
    if (!bases.includes(base)) bases.push(base);
  }
  return bases.length ? bases : [""];
}

let selected = null;
let resolving = null;

export function apiBase() {
  return selected ?? apiBases()[0];
}

export function apiUrl(path) {
  return `${apiBase()}${path}`;
}

async function probe(base) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS) : null;
  try {
    const res = await fetch(`${base}/api/health`, {
      cache: "no-store",
      signal: controller?.signal,
    });
    // A static host answers /api/health with its own 404 page, so only an OK
    // response means this base actually has a Medicraft backend behind it.
    return res.ok;
  } catch (err) {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Pick the first configured base that answers. Concurrent callers share one
// resolution; the result is cached until something invalidates it.
export async function resolveApiBase({ force = false } = {}) {
  if (!force && selected !== null) return selected;
  if (resolving) return resolving;
  resolving = (async () => {
    const bases = apiBases();
    for (const base of bases) {
      if (await probe(base)) return base;
    }
    return bases[0];
  })()
    .then((base) => {
      selected = base;
      return base;
    })
    .finally(() => {
      resolving = null;
    });
  return resolving;
}

// Call when a request to the selected base fails at the transport level, so the
// next resolve re-probes instead of retrying a host that has gone away.
export function invalidateApiBase() {
  selected = null;
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
