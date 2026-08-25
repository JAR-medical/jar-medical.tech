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
let staleBase = false;
let baseEpoch = 0;
const baseListeners = new Set();

export function apiBase() {
  return selected ?? apiBases()[0];
}

// How many times the effective base has actually moved. Anything minted by one
// backend — a contributor token, a contribution session id — is meaningless to
// another, so holders of that state compare epochs instead of guessing.
export function apiBaseEpoch() {
  return baseEpoch;
}

// Notified only when the base the game really calls changes, never on a
// re-probe that confirms the current one. Returns an unsubscribe function.
export function onApiBaseChange(listener) {
  if (typeof listener !== "function") return () => {};
  baseListeners.add(listener);
  return () => baseListeners.delete(listener);
}

function commitApiBase(base) {
  const previous = apiBase();
  selected = base;
  if (base === previous) return base;
  baseEpoch += 1;
  for (const listener of [...baseListeners]) {
    try {
      listener(base, baseEpoch);
    } catch {
      // A listener that throws must not strand the resolution for everyone else.
    }
  }
  return base;
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
//
// The pick is sticky. Each backend keeps its own contributor database, so
// moving between them invalidates the contribution session in flight and mints
// a second identity on the other host. Strict preference order made that happen
// on every re-probe: the moment the preferred host came back, every tab jumped
// to it, and the next hiccup jumped them back — the recurring "unbekannte oder
// abgelaufene Beitragssitzung". Re-checking the current pick first means the
// game only moves when the host it is actually using has gone away.
export async function resolveApiBase({ force = false, sticky = true } = {}) {
  if (!force && !staleBase && selected !== null) return selected;
  if (resolving) return resolving;
  staleBase = false;
  const current = selected;
  resolving = (async () => {
    const bases = apiBases();
    const order = sticky && current !== null && bases.includes(current)
      ? [current, ...bases.filter((base) => base !== current)]
      : bases;
    for (const base of order) {
      if (await probe(base)) return base;
    }
    // Nothing answered. Keep whatever we were using rather than shuffling the
    // identity to a host that is equally dead.
    return order[0];
  })()
    .then((base) => commitApiBase(base))
    .finally(() => {
      resolving = null;
    });
  return resolving;
}

// Call when a request to the selected base fails at the transport level, so the
// next resolve re-probes instead of retrying a host that has gone away.
//
// The current pick is kept rather than cleared: one failed POST is not proof
// the host is gone, and dropping it here would make the next resolution ignore
// stickiness and move the game — and its contribution identity — to a different
// backend over a single blip. The re-probe decides, starting with this host.
export function invalidateApiBase() {
  staleBase = true;
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
