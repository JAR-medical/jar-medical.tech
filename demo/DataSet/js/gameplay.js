import { emit } from "./events.js";
import { CASES, ReportParser, createSeededRandom, normalizeText, randomSeed, randomizeCase } from "./cases.js";
import { scoreAccuracy } from "./accuracy.js";
import { apiUrl } from "./api.js";
import { VOICE_STAGE_COUNT, voicePromptAt } from "./voice_prompts.js";

const BASE_SCORE = { rot: 150, gelb: 100 };
const PARTIAL_BONUS = 10;
const ACCURACY_BONUS = 60;
const HIDDEN_BONUS = 40;
const HINT_ATTEMPTS = 24;
const SEVERITY_LABELS = { rot: "ROT — sofort behandeln", gelb: "GELB — dringend behandeln" };
const DEFAULT_PATIENT_COUNT = 6;

function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function postJson(path, payload) {
  if (typeof fetch !== "function") return Promise.resolve(null);
  return fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).then(async (response) => {
    let body = null;
    try {
      body = await response.json();
    } catch (error) {
      body = null;
    }
    if (!response.ok) throw new Error(body?.detail || `HTTP ${response.status}`);
    return body;
  });
}

function scenarioIdentifier(seed) {
  return `mc-${Date.now().toString(36)}-${(seed >>> 0).toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

export class Game {
  constructor(entities) {
    this.entities = entities;
    this.runs = [];
    this.byPatientId = new Map();
    this.score = 0;
    this.elapsed = 0;
    this.started = false;
    this.finished = false;
    this.scenario = null;
    this.scenarioId = null;
    this.scenarioSync = Promise.resolve(false);
    this.level = null;
    this.levelIndex = 0;
    this.contributionMode = false;
  }

  // Templates are drawn least-used-first so a five-level run spreads the eight
  // case types instead of repeating the same two, and every generated report
  // script is checked against the run's ledger before it is handed out.
  _selectTemplates(total, rng, usage) {
    const byUse = new Map();
    for (const template of CASES) {
      const used = usage.get(template.id) || 0;
      if (!byUse.has(used)) byUse.set(used, []);
      byUse.get(used).push(template);
    }
    const ordered = [];
    for (const used of [...byUse.keys()].sort((a, b) => a - b)) {
      ordered.push(...shuffle(byUse.get(used), rng));
    }
    const picked = [];
    while (picked.length < total) {
      picked.push(...ordered.slice(0, Math.min(total - picked.length, ordered.length)));
      if (ordered.length === 0) break;
    }
    return picked.slice(0, total);
  }

  _uniqueVariant(template, rng, usedHints) {
    let fallback = null;
    for (let attempt = 0; attempt < HINT_ATTEMPTS; attempt++) {
      const candidate = randomizeCase(template, rng);
      fallback = candidate;
      const key = normalizeText(candidate.hint_de);
      if (usedHints.has(key)) continue;
      usedHints.add(key);
      return candidate;
    }
    const disambiguated = {
      ...fallback,
      hint_de: `${fallback.hint_de} Einsatznummer ${usedHints.size + 1}.`,
    };
    usedHints.add(normalizeText(disambiguated.hint_de));
    return disambiguated;
  }

  start(spots, count = DEFAULT_PATIENT_COUNT, options = {}) {
    this.reset();
    const total = Math.max(1, Number(count) || DEFAULT_PATIENT_COUNT);
    const seed = Number.isFinite(options?.scenarioSeed) ? Number(options.scenarioSeed) >>> 0 : randomSeed();
    const rng = createSeededRandom(seed);
    const usedHints = options.usedHints instanceof Set ? options.usedHints : new Set();
    const caseUsage = options.caseUsage instanceof Map ? options.caseUsage : new Map();
    this.level = options.level || null;
    this.levelIndex = Number.isFinite(options.levelIndex) ? Number(options.levelIndex) : 0;
    this.contributionMode = Boolean(options.contributionMode);
    this.score = Number(options.startScore) || 0;

    const templates = this._selectTemplates(total, rng, caseUsage);
    const assigned = templates.map((template) => {
      caseUsage.set(template.id, (caseUsage.get(template.id) || 0) + 1);
      return {
        ...this._uniqueVariant(template, rng, usedHints),
        name: template.names[Math.floor(rng() * template.names.length)],
        age: randomInt(template.ageRange[0], template.ageRange[1], rng),
      };
    });
    const safeSpots =
      Array.isArray(spots) && spots.length >= total
        ? shuffle(spots.slice(0, total), rng)
        : assigned.map(() => ({ x: 8 + Math.floor(rng() * 48), y: 0, z: 8 + Math.floor(rng() * 48) }));

    this.entities.spawn(assigned, safeSpots);

    const spawned = this.entities.getAll();
    assigned.forEach((template, index) => {
      const entity = spawned[index];
      if (!entity) return;
      const run = {
        patientId: entity.id,
        caseTitle: template.title_de,
        template,
        name: template.name,
        age: template.age,
        hidden: Boolean(safeSpots[index]?.hidden),
        partialGiven: false,
        performedActions: new Set(),
        usedItemIds: new Set(),
        completionMode: null,
        voiceStage: 0,
        acceptedVoiceClips: [],
        bestAccuracy: null,
        resolved: false,
        saved: false,
        dead: false,
        parser: new ReportParser(template),
      };
      this.runs.push(run);
      this.byPatientId.set(run.patientId, run);
    });

    this.scenarioId = scenarioIdentifier(seed);
    this.scenario = {
      schema_version: 1,
      scenario_id: this.scenarioId,
      seed,
      level_id: this.level?.id || null,
      level_index: this.levelIndex,
      level_title: this.level?.title || null,
      loaded_at: new Date().toISOString(),
      patients: this.runs.map((run) => this.serializeRun(run)),
    };
    this.scenarioSync = this.syncScenario();
    this.started = true;
    emit("game:started", { count: total });
  }

  reset() {
    this.runs = [];
    this.byPatientId.clear();
    this.score = 0;
    this.elapsed = 0;
    this.started = false;
    this.finished = false;
    this.scenario = null;
    this.scenarioId = null;
    this.scenarioSync = Promise.resolve(false);
    this.contributionMode = false;
  }

  serializeRun(run) {
    const entity = this.entities.getById(run.patientId);
    return {
      patient_id: run.patientId,
      case_id: run.template.id,
      case_title_de: run.caseTitle,
      case_title_en: run.template.title_en,
      name: run.name,
      age: run.age,
      severity: run.template.severity,
      concealed: Boolean(run.hidden),
      position: entity
        ? { x: Number(entity.pos.x), y: Number(entity.pos.y), z: Number(entity.pos.z) }
        : null,
      story_de: run.template.story_de,
      symptoms: run.template.symptoms,
      vitals: run.template.vitals,
      required: run.template.required,
      forbidden: run.template.forbidden,
      hint_de: run.template.hint_de,
      profile: run.template.profile || null,
    };
  }

  syncScenario() {
    if (!this.scenario) return Promise.resolve(false);
    return postJson("/api/scenarios", this.scenario)
      .then(() => true)
      .catch(() => false);
  }

  recordActionUse(run, item, result) {
    if (!this.scenarioId) return;
    const payload = {
      scenario_id: this.scenarioId,
      patient_id: run.patientId,
      item_id: item.id,
      item_label: item.label,
      action_keys: result.actionKeys,
      action_labels: result.actionLabels,
      used_at: new Date().toISOString(),
    };
    this.scenarioSync
      .then((registered) => postJson("/api/scenarios/actions", registered ? payload : { ...payload, scenario: this.scenario }))
      .catch(() => postJson("/api/scenarios/actions", { ...payload, scenario: this.scenario }).catch(() => {}));
  }

  recordReport(run, transcript, result, submissionSource = "report") {
    if (!this.scenarioId) return;
    const payload = {
      scenario_id: this.scenarioId,
      patient_id: run.patientId,
      transcript,
      submission_source: submissionSource,
      performed_keys: [...run.performedActions],
      client_result: {
        verdict: result.verdict,
        matched_keys: result.matchedKeys,
        missing_keys: result.missingKeys,
        forbidden_hits: result.forbiddenHits,
        level_id: this.level?.id || null,
        level_index: this.levelIndex,
        expected_text: run.template.hint_de,
        accuracy: result.accuracy
          ? {
              score: result.accuracy.score,
              word_accuracy: result.accuracy.wordAccuracy,
              char_accuracy: result.accuracy.charAccuracy,
              expected_words: result.accuracy.expectedWordCount,
              spoken_words: result.accuracy.spokenWordCount,
            }
          : null,
      },
    };
    const send = (registered) => postJson("/api/scenarios/reports", registered ? payload : { ...payload, scenario: this.scenario });
    this.scenarioSync
      .then((registered) => send(registered))
      .catch(() => send(false).catch(() => {}));
  }

  state() {
    const saved = this.runs.filter((r) => r.saved).length;
    const dead = this.runs.filter((r) => r.dead).length;
    const accuracies = this.runs.map((r) => r.bestAccuracy).filter((value) => Number.isFinite(value));
    return {
      total: this.runs.length,
      saved,
      dead,
      active: this.runs.length - saved - dead,
      score: this.score,
      elapsed: Math.floor(this.elapsed),
      levelIndex: this.levelIndex,
      levelId: this.level?.id || null,
      levelTitle: this.level?.title || null,
      hidden: this.runs.filter((r) => r.hidden).length,
      hiddenFound: this.runs.filter((r) => r.hidden && r.resolved).length,
      acceptedVoiceClips: this.runs.reduce((sum, run) => sum + run.acceptedVoiceClips.length, 0),
      requiredVoiceClips: this.contributionMode ? this.runs.length * VOICE_STAGE_COUNT : 0,
      levelAccuracy: accuracies.length
        ? Math.round(accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length)
        : null,
    };
  }

  getView(patientId) {
    const run = this.byPatientId.get(patientId);
    if (!run) return null;
    const t = run.template;
    const view = {
      patientId: run.patientId,
      name: run.name,
      age: run.age,
      severity: t.severity,
      severityLabel: SEVERITY_LABELS[t.severity],
      titleDe: t.title_de,
      titleEn: t.title_en,
      symptoms: t.symptoms,
      vitals: t.vitals,
      hint: t.hint_de,
      profile: t.profile || null,
      elapsed: Math.floor(this.elapsed),
      usedItems: [...run.usedItemIds],
      performedActions: [...run.performedActions],
      performedActionLabels: [...run.performedActions].map((key) => {
        const group = (t.required || []).find((candidate) => candidate.key === key);
        return group?.label_de || group?.label_en || key;
      }),
      requiredActionLabels: (t.required || [])
        .filter((group) => (group.base_key || group.key) !== "transport")
        .map((group) => group.label_de || group.label_en || group.key),
      completionMode: run.completionMode,
      resolved: run.resolved,
      hidden: Boolean(run.hidden),
      bestAccuracy: run.bestAccuracy,
      contributionMode: this.contributionMode,
      voiceStage: run.voiceStage,
      voiceStageCount: VOICE_STAGE_COUNT,
      acceptedVoiceClips: run.acceptedVoiceClips.length,
    };
    view.voicePrompt = this.contributionMode ? voicePromptAt(view, run.voiceStage) : null;
    return view;
  }

  acceptVoiceClip(patientId, clip = {}) {
    const run = this.byPatientId.get(patientId);
    if (!this.contributionMode || !run || run.resolved) {
      return { accepted: false, saved: false, reason: "Kein aktiver Sprachfall." };
    }
    const view = this.getView(patientId);
    const expectedPrompt = view?.voicePrompt;
    if (!expectedPrompt || clip.promptId !== expectedPrompt.promptId) {
      return { accepted: false, saved: false, reason: "Diese Sprachaufgabe ist nicht mehr aktuell." };
    }
    if (run.acceptedVoiceClips.some((entry) => entry.clipId === clip.clipId)) {
      return { accepted: false, saved: false, reason: "Aufnahme wurde bereits gezählt." };
    }
    run.acceptedVoiceClips.push({
      clipId: clip.clipId,
      promptId: clip.promptId,
      state: clip.validationState || "basic_accepted",
    });
    run.voiceStage += 1;
    const completed = run.voiceStage >= VOICE_STAGE_COUNT;
    emit("voice:accepted", {
      patientId,
      clipId: clip.clipId,
      promptId: clip.promptId,
      stage: run.voiceStage,
      total: VOICE_STAGE_COUNT,
      completed,
    });
    const scoreDelta = completed ? this._completeRun(run, "voice-sequence") : 0;
    return {
      accepted: true,
      saved: completed,
      completed,
      scoreDelta,
      stage: run.voiceStage,
      total: VOICE_STAGE_COUNT,
      nextPrompt: completed ? null : this.getView(patientId)?.voicePrompt,
    };
  }

  _isFullyTreated(run) {
    const requiredTreatment = (run.template.required || []).filter(
      (group) => (group.base_key || group.key) !== "transport"
    );
    return requiredTreatment.length > 0 && requiredTreatment.every((group) => run.performedActions.has(group.key));
  }

  // Base points for the rescue, a bonus proportional to how faithfully the
  // script was read back, and a finder's bonus for a concealed casualty.
  _completeRun(run, completionMode) {
    if (!run || run.resolved) return 0;
    run.resolved = true;
    run.saved = true;
    run.completionMode = completionMode;
    const base = BASE_SCORE[run.template.severity] || BASE_SCORE.gelb;
    const accuracyBonus = Number.isFinite(run.bestAccuracy)
      ? Math.round((ACCURACY_BONUS * run.bestAccuracy) / 100)
      : 0;
    const hiddenBonus = run.hidden ? HIDDEN_BONUS : 0;
    const scoreDelta = base + accuracyBonus + hiddenBonus;
    this.score += scoreDelta;
    this.entities.markSaved?.(run.patientId);
    this.entities.healFx?.(run.patientId);
    emit("patient:saved", {
      patientId: run.patientId,
      caseTitle: run.caseTitle,
      scoreDelta,
      completionMode,
      accuracy: run.bestAccuracy,
      accuracyBonus,
      hiddenBonus,
    });
    return scoreDelta;
  }

  // Dev shortcuts behind the settings password. They close patients through
  // the same path a finished treatment does, so a skipped level scores, emits
  // and ends exactly like a played one — there is no second code path to keep
  // in step.
  resolvePatient(patientId, completionMode = "kit") {
    const run = this.byPatientId.get(patientId);
    if (!run || run.resolved) return 0;
    return this._completeRun(run, completionMode);
  }

  resolveAllPatients(completionMode = "kit") {
    let resolved = 0;
    for (const run of this.runs) {
      if (run.resolved) continue;
      this._completeRun(run, completionMode);
      resolved += 1;
    }
    return resolved;
  }

  // Points awarded by the layer above (streak bonuses, discovery bonuses) that
  // are not tied to one report verdict. Additive on purpose: the per-patient
  // scoring in _completeRun is untouched.
  awardBonus(points, reason = "bonus") {
    const delta = Math.round(Number(points) || 0);
    if (!delta) return this.score;
    this.score += delta;
    emit("score:bonus", { delta, reason, score: this.score });
    return this.score;
  }

  useItem(patientId, item) {
    const run = this.byPatientId.get(patientId);
    if (!run || run.resolved) {
      return { used: false, message: "Kein aktiver Patient.", actionKeys: [], actionLabels: [] };
    }
    if (!item || item.type !== "use") {
      return { used: false, message: "Dieser Hotbar-Eintrag ist ein Block.", actionKeys: [], actionLabels: [] };
    }
    if (run.usedItemIds.has(item.id)) {
      return { used: false, message: `${item.label} wurde bei diesem Patienten bereits eingesetzt.`, actionKeys: [], actionLabels: [] };
    }

    const required = run.template.required || [];
    if (item.id === "med-kit") {
      const applicableGroups = required.filter((group) => (group.base_key || group.key) !== "transport");
      run.usedItemIds.add(item.id);
      for (const group of applicableGroups) run.performedActions.add(group.key);
      const result = {
        used: true,
        itemId: item.id,
        itemLabel: item.label,
        actionKeys: applicableGroups.map((group) => group.key),
        actionLabels: applicableGroups.map((group) => group.label_de || group.label_en || group.key),
        message: "Med-Kit eingesetzt — alles behandelt; Bericht weiterhin möglich.",
        completed: false,
        additive: true,
      };
      this.recordActionUse(run, item, result);
      return result;
    }

    const applicableGroups = required.filter((group) => (item.actionKeys || []).includes(group.base_key || group.key));
    if (applicableGroups.length === 0) {
      return {
        used: false,
        message: `${item.label} ist für diesen Fall nicht indiziert.`,
        actionKeys: [],
        actionLabels: [],
      };
    }

    run.usedItemIds.add(item.id);
    for (const group of applicableGroups) run.performedActions.add(group.key);
    const completed = this._isFullyTreated(run);
    const result = {
      used: true,
      itemId: item.id,
      itemLabel: item.label,
      actionKeys: applicableGroups.map((group) => group.key),
      actionLabels: applicableGroups.map((group) => group.label_de || group.label_en || group.key),
      message: completed ? `${item.label} eingesetzt — Patient vollständig behandelt.` : `${item.label} eingesetzt.`,
      completed,
    };
    this.recordActionUse(run, item, result);
    if (completed && !this.contributionMode) this._completeRun(run, "kit");
    if (completed && this.contributionMode) {
      result.completed = false;
      result.message = `${item.label} eingesetzt — Behandlung vorbereitet; Sprachübergabe bleibt erforderlich.`;
    }
    return result;
  }

  medicatePatient(patientId) {
    const result = this.useItem(patientId, { id: "med-kit", label: "Med-Kit", type: "use" });
    return { ...result, saved: false, scoreDelta: 0 };
  }

  submitReport(patientId, transcript, options = {}) {
    const run = this.byPatientId.get(patientId);
    if (!run || run.resolved) {
      return {
        verdict: "rejected",
        matchedKeys: [],
        missingKeys: [],
        forbiddenHits: [],
        feedback: ["Kein aktiver Patient."],
        scoreDelta: 0,
        saved: false,
      };
    }
    if (this.contributionMode) {
      return {
        verdict: "rejected",
        matchedKeys: [],
        missingKeys: [],
        forbiddenHits: [],
        feedback: ["Dieser Modus wird ausschließlich über die fünf Sprachschritte abgeschlossen."],
        scoreDelta: 0,
        saved: false,
      };
    }

    const normalizedTranscript = transcript || "";
    const audioRecorded = options?.source === "audio" || options?.audio === true;

    // How close the spoken words came to the script on the chart. Kept per
    // patient so re-reading a report can only improve the recorded accuracy.
    const accuracy = scoreAccuracy(run.template.hint_de, normalizedTranscript);
    if (accuracy.scored && (!Number.isFinite(run.bestAccuracy) || accuracy.score > run.bestAccuracy)) {
      run.bestAccuracy = accuracy.score;
    }

    let result = run.parser.parse(normalizedTranscript, [...run.performedActions]);
    if (audioRecorded && normalizedTranscript.trim() && !this.contributionMode) {
      result = {
        ...result,
        verdict: "saved",
        matchedKeys: [],
        missingKeys: [],
        forbiddenHits: [],
        feedback: ["Audio-Bericht aufgenommen — Patient dokumentiert."],
      };
    }
    let scoreDelta = 0;
    const labelsByKey = new Map(
      run.template.required.map((group) => [group.key, group.label_de || group.label_en || group.key])
    );
    const labelFor = (key) => labelsByKey.get(key) || key.replace(/_/g, " ");
    result.matchedLabels = result.matchedKeys.map(labelFor);
    result.missingLabels = result.missingKeys.map(labelFor);

    this.recordReport(run, normalizedTranscript, result, audioRecorded ? "audio" : "report");

    if (result.verdict === "saved") {
      scoreDelta = this._completeRun(run, audioRecorded ? "audio" : "report");
    } else if (result.verdict === "partial" && !run.partialGiven) {
      run.partialGiven = true;
      scoreDelta = PARTIAL_BONUS;
      this.score += PARTIAL_BONUS;
      emit("patient:partial", { patientId: run.patientId, scoreDelta: PARTIAL_BONUS });
    }

    return { ...result, scoreDelta, saved: result.verdict === "saved", accuracy, expectedText: run.template.hint_de };
  }

  update(dt) {
    if (!this.started || this.finished) return;
    this.elapsed += dt;

    if (this.runs.length > 0 && this.runs.every((r) => r.resolved)) {
      this.finished = true;
      const st = this.state();
      const won = st.saved === st.total && st.total > 0;
      emit(won ? "game:won" : "game:lost", {
        won,
        saved: st.saved,
        total: st.total,
        dead: st.dead,
        score: st.score,
        elapsed: st.elapsed,
        levelIndex: st.levelIndex,
        levelId: st.levelId,
        levelTitle: st.levelTitle,
        levelAccuracy: st.levelAccuracy,
        hidden: st.hidden,
        acceptedVoiceClips: st.acceptedVoiceClips,
        requiredVoiceClips: st.requiredVoiceClips,
        rank: Game.rankFor(st.saved, st.total),
      });
    }
  }

  static rankFor(savedCount, total = DEFAULT_PATIENT_COUNT) {
    const full = Math.max(1, Number(total) || DEFAULT_PATIENT_COUNT);
    if (savedCount >= full) return "Leitender Notarzt";
    if (savedCount >= Math.ceil(full * 0.75)) return "Notarzt";
    if (savedCount >= Math.ceil(full * 0.5)) return "Rettungsassistent";
    return "Ausbildung empfohlen";
  }
}
