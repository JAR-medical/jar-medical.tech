// The end-screen leaderboard.
//
// Three boards, one renderer. `global` is the real one: finished runs POSTed to
// the backend's /api/leaderboard and read back by everyone playing that
// install. `local` is this browser's own history, kept in localStorage, which
// is what a statically hosted copy with no backend falls back to. `demo` is the
// original fictional roster — kept because a first run with nothing to compare
// against still deserves a rank, and it says outright that the crews are made
// up.
//
// Nothing here throws on a missing backend: every remote call resolves to null
// and the UI shows the local board instead.

import { apiUrl, hasBackend } from "./api.js";

// The fictional crews are deliberately mid-range opponents. A good player run
// should be able to climb the demo board, while real global/local runs remain
// untouched and still show their actual accuracy.
const ROSTER = Object.freeze([
  { name: "Team Nordwand", crew: "Bergwacht Oberstdorf", score: 3200, saved: 19, total: 19, accuracy: 70, elapsed: 1188 },
  { name: "Crew Alpenrose", crew: "BRK Garmisch", score: 3025, saved: 18, total: 19, accuracy: 68, elapsed: 1302 },
  { name: "Team Hochtal", crew: "ASB Sonthofen", score: 2850, saved: 18, total: 19, accuracy: 66, elapsed: 1247 },
  { name: "Team Firnkante", crew: "Bergrettung Tirol", score: 2675, saved: 17, total: 19, accuracy: 64, elapsed: 1415 },
  { name: "Crew Talstation", crew: "DRK Kempten", score: 2500, saved: 17, total: 19, accuracy: 62, elapsed: 1361 },
  { name: "Team Windkolk", crew: "Bergwacht Ramsau", score: 2325, saved: 16, total: 19, accuracy: 60, elapsed: 1490 },
  { name: "Team Gratweg", crew: "Malteser Füssen", score: 2150, saved: 16, total: 19, accuracy: 58, elapsed: 1436 },
  { name: "Crew Lawinenhund", crew: "Bergwacht Berchtesgaden", score: 1975, saved: 15, total: 19, accuracy: 56, elapsed: 1523 },
  { name: "Team Schneefeld", crew: "JUH Immenstadt", score: 1800, saved: 14, total: 19, accuracy: 54, elapsed: 1602 },
  { name: "Team Steilhang", crew: "Bergwacht Lenggries", score: 1625, saved: 13, total: 19, accuracy: 52, elapsed: 1688 },
  { name: "Crew Gondelbahn", crew: "ASB Mittenwald", score: 1450, saved: 12, total: 19, accuracy: 50, elapsed: 1744 },
  { name: "Team Bergstation", crew: "DRK Oberammergau", score: 1275, saved: 11, total: 19, accuracy: 48, elapsed: 1810 },
]);

export const LEADERBOARD_NOTE = "Demo-Bestenliste — die Teams sind erfunden, dein Beitrag ist echt.";
export const LEADERBOARD_NOTES = Object.freeze({
  demo: LEADERBOARD_NOTE,
  local: "Deine eigenen Läufe auf diesem Gerät — nur lokal gespeichert.",
  global: "Alle Läufe auf diesem Medicraft-Server, beste zuerst.",
});

// The board the workstation publishes to the static site. The backend runs on
// one PC, so it is unreachable whenever that machine sleeps — and a board that
// vanishes overnight is worse than a slightly old one. This file is pushed
// alongside the game, so it is served by the same host as index.html and needs
// no backend at all. Relative on purpose: it resolves under /demo/DataSet/ on
// the published site and next to the game locally.
const PUBLISHED_BOARD_URL = "./leaderboard.json";

const IDENTITY_KEY = "medicraft.identity";
const RUNS_KEY = "medicraft.runs";
const BEST_KEY = "medicraft.best";
const ANONYMOUS_NAME = "Anonym";
const EMPTY_TEAM = "";
const LOCAL_RUN_LIMIT = 40;
const REMOTE_TIMEOUT_MS = 4000;

function storage() {
  try {
    return globalThis.localStorage ?? null;
  } catch (err) {
    return null;
  }
}

function readJson(key, fallback) {
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (err) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function cleanName(value, fallback) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 28);
  return text || fallback;
}

export function loadIdentity() {
  const stored = readJson(IDENTITY_KEY, null);
  // Older builds used public-looking placeholder values. Treat those as empty
  // so upgrading does not turn an anonymous player into a fake named entry.
  const storedName = stored?.name === "Deine Schicht" ? "" : stored?.name;
  const storedCrew = stored?.crew === "J.A.R. Medical Demo" ? "" : stored?.crew;
  return {
    name: cleanName(storedName, EMPTY_TEAM),
    crew: cleanName(storedCrew, EMPTY_TEAM),
  };
}

// Whether the player chose a public name. Gameplay never depends on this: an
// unnamed run is submitted as "Anonym" so the data collection can continue.
export function hasStoredIdentity() {
  return Boolean(loadIdentity().name);
}

export function saveIdentity({ name = "", crew = "" } = {}) {
  const safeName = cleanName(name, EMPTY_TEAM);
  const identity = {
    name: safeName,
    crew: safeName ? cleanName(crew, EMPTY_TEAM) : EMPTY_TEAM,
  };
  writeJson(IDENTITY_KEY, identity);
  return identity;
}

// One finished run, in the shape both boards and the server agree on.
export function runFromSummary(summary, identity = loadIdentity()) {
  return {
    name: cleanName(identity?.name, ANONYMOUS_NAME),
    crew: cleanName(identity?.crew, "—"),
    score: Math.round(Number(summary?.score) || 0),
    saved: Math.round(Number(summary?.saved) || 0),
    total: Math.round(Number(summary?.total) || 0),
    accuracy: Math.round(Number(summary?.accuracy) || 0),
    elapsed: Math.round(Number(summary?.elapsed) || 0),
    levels: Math.round(Number(summary?.levelsCleared) || 0),
    hidden_found: Math.round(Number(summary?.hiddenFound) || 0),
  };
}

export function loadLocalRuns() {
  const runs = readJson(RUNS_KEY, []);
  return Array.isArray(runs) ? runs.filter((entry) => entry && typeof entry === "object") : [];
}

export function saveLocalRun(run) {
  const runs = loadLocalRuns();
  runs.push({ ...run, recorded_at: run?.recorded_at || new Date().toISOString() });
  runs.sort(compare);
  const trimmed = runs.slice(0, LOCAL_RUN_LIMIT);
  writeJson(RUNS_KEY, trimmed);
  return trimmed;
}

// Personal bests are what turn a second run into a target. Kept separate from
// the run list so clearing the board never loses them.
export function loadPersonalBest() {
  const best = readJson(BEST_KEY, null);
  return {
    score: Number(best?.score) || 0,
    accuracy: Number(best?.accuracy) || 0,
    saved: Number(best?.saved) || 0,
    elapsed: Number(best?.elapsed) || 0,
    runs: Number(best?.runs) || 0,
  };
}

export function updatePersonalBest(run) {
  const previous = loadPersonalBest();
  const next = {
    score: Math.max(previous.score, Number(run?.score) || 0),
    accuracy: Math.max(previous.accuracy, Number(run?.accuracy) || 0),
    saved: Math.max(previous.saved, Number(run?.saved) || 0),
    elapsed:
      previous.elapsed && Number(run?.elapsed)
        ? Math.min(previous.elapsed, Number(run.elapsed))
        : Number(run?.elapsed) || previous.elapsed,
    runs: previous.runs + 1,
  };
  writeJson(BEST_KEY, next);
  return { previous, next, beatenScore: (Number(run?.score) || 0) > previous.score && previous.runs > 0 };
}

async function withTimeout(promise, ms) {
  let timer = null;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchLiveRuns(limit) {
  if (!hasBackend()) return null;
  try {
    const res = await withTimeout(fetch(apiUrl(`/api/leaderboard?limit=${limit}`), { cache: "no-store" }), REMOTE_TIMEOUT_MS);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data?.entries) ? data.entries : null;
  } catch (err) {
    return null;
  }
}

async function fetchPublishedRuns(limit) {
  try {
    const res = await withTimeout(fetch(PUBLISHED_BOARD_URL, { cache: "no-store" }), REMOTE_TIMEOUT_MS);
    if (!res.ok) return null;
    const data = await res.json();
    const entries = Array.isArray(data) ? data : data?.entries;
    return Array.isArray(entries) ? entries.slice(0, limit) : null;
  } catch (err) {
    // No published board is the normal case for a local checkout.
    return null;
  }
}

/** The global board, with where it came from — or null if neither answered.
 *
 * The live server wins whenever it is up: it has runs the published snapshot
 * has not caught up with yet. `source` lets the caller say which one the
 * player is looking at rather than passing off a snapshot as live.
 */
export async function fetchRemoteRuns(limit = 25) {
  const live = await fetchLiveRuns(limit);
  if (live && live.length) return { entries: live, source: "server" };
  const published = await fetchPublishedRuns(limit);
  if (published && published.length) return { entries: published, source: "published" };
  // An empty board from a reachable server is still an answer, not a failure.
  if (live) return { entries: live, source: "server" };
  return null;
}

export async function submitRun(run) {
  if (!hasBackend()) return null;
  try {
    const res = await withTimeout(
      fetch(apiUrl("/api/leaderboard"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(run),
      }),
      REMOTE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      rank: Number(data?.rank) || null,
      count: Number(data?.count) || 0,
      run: data?.run && typeof data.run === "object" ? data.run : null,
      entries: Array.isArray(data?.entries) ? data.entries : [],
    };
  } catch (err) {
    return null;
  }
}

// Ties go to the shorter run, then to the more accurate one, so two identical
// scores never sort at random.
function compare(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.elapsed !== b.elapsed) return a.elapsed - b.elapsed;
  return (b.accuracy || 0) - (a.accuracy || 0);
}

function rowKey(entry) {
  return entry?.recorded_at ? String(entry.recorded_at) : null;
}

function normalizeRow(entry, you = false) {
  return {
    name: cleanName(entry?.name, ANONYMOUS_NAME),
    crew: cleanName(entry?.crew, "—"),
    score: Number(entry?.score) || 0,
    saved: Number(entry?.saved) || 0,
    total: Number(entry?.total) || 0,
    accuracy: Number(entry?.accuracy) || 0,
    elapsed: Number(entry?.elapsed) || 0,
    recorded_at: entry?.recorded_at || null,
    you,
  };
}

export function buildLeaderboard(summary, options = {}) {
  const identity = options.identity || { name: options.name, crew: options.crew };
  const you = {
    ...normalizeRow(
      {
        ...runFromSummary(summary, {
          name: identity?.name || options.name,
          crew: identity?.crew || options.crew,
        }),
      },
      true,
    ),
  };

  // `entries` is the board this view is for; without one the fictional roster
  // stands in, which is the original behaviour and what a first run gets.
  const source = Array.isArray(options.entries) ? options.entries : ROSTER;
  // A board that already contains the run just played must mark that row as
  // the player's rather than appending a second copy of the same run.
  const youKey = options.youKey ? String(options.youKey) : null;
  const rows = source.map((entry) => normalizeRow(entry, Boolean(youKey) && rowKey(entry) === youKey));
  const alreadyListed = rows.some((row) => row.you);
  const includeYou = options.includeYou !== false && !alreadyListed;
  if (includeYou) rows.push(you);
  rows.sort(compare);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  const yourRank = rows.findIndex((row) => row.you) + 1;
  return { rows, you, yourRank, count: rows.length, scope: options.scope || "demo" };
}

// Top `top` rows, plus the player's own row and its neighbours when the run
// landed further down — a board that never leaves the player off it.
export function leaderboardView(summary, options = {}) {
  const board = buildLeaderboard(summary, options);
  const top = options.top ?? 8;
  const shown = board.rows.slice(0, top);
  if (board.yourRank > top) {
    const from = Math.max(top, board.yourRank - 2);
    shown.push({ gap: true, rank: null });
    shown.push(...board.rows.slice(from, board.yourRank + 1));
  }
  return { ...board, shown, note: LEADERBOARD_NOTES[options.scope] || LEADERBOARD_NOTE };
}

export const DEMO_ROSTER = ROSTER;
