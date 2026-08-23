import { normalizeText, levenshtein } from "./cases.js";

// How closely the spoken report matched the script the chart asked for. The
// word-level distance carries the score because that is what the dataset cares
// about; the character-level distance softens the penalty for a single wrong
// ending or a compound the ASR split in two.

const WORD_WEIGHT = 0.65;
const CHAR_WEIGHT = 0.35;

function tokens(text) {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

function tokenDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

export function accuracyLabel(score) {
  if (score >= 95) return "Wortgenau";
  if (score >= 85) return "Sehr genau";
  if (score >= 70) return "Gut";
  if (score >= 50) return "Ungenau";
  return "Stark abweichend";
}

export function scoreAccuracy(expectedText, spokenText) {
  const expectedWords = tokens(expectedText);
  const spokenWords = tokens(spokenText);
  if (expectedWords.length === 0) {
    return {
      score: 0,
      wordAccuracy: 0,
      charAccuracy: 0,
      expectedWordCount: 0,
      spokenWordCount: spokenWords.length,
      correctWords: 0,
      label: accuracyLabel(0),
      scored: false,
    };
  }

  const wordEdits = tokenDistance(expectedWords, spokenWords);
  const wordSpan = Math.max(expectedWords.length, spokenWords.length);
  const wordAccuracy = Math.max(0, 1 - wordEdits / wordSpan);

  const expectedChars = expectedWords.join(" ");
  const spokenChars = spokenWords.join(" ");
  const charSpan = Math.max(expectedChars.length, spokenChars.length) || 1;
  const charAccuracy = Math.max(0, 1 - levenshtein(expectedChars, spokenChars) / charSpan);

  const score = Math.round(100 * Math.min(1, WORD_WEIGHT * wordAccuracy + CHAR_WEIGHT * charAccuracy));
  return {
    score,
    wordAccuracy: Math.round(wordAccuracy * 1000) / 1000,
    charAccuracy: Math.round(charAccuracy * 1000) / 1000,
    expectedWordCount: expectedWords.length,
    spokenWordCount: spokenWords.length,
    correctWords: Math.max(0, expectedWords.length - wordEdits),
    label: accuracyLabel(score),
    scored: true,
  };
}

export class AccuracyTracker {
  constructor() {
    this.samples = [];
  }

  add(result) {
    if (!result?.scored) return this.summary();
    this.samples.push(result.score);
    return this.summary();
  }

  summary() {
    const count = this.samples.length;
    if (count === 0) return { count: 0, average: 0, best: 0, worst: 0, label: "—" };
    const total = this.samples.reduce((sum, value) => sum + value, 0);
    const average = Math.round(total / count);
    return {
      count,
      average,
      best: Math.max(...this.samples),
      worst: Math.min(...this.samples),
      label: accuracyLabel(average),
    };
  }

  reset() {
    this.samples = [];
  }
}
