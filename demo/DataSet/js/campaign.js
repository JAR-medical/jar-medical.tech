import { LEVELS } from "./levels.js";
import { AccuracyTracker } from "./accuracy.js";

// Run-scoped state that outlives a single level: the running score, the
// accuracy history, and the two ledgers that keep a run from repeating itself
// (which case templates have been used, and which report scripts were already
// spoken).

export class Campaign {
  constructor(levels = LEVELS) {
    this.levels = levels;
    this.accuracy = new AccuracyTracker();
    this.reset();
  }

  reset() {
    this.index = 0;
    this.carriedScore = 0;
    this.savedTotal = 0;
    this.patientTotal = 0;
    this.elapsedTotal = 0;
    this.results = [];
    this.usedHints = new Set();
    this.caseUsage = new Map();
    this.accuracy.reset();
  }

  get levelCount() {
    return this.levels.length;
  }

  current() {
    return this.levels[this.index] || null;
  }

  isFinal() {
    return this.index >= this.levels.length - 1;
  }

  isComplete() {
    return this.index >= this.levels.length;
  }

  advance() {
    this.index += 1;
    return this.current();
  }

  // Only spoken reports reach this: a typed fallback says nothing about how the
  // speech model heard the script.
  recordAccuracy(result) {
    if (!result?.scored) return this.accuracySummary();
    return this.accuracy.add(result);
  }

  accuracySummary() {
    return this.accuracy.summary();
  }

  completeLevel(stats) {
    const level = this.current();
    this.carriedScore = Number(stats?.score) || this.carriedScore;
    this.savedTotal += Number(stats?.saved) || 0;
    this.patientTotal += Number(stats?.total) || Number(stats?.saved) || 0;
    this.elapsedTotal += Number(stats?.elapsed) || 0;
    this.results.push({
      levelId: level?.id || `level-${this.index + 1}`,
      title: level?.title || "",
      saved: Number(stats?.saved) || 0,
      total: Number(stats?.total) || 0,
      score: this.carriedScore,
      elapsed: Number(stats?.elapsed) || 0,
      accuracy: this.accuracySummary().average,
    });
    return this.results[this.results.length - 1];
  }

  summary() {
    const accuracy = this.accuracySummary();
    return {
      levelsCleared: this.results.length,
      levelCount: this.levels.length,
      score: this.carriedScore,
      saved: this.savedTotal,
      total: this.patientTotal,
      elapsed: this.elapsedTotal,
      accuracy: accuracy.average,
      accuracyLabel: accuracy.label,
      accuracySamples: accuracy.count,
      results: [...this.results],
    };
  }

  noteCaseUsed(caseId) {
    this.caseUsage.set(caseId, (this.caseUsage.get(caseId) || 0) + 1);
  }
}
