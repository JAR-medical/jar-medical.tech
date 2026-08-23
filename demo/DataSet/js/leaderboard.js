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

const ROSTER = Object.freeze([
  { name: "Team Nordwand", crew: "Bergwacht Oberstdorf", score: 6120, saved: 19, total: 19, accuracy: 97, elapsed: 1188 },
  { name: "Crew Alpenrose", crew: "BRK Garmisch", score: 5740, saved: 19, total: 19, accuracy: 94, elapsed: 1302 },
  { name: "Schicht Hochtal", crew: "ASB Sonthofen", score: 5395, saved: 18, total: 19, accuracy: 95, elapsed: 1247 },
  { name: "Team Firnkante", crew: "Bergrettung Tirol", score: 5010, saved: 18, total: 19, accuracy: 91, elapsed: 1415 },
  { name: "Crew Talstation", crew: "DRK Kempten", score: 4680, saved: 17, total: 19, accuracy: 92, elapsed: 1361 },
  { name: "Schicht Windkolk", crew: "Bergwacht Ramsau", score: 4295, saved: 17, total: 19, accuracy: 88, elapsed: 1490 },
  { name: "Team Gratweg", crew: "Malteser Füssen", score: 3960, saved: 16, total: 19, accuracy: 90, elapsed: 1436 },
  { name: "Crew Lawinenhund", crew: "Bergwacht Berchtesgaden", score: 3610, saved: 15, total: 19, accuracy: 86, elapsed: 1523 },
  { name: "Schicht Schneefeld", crew: "JUH Immenstadt", score: 3240, saved: 14, total: 19, accuracy: 84, elapsed: 1602 },
  { name: "Team Steilhang", crew: "Bergwacht Lenggries", score: 2870, saved: 13, total: 19, accuracy: 81, elapsed: 1688 },
  { name: "Crew Gondelbahn", crew: "ASB Mittenwald", score: 2480, saved: 11, total: 19, accuracy: 79, elapsed: 1744 },
  { name: "Schicht Bergstation", crew: "DRK Oberammergau", score: 2105, saved: 10, total: 19, accuracy: 76, elapsed: 1810 },
]);

export const LEADERBOARD_NOTE = "Demo-Bestenliste — die Crews sind erfunden, dein Lauf ist echt.";
export const LEADERBOARD_NOTES = Object.freeze({
  demo: LEADERBOARD_NOTE,
  local: "Deine eigenen Läufe auf diesem Gerät — nur lokal gespeichert.",
  global: "Alle Läufe auf diesem Medicraft-Server, beste zuerst.",
});

const IDENTITY_KEY = "medicraft.identity";
const RUNS_KEY = "medicraft.runs";
const BEST_KEY = "medicraft.best";
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
  return {
    name: cleanName(stored?.name, "Deine Schicht"),
    crew: cleanName(stored?.crew, "J.A.R. Medical Demo"),
  };
}

// Whether the player has ever named their shift. A run from a browser that has
// is submitted straight away; a first-time run waits for the name field, so
// nobody lands on a public board as "Deine Schicht".
export function hasStoredIdentity() {
  return Boolean(readJson(IDENTITY_KEY, null)?.name);
}

export function saveIdentity({ name, crew } = {}) {
  const identity = {
    name: cleanName(name, "Deine Schicht"),
    crew: cleanName(crew, "J.A.R. Medical Demo"),
  };
  writeJson(IDENTITY_KEY, identity);
  return identity;
}

// One finished run, in the shape both boards and the server agree on.
export function runFromSummary(summary, identity = loadIdentity()) {
  return {
    name: cleanName(identity?.name, "Deine Schicht"),
    crew: cleanName(identity?.crew, "J.A.R. Medical Demo"),
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

export async function fetchRemoteRuns(limit = 25) {
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
    name: cleanName(entry?.name, "Schicht"),
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
