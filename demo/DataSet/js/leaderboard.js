// The end-screen leaderboard.
//
// The board is FICTIONAL: the rescue crews below do not exist and their runs
// were never played. It is there so a finished run has something to be measured
// against — a bare score tells a player nothing, a rank tells them where the
// run sits. Nothing here is sent anywhere and nothing here is read from a
// server; if a real board is ever added, replace ROSTER with what it returns
// and leave the rest of this file alone.

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

// The run just played, as a board row. Ties go to the shorter run, then to the
// more accurate one, so two identical scores never sort at random.
function compare(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.elapsed !== b.elapsed) return a.elapsed - b.elapsed;
  return (b.accuracy || 0) - (a.accuracy || 0);
}

export function buildLeaderboard(summary, options = {}) {
  const you = {
    name: options.name || "Deine Schicht",
    crew: options.crew || "J.A.R. Medical Demo",
    score: Number(summary?.score) || 0,
    saved: Number(summary?.saved) || 0,
    total: Number(summary?.total) || 0,
    accuracy: Number(summary?.accuracy) || 0,
    elapsed: Number(summary?.elapsed) || 0,
    you: true,
  };

  const rows = [...ROSTER.map((entry) => ({ ...entry, you: false })), you].sort(compare);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  const yourRank = rows.findIndex((row) => row.you) + 1;
  return { rows, you, yourRank, count: rows.length };
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
  return { ...board, shown };
}
