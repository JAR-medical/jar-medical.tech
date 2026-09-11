// Loads the TriARge demo's shipped scripts into a Node sandbox.
//
// demo/*.js are classic browser scripts: they attach to `window` and expose the
// simulation core as the global `TR`. Nothing in engine.js or scenario.js
// touches the DOM, Leaflet, storage or the network - the only browser global
// they need is `window` - so the real, unmodified files can be executed here.
// Tests therefore exercise production code, not a transcription of it.
import vm from 'node:vm';
import { readText } from './repo.mjs';

/**
 * mulberry32 - a small, fast, well-distributed PRNG.
 * Math.random() is replaced with this inside the sandbox so simulation runs
 * are reproducible; the engine seeds unit headings, scatter and ambient radio
 * from it, and a flaky test is worse than no test.
 */
export function seededRandom(seed = 0x5eed1e) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEMO_SCRIPTS = [
  'demo/data/neubiberg.js',
  'demo/data/halle-kroellwitz.js',
  'demo/data/muenchen-mitte.js',
  'demo/scenario.js',
  'demo/szenario-halle.js',
  'demo/szenario-muenchen.js',
  'demo/engine.js',
];

/**
 * Execute the demo's data, scenario and engine scripts in one fresh context.
 * Returns { TR, window, random } - `TR` is the live simulation API.
 */
export function loadEngine({ seed = 0x5eed1e } = {}) {
  const random = seededRandom(seed);
  const sandbox = { console, Math: Object.create(Math), Date };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.Math.random = random;

  const context = vm.createContext(sandbox);
  // The browser shares one global lexical scope across every <script> tag, so
  // engine.js's `const TR` is visible to map.js and ui.js. vm gives each
  // runInContext call its own scope, so the files are concatenated to
  // reproduce that, then TR is published onto the sandbox's window.
  const bundle = [
    '"use strict";',
    ...DEMO_SCRIPTS.map((rel) => `\n/* ${rel} */\n${readText(rel)}`),
    '\nwindow.TR = TR;\n',
  ].join('');
  try {
    vm.runInContext(bundle, context, { filename: 'demo-bundle.js', timeout: 30000 });
  } catch (err) {
    throw new Error(`the demo scripts failed to execute in a bare sandbox: ${err.stack}`);
  }
  if (!sandbox.TR) throw new Error('demo/engine.js did not define the global TR');
  if (!Array.isArray(sandbox.SZENARIEN) || sandbox.SZENARIEN.length === 0) {
    throw new Error('no scenarios registered on window.SZENARIEN');
  }
  return { TR: sandbox.TR, window: sandbox, random };
}

/**
 * Extract a named `function foo(...) { ... }` declaration verbatim from a source
 * file, brace-balanced and aware of strings, comments and regex literals.
 * Used for functions that live inside an IIFE and are never exported, so the
 * test runs the shipped source rather than a copy of it.
 */
export function extractFunction(src, name) {
  const decl = new RegExp(`(?:^|[^\\w.])function\\s+${name}\\s*\\(`);
  const m = decl.exec(src);
  if (!m) throw new Error(`no function named ${name} in the source`);
  const start = src.indexOf('function', m.index);
  const bodyStart = src.indexOf('{', src.indexOf('(', start));
  let i = bodyStart;
  let depth = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i === -1) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); if (i === -1) break; i += 2; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    i++;
  }
  throw new Error(`unbalanced body in function ${name}`);
}

/**
 * Pull a set of internal helper functions out of a demo script and evaluate
 * them together in a sandbox. `extraGlobals` supplies anything they close over.
 */
export function loadInternalFunctions(rel, names, extraGlobals = {}) {
  const src = readText(rel);
  const params = Object.keys(extraGlobals);
  // Compiled in this realm rather than a vm context so the helpers return
  // ordinary host arrays and objects; a vm context has its own Array and Object
  // intrinsics, which makes assert.deepEqual fail on the prototype alone.
  const body = [
    '"use strict";',
    ...names.map((name) => extractFunction(src, name)),
    `return { ${names.join(', ')} };`,
  ].join('\n\n');
  let factory;
  try {
    factory = new Function(...params, body);
  } catch (err) {
    throw new Error(`could not compile ${names.join(', ')} out of ${rel}: ${err.message}`);
  }
  const out = factory(...params.map((p) => extraGlobals[p]));
  for (const name of names) {
    if (typeof out[name] !== 'function') throw new Error(`${name} in ${rel} did not evaluate to a function`);
  }
  return out;
}

// engine.js keeps `letzterFrame` in module scope across calls, so the synthetic
// frame clock has to keep moving forward for the whole life of an engine
// instance - restarting it at 0 would hand takt() a negative delta.
const frameClock = new WeakMap();

/**
 * Advance the simulation by `simSeconds` of scenario time.
 * `takt(now)` clamps a frame to 0.5 real seconds and multiplies by S.tempo, so
 * the loop feeds monotonic synthetic timestamps rather than wall-clock ones -
 * no sleeping, no timing flake, identical results on any machine.
 */
export function runSimulation(TR, simSeconds, { tempo = 2, stepMs = 250 } = {}) {
  if (stepMs > 500) throw new Error('takt() clamps a frame to 500 ms; use a smaller stepMs');
  TR.tempoSetzen(tempo);
  const perStep = (stepMs / 1000) * tempo;
  const steps = Math.ceil(simSeconds / perStep);
  if (steps > 20000) throw new Error(`refusing to run ${steps} ticks; raise stepMs or lower simSeconds`);
  let now = frameClock.get(TR);
  if (now === undefined) {
    now = 0;
    TR.takt(now); // primes letzterFrame; contributes no simulated time
  }
  for (let i = 0; i < steps; i++) {
    now += stepMs;
    TR.takt(now);
  }
  frameClock.set(TR, now);
  return TR.S.simSek;
}

/**
 * Copy a value out of the sandbox realm. vm contexts have their own Array and
 * Object intrinsics, so assert.deepEqual on a sandbox value fails on the
 * prototype even when the contents match.
 */
export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** The three scenarios the demo ships, by id. */
export const SCENARIO_IDS = ['neubiberg', 'halle', 'muenchen'];
