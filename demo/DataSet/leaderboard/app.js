const DATA_URL = "../leaderboard.json";
const REFRESH_MS = 60_000;

const SORTS = {
  score: { defaultDirection: "desc" },
  saved: { defaultDirection: "desc" },
  progress: { defaultDirection: "desc" },
  accuracy: { defaultDirection: "desc" },
  elapsed: { defaultDirection: "asc" },
  runs: { defaultDirection: "desc" },
  name: { defaultDirection: "asc" },
};

const VIEW_COPY = {
  players: {
    title: "Spieler-Bestenliste",
    noun: "Spieler",
    identity: "Spieler",
    score: "Punkte",
    progress: "Level",
    accuracy: "Genauigkeit",
    elapsed: "Zeit",
    podium: "Die besten drei Spieler",
    emptyTitle: "Noch kein Spielergebnis.",
    emptyCopy: "Sei die erste Person auf der öffentlichen MEDICRAFT-Bestenliste.",
  },
  teams: {
    title: "Team-Bestenliste",
    noun: "Teams",
    identity: "Team",
    score: "Bestwert",
    progress: "Bestes Level",
    accuracy: "Ø Genauigkeit",
    elapsed: "Ø Zeit",
    podium: "Die besten drei Teams",
    emptyTitle: "Noch kein Team-Ergebnis.",
    emptyCopy: "Spiele mit einem Teamnamen, um die Team-Rangliste zu füllen.",
  },
};

const state = {
  mode: "players",
  sort: "score",
  direction: "desc",
  rawEntries: [],
  payload: null,
};

const elements = {
  state: document.querySelector("#connection-state"),
  totalRuns: document.querySelector("#total-runs"),
  totalRunsLabel: document.querySelector("#total-runs-label"),
  totalSaved: document.querySelector("#total-saved"),
  totalSavedLabel: document.querySelector("#total-saved-label"),
  bestScore: document.querySelector("#best-score"),
  bestScoreLabel: document.querySelector("#best-score-label"),
  published: document.querySelector("#published-time"),
  boardTitle: document.querySelector("#board-title"),
  viewPlayers: document.querySelector("#view-players"),
  viewTeams: document.querySelector("#view-teams"),
  sort: document.querySelector("#sort-board"),
  direction: document.querySelector("#sort-direction"),
  identityHeading: document.querySelector("#identity-heading"),
  scoreHeading: document.querySelector("#score-heading"),
  progressHeading: document.querySelector("#progress-heading"),
  accuracyHeading: document.querySelector("#accuracy-heading"),
  elapsedHeading: document.querySelector("#elapsed-heading"),
  podium: document.querySelector("#podium"),
  body: document.querySelector("#leaderboard-body"),
  empty: document.querySelector("#empty-state"),
  emptyTitle: document.querySelector("#empty-title"),
  emptyCopy: document.querySelector("#empty-copy"),
  error: document.querySelector("#board-error"),
  refresh: document.querySelector("#refresh-board"),
};

const menuToggle = document.querySelector("#menu-toggle");
const mainNav = document.querySelector("#main-nav");

function closeMenu() {
  mainNav?.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");
}

menuToggle?.addEventListener("click", () => {
  const open = !mainNav?.classList.contains("open");
  mainNav?.classList.toggle("open", open);
  menuToggle.setAttribute("aria-expanded", String(open));
});

mainNav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const dateTime = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function cleanText(value, fallback = "—") {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return text || fallback;
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(numeric(seconds)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatRuns(count) {
  const value = number.format(count);
  return `${value} ${numeric(count) === 1 ? "Einsatz" : "Einsätze"}`;
}

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("de-DE");
}

function teamLabel(value) {
  const text = cleanText(value, "");
  return text && !["—", "-", "–", "none", "null"].includes(text.toLocaleLowerCase("de-DE"))
    ? text
    : "Ohne Team";
}

function normalizedEntries(payload) {
  const entries = Array.isArray(payload) ? payload : payload?.entries;
  if (!Array.isArray(entries)) throw new Error("Ungültiges Ranglistenformat");
  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      name: cleanText(entry.name, "Anonym"),
      crew: teamLabel(entry.crew),
      score: numeric(entry.score),
      saved: numeric(entry.saved),
      total: numeric(entry.total),
      levels: numeric(entry.levels ?? entry.levelsCleared),
      accuracy: numeric(entry.accuracy),
      elapsed: numeric(entry.elapsed),
      recordedAt: entry.recorded_at || entry.recordedAt || null,
    }));
}

function strongestRun(runs) {
  return [...runs].sort((a, b) =>
    b.score - a.score ||
    b.saved - a.saved ||
    b.accuracy - a.accuracy ||
    a.elapsed - b.elapsed
  )[0];
}

function aggregatePlayers(runs) {
  const groups = new Map();
  for (const run of runs) {
    const key = normalizeKey(run.name);
    if (!groups.has(key)) groups.set(key, { name: run.name, runs: [], teams: new Set() });
    const group = groups.get(key);
    group.runs.push(run);
    group.teams.add(run.crew);
  }

  return [...groups.values()].map((group) => {
    const best = strongestRun(group.runs);
    const teamNames = [...group.teams];
    return {
      kind: "player",
      name: group.name,
      secondary: teamNames.length > 1 ? `${teamNames.join(" · ")} · ${formatRuns(group.runs.length)}` : `${teamNames[0]}${group.runs.length > 1 ? ` · ${formatRuns(group.runs.length)}` : ""}`,
      score: best.score,
      saved: best.saved,
      total: best.total,
      progress: best.levels,
      accuracy: best.accuracy,
      elapsed: best.elapsed,
      runs: group.runs.length,
      recordedAt: best.recordedAt,
    };
  });
}

function aggregateTeams(runs) {
  const groups = new Map();
  for (const run of runs) {
    const key = normalizeKey(run.crew);
    if (!groups.has(key)) {
      groups.set(key, {
        name: run.crew,
        runs: 0,
        members: new Set(),
        score: 0,
        saved: 0,
        total: 0,
        progress: 0,
        accuracyWeighted: 0,
        accuracyWeight: 0,
        elapsed: 0,
      });
    }
    const group = groups.get(key);
    const accuracyWeight = run.total > 0 ? run.total : 1;
    group.runs += 1;
    group.members.add(run.name);
    group.score = Math.max(group.score, run.score);
    group.saved += run.saved;
    group.total += run.total;
    group.progress = Math.max(group.progress, run.levels);
    group.accuracyWeighted += run.accuracy * accuracyWeight;
    group.accuracyWeight += accuracyWeight;
    group.elapsed += run.elapsed;
  }

  return [...groups.values()].map((group) => {
    const members = [...group.members].sort((a, b) => a.localeCompare(b, "de-DE"));
    const memberSummary = members.length > 3
      ? `${members.slice(0, 3).join(", ")} + ${members.length - 3} weitere`
      : members.join(", ");
    return {
      kind: "team",
      name: group.name,
      secondary: `${memberSummary || "Anonym"} · ${formatRuns(group.runs)}`,
      score: group.score,
      saved: group.saved,
      total: group.total,
      progress: group.progress,
      accuracy: group.accuracyWeight ? group.accuracyWeighted / group.accuracyWeight : 0,
      elapsed: group.runs ? group.elapsed / group.runs : 0,
      runs: group.runs,
    };
  });
}

function valueForSort(entry) {
  return numeric(entry[state.sort]);
}

function sortedEntries(entries) {
  const direction = state.direction === "asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    if (state.sort === "name") {
      const nameResult = a.name.localeCompare(b.name, "de-DE", { sensitivity: "base" }) * direction;
      if (nameResult) return nameResult;
    }
    const primary = (valueForSort(a) - valueForSort(b)) * direction;
    if (primary) return primary;
    const scoreTie = b.score - a.score;
    if (scoreTie) return scoreTie;
    return a.name.localeCompare(b.name, "de-DE", { sensitivity: "base" });
  });
}

function entriesForCurrentView() {
  return state.mode === "teams"
    ? aggregateTeams(state.rawEntries)
    : aggregatePlayers(state.rawEntries);
}

function addText(parent, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function formatSaved(entry) {
  return `${number.format(entry.saved)}/${number.format(entry.total)}`;
}

function renderPodium(entries) {
  elements.podium.replaceChildren();
  for (const [index, entry] of entries.slice(0, 3).entries()) {
    const card = document.createElement("article");
    card.className = "podium-card";
    addText(card, "span", "podium-rank", `RANG ${String(index + 1).padStart(2, "0")}`);
    const identity = document.createElement("div");
    addText(identity, "div", "podium-name", entry.name);
    addText(identity, "div", "podium-crew", entry.secondary);
    card.appendChild(identity);
    const score = addText(card, "div", "podium-score", number.format(entry.score));
    addText(score, "small", "", " PUNKTE");
    elements.podium.appendChild(card);
  }
}

function renderTable(entries) {
  elements.body.replaceChildren();
  elements.empty.hidden = entries.length > 0;
  elements.body.closest("table").hidden = entries.length === 0;

  for (const [index, entry] of entries.entries()) {
    const row = document.createElement("tr");
    addText(row, "td", "rank-cell", `#${index + 1}`);
    const identity = document.createElement("td");
    identity.className = "player-cell";
    addText(identity, "strong", "", entry.name);
    addText(identity, "small", "", entry.secondary);
    row.appendChild(identity);
    addText(row, "td", "score-cell", number.format(entry.score));
    addText(row, "td", "", formatSaved(entry));
    addText(row, "td", "muted-cell", number.format(entry.progress));
    addText(row, "td", "muted-cell", `${number.format(entry.accuracy)} %`);
    addText(row, "td", "muted-cell", formatDuration(entry.elapsed));
    elements.body.appendChild(row);
  }
}

function syncSortOptions() {
  const progressOption = elements.sort?.querySelector('option[value="progress"]');
  const runsOption = elements.sort?.querySelector('option[value="runs"]');
  const nameOption = elements.sort?.querySelector('option[value="name"]');
  if (progressOption) progressOption.textContent = state.mode === "teams" ? "Bestes Level" : "Level";
  if (runsOption) runsOption.textContent = "Einsätze";
  if (nameOption) nameOption.textContent = state.mode === "teams" ? "Team (A–Z)" : "Spieler (A–Z)";
}

function syncControls() {
  const copy = VIEW_COPY[state.mode];
  elements.viewPlayers?.classList.toggle("active", state.mode === "players");
  elements.viewTeams?.classList.toggle("active", state.mode === "teams");
  elements.viewPlayers?.setAttribute("aria-selected", String(state.mode === "players"));
  elements.viewTeams?.setAttribute("aria-selected", String(state.mode === "teams"));
  elements.sort.value = state.sort;
  elements.direction.textContent = state.direction === "asc" ? "Aufsteigend ↑" : "Absteigend ↓";
  elements.direction.setAttribute("aria-pressed", String(state.direction === "asc"));
  elements.direction.setAttribute("aria-label", `${state.direction === "asc" ? "Aufsteigend" : "Absteigend"} sortiert. Klicken zum Umkehren.`);
  elements.boardTitle.textContent = copy.title;
  elements.totalRunsLabel.textContent = copy.noun;
  elements.totalSavedLabel.textContent = "Gerettet";
  elements.bestScoreLabel.textContent = "Bestwert";
  elements.identityHeading.textContent = copy.identity;
  elements.scoreHeading.textContent = copy.score;
  elements.progressHeading.textContent = copy.progress;
  elements.accuracyHeading.textContent = copy.accuracy;
  elements.elapsedHeading.textContent = copy.elapsed;
  elements.podium.setAttribute("aria-label", copy.podium);
  elements.emptyTitle.textContent = copy.emptyTitle;
  elements.emptyCopy.textContent = copy.emptyCopy;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.mode !== "players") params.set("view", state.mode);
  if (state.sort !== "score") params.set("sort", state.sort);
  if (state.direction !== SORTS[state.sort].defaultDirection) params.set("dir", state.direction);
  const query = params.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}`);
}

function renderCurrentView() {
  syncSortOptions();
  syncControls();
  const entries = sortedEntries(entriesForCurrentView());
  const totalSaved = entries.reduce((sum, entry) => sum + entry.saved, 0);
  const bestScore = entries.reduce((best, entry) => Math.max(best, entry.score), 0);
  elements.totalRuns.textContent = number.format(entries.length);
  elements.totalSaved.textContent = number.format(totalSaved);
  elements.bestScore.textContent = number.format(bestScore);
  renderPodium(entries);
  renderTable(entries);
  syncUrl();
}

function render(payload) {
  state.payload = payload;
  state.rawEntries = normalizedEntries(payload);
  elements.state.textContent = "ONLINE";
  elements.state.className = "connection";
  const publishedAt = !Array.isArray(payload) && payload?.published_at;
  if (publishedAt && !Number.isNaN(Date.parse(publishedAt))) {
    elements.published.textContent = `Veröffentlicht: ${dateTime.format(new Date(publishedAt))}`;
  } else {
    elements.published.textContent = "Öffentliche Server-Rangliste";
  }
  renderCurrentView();
}

async function loadBoard({ announce = false } = {}) {
  elements.refresh.disabled = true;
  elements.error.textContent = announce ? "Bestenliste wird aktualisiert …" : "";
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Serverantwort ${response.status}`);
    render(await response.json());
    elements.error.textContent = announce ? "Bestenliste ist aktuell." : "";
  } catch (error) {
    elements.state.textContent = "NICHT ERREICHBAR";
    elements.state.className = "connection error";
    elements.error.textContent = `Die öffentliche Bestenliste konnte nicht geladen werden. ${error.message}`;
  } finally {
    elements.refresh.disabled = false;
  }
}

function setMode(mode) {
  if (mode === state.mode) return;
  state.mode = mode;
  renderCurrentView();
}

elements.viewPlayers?.addEventListener("click", () => setMode("players"));
elements.viewTeams?.addEventListener("click", () => setMode("teams"));
elements.sort?.addEventListener("change", () => {
  state.sort = elements.sort.value in SORTS ? elements.sort.value : "score";
  state.direction = SORTS[state.sort].defaultDirection;
  renderCurrentView();
});
elements.direction?.addEventListener("click", () => {
  state.direction = state.direction === "asc" ? "desc" : "asc";
  renderCurrentView();
});
elements.refresh?.addEventListener("click", () => loadBoard({ announce: true }));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadBoard();
});

const params = new URLSearchParams(location.search);
if (params.get("view") === "teams") state.mode = "teams";
if (params.get("sort") in SORTS) state.sort = params.get("sort");
state.direction = SORTS[state.sort].defaultDirection;
if (["asc", "desc"].includes(params.get("dir"))) state.direction = params.get("dir");
syncSortOptions();
syncControls();
loadBoard();
setInterval(() => loadBoard(), REFRESH_MS);
