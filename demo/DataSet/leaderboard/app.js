const DATA_URL = "../leaderboard.json";
const REFRESH_MS = 60_000;

const elements = {
  state: document.querySelector("#connection-state"),
  totalRuns: document.querySelector("#total-runs"),
  totalSaved: document.querySelector("#total-saved"),
  bestScore: document.querySelector("#best-score"),
  published: document.querySelector("#published-time"),
  podium: document.querySelector("#podium"),
  body: document.querySelector("#leaderboard-body"),
  empty: document.querySelector("#empty-state"),
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

const number = new Intl.NumberFormat("de-DE");
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

function normalizedEntries(payload) {
  const entries = Array.isArray(payload) ? payload : payload?.entries;
  if (!Array.isArray(entries)) throw new Error("Ungültiges Ranglistenformat");
  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      name: cleanText(entry.name, "Anonym"),
      crew: cleanText(entry.crew),
      score: numeric(entry.score),
      saved: numeric(entry.saved),
      total: numeric(entry.total),
      levels: numeric(entry.levels ?? entry.levelsCleared),
      accuracy: numeric(entry.accuracy),
      elapsed: numeric(entry.elapsed),
      recordedAt: entry.recorded_at || entry.recordedAt || null,
    }))
    .sort((a, b) => b.score - a.score || a.elapsed - b.elapsed || b.accuracy - a.accuracy);
}

function addText(parent, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function renderPodium(entries) {
  elements.podium.replaceChildren();
  for (const [index, entry] of entries.slice(0, 3).entries()) {
    const card = document.createElement("article");
    card.className = "podium-card";
    addText(card, "span", "podium-rank", `RANG ${String(index + 1).padStart(2, "0")}`);
    const identity = document.createElement("div");
    addText(identity, "div", "podium-name", entry.name);
    addText(identity, "div", "podium-crew", entry.crew);
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
    const player = document.createElement("td");
    player.className = "player-cell";
    addText(player, "strong", "", entry.name);
    addText(player, "small", "", entry.crew);
    row.appendChild(player);
    addText(row, "td", "score-cell", number.format(entry.score));
    addText(row, "td", "", `${number.format(entry.saved)}/${number.format(entry.total)}`);
    addText(row, "td", "muted-cell", number.format(entry.levels));
    addText(row, "td", "muted-cell", `${number.format(entry.accuracy)} %`);
    addText(row, "td", "muted-cell", formatDuration(entry.elapsed));
    elements.body.appendChild(row);
  }
}

function render(payload) {
  const entries = normalizedEntries(payload);
  const totalSaved = entries.reduce((sum, entry) => sum + entry.saved, 0);
  elements.totalRuns.textContent = number.format(entries.length);
  elements.totalSaved.textContent = number.format(totalSaved);
  elements.bestScore.textContent = number.format(entries[0]?.score || 0);
  elements.state.textContent = "ONLINE";
  elements.state.className = "connection";

  const publishedAt = !Array.isArray(payload) && payload?.published_at;
  if (publishedAt && !Number.isNaN(Date.parse(publishedAt))) {
    elements.published.textContent = `Veröffentlicht: ${dateTime.format(new Date(publishedAt))}`;
  } else {
    elements.published.textContent = "Öffentliche Server-Rangliste";
  }
  renderPodium(entries);
  renderTable(entries);
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

elements.refresh.addEventListener("click", () => loadBoard({ announce: true }));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadBoard();
});

loadBoard();
setInterval(() => loadBoard(), REFRESH_MS);
