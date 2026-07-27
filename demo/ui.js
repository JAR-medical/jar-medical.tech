/* TriARge — Bedienoberfläche des Lagebilds.
 *
 * Alle Panels lesen den Zustand aus engine.js und schreiben über dessen
 * Funktionen zurück. Die Karte (map.js) ist das Hauptelement, die Leisten
 * links und rechts sowie der Bereich unten sind ihr zugeordnet.
 */

"use strict";

(function () {
  const S = TR.S;
  const KAT = TR.KAT;
  const $ = (id) => document.getElementById(id);
  const esc = TR.esc;
  // Messwerte werden immer als ganze Zahl angezeigt.
  const zahl = (v) => (v == null ? "—" : String(Math.round(v)));

  let dockTab = "patienten";
  let patSort = { spalte: "kat", ab: false };
  let syncAn = false;

  /* --------------------------------------------------------- Seitenleisten
   * Beide Leisten lassen sich in der Breite ziehen und ganz einklappen. Der
   * Zustand wird lokal gespeichert, damit er beim nächsten Aufruf wieder steht. */

  const LEISTEN = {
    l: { rail: "rail-l", griff: "griff-l", eigenschaft: "--rail-l", standard: 274 },
    r: { rail: "rail-r", griff: "griff-r", eigenschaft: "--rail-r", standard: 330 },
  };
  const LEISTE_MIN = 190, LEISTE_MAX = 560, LEISTE_ZU = 28;
  let leisten = { l: { breite: 274, zu: false }, r: { breite: 330, zu: false } };

  function leistenLaden() {
    try {
      const j = JSON.parse(localStorage.getItem("triarge.leisten") || "null");
      if (j && j.l && j.r) {
        for (const s of ["l", "r"]) {
          leisten[s] = {
            breite: Math.max(LEISTE_MIN, Math.min(LEISTE_MAX, +j[s].breite || LEISTEN[s].standard)),
            zu: !!j[s].zu,
          };
        }
        return;
      }
    } catch (e) { /* kein gespeicherter Zustand */ }
    // Ohne gespeicherte Vorgabe starten schmale Fenster (Tablet) mit
    // eingeklappten Leisten, damit die Karte die volle Breite bekommt.
    if (window.innerWidth < 1200) {
      leisten.l.zu = true;
      leisten.r.zu = true;
    }
  }

  function leistenSpeichern() {
    try { localStorage.setItem("triarge.leisten", JSON.stringify(leisten)); } catch (e) { /* egal */ }
  }

  function leisteAnwenden(seite) {
    const cfg = LEISTEN[seite], z = leisten[seite];
    const rail = $(cfg.rail), griff = $(cfg.griff);
    rail.classList.toggle("zu", z.zu);
    griff.classList.toggle("gesperrt", z.zu);
    $("app").style.setProperty(cfg.eigenschaft, (z.zu ? LEISTE_ZU : z.breite) + "px");
    const btn = rail.querySelector(".rail-btn");
    const einwaerts = seite === "l" ? "‹" : "›";
    const auswaerts = seite === "l" ? "›" : "‹";
    btn.textContent = z.zu ? auswaerts : einwaerts;
    btn.title = z.zu ? "Leiste ausklappen" : "Leiste einklappen";
    rail.setAttribute("aria-expanded", String(!z.zu));
    // Hinweis: KARTE ist ein `const` auf oberster Ebene und liegt damit nicht
    // am window-Objekt — hier also nicht über `window.KARTE` prüfen.
    if (typeof KARTE !== "undefined" && KARTE.karte()) {
      KARTE.karte().invalidateSize({ animate: false });
    }
  }

  /* Jeder Abschnitt in den Leisten lässt sich einzeln zuklappen. Auf einem
   * Tablet ist das der wichtigste Platzgewinn: man behält nur das offen, was
   * gerade gebraucht wird, und muss in der Leiste nicht mehr scrollen. */
  let zugeklappt = new Set();

  function abschnitteLaden() {
    try {
      const j = JSON.parse(localStorage.getItem("triarge.blocks") || "null");
      if (Array.isArray(j)) zugeklappt = new Set(j);
      else if (window.matchMedia("(max-width: 1200px)").matches) {
        // Kleine Fenster starten kompakt: nur Lage und Auswahl offen.
        zugeklappt = new Set(["ebenen", "raster", "filter", "abschnitte", "mittel", "funk"]);
      }
    } catch (e) { /* kein gespeicherter Zustand */ }
  }

  function abschnitteVerdrahten() {
    abschnitteLaden();
    for (const sec of document.querySelectorAll("[data-blk]")) {
      const name = sec.dataset.blk;
      const h2 = sec.querySelector("h2");
      const pfeil = document.createElement("span");
      pfeil.className = "blk-pfeil";
      h2.insertBefore(pfeil, h2.firstChild);
      h2.setAttribute("role", "button");
      h2.tabIndex = 0;
      const umschalten = () => {
        if (zugeklappt.has(name)) zugeklappt.delete(name);
        else zugeklappt.add(name);
        abschnittAnwenden(sec);
        try { localStorage.setItem("triarge.blocks", JSON.stringify([...zugeklappt])); } catch (e) { /* egal */ }
      };
      h2.addEventListener("click", (e) => {
        if (e.target.closest("button.mini")) return;   // Schaltflächen in der Überschrift
        umschalten();
      });
      h2.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); umschalten(); }
      });
      abschnittAnwenden(sec);
    }
  }

  function abschnittAnwenden(sec) {
    const zu = zugeklappt.has(sec.dataset.blk);
    sec.classList.toggle("zu", zu);
    sec.querySelector("h2").setAttribute("aria-expanded", String(!zu));
  }

  function leisteUmschalten(seite) {
    leisten[seite].zu = !leisten[seite].zu;
    leisteAnwenden(seite);
    leistenSpeichern();
  }

  function leisteBreite(seite, px) {
    leisten[seite].breite = Math.max(LEISTE_MIN, Math.min(LEISTE_MAX, Math.round(px)));
    if (leisten[seite].zu) leisten[seite].zu = false;
    leisteAnwenden(seite);
  }

  function leistenVerdrahten() {
    leistenLaden();
    for (const seite of ["l", "r"]) {
      leisteAnwenden(seite);
      const griff = $(LEISTEN[seite].griff);
      griff.addEventListener("pointerdown", (e) => {
        if (leisten[seite].zu || e.button !== 0) return;
        e.preventDefault();
        try { griff.setPointerCapture(e.pointerId); } catch (err) { /* ohne Capture weiterziehen */ }
        griff.classList.add("aktiv");
        const startX = e.clientX, startBreite = leisten[seite].breite;
        const ziehen = (ev) => {
          const d = seite === "l" ? ev.clientX - startX : startX - ev.clientX;
          leisteBreite(seite, startBreite + d);
        };
        const loslassen = () => {
          griff.classList.remove("aktiv");
          griff.removeEventListener("pointermove", ziehen);
          griff.removeEventListener("pointerup", loslassen);
          griff.removeEventListener("pointercancel", loslassen);
          leistenSpeichern();
        };
        griff.addEventListener("pointermove", ziehen);
        griff.addEventListener("pointerup", loslassen);
        griff.addEventListener("pointercancel", loslassen);
      });
      griff.addEventListener("dblclick", () => leisteUmschalten(seite));
    }
    for (const btn of document.querySelectorAll(".rail-btn")) {
      btn.onclick = () => leisteUmschalten(btn.dataset.rail);
    }
  }

  /* ------------------------------------------------------------------ Start */

  function start() {
    TR.init(window.SZENARIEN[0]);
    KARTE.init("map");

    kopfzeileAufbauen();
    ebenenAufbauen();
    filterAufbauen();
    legendeAufbauen();
    bedienungVerdrahten();
    leistenVerdrahten();
    abschnitteVerdrahten();
    dockVerdrahten();

    TR.on("patienten", () => {
      kennzahlen();
      abschnittListe();
      if (dockTab === "patienten") dockZeichnen();
      inspektorZeichnen();
    });
    TR.on("mittel", () => { mittelListe(); inspektorZeichnen(); });
    TR.on("gefahren", () => { if (dockTab === "gefahren") dockZeichnen(); inspektorZeichnen(); });
    TR.on("warnungen", warnungenZeichnen);
    TR.on("funk", funkZeichnen);
    TR.on("ereignisse", () => { if (dockTab === "ereignisse") dockZeichnen(); });
    TR.on("transporte", () => { if (dockTab === "transport") dockZeichnen(); });
    TR.on("auswahl", inspektorZeichnen);
    TR.on("sitzungen", sitzungenZeichnen);
    TR.on("steuerung", steuerungZeichnen);
    TR.on("abschnitte", () => { abschnittListe(); inspektorZeichnen(); });
    TR.on("szenario", () => { rasterFelderZeigen(); zellgroesse(); demoHinweis(); steuerungZeichnen(); });
    TR.on("neustart", () => {
      syncAn = false;
      kopfzeileAufbauen();
      abschnittListe();
      mittelListe();
      warnungenZeichnen();
      funkZeichnen();
      dockZeichnen();
      inspektorZeichnen();
    });

    abschnittListe();
    mittelListe();
    warnungenZeichnen();
    funkZeichnen();
    dockZeichnen();
    inspektorZeichnen();
    steuerungZeichnen();
    rasterFelderZeigen();
    zellgroesse();
    demoHinweis();

    requestAnimationFrame(schleife);
    setInterval(uhrZeichnen, 500);
    setInterval(() => { if (dockTab === "lagemeldung") dockZeichnen(); }, 5000);
  }

  function schleife(t) {
    TR.takt(t);
    uhrZeichnen();
    requestAnimationFrame(schleife);
  }

  /* -------------------------------------------------------------- Kopfzeile */

  function kopfzeileAufbauen() {
    $("tb-titel").textContent = S.einsatz.name;
    lagewahlZeichnen();
    sitzungenZeichnen();
    lageZeichnen();
    kennzahlen();
  }

  /* Auswahl der Übungslage. Ein Wechsel baut das gesamte Lagebild neu auf —
   * anderes Gebiet, anderes Raster, andere Einsatzstellen. */
  function lagewahlZeichnen() {
    const aktiv = TR.aktivesSzenario();
    $("lage-wahl").innerHTML = TR.szenarien()
      .map((sz) => `<option value="${esc(sz.id)}"${aktiv && sz.id === aktiv.id ? " selected" : ""}>${esc(sz.kurz)}</option>`)
      .join("");
  }

  function sitzungenZeichnen() {
    $("sitzung").innerHTML = S.sitzungen
      .map((s) => `<option${s.aktiv ? " selected" : ""}>${esc(s.name)}</option>`)
      .join("");
  }

  function uhrZeichnen() {
    $("uhr").textContent = TR.uhr(S.simSek);
    $("einsatzzeit").textContent = TR.zeit(S.simSek);
    $("zt-info").textContent = "Einsatzzeit " + TR.zeit(S.simSek) + (S.pause ? " · angehalten" : "");
    if (!syncAn && S.simSek > 90) {
      syncAn = true;
      const p = $("pill-sync");
      p.textContent = "Cloud-Sync aktiv";
      p.className = "pill ok";
      TR.funken("Fernmelder ELW 2", "Netzabdeckung stabil — Hybrid-Sync aktiv, Lagebild wird repliziert.");
    }
  }

  function lageZeichnen() {
    const e = S.einsatz;
    $("lage").innerHTML = [
      ["Stichwort", e.stichwort],
      ["Einsatzort", e.ort],
      ["Alarmierung", e.alarmiert + " Uhr"],
      ["Betroffene", e.betroffene],
      ["Einsatzleitung", "ÖEL " + e.oel],
      ["LNA / OrgL", e.lna + " / " + e.orgl],
      ["Wetter", e.wetter],
    ].map(([k, v]) => `<span class="k">${esc(k)}</span><span class="v">${esc(v)}</span>`).join("");
  }

  function kennzahlen() {
    const kz = TR.kennzahlen();
    $("zaehler").innerHTML = ["SK1", "SK2", "SK3", "SK4", "TOT", "UNG"]
      .filter((k) => kz.kat[k])
      .map((k) => `<span class="z z-${k}" title="${esc(KAT[k].label)}">${kz.kat[k]}</span>`)
      .join("");

    const felder = [
      ["Betroffene erfasst", kz.gesamt, ""],
      ["gesichtet", kz.gesichtet + " / " + kz.gesamt, kz.kat.UNG ? "warn" : ""],
      ["in Patientenablage", kz.inPA, ""],
      ["im Behandlungsplatz", kz.imBHP, ""],
      ["abtransportiert", kz.transportiert, ""],
      ["noch am Schadensort", kz.offen, kz.offen > 6 ? "warn" : ""],
      ["Ø Sichtungsdauer", kz.sichtSchnitt ? TR.zeit(kz.sichtSchnitt) : "—", ""],
      ["RTW frei", kz.freieRTW + " / " + kz.rtwGesamt, kz.freieRTW === 0 ? "krit" : ""],
      ["offene Warnungen", kz.offeneWarnungen, kz.offeneWarnungen ? "krit" : ""],
    ];
    $("kpibar").innerHTML = felder
      .map(([k, v, c]) => `<span class="kpi ${c}"><i>${esc(k)}</i><b>${esc(v)}</b></span>`)
      .join("");
    $("warn-anz").textContent = kz.offeneWarnungen;
  }

  /* ------------------------------------------------------------ Linke Leiste */

  const EBENEN = [
    ["raster", "Einsatzraster"],
    ["belegung", "Rasterauslastung (Patientendichte)"],
    ["abschnitte", "Einsatzabschnitte"],
    ["gefahren", "Gefahrenlage"],
    ["sperren", "Sperrungen / Bahnstrecke"],
    ["patienten", "Patienten"],
    ["mittel", "Einsatzmittel"],
    ["spuren", "Fahr- und Laufwege"],
    ["wege", "Wegenetz (OSM)"],
    ["poi", "Ortskenntnis"],
    ["beschriftung", "Beschriftungen"],
  ];

  function ebenenAufbauen() {
    $("ebenen").innerHTML = EBENEN.map(([k, t]) =>
      `<label class="check"><input type="checkbox" data-ebene="${k}"${S.ebenen[k] ? " checked" : ""}> ${esc(t)}</label>`
    ).join("");
    $("ebenen").onchange = (e) => {
      const k = e.target.dataset.ebene;
      if (!k) return;
      S.ebenen[k] = e.target.checked;
      KARTE.ebenenAnwenden();
    };
  }

  function filterAufbauen() {
    $("kat-chips").innerHTML = Object.keys(KAT)
      .map((k) => `<button class="chip c-${k}" data-kat="${k}" type="button">${esc(KAT[k].label)}</button>`)
      .join("");
    $("kat-chips").onclick = (e) => {
      const k = e.target.dataset && e.target.dataset.kat;
      if (!k) return;
      if (S.filter.kats.has(k)) S.filter.kats.delete(k);
      else S.filter.kats.add(k);
      filterAnwenden();
    };
    $("suche").oninput = () => { S.filter.text = $("suche").value.trim(); filterAnwenden(); };
    $("nur-offen").onchange = () => { S.filter.nurOffen = $("nur-offen").checked; filterAnwenden(); };
    $("filter-weg").onclick = () => {
      S.filter.kats.clear();
      S.filter.text = "";
      S.filter.zelle = null;
      S.filter.nurOffen = false;
      $("suche").value = "";
      $("nur-offen").checked = false;
      filterAnwenden();
    };
  }

  function filterAnwenden() {
    for (const b of $("kat-chips").querySelectorAll(".chip")) {
      b.classList.toggle("an", S.filter.kats.has(b.dataset.kat));
    }
    const teile = [];
    if (S.filter.kats.size) teile.push([...S.filter.kats].map((k) => KAT[k].label).join(", "));
    if (S.filter.zelle) teile.push("Raster " + S.filter.zelle);
    if (S.filter.text) teile.push('Suche „' + S.filter.text + '"');
    if (S.filter.nurOffen) teile.push("nur offene");
    $("filter-info").textContent = teile.length ? teile.join(" · ") : "kein Filter aktiv";
    KARTE.patientenZeichnen();
    dockZeichnen();
  }

  function abschnittListe() {
    const el = $("abschnitt-liste");
    const zahl = new Map();
    for (const p of S.patienten.values()) {
      if (!p.abschnitt) continue;
      zahl.set(p.abschnitt, (zahl.get(p.abschnitt) || 0) + 1);
    }
    el.innerHTML = [...S.abschnitte.values()].map((a) => {
      const n = zahl.get(a.id) || 0;
      const kap = a.kapazitaet ? ` <span class="kap">${n}/${a.kapazitaet}</span>` : n ? ` <span class="kap">${n}</span>` : "";
      return `<button class="zl art-${a.art}" data-abschnitt="${a.id}" type="button">
        <b>${esc(a.kurz)}</b><span>${esc(a.name)}</span>${kap}</button>`;
    }).join("");
    el.onclick = (e) => {
      const b = e.target.closest("[data-abschnitt]");
      if (b) TR.auswaehlen({ typ: "abschnitt", id: b.dataset.abschnitt });
    };
  }

  const ART_TEXT = {
    trupp: "Trupp", rtw: "RTW", nef: "NEF", rth: "RTH", arzt: "Arzt",
    loesch: "Feuerwehr", polizei: "Polizei", fuehrung: "Führung", drohne: "Drohne",
  };

  function mittelListe() {
    const el = $("mittel-liste");
    const gruppen = new Map();
    for (const m of S.mittel.values()) {
      const g = ART_TEXT[m.art] || "Sonstige";
      (gruppen.get(g) || gruppen.set(g, []).get(g)).push(m);
    }
    let html = "";
    for (const [g, liste] of gruppen) {
      html += `<div class="gruppe">${esc(g)}</div>`;
      for (const m of liste) {
        const frei = m.status === "frei" || m.status === "bereit" || m.status.startsWith("am Boden");
        html += `<button class="zl mittel${frei ? " frei" : " gebunden"}" data-mittel="${m.id}" type="button">
          <b>${esc(m.kurz)}</b><span>${esc(m.name)}</span>
          <span class="st">${esc(m.status)}</span></button>`;
      }
    }
    el.innerHTML = html;
    el.onclick = (e) => {
      const b = e.target.closest("[data-mittel]");
      if (b) TR.auswaehlen({ typ: "mittel", id: b.dataset.mittel });
    };
  }

  /* Die Rastereingaben gehören zur Lage: beim Wechsel stehen dort sonst noch
   * die Felderzahlen der vorherigen. */
  function rasterFelderZeigen() {
    $("raster-spalten").value = S.raster.spalten;
    $("raster-zeilen").value = S.raster.zeilen;
  }

  function demoHinweis() {
    const el = $("db-tag");
    if (!el) return;
    const ort = (S.einsatz.ort || "").split(",").pop().trim();
    el.textContent = "Simulierte Übungslage" + (ort ? " " + ort : "") +
      " · keine echten Personendaten · Karte © OpenStreetMap-Mitwirkende";
  }

  function zellgroesse() {
    const b = S.bbox;
    const br = TR.dist([b[0], b[1]], [b[0], b[3]]) / S.raster.spalten;
    const ho = TR.dist([b[0], b[1]], [b[2], b[1]]) / S.raster.zeilen;
    $("zellgroesse").textContent = "≈ " + Math.round(br) + " × " + Math.round(ho) + " m je Feld";
  }

  /* ------------------------------------------------------------- Legende */

  function legendeAufbauen() {
    const kats = Object.entries(KAT)
      .map(([k, m]) => `<span class="lg"><i class="pkt k-${k}"></i>${esc(m.label)}</span>`).join("");
    $("legende-inhalt").innerHTML =
      `<div class="lg-zeile">${kats}</div>` +
      `<div class="lg-zeile">
         <span class="lg"><i class="bx u-trupp"></i>Trupp</span>
         <span class="lg"><i class="bx u-rtw"></i>RTW</span>
         <span class="lg"><i class="bx u-nef"></i>NEF/Arzt</span>
         <span class="lg"><i class="bx u-rth"></i>RTH</span>
         <span class="lg"><i class="bx u-loesch"></i>Feuerwehr</span>
         <span class="lg"><i class="bx u-polizei"></i>Polizei</span>
         <span class="lg"><i class="rt"></i>Gefahrenstelle</span>
         <span class="lg"><i class="sp"></i>Straßensperre</span>
       </div>`;

    // Standardmäßig eingeklappt — die Legende soll die Karte nicht zustellen.
    let offen = false;
    try { offen = localStorage.getItem("triarge.legende") === "offen"; } catch (e) { /* egal */ }
    const anwenden = () => {
      $("legende").classList.toggle("zu", !offen);
      $("legende-schalter").title = offen ? "Legende einklappen" : "Legende ausklappen";
    };
    $("legende-schalter").onclick = () => {
      offen = !offen;
      anwenden();
      try { localStorage.setItem("triarge.legende", offen ? "offen" : "zu"); } catch (e) { /* egal */ }
    };
    anwenden();
  }

  /* ------------------------------------------------------------- Inspektor */

  function inspektorZeichnen() {
    const el = $("inspektor");
    const sel = S.auswahl;
    if (!sel) { el.innerHTML = inspektorLeer(); verdrahteInspektor(el); return; }
    if (sel.typ === "patient") el.innerHTML = inspPatient(S.patienten.get(sel.id), sel.id);
    else if (sel.typ === "mittel") el.innerHTML = inspMittel(S.mittel.get(sel.id));
    else if (sel.typ === "abschnitt") el.innerHTML = inspAbschnitt(S.abschnitte.get(sel.id));
    else if (sel.typ === "gefahr") el.innerHTML = inspGefahr(S.gefahren.get(sel.id));
    else if (sel.typ === "sperre") el.innerHTML = inspSperre(S.sperren.find((s) => s.id === sel.id));
    else if (sel.typ === "zelle") el.innerHTML = inspZelle(sel.id);
    else el.innerHTML = inspektorLeer();
    verdrahteInspektor(el);
  }

  function inspektorLeer() {
    const kz = TR.kennzahlen();
    return `<div class="insp-leer">
      <p>Kein Objekt ausgewählt. Auf der Karte ein Patientensymbol, ein Einsatzmittel,
         einen Einsatzabschnitt, eine Gefahrenstelle oder ein Rasterfeld anklicken.</p>
      <div class="dg">
        <span class="k">Erfasste Betroffene</span><span class="v">${kz.gesamt}</span>
        <span class="k">davon gesichtet</span><span class="v">${kz.gesichtet}</span>
        <span class="k">SK I / SK II</span><span class="v">${kz.kat.SK1} / ${kz.kat.SK2}</span>
        <span class="k">abtransportiert</span><span class="v">${kz.transportiert}</span>
      </div>
      <p class="hinweis">Tasten: <b>Leertaste</b> Pause · <b>1–4</b> Tempo · <b>M</b> Messen ·
         <b>G</b> Raster · <b>[</b> / <b>]</b> Seitenleisten · <b>Esc</b> Auswahl aufheben</p>
      <p class="hinweis">Die Seitenleisten lassen sich am Trennsteg breiter ziehen; ein Doppelklick
         darauf oder die Schaltfläche in der Leistenüberschrift klappt sie ganz ein.</p>
    </div>`;
  }

  function inspPatient(p, id) {
    if (!p) return `<div class="insp-leer"><p>Patient #${id} ist nicht mehr im Lagebild.</p></div>`;
    const v = p.vit || {};
    const katBtns = ["SK1", "SK2", "SK3", "SK4", "TOT"]
      .map((k) => `<button class="katb b-${k}${p.kat === k ? " an" : ""}" data-setkat="${k}" type="button">${esc(KAT[k].label)}</button>`)
      .join("");
    const proto = [...p.proto].reverse().map((e) =>
      `<div class="pe"><div class="pe-m">${TR.uhr(e.t)} · ${esc(e.quelle)}${e.autor ? " · " + esc(e.autor) : ""}</div>
       <div>${esc(e.text)}</div></div>`).join("");
    const klinik = p.klinik ? (S.kliniken.find((k) => k.id === p.klinik) || {}).name : null;
    const zuweisung = p.zustand === "BHP" && p.transportBereit
      ? `<div class="insp-akt"><label class="lbl">Zielklinik</label>
         <select id="klinik-wahl" class="sel-klein">
           <option value="">automatisch (nach Kapazität)</option>
           ${S.kliniken.map((k) => `<option value="${k.id}"${p.wunschKlinik === k.id ? " selected" : ""}>${esc(k.name)} — ${k.minuten} min, frei ${k.frei[p.kat] ?? 0}</option>`).join("")}
         </select></div>` : "";

    return `<div class="insp">
      <div class="insp-kopf">
        <h3>Patient #${p.id}</h3>
        <span class="kat-tag k-${p.kat}">${esc(KAT[p.kat].label)}</span>
      </div>
      <div class="katzeile">${katBtns}</div>
      <div class="dg">
        <span class="k">Zustand</span><span class="v">${esc(TR.STATUS_TEXT[p.zustand] || p.zustand)}</span>
        <span class="k">Einsatzabschnitt</span><span class="v">${p.abschnitt ? esc((S.abschnitte.get(p.abschnitt) || {}).name || "") : "—"}</span>
        <span class="k">Rasterfeld</span><span class="v mono">${esc(TR.patientZelle(p))}${p.ll ? "" : " (zuletzt)"}</span>
        <span class="k">Koordinate</span><span class="v mono">${p.ll ? p.ll[0].toFixed(5) + ", " + p.ll[1].toFixed(5) : "—"}</span>
        <span class="k">Atemfrequenz</span><span class="v">${zahl(v.af)} /min</span>
        <span class="k">Puls</span><span class="v">${zahl(v.puls)} /min</span>
        <span class="k">SpO₂</span><span class="v${v.spo2 != null && v.spo2 < 90 ? " krit" : ""}">${v.spo2 != null ? Math.round(v.spo2) + " %" : "—"}</span>
        <span class="k">Blutdruck</span><span class="v">${v.rrs != null ? Math.round(v.rrs) + (v.rrd != null ? "/" + Math.round(v.rrd) : "") + " mmHg" : "—"}</span>
        <span class="k">GCS</span><span class="v">${zahl(v.gcs)}</span>
        <span class="k">Geschlecht / Alter</span><span class="v">${p.sex === "m" ? "männlich" : p.sex === "w" ? "weiblich" : "—"} / ${p.alter != null ? "ca. " + p.alter + " J." : "—"}</span>
        <span class="k">gehfähig</span><span class="v">${p.geh ? "ja" : "nein"}</span>
        <span class="k">ansprechbar</span><span class="v">${p.wach ? "ja" : "nein"}</span>
        <span class="k">Atemweg frei</span><span class="v">${p.atemweg ? "ja" : "nein"}</span>
        <span class="k">Verletzungen</span><span class="v">${(p.verletzt || []).map(esc).join(", ") || "—"}</span>
        <span class="k">Maßnahmen</span><span class="v">${(p.massnahmen || []).map(esc).join(", ") || "—"}</span>
        <span class="k">zuletzt gesehen</span><span class="v">${p.gesehen ? esc(p.gesehen.von) + ", " + TR.uhr(p.gesehen.t) : "—"}</span>
        <span class="k">letzte Kontrolle</span><span class="v">${TR.zeit(S.simSek - p.letzteKontrolle)} her</span>
        ${klinik ? `<span class="k">Zielklinik</span><span class="v">${esc(klinik)}</span>` : ""}
      </div>
      ${zuweisung}
      <div class="insp-akt">
        <button class="btn-klein" data-zeigen="1" type="button">Auf Karte zentrieren</button>
        <button class="btn-klein gefahr" data-loeschen="1" type="button">Patient löschen</button>
      </div>
      <h4>Protokoll (${p.proto.length})</h4>
      <div class="proto">${proto || '<p class="hinweis">Keine Einträge.</p>'}</div>
    </div>`;
  }

  function inspMittel(m) {
    if (!m) return inspektorLeer();
    const p = m.patient != null ? S.patienten.get(m.patient) : null;
    return `<div class="insp">
      <div class="insp-kopf"><h3>${esc(m.name)}</h3><span class="kat-tag">${esc(ART_TEXT[m.art] || m.art)}</span></div>
      <div class="dg">
        <span class="k">Rolle</span><span class="v">${esc(m.rolle)}</span>
        <span class="k">Status</span><span class="v">${esc(m.status)}</span>
        <span class="k">Stammabschnitt</span><span class="v">${esc((S.abschnitte.get(m.basis) || {}).name || m.basis)}</span>
        <span class="k">Besatzung</span><span class="v">${m.besatzung}</span>
        <span class="k">Position</span><span class="v mono">${m.ll[0].toFixed(5)}, ${m.ll[1].toFixed(5)}</span>
        <span class="k">Rasterfeld</span><span class="v mono">${TR.zelle(m.ll)}</span>
        <span class="k">Patient an Bord</span><span class="v">${p ? "#" + p.id + " — " + esc(KAT[p.kat].label) : "—"}</span>
        <span class="k">zurückgelegt</span><span class="v">${(m.gefahren / 1000).toFixed(2)} km</span>
        <span class="k">letzte Meldung</span><span class="v">${TR.zeit(S.simSek - m.letzterKontakt)} her</span>
      </div>
      <div class="insp-akt">
        <button class="btn-klein" data-folgen="${m.id}" type="button">${S.verfolgt === m.id ? "Verfolgung beenden" : "Verfolgen"}</button>
        <button class="btn-klein" data-zeigen="1" type="button">Auf Karte zentrieren</button>
        <button class="btn-klein gefahr" data-mittel-weg="${m.id}" type="button">Abmelden</button>
      </div>
    </div>`;
  }

  function inspAbschnitt(a) {
    if (!a) return inspektorLeer();
    const pats = [...S.patienten.values()].filter((p) => p.abschnitt === a.id);
    const zaehl = {};
    for (const p of pats) zaehl[p.kat] = (zaehl[p.kat] || 0) + 1;
    const mittel = [...S.mittel.values()].filter((m) => m.basis === a.id);
    return `<div class="insp">
      <div class="insp-kopf"><h3>${esc(a.name)}</h3><span class="kat-tag">${esc(a.kurz)}</span></div>
      <div class="dg">
        <span class="k">Abschnittsleitung</span><span class="v">${esc(a.leitung)}</span>
        <span class="k">Auftrag</span><span class="v">${esc(a.info)}</span>
        <span class="k">Belegung</span><span class="v">${pats.length}${a.kapazitaet ? " / " + a.kapazitaet + " Plätze" : ""}</span>
        <span class="k">Zusammensetzung</span><span class="v">${Object.keys(zaehl).length
          ? Object.entries(zaehl).map(([k, n]) => n + "× " + KAT[k].label).join(", ") : "—"}</span>
        <span class="k">Stammmittel</span><span class="v">${mittel.length ? mittel.map((m) => esc(m.name)).join(", ") : "—"}</span>
        <span class="k">Koordinate</span><span class="v mono">${a.ll[0].toFixed(5)}, ${a.ll[1].toFixed(5)}</span>
        <span class="k">Rasterfeld</span><span class="v mono">${TR.zelle(a.ll)}</span>
        <span class="k">Radius</span><span class="v">${a.r} m</span>
      </div>
      <div class="insp-akt"><button class="btn-klein" data-zeigen="1" type="button">Auf Karte zentrieren</button></div>
      ${pats.length ? `<h4>Patienten im Abschnitt</h4><div class="minitab">${pats
        .sort((x, y) => KAT[x.kat].ord - KAT[y.kat].ord)
        .map((p) => `<button class="mz" data-patient="${p.id}" type="button">
          <i class="pkt k-${p.kat}"></i>#${p.id}<span>${esc(KAT[p.kat].label)}</span></button>`).join("")}</div>` : ""}
    </div>`;
  }

  function inspGefahr(g) {
    if (!g) return inspektorLeer();
    const stufe = g.stufe === 3 ? "kritisch" : g.stufe === 2 ? "erhöht" : "gering";
    return `<div class="insp">
      <div class="insp-kopf"><h3>${esc(g.name)}</h3><span class="kat-tag s-${g.stufe}">${esc(stufe)}</span></div>
      <div class="dg">
        <span class="k">Kennung</span><span class="v mono">${esc(g.code)}</span>
        <span class="k">Status</span><span class="v">${esc(g.status)}</span>
        <span class="k">Zuständig</span><span class="v">${esc(g.verantwortlich)}</span>
        <span class="k">erkannt</span><span class="v">${TR.uhr(g.erkanntT)} Uhr</span>
        ${g.r ? `<span class="k">Wirkbereich</span><span class="v">${Math.round(g.r)} m Radius</span>` : ""}
        ${g.messwert ? `<span class="k">${esc(g.messwert.label)}</span><span class="v${g.messwert.wert > g.messwert.warn ? " krit" : ""}">${g.messwert.wert.toFixed(1)} ${esc(g.messwert.einheit)} (Warnschwelle ${g.messwert.warn})</span>` : ""}
        ${g.wind ? `<span class="k">Wind</span><span class="v">${Math.round(g.wind.grad)}° / ${Math.round(g.wind.kmh)} km/h</span>` : ""}
        <span class="k">Rasterfeld</span><span class="v mono">${TR.zelle(g.ll)}</span>
      </div>
      <p class="fliess">${esc(g.info)}</p>
      <div class="insp-akt"><button class="btn-klein" data-zeigen="1" type="button">Auf Karte zentrieren</button></div>
    </div>`;
  }

  function inspSperre(s) {
    if (!s) return inspektorLeer();
    return `<div class="insp">
      <div class="insp-kopf"><h3>Straßensperre</h3><span class="kat-tag">${esc(s.id)}</span></div>
      <div class="dg">
        <span class="k">Ort</span><span class="v">${esc(s.name)}</span>
        <span class="k">Besetzt durch</span><span class="v">${esc(s.von)}</span>
        <span class="k">Koordinate</span><span class="v mono">${s.ll[0].toFixed(5)}, ${s.ll[1].toFixed(5)}</span>
        <span class="k">Rasterfeld</span><span class="v mono">${TR.zelle(s.ll)}</span>
      </div>
      <div class="insp-akt"><button class="btn-klein" data-zeigen="1" type="button">Auf Karte zentrieren</button></div>
    </div>`;
  }

  function inspZelle(ref) {
    const pats = [...S.patienten.values()].filter((p) => p.ll && TR.zelle(p.ll) === ref);
    const mittel = [...S.mittel.values()].filter((m) => TR.zelle(m.ll) === ref);
    const gef = [...S.gefahren.values()].filter((g) => g.aktiv && TR.zelle(g.ll) === ref);
    return `<div class="insp">
      <div class="insp-kopf"><h3>Rasterfeld ${esc(ref)}</h3><span class="kat-tag">Einsatzraster</span></div>
      <div class="dg">
        <span class="k">Patienten</span><span class="v">${pats.length}</span>
        <span class="k">Einsatzmittel</span><span class="v">${mittel.length}</span>
        <span class="k">Gefahrenstellen</span><span class="v">${gef.length}</span>
      </div>
      <div class="insp-akt">
        <button class="btn-klein" data-zeigen="1" type="button">Auf Karte zentrieren</button>
        <button class="btn-klein" data-zellfilter="${esc(ref)}" type="button">Nur dieses Feld anzeigen</button>
      </div>
      ${pats.length ? `<h4>Patienten</h4><div class="minitab">${pats.map((p) =>
        `<button class="mz" data-patient="${p.id}" type="button"><i class="pkt k-${p.kat}"></i>#${p.id}
         <span>${esc(KAT[p.kat].label)}</span></button>`).join("")}</div>` : ""}
      ${mittel.length ? `<h4>Einsatzmittel</h4><div class="minitab">${mittel.map((m) =>
        `<button class="mz" data-mittel-sel="${m.id}" type="button"><b>${esc(m.kurz)}</b>
         <span>${esc(m.name)}</span></button>`).join("")}</div>` : ""}
    </div>`;
  }

  function verdrahteInspektor(el) {
    el.onclick = (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.setkat) TR.kategorieSetzen(S.auswahl.id, t.dataset.setkat);
      else if (t.dataset.loeschen) {
        if (confirm("Patient #" + S.auswahl.id + " löschen? Nur für Fehlerkennungen — das Protokoll wird mit entfernt."))
          TR.patientLoeschen(S.auswahl.id);
      } else if (t.dataset.zeigen) {
        const sel = S.auswahl;
        TR.emit("auswahl", sel);
      } else if (t.dataset.folgen) {
        S.verfolgt = S.verfolgt === t.dataset.folgen ? null : t.dataset.folgen;
        inspektorZeichnen();
        werkzeugeZeichnen();
      } else if (t.dataset.mittelWeg) {
        if (confirm("Einsatzmittel abmelden?")) { TR.truppEntfernen(t.dataset.mittelWeg); TR.auswaehlen(null); }
      } else if (t.dataset.patient) {
        TR.auswaehlen({ typ: "patient", id: parseInt(t.dataset.patient, 10) });
      } else if (t.dataset.mittelSel) {
        TR.auswaehlen({ typ: "mittel", id: t.dataset.mittelSel });
      } else if (t.dataset.zellfilter) {
        S.filter.zelle = t.dataset.zellfilter;
        filterAnwenden();
      }
    };
    const kw = $("klinik-wahl");
    if (kw) {
      kw.onchange = () => {
        const p = S.patienten.get(S.auswahl.id);
        if (p) {
          p.wunschKlinik = kw.value || null;
          const k = S.kliniken.find((x) => x.id === kw.value);
          p.proto.push({ t: S.simSek, quelle: "dashboard", autor: "EA 4",
            text: k ? "Zielklinik vorgegeben: " + k.name : "Zielklinikwahl wieder automatisch." });
        }
      };
    }
  }

  /* ------------------------------------------------------------- Warnungen */

  function warnungenZeichnen() {
    const el = $("warn-liste");
    const offen = S.warnungen.filter((w) => !w.quittiert);
    if (!offen.length) {
      el.innerHTML = '<p class="hinweis">Keine offenen Warnungen.</p>';
      return;
    }
    el.innerHTML = offen.map((w) => `<div class="warn s-${w.stufe}">
      <div class="warn-kopf"><b>${esc(w.titel)}</b><span class="mono">${TR.uhr(w.t)}</span></div>
      <div class="warn-txt">${esc(w.text)}</div>
      <div class="warn-akt">
        ${w.ref ? `<button class="btn-klein" data-ref="${esc(JSON.stringify(w.ref))}" type="button">anzeigen</button>` : ""}
        <button class="btn-klein" data-quitt="${w.nr}" type="button">quittieren</button>
      </div></div>`).join("");
    el.onclick = (e) => {
      const t = e.target.closest("button");
      if (!t) return;
      if (t.dataset.quitt) {
        const w = S.warnungen.find((x) => x.nr === parseInt(t.dataset.quitt, 10));
        if (w) { w.quittiert = true; warnungenZeichnen(); kennzahlen(); }
      } else if (t.dataset.ref) {
        TR.auswaehlen(JSON.parse(t.dataset.ref));
      }
    };
  }

  /* ---------------------------------------------------------------- Funk */

  function funkZeichnen() {
    const el = $("funk-liste");
    if (!S.funk.length) { el.innerHTML = '<p class="hinweis">Noch keine Transmissionen.</p>'; return; }
    el.innerHTML = S.funk.slice(0, 60).map((f) => `<div class="fk">
      <div class="fk-m"><span class="mono">${TR.uhr(f.t)}</span><b>${esc(f.von)}</b>
        <span class="refs">${(f.refs || []).map((r) => `<button class="refb" data-ref-pat="${r}" type="button">#${r}</button>`).join("")}</span></div>
      <div>${esc(f.text)}</div></div>`).join("");
    el.onclick = (e) => {
      const t = e.target.closest("[data-ref-pat]");
      if (t) TR.auswaehlen({ typ: "patient", id: parseInt(t.dataset.refPat, 10) });
    };
  }

  /* ------------------------------------------------------------------ Dock */

  function dockZeichnen() {
    const el = $("dock-inhalt");
    if (dockTab === "patienten") el.innerHTML = tabPatienten();
    else if (dockTab === "gefahren") el.innerHTML = tabGefahren();
    else if (dockTab === "transport") el.innerHTML = tabTransport();
    else if (dockTab === "ereignisse") el.innerHTML = tabEreignisse();
    else if (dockTab === "lagemeldung") el.innerHTML = tabLagemeldung();
    verdrahteDock(el);
  }

  function patientenGefiltert() {
    const f = S.filter;
    return [...S.patienten.values()].filter((p) => {
      if (f.kats.size && !f.kats.has(p.kat)) return false;
      if (f.zelle && TR.patientZelle(p) !== f.zelle) return false;
      if (f.nurOffen && (p.zustand === "klinik" || p.zustand === "BST")) return false;
      if (f.text) {
        const t = f.text.toLowerCase();
        const hay = ("#" + p.id + " " + KAT[p.kat].label + " " + (p.verletzt || []).join(" ") + " " +
          (p.massnahmen || []).join(" ") + " " + (p.befund || "")).toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }

  function tabPatienten() {
    const liste = patientenGefiltert();
    const s = patSort;
    liste.sort((a, b) => {
      let r = 0;
      if (s.spalte === "id") r = a.id - b.id;
      else if (s.spalte === "kat") r = KAT[a.kat].ord - KAT[b.kat].ord || a.id - b.id;
      else if (s.spalte === "zustand") r = String(a.zustand).localeCompare(String(b.zustand)) || a.id - b.id;
      else if (s.spalte === "raster") {
        r = TR.zellSchluessel(TR.patientZelle(a)).localeCompare(TR.zellSchluessel(TR.patientZelle(b))) || a.id - b.id;
      } else if (s.spalte === "spo2") r = (a.vit.spo2 ?? 999) - (b.vit.spo2 ?? 999);
      return s.ab ? -r : r;
    });
    const kopf = [["id", "#"], ["kat", "Sichtung"], ["zustand", "Zustand"], ["", "Abschnitt"],
      ["raster", "Raster"], ["", "AF"], ["", "Puls"], ["spo2", "SpO₂"], ["", "RR"], ["", "GCS"],
      ["", "Verletzungen / Maßnahmen"], ["", "zuletzt gesehen"]];
    return `<table class="tab">
      <thead><tr>${kopf.map(([k, t]) =>
        `<th${k ? ` class="sortbar${patSort.spalte === k ? " s-an" : ""}" data-sort="${k}"` : ""}>${t}</th>`).join("")}</tr></thead>
      <tbody>${liste.map((p) => {
        const v = p.vit || {};
        const feld = TR.patientZelle(p);
        return `<tr data-patient="${p.id}"${S.auswahl && S.auswahl.typ === "patient" && S.auswahl.id === p.id ? ' class="an"' : ""}>
          <td class="mono">#${p.id}</td>
          <td><i class="pkt k-${p.kat}"></i>${esc(KAT[p.kat].label)}</td>
          <td>${esc(TR.STATUS_TEXT[p.zustand] || p.zustand)}</td>
          <td>${p.abschnitt ? esc((S.abschnitte.get(p.abschnitt) || {}).kurz || "") : "—"}</td>
          <td class="mono${p.ll ? "" : " verlassen"}" title="${p.ll ? "aktuelles Rasterfeld" : "zuletzt bekanntes Rasterfeld vor dem Abtransport"}">${esc(feld)}</td>
          <td class="num">${zahl(v.af)}</td>
          <td class="num">${zahl(v.puls)}</td>
          <td class="num${v.spo2 != null && v.spo2 < 90 ? " krit" : ""}">${zahl(v.spo2)}</td>
          <td class="num">${v.rrs != null ? Math.round(v.rrs) + (v.rrd != null ? "/" + Math.round(v.rrd) : "") : "—"}</td>
          <td class="num">${zahl(v.gcs)}</td>
          <td class="lang">${esc((p.verletzt || []).join(", "))}${(p.massnahmen || []).length ? " · <i>" + esc(p.massnahmen.join(", ")) + "</i>" : ""}</td>
          <td>${p.gesehen ? esc(p.gesehen.von) + " " + TR.uhr(p.gesehen.t) : "—"}</td>
        </tr>`;
      }).join("")}</tbody></table>
      ${liste.length ? "" : '<p class="hinweis pad">Keine Patienten entsprechen dem Filter.</p>'}`;
  }

  function tabGefahren() {
    const g = [...S.gefahren.values()].filter((x) => x.aktiv);
    return `<table class="tab">
      <thead><tr><th>Kennung</th><th>Stufe</th><th>Bezeichnung</th><th>Status</th>
        <th>Zuständig</th><th>erkannt</th><th>Raster</th><th>Messwert / Hinweis</th></tr></thead>
      <tbody>${g.map((x) => `<tr data-gefahr="${x.id}">
        <td class="mono">${esc(x.code)}</td>
        <td><span class="stufe s-${x.stufe}">${x.stufe === 3 ? "kritisch" : x.stufe === 2 ? "erhöht" : "gering"}</span></td>
        <td>${esc(x.name)}</td>
        <td>${esc(x.status)}</td>
        <td>${esc(x.verantwortlich)}</td>
        <td class="mono">${TR.uhr(x.erkanntT)}</td>
        <td class="mono">${TR.zelle(x.ll)}</td>
        <td class="lang">${x.messwert ? esc(x.messwert.label) + " " + x.messwert.wert.toFixed(1) + " " + esc(x.messwert.einheit) + " · " : ""}${esc(x.info)}</td>
      </tr>`).join("")}
      ${S.sperren.map((s) => `<tr data-sperre="${s.id}">
        <td class="mono">SPR</td><td><span class="stufe s-1">Sperrung</span></td>
        <td>Straßensperre ${esc(s.name)}</td><td>eingerichtet</td><td>${esc(s.von)}</td>
        <td class="mono">—</td><td class="mono">${TR.zelle(s.ll)}</td>
        <td class="lang">Zufahrt nur für Einsatzfahrzeuge, Umleitung ausgeschildert.</td></tr>`).join("")}
      </tbody></table>`;
  }

  function tabTransport() {
    const t = S.transporte;
    return `<div class="dock-zwei">
      <div>
        <h4>Zielkliniken — gemeldete freie Kapazität</h4>
        <table class="tab">
          <thead><tr><th>Klinik</th><th>Versorgungsstufe</th><th class="num">km</th><th class="num">min</th>
            <th class="num">SK I</th><th class="num">SK II</th><th class="num">SK III</th>
            <th class="num">Schockraum</th><th>Besonderheit</th><th class="num">zugewiesen</th></tr></thead>
          <tbody>${S.kliniken.map((k) => `<tr>
            <td>${esc(k.name)}</td><td>${esc(k.stufe)}</td>
            <td class="num">${k.km.toFixed(1)}</td><td class="num">${k.minuten}</td>
            <td class="num${k.frei.SK1 === 0 ? " krit" : ""}">${k.frei.SK1}</td>
            <td class="num">${k.frei.SK2}</td><td class="num">${k.frei.SK3}</td>
            <td class="num">${k.schockraum}</td>
            <td>${[k.kinder ? "Kindertraumatologie" : null, k.neuro ? "Neurochirurgie" : null].filter(Boolean).join(", ") || "—"}</td>
            <td class="num">${k.belegt}</td></tr>`).join("")}</tbody>
        </table>
      </div>
      <div>
        <h4>Laufende und abgeschlossene Transporte</h4>
        ${t.length ? `<table class="tab">
          <thead><tr><th>#</th><th>Sichtung</th><th>Rettungsmittel</th><th>Ziel</th>
            <th>ab</th><th>ETA</th><th>Status</th></tr></thead>
          <tbody>${t.map((x) => `<tr data-patient="${x.patient}">
            <td class="mono">#${x.patient}</td>
            <td><i class="pkt k-${x.kat}"></i>${esc(KAT[x.kat].label)}</td>
            <td>${esc(x.mittelName)}</td><td>${esc(x.klinikName)}</td>
            <td class="mono">${TR.uhr(x.ab)}</td><td class="mono">${TR.uhr(x.an)}</td>
            <td>${esc(x.status)}</td></tr>`).join("")}</tbody></table>`
          : '<p class="hinweis pad">Noch kein Abtransport eingeleitet.</p>'}
      </div>
    </div>`;
  }

  function tabEreignisse() {
    const e = [...S.ereignisse].reverse();
    return `<table class="tab">
      <thead><tr><th>Nr.</th><th>Zeit</th><th>Einsatzzeit</th><th>Art</th><th>Ereignis</th></tr></thead>
      <tbody>${e.map((x) => `<tr${x.ref ? ` data-ereignis="${esc(JSON.stringify(x.ref))}"` : ""}>
        <td class="mono">${x.nr}</td><td class="mono">${TR.uhr(x.t)}</td>
        <td class="mono">${TR.zeit(x.t)}</td><td>${esc(x.art)}</td><td class="lang">${esc(x.text)}</td>
      </tr>`).join("")}</tbody></table>`;
  }

  function tabLagemeldung() {
    return `<div class="lagemeldung">
      <div class="lm-akt">
        <button class="btn-klein" id="lm-kopieren" type="button">In Zwischenablage kopieren</button>
        <span class="hinweis">Automatisch erzeugt aus dem aktuellen Lagebild — Stand ${TR.uhr(S.simSek)} Uhr.</span>
      </div>
      <pre id="lm-text">${esc(TR.lagemeldung())}</pre>
    </div>`;
  }

  function verdrahteDock(el) {
    el.onclick = (e) => {
      const th = e.target.closest("th.sortbar");
      if (th) {
        const k = th.dataset.sort;
        patSort = { spalte: k, ab: patSort.spalte === k ? !patSort.ab : false };
        dockZeichnen();
        return;
      }
      const tr = e.target.closest("tr");
      if (tr) {
        if (tr.dataset.patient) TR.auswaehlen({ typ: "patient", id: parseInt(tr.dataset.patient, 10) });
        else if (tr.dataset.gefahr) TR.auswaehlen({ typ: "gefahr", id: tr.dataset.gefahr });
        else if (tr.dataset.sperre) TR.auswaehlen({ typ: "sperre", id: tr.dataset.sperre });
        else if (tr.dataset.ereignis) TR.auswaehlen(JSON.parse(tr.dataset.ereignis));
      }
      if (e.target.id === "lm-kopieren") {
        const txt = TR.lagemeldung();
        navigator.clipboard.writeText(txt).then(
          () => { e.target.textContent = "kopiert ✓"; setTimeout(() => { e.target.textContent = "In Zwischenablage kopieren"; }, 1800); },
          () => { e.target.textContent = "Kopieren nicht möglich"; }
        );
      }
    };
  }

  /* -------------------------------------------------------------- Bedienung */

  function bedienungVerdrahten() {
    $("btn-neustart").onclick = () => { TR.neustart(); };
    $("lage-wahl").onchange = () => {
      if (!TR.szenarioWechseln($("lage-wahl").value)) lagewahlZeichnen();
    };
    $("btn-neuer-einsatz").onclick = () => {
      const name = prompt("Neuen Einsatz eröffnen — die bisherigen Daten bleiben unter dem aktuellen Einsatz gespeichert.\n\nBezeichnung (leer = automatisch):");
      if (name === null) return;
      TR.neuerEinsatz(name.trim() || "Einsatz " + new Date().toLocaleString("de-DE"));
    };
    $("sitzung").onchange = () => {
      const name = $("sitzung").value;
      if (!confirm('Zu Einsatz „' + name + '" wechseln?\n(Der aktuelle Einsatz bleibt gespeichert.)')) {
        sitzungenZeichnen();
        return;
      }
      S.sitzungen = S.sitzungen.map((s) => ({ ...s, aktiv: s.name === name }));
      sitzungenZeichnen();
    };
    $("btn-funk").onclick = () => {
      S.funkAktiv = !S.funkAktiv;
      $("btn-funk").classList.toggle("an", S.funkAktiv);
      $("btn-funk").textContent = S.funkAktiv ? "Funk läuft (AUX / BOS)" : "Funk aus";
      TR.ereignis("system", S.funkAktiv
        ? "Sprechfunk-Auswertung gestartet (AUX / BOS-Funk)"
        : "Sprechfunk-Auswertung beendet");
    };

    $("basiskarte").onchange = () => {
      KARTE.basisSetzen($("basiskarte").value);
      ebenenAufbauen();   // "ohne Kachelkarte" blendet das Wegenetz mit ein
    };
    const rasterAendern = () => {
      KARTE.rasterSetzen(parseInt($("raster-spalten").value, 10), parseInt($("raster-zeilen").value, 10));
      zellgroesse();
      inspektorZeichnen();
      dockZeichnen();   // Rasterfelder in der Patiententabelle sofort mitziehen
    };
    $("raster-spalten").onchange = rasterAendern;
    $("raster-zeilen").onchange = rasterAendern;

    $("plan-datei").onchange = () => {
      const f = $("plan-datei").files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        KARTE.planLaden(r.result);
        KARTE.planDeckkraft($("plan-deck").value / 100);
        TR.ereignis("system", "Eigener Lageplan über den Einsatzraum gelegt");
        $("plan-datei").value = "";
      };
      r.readAsDataURL(f);
    };
    $("plan-deck").oninput = () => KARTE.planDeckkraft($("plan-deck").value / 100);
    $("plan-weg").onclick = () => KARTE.planEntfernen();

    $("btn-mittel-neu").onclick = () => {
      const name = prompt("Rufname des Einsatzmittels (z. B. SEG-Trupp 3):");
      if (!name || !name.trim()) return;
      const notiz = prompt("Auftrag / Notiz (optional):") || "";
      TR.truppHinzufuegen(name.trim(), notiz);
    };

    $("wz-gesamt").onclick = () => { KARTE.gesamtansicht(); werkzeugeZeichnen(); };
    $("wz-schaden").onclick = () => { KARTE.schadensansicht(); werkzeugeZeichnen(); };
    $("wz-messen").onclick = () => { KARTE.messenUmschalten(); werkzeugeZeichnen(); };
    $("wz-folgen").onclick = () => {
      if (S.verfolgt) S.verfolgt = null;
      else if (S.auswahl && S.auswahl.typ === "mittel") S.verfolgt = S.auswahl.id;
      else alert("Zuerst ein Einsatzmittel auswählen (Karte oder Liste links).");
      werkzeugeZeichnen();
      inspektorZeichnen();
    };

    $("zt-pause").onclick = () => TR.pauseUmschalten();
    for (const b of document.querySelectorAll(".zt.tempo")) {
      b.onclick = () => TR.tempoSetzen(parseInt(b.dataset.tempo, 10));
    }

    $("dock-tabs").onclick = (e) => {
      const b = e.target.closest(".dtab");
      if (!b) return;
      dockTab = b.dataset.tab;
      for (const x of document.querySelectorAll(".dtab")) x.classList.toggle("aktiv", x === b);
      dockZeichnen();
    };
    $("btn-csv").onclick = () => {
      const blob = new Blob(["﻿" + TR.csvExport()], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "triarge-patientenliste.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    };

    document.addEventListener("keydown", (e) => {
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.key === " ") { e.preventDefault(); TR.pauseUmschalten(); }
      else if (["1", "2", "3", "4"].includes(e.key)) TR.tempoSetzen([1, 2, 4, 8][+e.key - 1]);
      else if (e.key.toLowerCase() === "m") { KARTE.messenUmschalten(); werkzeugeZeichnen(); }
      else if (e.key.toLowerCase() === "g") {
        S.ebenen.raster = !S.ebenen.raster;
        ebenenAufbauen();
        KARTE.ebenenAnwenden();
      } else if (e.key === "[") leisteUmschalten("l");
      else if (e.key === "]") leisteUmschalten("r");
      else if (e.key === "Escape") {
        KARTE.messenUmschalten(false);
        werkzeugeZeichnen();
        TR.auswaehlen(null);
      }
    });
  }

  /* ------------------------------------------------------------ Unterer Bereich
   * Höhe frei ziehbar, zusätzlich ganz aufziehen und einklappen. */

  const DOCK_MIN = 110, DOCK_ZU = 27;
  let dock = { hoehe: 208, zu: false, gross: false };

  function dockLaden() {
    try {
      const j = JSON.parse(localStorage.getItem("triarge.dock") || "null");
      if (j) {
        dock = { hoehe: +j.hoehe || 208, zu: !!j.zu, gross: !!j.gross, hoeheVorGross: +j.hoeheVorGross || 0 };
        return;
      }
    } catch (e) { /* kein gespeicherter Zustand */ }
    // Auf flachen Bildschirmen (Tablet quer) von vornherein niedriger ansetzen,
    // damit die Karte das Hauptelement bleibt. Auf einem quer gehaltenen
    // Telefon bleibt selbst bei der Mindesthöhe kaum Karte übrig — dort
    // startet der Bereich eingeklappt und wird bei Bedarf aufgezogen.
    if (window.innerHeight < 480) dock.zu = true;
    else dock.hoehe = Math.max(140, Math.min(208, Math.round(window.innerHeight * 0.24)));
  }
  function dockSpeichern() {
    try { localStorage.setItem("triarge.dock", JSON.stringify(dock)); } catch (e) { /* egal */ }
  }

  function dockMax() {
    return Math.max(DOCK_MIN, $("app").getBoundingClientRect().height - 190);
  }

  function dockAnwenden() {
    const el = $("dock");
    el.classList.toggle("zu", dock.zu);
    const h = dock.zu ? DOCK_ZU : dock.gross ? dockMax() : Math.min(dock.hoehe, dockMax());
    $("app").style.setProperty("--dock-h", Math.round(h) + "px");
    $("dock-klein").textContent = dock.zu ? "▲" : "▼";
    $("dock-klein").title = dock.zu ? "Bereich ausklappen" : "Bereich einklappen";
    $("dock-gross").classList.toggle("an", dock.gross);
    $("dock-gross").title = dock.gross ? "Auf gespeicherte Höhe zurück" : "Bereich auf volle Höhe bringen";
    if (typeof KARTE !== "undefined" && KARTE.karte()) {
      KARTE.karte().invalidateSize({ animate: false });
    }
  }

  function dockVerdrahten() {
    dockLaden();
    dockAnwenden();

    $("dock-klein").onclick = () => {
      dock.zu = !dock.zu;
      if (!dock.zu) dock.gross = false;
      dockAnwenden();
      dockSpeichern();
    };
    $("dock-gross").onclick = () => {
      if (dock.gross) {
        dock.gross = false;
        if (dock.hoeheVorGross) dock.hoehe = dock.hoeheVorGross;
      } else {
        dock.hoeheVorGross = Math.round($("dock").getBoundingClientRect().height);
        dock.gross = true;
      }
      dock.zu = false;
      dockAnwenden();
      dockSpeichern();
    };

    const griff = $("dock-griff");
    griff.addEventListener("pointerdown", (e) => {
      if (dock.zu || e.button !== 0) return;
      e.preventDefault();
      try { griff.setPointerCapture(e.pointerId); } catch (err) { /* ohne Capture weiterziehen */ }
      griff.classList.add("aktiv");
      const startY = e.clientY;
      const startHoehe = $("dock").getBoundingClientRect().height;
      const ziehen = (ev) => {
        dock.gross = false;
        dock.hoehe = Math.max(DOCK_MIN, Math.min(dockMax(), startHoehe + (startY - ev.clientY)));
        dockAnwenden();
      };
      const loslassen = () => {
        griff.classList.remove("aktiv");
        griff.removeEventListener("pointermove", ziehen);
        griff.removeEventListener("pointerup", loslassen);
        griff.removeEventListener("pointercancel", loslassen);
        dockSpeichern();
      };
      griff.addEventListener("pointermove", ziehen);
      griff.addEventListener("pointerup", loslassen);
      griff.addEventListener("pointercancel", loslassen);
    });
    griff.addEventListener("dblclick", () => {
      dock.zu = !dock.zu;
      dockAnwenden();
      dockSpeichern();
    });
    window.addEventListener("resize", () => dockAnwenden());
  }

  function werkzeugeZeichnen() {
    $("wz-folgen").classList.toggle("an", !!S.verfolgt);
    $("wz-folgen").textContent = S.verfolgt ? "Verfolgung beenden" : "Folgen";
    $("wz-messen").classList.toggle("an", document.getElementById("karte").classList.contains("misst"));
  }

  function steuerungZeichnen() {
    $("zt-pause").textContent = S.pause ? "Weiter" : "Pause";
    $("zt-pause").classList.toggle("an", S.pause);
    for (const b of document.querySelectorAll(".zt.tempo")) {
      b.classList.toggle("an", parseInt(b.dataset.tempo, 10) === S.tempo);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
