// Access codes for single courses and their demo apps (on top of the
// administrator's grant). A course opts in with `passcode: <one of the
// configs below>`; demo/rp-xr/gate.js imports the same config, so entering
// the code once unlocks both the course and its simulator on that device.
//
// What this is: a doorman, like the AR client's gate (holo-lens/gate.js).
// GitHub Pages serves static files, so the code is checked in the browser
// against a salted PBKDF2-SHA256 hash; the code itself is not in the
// repository. Anyone who reads the source can bypass it, and the hash of a
// short code can be guessed offline. It keeps casual visitors out; it does not
// protect secrets.
//
// To change a code: derive a new salt and hash, e.g.
//   node -e 'const c=require("crypto"),s=c.randomBytes(16);console.log(s.toString("hex"),c.pbkdf2Sync(process.argv[1],s,200000,32,"sha256").toString("hex"))' '<new code>'
// A new hash revokes every device that unlocked with the old code.

export const RP_XR_PASSCODE = Object.freeze({
  storeKey: "jar-rp-xr-unlock",
  salt: "13bd26505a5d8b763d69cd976c200163",
  iterations: 200000,
  hash: "2fcd5c769c41d4ce500cb48716ff17932b77331653cdf76529ebd3a8e3ebdcb7",
  rememberDays: 30,
});

const fromHex = (hex) => Uint8Array.from(hex.match(/../g), (pair) => parseInt(pair, 16));
const toHex = (buffer) => Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");

function read(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; }
}

// The stored unlock carries the start of the hash, so a new code revokes it.
export function isUnlocked(pc) {
  const saved = read(pc.storeKey);
  return !!saved && saved.h === pc.hash.slice(0, 16) && typeof saved.until === "number" && saved.until > Date.now();
}

export function lock(pc) {
  try { localStorage.removeItem(pc.storeKey); } catch { /* nothing to forget */ }
}

export function canCheck() {
  return !!(globalThis.crypto && crypto.subtle);
}

async function derive(pc, code) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromHex(pc.salt), iterations: pc.iterations }, material, 256);
  return toHex(bits);
}

function sameHash(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Resolves true (and remembers the unlock on this device) when the code is
// right, false when it is wrong. Throws if the browser cannot check it.
export async function tryUnlock(pc, code) {
  if (!canCheck()) throw new Error("insecure-context");
  const ok = sameHash(await derive(pc, String(code).trim()), pc.hash);
  if (ok) {
    try {
      localStorage.setItem(pc.storeKey, JSON.stringify({ h: pc.hash.slice(0, 16), until: Date.now() + pc.rememberDays * 86400000 }));
    } catch { /* private mode: ask again next time */ }
  }
  return ok;
}

// Wait before the next attempt: 1 s, 2 s, 4 s … capped at 8 s.
export const retryDelayMs = (failures) => Math.min(8000, 1000 * 2 ** Math.max(0, failures - 1));
