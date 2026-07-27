/* TriARge — Simulationskern der Live-Demo.
 *
 * Im Produkt liefert der FastAPI-Hub den Zustand per REST + WebSocket. Auf einer
 * statischen Seite gibt es keinen Backend-Prozess, deshalb erzeugt diese Datei
 * denselben Zustand lokal: Einsatzkräfte bewegen sich auf dem echten Wegenetz
 * (OpenStreetMap), sichten und transportieren Patienten, Gefahrenstellen
 * verändern sich, Warnregeln laufen mit. Die Oberfläche (map.js, ui.js) liest
 * nur diesen Zustand — sie kennt die Simulation nicht.
 */

"use strict";

const TR = (function () {
  /* ------------------------------------------------------------ Kategorien */

  const KAT = {
    SK1: { kurz: "I", label: "SK I — rot", farbe: "#d1232a", ord: 0 },
    SK2: { kurz: "II", label: "SK II — gelb", farbe: "#e39400", ord: 1 },
    SK3: { kurz: "III", label: "SK III — grün", farbe: "#177d3c", ord: 2 },
    SK4: { kurz: "IV", label: "SK IV — blau", farbe: "#1f5fa8", ord: 3 },
    TOT: { kurz: "T", label: "verstorben", farbe: "#22262b", ord: 4 },
    UNG: { kurz: "?", label: "ungesichtet", farbe: "#8b9199", ord: 5 },
  };

  const STATUS_TEXT = {
    unsighted: "ungesichtet, am Schadensort",
    gesichtet: "gesichtet, wartet auf Rettung",
    getragen: "wird transportiert",
    laufend: "geht selbstständig",
    PA: "Patientenablage",
    BHP: "Behandlungsplatz",
    BST: "Betreuungsstelle",
    VER: "Ablage Verstorbene",
    transport: "im Transport",
    klinik: "an Klinik übergeben",
  };

  /* ------------------------------------------------------------- Geo-Utils */

  const RAD = Math.PI / 180;
  const ERD = 6371000;

  function dist(a, b) {
    const x = (b[1] - a[1]) * RAD * Math.cos(((a[0] + b[0]) / 2) * RAD);
    const y = (b[0] - a[0]) * RAD;
    return Math.sqrt(x * x + y * y) * ERD;
  }

  function bearing(a, b) {
    const x = (b[1] - a[1]) * Math.cos(((a[0] + b[0]) / 2) * RAD);
    const y = b[0] - a[0];
    return (Math.atan2(x, y) / RAD + 360) % 360;
  }

  // Punkt in `m` Metern Entfernung unter `grad` (0 = Nord).
  function versetzt(ll, m, grad) {
    const dLat = (m * Math.cos(grad * RAD)) / ERD / RAD;
    const dLon = (m * Math.sin(grad * RAD)) / (ERD * Math.cos(ll[0] * RAD)) / RAD;
    return [ll[0] + dLat, ll[1] + dLon];
  }

  function streu(ll, m) {
    return versetzt(ll, Math.random() * m, Math.random() * 360);
  }

  /* --------------------------------------------------------- Wegenetz-Graph
   * Aus den OSM-Linien wird einmalig ein Knoten-/Kantengraph gebaut. Fahrzeuge
   * routen über Klasse 0/1 (befahrbar), Trupps zusätzlich über Klasse 2 (Fuß). */

  const graph = { knoten: [], adj: [] };

  function graphBauen(geo) {
    const idx = new Map();
    const key = (a, b) => a.toFixed(5) + "|" + b.toFixed(5);
    function id(lat, lon) {
      const k = key(lat, lon);
      let i = idx.get(k);
      if (i === undefined) {
        i = graph.knoten.length;
        graph.knoten.push([lat, lon]);
        graph.adj.push([]);
        idx.set(k, i);
      }
      return i;
    }
    for (const [, klasse, pts] of geo.ways) {
      let prev = -1;
      for (let i = 0; i < pts.length; i += 2) {
        const n = id(pts[i], pts[i + 1]);
        if (prev >= 0 && prev !== n) {
          const w = dist(graph.knoten[prev], graph.knoten[n]);
          graph.adj[prev].push([n, w, klasse]);
          graph.adj[n].push([prev, w, klasse]);
        }
        prev = n;
      }
    }
  }

  function naechsterKnoten(ll, fuss) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < graph.knoten.length; i++) {
      if (!fuss && !graph.adj[i].some((e) => e[2] < 2)) continue;
      const d = dist(ll, graph.knoten[i]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // Binärer Heap — reicht für ~2.500 Knoten deutlich aus.
  function Heap() {
    const a = [];
    return {
      size: () => a.length,
      push(v, p) {
        a.push([p, v]);
        let i = a.length - 1;
        while (i > 0) {
          const par = (i - 1) >> 1;
          if (a[par][0] <= a[i][0]) break;
          [a[par], a[i]] = [a[i], a[par]];
          i = par;
        }
      },
      pop() {
        const top = a[0];
        const last = a.pop();
        if (a.length) {
          a[0] = last;
          let i = 0;
          for (;;) {
            const l = 2 * i + 1, r = l + 1;
            let s = i;
            if (l < a.length && a[l][0] < a[s][0]) s = l;
            if (r < a.length && a[r][0] < a[s][0]) s = r;
            if (s === i) break;
            [a[s], a[i]] = [a[i], a[s]];
            i = s;
          }
        }
        return top[1];
      },
    };
  }

  function route(von, nach, fuss) {
    const s = naechsterKnoten(von, fuss);
    const z = naechsterKnoten(nach, fuss);
    if (s < 0 || z < 0 || s === z) return [von, nach];

    const dst = new Float64Array(graph.knoten.length).fill(Infinity);
    const vor = new Int32Array(graph.knoten.length).fill(-1);
    const fertig = new Uint8Array(graph.knoten.length);
    const h = Heap();
    dst[s] = 0;
    h.push(s, 0);
    while (h.size()) {
      const u = h.pop();
      if (fertig[u]) continue;
      fertig[u] = 1;
      if (u === z) break;
      for (const [v, w, kl] of graph.adj[u]) {
        if (!fuss && kl === 2) continue;
        const nd = dst[u] + w * (kl === 0 ? 1 : kl === 1 ? 1.05 : 1.15);
        if (nd < dst[v]) { dst[v] = nd; vor[v] = u; h.push(v, nd); }
      }
    }
    if (dst[z] === Infinity) return [von, nach];
    const pfad = [];
    for (let k = z; k >= 0; k = vor[k]) pfad.push(graph.knoten[k]);
    pfad.reverse();
    return [von, ...pfad, nach];
  }

  function pfadLaenge(p) {
    let s = 0;
    for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]);
    return s;
  }

  /* --------------------------------------------------------------- Zustand */

  const S = {
    einsatz: null,
    startZeit: 0,          // ms (echte Uhr) bei Einsatzbeginn
    simSek: 0,             // vergangene Einsatzsekunden
    tempo: 2,
    pause: false,
    patienten: new Map(),
    mittel: new Map(),
    gefahren: new Map(),
    abschnitte: new Map(),
    sperren: [],
    kliniken: [],
    poi: [],
    funk: [],
    ereignisse: [],
    warnungen: [],
    transporte: [],
    raster: { spalten: 10, zeilen: 8 },   // ~139 x 120 m je Feld im vergrößerten Einsatzraum
    bbox: null,
    auswahl: null,         // {typ, id}
    filter: { text: "", kats: new Set(), nurOffen: false, zelle: null },
    ebenen: {
      raster: true, abschnitte: true, gefahren: true, sperren: true,
      patienten: true, mittel: true, wege: false, poi: true,
      spuren: true, belegung: false, beschriftung: true,
    },
    sitzungen: [],
    funkAktiv: false,
    verfolgt: null,
    zaehler: { funk: 0, ereignis: 0, warnung: 0 },
  };

  /* ----------------------------------------------------------- Ereignis-Bus */

  const hoerer = new Map();
  function on(ev, fn) { (hoerer.get(ev) || hoerer.set(ev, []).get(ev)).push(fn); }
  function emit(ev, data) { (hoerer.get(ev) || []).forEach((f) => f(data)); }

  /* ------------------------------------------------------------ Hilfsmittel */

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function zeit(sek) {
    const s = Math.max(0, Math.floor(sek));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function uhr(sek) {
    const [h, m] = (S.einsatz.alarmiert || "09:07").split(":").map(Number);
    const t = h * 3600 + m * 60 + Math.floor(sek);
    return (
      String(Math.floor(t / 3600) % 24).padStart(2, "0") + ":" +
      String(Math.floor(t / 60) % 60).padStart(2, "0") + ":" +
      String(Math.floor(t) % 60).padStart(2, "0")
    );
  }

  function zelle(ll) {
    const b = S.bbox;
    if (!b) return "—";
    const c = Math.floor(((ll[1] - b[1]) / (b[3] - b[1])) * S.raster.spalten);
    const r = Math.floor(((b[2] - ll[0]) / (b[2] - b[0])) * S.raster.zeilen);
    if (c < 0 || r < 0 || c >= S.raster.spalten || r >= S.raster.zeilen) return "—";
    return String.fromCharCode(65 + c) + (r + 1);
  }

  /* Rasterfeld eines Patienten. Solange er im Einsatzraum ist, wird es aus der
   * aktuellen Position bestimmt und gemerkt; nach dem Abtransport bleibt das
   * zuletzt bekannte Feld stehen, damit die Spalte nicht leer läuft. */
  function patientZelle(p) {
    if (!p.ll) return p.letzteZelle || "—";
    const z = zelle(p.ll);
    // Ab dem Aufsitzen auf das Transportmittel wird nicht mehr nachgeführt,
    // sonst bliebe am Ende nur der Punkt stehen, an dem das Fahrzeug den
    // Einsatzraum verlassen hat.
    if (z !== "—" && p.zustand !== "transport") p.letzteZelle = z;
    return z;
  }

  // Sortierschlüssel für Rasterfelder: erst Spalte, dann Zeile numerisch,
  // damit A2 vor A10 steht und Patienten ohne Feld hinten landen.
  function zellSchluessel(ref) {
    const m = /^([A-Z]+)(\d{1,2})$/.exec(ref || "");
    if (!m) return "zzz|9999";
    return m[1].padStart(3, " ") + "|" + String(m[2]).padStart(4, "0");
  }

  function zellGrenzen(ref) {
    const m = /^([A-Z])(\d{1,2})$/.exec(ref || "");
    if (!m || !S.bbox) return null;
    const c = m[1].charCodeAt(0) - 65, r = parseInt(m[2], 10) - 1;
    const b = S.bbox;
    const dw = (b[3] - b[1]) / S.raster.spalten, dh = (b[2] - b[0]) / S.raster.zeilen;
    return [[b[2] - (r + 1) * dh, b[1] + c * dw], [b[2] - r * dh, b[1] + (c + 1) * dw]];
  }

  /* -------------------------------------------------------------- Protokoll */

  function proto(p, quelle, autor, text) {
    p.proto.push({ t: S.simSek, quelle, autor, text });
    p.aktualisiert = S.simSek;
  }

  function ereignis(art, text, ref) {
    S.ereignisse.push({ nr: ++S.zaehler.ereignis, t: S.simSek, art, text, ref: ref || null });
    if (S.ereignisse.length > 400) S.ereignisse.shift();
    emit("ereignisse");
  }

  function funken(von, text, refs) {
    S.funk.unshift({ nr: ++S.zaehler.funk, t: S.simSek, von, text, refs: refs || [] });
    if (S.funk.length > 160) S.funk.pop();
    emit("funk");
  }

  function warnen(schluessel, stufe, titel, text, ref) {
    const vorhanden = S.warnungen.find((w) => w.schluessel === schluessel && !w.quittiert);
    if (vorhanden) { vorhanden.t = S.simSek; return; }
    S.warnungen.unshift({
      nr: ++S.zaehler.warnung, schluessel, stufe, titel, text, ref: ref || null,
      t: S.simSek, quittiert: false,
    });
    if (S.warnungen.length > 60) S.warnungen.pop();
    emit("warnungen");
  }

  function warnungWeg(schluessel) {
    const i = S.warnungen.findIndex((w) => w.schluessel === schluessel && !w.quittiert);
    if (i >= 0) { S.warnungen.splice(i, 1); emit("warnungen"); }
  }

  /* ------------------------------------------------------------ Initialisierung */

  function init(szenario, geo) {
    graphBauen(geo);
    S.einsatz = szenario.einsatz;
    S.bbox = geo.bbox;
    S.epi = szenario.epi;
    S.sperren = szenario.sperren.slice();
    S.poi = szenario.poi.slice();
    S.kliniken = szenario.kliniken.map((k) =>
      ({ ...k, frei: { ...k.frei }, startFrei: { ...k.frei }, belegt: 0 }));
    S.sitzungen = [{ name: "Neubiberg · Hauptstraße " + (S.einsatz.alarmiert || ""), aktiv: true }];

    for (const a of szenario.abschnitte) S.abschnitte.set(a.id, { ...a });
    for (const g of szenario.gefahren) {
      S.gefahren.set(g.id, { ...g, erkanntT: g.t, aktiv: g.t === 0, messwert: g.messwert ? { ...g.messwert } : null });
    }

    for (const m of szenario.mittel) {
      const basis = S.abschnitte.get(m.basis) || S.sperren.find((s) => s.id === m.basis);
      const ll = basis ? streu(basis.ll, 12) : S.epi.slice();
      S.mittel.set(m.id, {
        ...m, ll, heim: basis ? basis.ll.slice() : S.epi.slice(),
        kurs: Math.random() * 360, pfad: null, pfadPos: 0, pfadLen: 0,
        status: m.art === "rtw" ? "frei" : "vor Ort", auftrag: null, patient: null,
        wartet: 0, online: true, letzterKontakt: 0, phase: Math.random() * Math.PI * 2,
        gefahren: 0,
      });
    }

    ROSTER = szenario.patienten.slice();
    FUNK_SKRIPT = szenario.funk.slice();
    naechsterFunk = 0;
    naechsterPatient = 0;

    S.startZeit = Date.now();
    S.simSek = 0;
    ereignis("system", "Einsatz eröffnet — " + S.einsatz.stichwort);
  }

  let ROSTER = [], FUNK_SKRIPT = [], naechsterFunk = 0, naechsterPatient = 0;

  /* --------------------------------------------------------------- Patienten */

  function patientAnlegen(v) {
    const p = {
      id: v.id, kat: "UNG", zielKat: v.kat, sex: v.sex, alter: v.alter, kind: !!v.kind,
      geh: v.geh, wach: v.wach, atemweg: v.atemweg,
      vit: {}, zielVit: v.vit, basisVit: { ...v.vit }, verletzt: [], massnahmen: [],
      zielVerletzt: v.verletzt, zielMassnahmen: v.massnahmen, befund: v.befund,
      ll: v.ll.slice(), start: v.ll.slice(), zustand: "unsighted",
      abschnitt: null, traeger: null, belegtVon: null, klinik: null,
      erkannt: S.simSek, gesichtet: null, aktualisiert: S.simSek, gesehen: null,
      letzteKontrolle: S.simSek, proto: [], transportBereit: false,
      verschlechtert: v.verschlechtert || null, verschlechtertGetan: false,
      trupp: v.trupp,
    };
    proto(p, "client", "AR-Client", "Marker erkannt — Sichtung ausstehend.");
    S.patienten.set(p.id, p);
    ereignis("patient", "Marker #" + p.id + " erkannt (" + zelle(p.ll) + ")", { typ: "patient", id: p.id });
    emit("patienten");
    return p;
  }

  function sichten(p, durch) {
    p.kat = p.zielKat;
    p.vit = { ...p.zielVit };
    p.verletzt = p.zielVerletzt.slice();
    p.massnahmen = p.zielMassnahmen.slice();
    p.gesichtet = S.simSek;
    p.letzteKontrolle = S.simSek;
    p.zustand = p.kat === "TOT" ? "gesichtet" : p.geh ? "laufend" : "gesichtet";
    proto(p, "client", durch, p.befund);
    ereignis("sichtung", "Patient #" + p.id + " gesichtet: " + KAT[p.kat].label, { typ: "patient", id: p.id });
    if (p.geh && p.kat !== "TOT") {
      const ziel = S.abschnitte.get(p.kat === "SK3" ? "BST" : "PA");
      p.pfad = route(p.ll, streu(ziel.ll, 14), true);
      p.pfadPos = 0;
      p.pfadLen = pfadLaenge(p.pfad);
      p.zielAbschnitt = ziel.id;
      p.zustand = "laufend";
    }
    emit("patienten");
  }

  function kategorieSetzen(id, kat) {
    const p = S.patienten.get(id);
    if (!p) return;
    const alt = p.kat;
    p.kat = kat;
    p.aktualisiert = S.simSek;
    p.letzteKontrolle = S.simSek;
    if (p.zustand === "unsighted") { p.zustand = "gesichtet"; p.gesichtet = S.simSek; }
    proto(p, "dashboard", "EL", "Sichtungskategorie manuell gesetzt: " + KAT[kat].label +
      (alt !== kat ? " (vorher " + KAT[alt].label + ")" : ""));
    ereignis("sichtung", "Patient #" + id + " umgesichtet: " + KAT[alt].label + " → " + KAT[kat].label,
      { typ: "patient", id });
    emit("patienten");
  }

  function patientLoeschen(id) {
    const p = S.patienten.get(id);
    if (!p) return;
    if (p.traeger) {
      const m = S.mittel.get(p.traeger);
      if (m) { m.patient = null; m.auftrag = null; m.pfad = null; }
    }
    S.patienten.delete(id);
    warnungWeg("spo2-" + id);
    warnungWeg("reeval-" + id);
    ereignis("system", "Patient #" + id + " gelöscht (Fehlerkennung)");
    if (S.auswahl && S.auswahl.typ === "patient" && S.auswahl.id === id) auswaehlen(null);
    emit("patienten");
  }

  function patientVerschieben(id, ll) {
    const p = S.patienten.get(id);
    if (!p) return;
    p.ll = ll;
    p.aktualisiert = S.simSek;
    p.pfad = null;
    p.abschnitt = abschnittBei(ll);
    proto(p, "dashboard", "EL", "Position auf der Karte korrigiert: " + zelle(ll) +
      " (" + ll[0].toFixed(5) + ", " + ll[1].toFixed(5) + ")");
    emit("patienten");
  }

  function abschnittBei(ll) {
    for (const a of S.abschnitte.values()) if (dist(ll, a.ll) <= a.r) return a.id;
    return null;
  }

  /* ------------------------------------------------------------ Einsatzmittel */

  const TEMPO_MS = {
    trupp: 2.2, truppLast: 1.5, arzt: 1.9, nef: 9, rtw: 9.5,
    rth: 52, drohne: 11, polizei: 5, laufend: 1.35,
  };

  function fahrtAuftrag(m, ziel, fuss, auftrag) {
    m.pfad = route(m.ll, ziel, fuss);
    m.pfadPos = 0;
    m.segPos = 0;
    m.pfadLen = pfadLaenge(m.pfad);
    m.auftrag = auftrag;
    m.wartet = 0;
  }

  function bewege(m, dt, tempo) {
    if (!m.pfad) return true;
    let rest = tempo * dt;
    while (rest > 0 && m.pfadPos < m.pfad.length - 1) {
      const a = m.pfad[m.pfadPos], b = m.pfad[m.pfadPos + 1];
      const seg = dist(a, b);
      const gefahren = m.segPos || 0;
      const uebrig = seg - gefahren;
      if (rest < uebrig) {
        const f = (gefahren + rest) / seg;
        m.ll = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
        m.kurs = bearing(a, b);
        m.segPos = gefahren + rest;
        m.gefahren += rest;
        return false;
      }
      rest -= uebrig;
      m.gefahren += uebrig;
      m.pfadPos++;
      m.segPos = 0;
      m.ll = b.slice();
    }
    m.pfad = null;
    m.segPos = 0;
    return true;
  }

  // Nächstgelegener noch nicht gesichteter Marker, den kein anderer Trupp hat.
  function offeneMarker(truppId) {
    const von = S.mittel.get(truppId).ll;
    let best = null, bd = Infinity;
    for (const p of S.patienten.values()) {
      if (p.zustand !== "unsighted" || p.belegtVon) continue;
      const d = dist(p.ll, von);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function traegerZiel() {
    // Patienten, die von der Schadensstelle in die Patientenablage müssen.
    let best = null, bo = Infinity;
    for (const p of S.patienten.values()) {
      if (p.zustand !== "gesichtet" || p.belegtVon || p.geh) continue;
      const o = KAT[p.kat].ord;
      if (o < bo) { bo = o; best = p; }
    }
    return best;
  }

  function ablageZiel() {
    let best = null, bo = Infinity;
    for (const p of S.patienten.values()) {
      if (p.abschnitt !== "PA" || p.belegtVon || p.zustand !== "PA") continue;
      const o = KAT[p.kat].ord + (p.kat === "TOT" ? 10 : 0);
      if (o < bo) { bo = o; best = p; }
    }
    return best;
  }

  /* Luftrettung ist Patienten mit Spezialindikation vorbehalten (Kind,
   * Brand-/Rauchgas-/Crush-Verletzung). Wartet so ein Patient zu lange auf den
   * RTH, wird er wieder für den bodengebundenen Transport freigegeben. */
  function transportZiel(luft) {
    let best = null, bo = Infinity;
    for (const p of S.patienten.values()) {
      if (p.zustand !== "BHP" || p.belegtVon || !p.transportBereit) continue;
      if (p.kat === "TOT" || p.kat === "SK4") continue;
      if (p.luft && !luft && S.simSek - p.transportSeit < 300) continue;
      if (luft && !p.luft) continue;
      const o = KAT[p.kat].ord * 1000 + p.gesichtet;
      if (o < bo) { bo = o; best = p; }
    }
    return best;
  }

  function luftIndikation(p) {
    return p.kat === "SK1" &&
      (p.kind || (p.verletzt || []).some((v) => /verbrenn|crush|rauchgas|inhalation/i.test(v)));
  }

  function klinikWaehlen(p) {
    if (p.wunschKlinik) {
      const gewuenscht = S.kliniken.find((k) => k.id === p.wunschKlinik);
      if (gewuenscht) return gewuenscht;
    }
    const passend = S.kliniken.filter((k) => {
      if (p.kind && !k.kinder) return false;
      if (k.frei[p.kat] === undefined) return false;
      return k.frei[p.kat] > 0;
    });
    if (!passend.length) return null;
    passend.sort((a, b) => {
      if (p.kat === "SK1") return a.minuten - b.minuten;
      return b.frei[p.kat] - a.frei[p.kat] || a.minuten - b.minuten;
    });
    return passend[0];
  }

  function transportStarten(p, m, klinik) {
    if (p.ll) {
      const z = zelle(p.ll);
      if (z !== "—") p.letzteZelle = z;   // Feld der Übergabe festhalten
    }
    klinik.frei[p.kat] = Math.max(0, klinik.frei[p.kat] - 1);
    klinik.belegt++;
    p.klinik = klinik.id;
    p.zustand = "transport";
    p.abschnitt = null;
    proto(p, "dashboard", "EA 4", "Transport durch " + m.name + " → " + klinik.name +
      " (Fahrzeit ca. " + klinik.minuten + " min).");
    S.transporte.unshift({
      patient: p.id, kat: p.kat, mittel: m.id, mittelName: m.name,
      klinik: klinik.id, klinikName: klinik.name, ab: S.simSek,
      an: S.simSek + klinik.minuten * 60, status: "unterwegs",
    });
    ereignis("transport", "Patient #" + p.id + " → " + klinik.name + " (" + m.name + ")",
      { typ: "patient", id: p.id });
    funken(m.name, "Patient " + p.id + " übernommen, Transport " + klinik.name + ".", [p.id]);
    emit("transporte");
  }

  /* ------------------------------------------ Verhalten je Einsatzmittel-Art */

  function truppTakt(m, dt) {
    const rettung = m.basis === "SCHADEN";
    const tempo = m.patient ? TEMPO_MS.truppLast : TEMPO_MS.trupp;

    if (m.wartet > 0) {
      m.wartet -= dt;
      if (m.patient) {
        const p = S.patienten.get(m.patient);
        if (p) p.ll = m.ll.slice();
      }
      return;
    }

    if (m.pfad) {
      const fertig = bewege(m, dt, tempo);
      if (m.patient) {
        const p = S.patienten.get(m.patient);
        if (p) { p.ll = m.ll.slice(); p.aktualisiert = S.simSek; }
      }
      if (!fertig) return;
      auftragErledigt(m);
      return;
    }

    if (truppNeuerAuftrag(m, rettung)) return;

    if (rettung) {
      m.status = "Erkundung Schadensbereich";
      fahrtAuftrag(m, streu(S.epi, 55), true, "streife");
      m.wartet = 2;
    } else {
      m.status = "bereit";
      const heim = S.abschnitte.get(m.basis);
      if (dist(m.ll, heim.ll) > 25) fahrtAuftrag(m, streu(heim.ll, 12), true, "heim");
      else m.wartet = 3;
    }
  }

  /* Auftragsvergabe. Rettungstrupps sichten zuerst, Trag-Trupps räumen zuerst
   * die Patientenablage; ist im eigenen Schwerpunkt nichts zu tun, hilft jeder
   * Trupp im jeweils anderen aus. */
  function truppNeuerAuftrag(m, rettung) {
    for (const art of rettung ? ["sichten", "ablage", "bhp"] : ["bhp", "ablage", "sichten"]) {
      if (art === "sichten") {
        const p = offeneMarker(m.id);
        if (!p) continue;
        p.belegtVon = m.id;
        m.zielPatient = p.id;
        m.status = "Sichtung Marker #" + p.id;
        fahrtAuftrag(m, p.ll.slice(), true, "sichten");
        return true;
      }
      if (art === "ablage") {
        const p = traegerZiel();
        if (!p) continue;
        p.belegtVon = m.id;
        m.zielPatient = p.id;
        m.status = (p.kat === "TOT" ? "Bergung #" : "Rettung #") + p.id +
          " → " + (p.kat === "TOT" ? "Ablage Verstorbene" : "Patientenablage");
        fahrtAuftrag(m, p.ll.slice(), true, "abholenSchaden");
        return true;
      }
      const p = ablageZiel();
      if (!p) continue;
      p.belegtVon = m.id;
      m.zielPatient = p.id;
      m.status = "Transport #" + p.id + " → " + (p.kat === "TOT" ? "Ablage Verstorbene" : "BHP 25");
      fahrtAuftrag(m, p.ll.slice(), true, "abholenPA");
      return true;
    }
    return false;
  }

  function auftragErledigt(m) {
    const auftrag = m.auftrag;
    m.auftrag = null;
    if (!m.funkstille) m.letzterKontakt = S.simSek;
    const p = m.zielPatient != null ? S.patienten.get(m.zielPatient) : null;

    if (auftrag === "sichten" && p) {
      sichten(p, m.name);
      p.gesehen = { von: m.name, t: S.simSek };
      m.letzterKontakt = S.simSek;
      // Nicht gehfähige Patienten nimmt der Rettungstrupp direkt mit in die Ablage.
      if (!p.geh && p.kat !== "TOT") {
        m.patient = p.id;
        p.traeger = m.id;
        p.zustand = "getragen";
        p.abschnitt = null;
        const ziel = S.abschnitte.get("PA");
        proto(p, "client", m.name, "Rettung aus dem Schadensbereich — Transport in die " + ziel.name + ".");
        fahrtAuftrag(m, streu(ziel.ll, ziel.r * 0.55), true, "abliefern:PA");
        m.status = "Rettung #" + p.id + " → Patientenablage";
        m.wartet = 5 + Math.random() * 5;
        return;
      }
      m.wartet = 4 + Math.random() * 5;
      p.belegtVon = null;
      m.zielPatient = null;
      m.status = "bereit";
      return;
    }
    if ((auftrag === "abholenSchaden" || auftrag === "abholenPA") && p) {
      m.patient = p.id;
      p.traeger = m.id;
      p.zustand = "getragen";
      p.abschnitt = null;
      p.gesehen = { von: m.name, t: S.simSek };
      const zielId = p.kat === "TOT" ? "VER" : auftrag === "abholenSchaden" ? "PA" : "BHP";
      const ziel = S.abschnitte.get(zielId);
      proto(p, "client", m.name, "Übernahme durch " + m.name + " — Transport nach " + ziel.name + ".");
      fahrtAuftrag(m, streu(ziel.ll, ziel.r * 0.55), true, "abliefern:" + zielId);
      m.wartet = 3 + Math.random() * 3;
      return;
    }
    if (auftrag && auftrag.startsWith("abliefern:") && p) {
      const zielId = auftrag.split(":")[1];
      const ziel = S.abschnitte.get(zielId);
      p.ll = m.ll.slice();
      p.traeger = null;
      p.belegtVon = null;
      p.abschnitt = zielId;
      p.zustand = zielId === "VER" ? "VER" : zielId;
      p.aktualisiert = S.simSek;
      p.letzteKontrolle = S.simSek;
      if (zielId === "BHP") {
        p.transportBereit = p.kat === "SK1" || p.kat === "SK2";
        p.transportSeit = S.simSek;
        p.luft = luftIndikation(p);
        proto(p, "client", m.name, "Übergabe an " + ziel.name + "." +
          (p.transportBereit ? " Transportpriorität " + KAT[p.kat].label + "." : "") +
          (p.luft ? " Luftrettung angefordert (Spezialindikation)." : ""));
      } else {
        proto(p, "client", m.name, "Übergabe an " + ziel.name + ".");
      }
      ereignis("verlegung", "Patient #" + p.id + " in " + ziel.name, { typ: "patient", id: p.id });
      m.patient = null;
      m.zielPatient = null;
      m.wartet = 2 + Math.random() * 3;
      m.status = "bereit";
      emit("patienten");
      return;
    }
    m.zielPatient = null;
    m.status = m.art === "rtw" ? "frei" : "bereit";
  }

  function rtwTakt(m, dt) {
    if (m.wartet > 0) { m.wartet -= dt; return; }
    if (m.pfad) {
      const fertig = bewege(m, dt, TEMPO_MS.rtw);
      if (m.patient) {
        const p = S.patienten.get(m.patient);
        if (p) p.ll = m.ll.slice();
      }
      if (!fertig) return;

      if (m.auftrag === "zumBHP") {
        const p = m.zielPatient != null ? S.patienten.get(m.zielPatient) : null;
        if (!p) { m.auftrag = null; m.status = "frei"; return; }
        const k = klinikWaehlen(p) || S.kliniken[0];
        m.patient = p.id;
        p.belegtVon = m.id;
        transportStarten(p, m, k);
        m.wartet = 8;
        m.status = "Transport #" + p.id + " → " + k.name;
        // Abfahrt Richtung Osten aus dem Einsatzraum heraus
        fahrtAuftrag(m, [48.07561, 11.66840], false, "abfahrt");
        return;
      }
      if (m.auftrag === "abfahrt") {
        const p = m.patient != null ? S.patienten.get(m.patient) : null;
        if (p) {
          p.zustand = "klinik";
          p.ll = null;
          p.belegtVon = null;
          const k = S.kliniken.find((x) => x.id === p.klinik);
          proto(p, "client", m.name, "An " + (k ? k.name : "Zielklinik") + " übergeben.");
          const tr = S.transporte.find((t) => t.patient === p.id && t.status === "unterwegs");
          if (tr) tr.status = "übergeben";
          ereignis("transport", "Patient #" + p.id + " an Klinik übergeben", { typ: "patient", id: p.id });
          emit("transporte");
          emit("patienten");
        }
        m.patient = null;
        m.zielPatient = null;
        m.status = "Rückfahrt Bereitstellungsraum";
        m.wartet = 20 + Math.random() * 20;
        const br = S.abschnitte.get("BR");
        fahrtAuftrag(m, streu(br.ll, 14), false, "heim");
        return;
      }
      m.auftrag = null;
      m.status = "frei";
      m.wartet = 4;
      return;
    }

    if (m.status === "frei" || m.status === "Rückfahrt Bereitstellungsraum") {
      const p = transportZiel(false);
      if (p) {
        p.belegtVon = m.id;
        m.zielPatient = p.id;
        m.status = "Anfahrt Rettungsmittel-Halteplatz";
        const rmhp = S.abschnitte.get("RMHP");
        fahrtAuftrag(m, streu(rmhp.ll, 10), false, "zumBHP");
        return;
      }
      m.status = "frei";
      m.wartet = 5;
    }
  }

  function rthTakt(m, dt) {
    if (m.wartet > 0) { m.wartet -= dt; return; }
    if (m.pfad) {
      const fertig = bewege(m, dt, TEMPO_MS.rth);
      if (m.patient) {
        const p = S.patienten.get(m.patient);
        if (p) p.ll = m.ll.slice();
      }
      if (!fertig) return;
      if (m.auftrag === "anflugBHP") {
        const p = m.zielPatient != null ? S.patienten.get(m.zielPatient) : null;
        if (p) {
          m.patient = p.id;
          const k = S.kliniken.find((x) => x.id === "K6" && x.frei[p.kat] > 0) || klinikWaehlen(p) || S.kliniken[1];
          transportStarten(p, m, k);
          m.status = "Ferntransport #" + p.id;
          m.wartet = 12;
          fahrtAuftrag(m, [48.06400, 11.64000], false, "abflug");
        } else { m.status = "am Boden"; m.wartet = 10; }
        return;
      }
      if (m.auftrag === "abflug") {
        const p = m.patient != null ? S.patienten.get(m.patient) : null;
        if (p) {
          p.zustand = "klinik";
          p.ll = null;
          p.belegtVon = null;
          const tr = S.transporte.find((t) => t.patient === p.id && t.status === "unterwegs");
          if (tr) tr.status = "übergeben";
          proto(p, "client", m.name, "Luftrettung — an Zielklinik übergeben.");
          emit("patienten");
          emit("transporte");
        }
        m.patient = null;
        m.zielPatient = null;
        m.status = "Rückflug Landeplatz";
        m.wartet = 40 + Math.random() * 30;
        fahrtAuftrag(m, S.abschnitte.get("RTH").ll.slice(), false, "heim");
        return;
      }
      m.auftrag = null;
      m.status = "am Boden, einsatzbereit";
      m.wartet = 15;
      return;
    }
    if (m.status === "am Boden, einsatzbereit" || m.status === "vor Ort" || m.status === "am Boden") {
      const p = transportZiel(true);
      if (p) {
        p.belegtVon = m.id;
        m.zielPatient = p.id;
        m.status = "Anflug Rettungsmittel-Halteplatz";
        fahrtAuftrag(m, S.abschnitte.get("RMHP").ll.slice(), false, "anflugBHP");
        return;
      }
      m.status = "am Boden, einsatzbereit";
      m.wartet = 12;
    }
  }

  function arztTakt(m, dt) {
    if (m.wartet > 0) { m.wartet -= dt; return; }
    if (m.pfad) {
      if (!bewege(m, dt, m.art === "nef" ? TEMPO_MS.nef : TEMPO_MS.arzt)) return;
      const p = m.zielPatient != null ? S.patienten.get(m.zielPatient) : null;
      if (p && p.ll) {
        p.letzteKontrolle = S.simSek;
        p.gesehen = { von: m.name, t: S.simSek };
        m.wartet = 10 + Math.random() * 10;
        const massnahme = REEVAL[Math.floor(Math.random() * REEVAL.length)];
        proto(p, "client", m.name, massnahme);
        // Versorgung wirkt: der Ausgangswert der Messreihe verbessert sich mit.
        // Messwerte bleiben ganzzahlig — sie werden am Monitor abgelesen, nicht gerechnet.
        const b = p.basisVit || (p.basisVit = { ...p.vit });
        if (p.vit.spo2 != null && p.vit.spo2 < 94) {
          b.spo2 = Math.round(Math.min(97, (b.spo2 ?? p.vit.spo2) + 3 + Math.random() * 2));
          p.vit.spo2 = Math.round(Math.min(99, p.vit.spo2 + 3 + Math.random() * 3));
        }
        if (p.vit.puls != null && p.vit.puls > 110) {
          b.puls = Math.round(Math.max(88, (b.puls ?? p.vit.puls) - 5));
          p.vit.puls = Math.round(p.vit.puls - (4 + Math.random() * 6));
        }
        emit("patienten");
      }
      m.zielPatient = null;
      m.status = "bereit";
      return;
    }
    // nächsten roten Patienten reevaluieren
    let ziel = null, bt = Infinity;
    for (const p of S.patienten.values()) {
      if (!p.ll || p.zustand === "klinik" || p.zustand === "transport") continue;
      if (p.kat !== "SK1" && p.kat !== "SK2" && p.kat !== "SK4") continue;
      if (p.letzteKontrolle < bt) { bt = p.letzteKontrolle; ziel = p; }
    }
    if (ziel && S.simSek - bt > 45) {
      m.zielPatient = ziel.id;
      m.status = "Reevaluation #" + ziel.id;
      fahrtAuftrag(m, ziel.ll.slice(), m.art !== "nef", "reeval");
      return;
    }
    m.status = "bereit";
    m.wartet = 6;
  }

  const REEVAL = [
    "Reevaluation: Kreislauf stabil, Sichtungskategorie bestätigt.",
    "Reevaluation: Analgesie nachgesteuert, Patient toleriert Lagerung.",
    "Reevaluation: Sauerstoffgabe erhöht, Sättigung steigt.",
    "Reevaluation: Volumengabe fortgeführt, Zugang kontrolliert.",
    "Reevaluation: Wärmeerhalt sichergestellt, Rettungsdecke erneuert.",
    "Reevaluation: Transportpriorität bestätigt, Voranmeldung veranlasst.",
  ];

  function drohneTakt(m, dt) {
    m.phase += dt * 0.12;
    const r = 95 + 25 * Math.sin(m.phase * 0.7);
    const g = (m.phase / RAD) % 360;
    const neu = versetzt(S.epi, r, g);
    m.kurs = bearing(m.ll, neu);
    m.ll = neu;
    m.status = "Aufklärungsflug, Wärmebild aktiv";
  }

  function statischTakt(m, dt) {
    m.phase += dt;
    if (m.art === "polizei" || m.art === "loesch" || m.art === "fuehrung") {
      // minimale Positionskorrektur, damit die Lage nicht "eingefroren" wirkt
      if (m.phase > 25) {
        m.phase = 0;
        m.ll = streu(m.heim, 8);
      }
    }
  }

  /* ---------------------------------------------------------------- Gefahren */

  function gefahrenTakt(dt) {
    for (const g of S.gefahren.values()) {
      if (!g.aktiv && S.simSek >= g.erkanntT) {
        g.aktiv = true;
        ereignis("gefahr", "Gefahrenstelle erkannt: " + g.name, { typ: "gefahr", id: g.id });
        funken("EA 1 Lageerkundung", g.name + " — " + g.info.split(".")[0] + ".");
        emit("gefahren");
      }
      if (!g.aktiv) continue;

      if (g.messwert) {
        const mw = g.messwert;
        // Absperrarmatur ab Minute 5 geschlossen -> der Wert fällt wieder.
        if (S.simSek > 300 && mw.trend > 0) {
          mw.trend = -1;
          g.status = "abgesperrt, Wert fallend";
          ereignis("gefahr", "Gasleitung abgesperrt — Messwert fällt", { typ: "gefahr", id: g.id });
        }
        mw.wert = Math.max(0, Math.min(90, mw.wert + mw.trend * dt * 0.06 + (Math.random() - 0.5) * 0.15));
        if (mw.wert < 5 && g.status !== "erledigt") {
          g.status = "erledigt";
          g.stufe = 1;
          ereignis("gefahr", "Gasaustritt abgesperrt — UEG unter 5 %", { typ: "gefahr", id: g.id });
          funken("Sicherheitstrupp", "Gasmessung unter 5 % UEG. Trümmerbereich für Rettungstrupps freigegeben.");
          emit("gefahren");
        }
      }
      if (g.wind) {
        g.wind.grad += (Math.random() - 0.5) * dt * 1.2;
        g.wind.kmh = Math.max(8, Math.min(26, g.wind.kmh + (Math.random() - 0.5) * dt * 0.3));
        g.fahneLaenge = 150 + 45 * Math.sin(S.simSek * 0.05);
      }
    }
  }

  /* Die Kliniken melden im Verlauf wieder Kapazität nach (Verlegungen,
   * freigewordene Schockräume) — sonst läuft die Zielklinikplanung leer. */
  let klinikAkku = 0;

  function klinikTakt(dt) {
    klinikAkku += dt;
    if (klinikAkku < 240) return;
    klinikAkku = 0;
    const k = S.kliniken[Math.floor(Math.random() * S.kliniken.length)];
    const kats = Object.keys(k.frei).filter((c) => k.frei[c] < k.startFrei[c]);
    if (!kats.length) return;
    const c = kats[Math.floor(Math.random() * kats.length)];
    k.frei[c]++;
    funken("ILS München", k.name + " meldet einen freien Platz " + KAT[c].label + " nach.");
    emit("transporte");
  }

  /* Funkloch im Trümmerbereich: ein Trupp ist zeitweise nicht erreichbar — die
   * Warnregel "Funkkontakt" wird dadurch tatsächlich ausgelöst. */
  function sonderlagen() {
    const t = S.mittel.get("T3");
    if (!t) return;
    const soll = S.simSek > 600 && S.simSek < 1150;
    if (soll && !t.funkstille) {
      t.funkstille = true;
      t.online = false;
      funken("Fernmelder ELW 2", "Rettungstrupp 3 auf Kanal 31 nicht erreichbar — vermutlich Funkschatten im Trümmerbereich.");
      ereignis("system", "Funkkontakt zu Rettungstrupp 3 abgerissen", { typ: "mittel", id: "T3" });
    } else if (!soll && t.funkstille) {
      t.funkstille = false;
      t.online = true;
      t.letzterKontakt = S.simSek;
      funken("Rettungstrupp 3", "Wieder auf Kanal. Standort Trümmerbereich Nordseite, Trupp vollzählig.");
      ereignis("system", "Rettungstrupp 3 wieder auf Kanal", { typ: "mittel", id: "T3" });
    }
  }

  /* ---------------------------------------------------------------- Warnungen */

  function warnRegeln() {
    let offeneRot = 0, ungesichtet = 0, imBHP = 0, transportOffen = 0;
    for (const p of S.patienten.values()) {
      if (p.zustand === "klinik") {
        warnungWeg("spo2-" + p.id);
        warnungWeg("reeval-" + p.id);
        continue;
      }
      if (p.kat === "UNG") ungesichtet++;
      if (p.zustand === "BHP") imBHP++;
      if (p.kat === "SK1") {
        offeneRot++;
        if (p.zustand === "BHP" && p.transportBereit) transportOffen++;
      }
      if (p.ll && p.vit && p.vit.spo2 != null && p.vit.spo2 < 90 && (p.kat === "SK1" || p.kat === "SK2")) {
        warnen("spo2-" + p.id, 3, "Sättigungsabfall Patient #" + p.id,
          "SpO₂ " + Math.round(p.vit.spo2) + " % — " + KAT[p.kat].label + ", " + (STATUS_TEXT[p.zustand] || p.zustand) + ".",
          { typ: "patient", id: p.id });
      } else {
        warnungWeg("spo2-" + p.id);
      }
      if (p.ll && (p.kat === "SK1" || p.kat === "SK2") && S.simSek - p.letzteKontrolle > 360) {
        warnen("reeval-" + p.id, 2, "Reevaluation überfällig #" + p.id,
          "Letzte ärztliche Kontrolle vor " + Math.floor((S.simSek - p.letzteKontrolle) / 60) + " min. Vorgabe: alle 5 min bei SK I/II.",
          { typ: "patient", id: p.id });
      } else {
        warnungWeg("reeval-" + p.id);
      }
    }

    if (ungesichtet > 3) {
      warnen("ungesichtet", 2, ungesichtet + " Marker ungesichtet",
        "Sichtung hängt hinter der Erkundung zurück. Weitere Sichtungstrupps prüfen.", null);
    } else warnungWeg("ungesichtet");

    const bhp = S.abschnitte.get("BHP");
    if (bhp && imBHP > bhp.kapazitaet * 0.8) {
      warnen("bhp-last", 2, "Behandlungsplatz nahe Kapazitätsgrenze",
        imBHP + " von " + bhp.kapazitaet + " Plätzen belegt. Abtransport priorisieren oder BHP erweitern.",
        { typ: "abschnitt", id: "BHP" });
    } else warnungWeg("bhp-last");

    const freieRTW = [...S.mittel.values()].filter((m) => m.art === "rtw" && m.status === "frei").length;
    if (transportOffen > 0 && freieRTW === 0) {
      warnen("rtw-mangel", 3, "Kein freies Transportmittel",
        transportOffen + "× SK I transportbereit, alle RTW gebunden. Nachforderung über ILS prüfen.", null);
    } else warnungWeg("rtw-mangel");

    const gas = S.gefahren.get("G1");
    if (gas && gas.aktiv && gas.messwert && gas.messwert.wert > gas.messwert.warn) {
      warnen("gas", 3, "Explosionsgefahr — " + Math.round(gas.messwert.wert) + " % UEG",
        "Zündquellenverbot im Umkreis 100 m. Kein Einsatz nicht-exgeschützter Geräte im Trümmerbereich.",
        { typ: "gefahr", id: "G1" });
    } else warnungWeg("gas");

    if (!S.kliniken.some((k) => k.frei.SK1 > 0)) {
      warnen("kap-sk1", 3, "Keine SK-I-Kapazität gemeldet",
        "Alle Zielkliniken melden ihre Schockraum-/Intensivplätze für SK I als belegt. Erweiterte Zielklinikabfrage über die ILS veranlassen.", null);
    } else warnungWeg("kap-sk1");

    const kind = [...S.patienten.values()].find((p) => p.kind && p.transportBereit && p.zustand === "BHP");
    if (kind && !S.kliniken.some((k) => k.kinder && k.frei[kind.kat] > 0)) {
      warnen("kind-klinik", 3, "Keine Kinderkapazität frei",
        "Patient #" + kind.id + " (" + kind.alter + " J.) benötigt Kindertraumazentrum. Alle gemeldeten Plätze belegt.",
        { typ: "patient", id: kind.id });
    } else warnungWeg("kind-klinik");

    for (const m of S.mittel.values()) {
      if (m.art === "trupp" && S.simSek - m.letzterKontakt > 300 && m.letzterKontakt > 0) {
        warnen("funk-" + m.id, 2, "Funkkontakt " + m.name,
          "Seit " + Math.floor((S.simSek - m.letzterKontakt) / 60) + " min keine Statusmeldung. Kontaktaufnahme veranlassen.",
          { typ: "mittel", id: m.id });
      } else warnungWeg("funk-" + m.id);
    }
  }

  /* ------------------------------------------------------------------- Takt */

  let letzterFrame = 0, ambientAkku = 0, warnAkku = 0, renderAkku = 0;

  function takt(now) {
    if (!letzterFrame) letzterFrame = now;
    let dtReal = (now - letzterFrame) / 1000;
    letzterFrame = now;
    if (dtReal > 0.5) dtReal = 0.5;
    if (S.pause) { emit("frame"); return; }

    const dt = dtReal * S.tempo;
    S.simSek += dt;

    // Patienten aus dem Roster aufdecken
    while (naechsterPatient < ROSTER.length && ROSTER[naechsterPatient].t <= S.simSek) {
      const v = ROSTER[naechsterPatient++];
      naechsteId = Math.max(naechsteId, v.id);
      patientAnlegen(v);
    }
    if (naechsterPatient >= ROSTER.length) {
      nachAkku += dt;
      if (nachAkku > nachIntervall) {
        nachAkku = 0;
        nachIntervall = 110 + Math.random() * 130;
        nachmeldung();
      }
    }
    // Funkskript abspielen
    while (naechsterFunk < FUNK_SKRIPT.length && FUNK_SKRIPT[naechsterFunk].t <= S.simSek) {
      const f = FUNK_SKRIPT[naechsterFunk++];
      funken(f.von, f.text, f.refs);
    }

    // Verschlechterungen
    for (const p of S.patienten.values()) {
      if (p.verschlechtert && !p.verschlechtertGetan && S.simSek >= p.verschlechtert.t && p.gesichtet != null) {
        const v = p.verschlechtert;
        p.verschlechtertGetan = true;
        p.kat = v.kat;
        Object.assign(p.vit, v.vit);
        if (v.massnahmen) p.massnahmen = v.massnahmen.slice();
        p.transportBereit = p.zustand === "BHP";
        proto(p, "client", "Trag-Trupp SEG 2", v.befund);
        ereignis("sichtung", "Patient #" + p.id + " verschlechtert — Umsichtung auf " + KAT[v.kat].label,
          { typ: "patient", id: p.id });
        emit("patienten");
      }
      // selbstständig gehende Patienten bewegen
      if (p.zustand === "laufend" && p.pfad) {
        const dummy = { pfad: p.pfad, pfadPos: p.pfadPos, segPos: p.segPos, ll: p.ll, kurs: 0, gefahren: 0 };
        const fertig = bewege(dummy, dt, TEMPO_MS.laufend);
        p.ll = dummy.ll; p.pfad = dummy.pfad; p.pfadPos = dummy.pfadPos; p.segPos = dummy.segPos;
        if (fertig) {
          p.zustand = p.zielAbschnitt || "BST";
          p.abschnitt = p.zielAbschnitt || "BST";
          p.letzteKontrolle = S.simSek;
          proto(p, "client", "SEG Betreuung", "Selbstständig eingetroffen, registriert.");
          if (p.zustand === "PA") p.transportBereit = false;
          emit("patienten");
        }
      }
    }

    // Einsatzmittel
    for (const m of S.mittel.values()) {
      switch (m.art) {
        case "trupp": truppTakt(m, dt); break;
        case "rtw": rtwTakt(m, dt); break;
        case "rth": rthTakt(m, dt); break;
        case "nef": case "arzt": arztTakt(m, dt); break;
        case "drohne": drohneTakt(m, dt); break;
        default: statischTakt(m, dt);
      }
    }

    gefahrenTakt(dt);
    sonderlagen();
    klinikTakt(dt);

    // Transporte zeitlich fortschreiben
    for (const t of S.transporte) {
      if (t.status === "übergeben" && S.simSek > t.an) t.status = "abgeschlossen";
    }

    // Vitalwert-Drift
    ambientAkku += dt;
    if (ambientAkku > 5) {
      ambientAkku = 0;
      vitalDrift();
      if (S.funkAktiv) ambientFunk();
    }

    warnAkku += dt;
    if (warnAkku > 4) { warnAkku = 0; warnRegeln(); }

    renderAkku += dtReal;
    if (renderAkku > 0.9) { renderAkku = 0; emit("patienten"); emit("mittel"); }

    emit("frame");
  }

  // Messwerte schwanken um den erhobenen Ausgangswert — keine freie Drift, sonst
  // rutschen unauffällige Patienten irgendwann in den Alarmbereich.
  function vitalDrift() {
    const kand = [...S.patienten.values()].filter(
      (p) => p.ll && p.vit && p.vit.puls != null && p.kat !== "TOT");
    if (!kand.length) return;
    const n = Math.min(4, kand.length);
    for (let i = 0; i < n; i++) {
      const p = kand[Math.floor(Math.random() * kand.length)];
      const b = p.basisVit || p.vit;
      const j = (wert, basis, schritt, band, lo, hi) => {
        const neu = wert + Math.round((Math.random() * 2 - 1) * schritt);
        return Math.max(lo, Math.min(hi, Math.max(basis - band, Math.min(basis + band, neu))));
      };
      if (b.puls != null) p.vit.puls = j(p.vit.puls, b.puls, 4, 8, 38, 165);
      if (p.vit.spo2 != null && b.spo2 != null) p.vit.spo2 = j(p.vit.spo2, b.spo2, 2, 4, 68, 100);
      if (p.vit.af != null && b.af != null) p.vit.af = j(p.vit.af, b.af, 1, 3, 5, 42);
      p.aktualisiert = S.simSek;
    }
  }

  /* --------------------------------------------------- Nachgemeldete Betroffene
   * Die Vollzähligkeit ist in der Lage nicht hergestellt; nach dem Abarbeiten des
   * Rosters melden Trupps und Anwohner weiter Betroffene nach. So bleibt das
   * Lagebild dauerhaft in Bewegung. */

  let naechsteId = 0, nachAkku = 0, nachIntervall = 130;

  const NACH_POOL = [
    { kat: "SK3", geh: true, verletzt: ["Prellungen", "Schock"], massnahmen: [],
      vit: { af: 16, puls: 86, spo2: 98, gcs: 15 },
      befund: "Anwohner aus dem Nachbarhaus, leicht verletzt, gehfähig — grün." },
    { kat: "SK3", geh: true, verletzt: ["Rauchgasexposition, leicht"], massnahmen: ["Sauerstoff"],
      vit: { af: 18, puls: 92, spo2: 96, gcs: 15 },
      befund: "Reizhusten nach Rauchexposition, kreislaufstabil — grün, Kontrolle im BHP." },
    { kat: "SK2", geh: false, verletzt: ["Sprunggelenksfraktur", "Platzwunde"], massnahmen: ["Schienung", "Analgesie"],
      vit: { af: 18, puls: 100, spo2: 96, rrs: 126, gcs: 15 },
      befund: "Bei der Räumung des Treppenhauses gestürzt — gelb." },
    { kat: "SK2", geh: false, verletzt: ["Kreislaufkollaps", "Exsikkose"], massnahmen: ["Volumen", "Monitoring"],
      vit: { af: 20, puls: 108, spo2: 95, rrs: 96, gcs: 14 },
      befund: "Ältere Person aus dem Rückgebäude, Kreislauf grenzwertig — gelb." },
    { kat: "SK1", geh: false, verletzt: ["Verschüttung Unterschenkel", "Crush-Syndrom möglich"],
      massnahmen: ["Volumen", "Analgesie", "Wärmeerhalt"],
      vit: { af: 26, puls: 122, spo2: 91, rrs: 98, gcs: 13 },
      befund: "Spät aus Teilverschüttung befreit, Crush-Problematik — rot." },
  ];

  const NACH_MELDER = ["Rettungstrupp 1", "Rettungstrupp 2", "Rettungstrupp 3",
    "Sicherheitstrupp", "Polizei München Land", "EA 5 Betreuung"];

  function nachmeldung() {
    if (S.patienten.size > 55) return;
    const v = NACH_POOL[Math.floor(Math.random() * NACH_POOL.length)];
    const id = ++naechsteId;
    const melder = NACH_MELDER[Math.floor(Math.random() * NACH_MELDER.length)];
    patientAnlegen({
      id, t: S.simSek, ll: streu(S.epi, 70), kat: v.kat, sex: Math.random() < 0.5 ? "m" : "w",
      alter: 18 + Math.floor(Math.random() * 60), geh: v.geh, wach: v.kat !== "SK1", atemweg: true,
      vit: { ...v.vit }, verletzt: v.verletzt.slice(), massnahmen: v.massnahmen.slice(),
      befund: v.befund,
    });
    funken(melder, "Nachmeldung: weitere betroffene Person aufgefunden, Marker " + id +
      " gesetzt, Sichtung angefordert.", [id]);
  }

  const AMBIENT = [
    { t: "{m} an Einsatzleitung: Patient {p} übernommen, Transport läuft.", pat: true },
    { t: "Behandlungsplatz an EA 4: Patient {p} transportbereit.", pat: true },
    { t: "NEF 71/1: Reevaluation Patient {p} — Kreislauf stabil.", pat: true },
    { t: "Betreuungsstelle: Patient {p} registriert, keine Verschlechterung.", pat: true },
    { t: "EA 4 Transport: nächstes Rettungsmittel in zwei Minuten frei.", pat: false },
    { t: "Einsatzleitung an alle Abschnitte: Vollzähligkeitsmeldung an S1.", pat: false },
    { t: "Sicherheitstrupp: Nachmessung Trümmerbereich abgeschlossen.", pat: false },
    { t: "EA 5 Betreuung: Angehörigensammelstelle Musisches Zentrum in Betrieb.", pat: false },
    { t: "Polizei München Land: Absperrgrenze unverändert, Zufahrt Ost frei.", pat: false },
  ];

  function ambientFunk() {
    if (Math.random() > 0.55) return;
    const z = AMBIENT[Math.floor(Math.random() * AMBIENT.length)];
    const kand = [...S.patienten.values()].filter((p) => p.ll && p.kat !== "UNG");
    const p = kand.length ? kand[Math.floor(Math.random() * kand.length)] : null;
    if (z.pat && !p) return;
    const m = [...S.mittel.values()].filter((x) => x.art === "rtw")[0];
    funken("Sprechfunk", z.t.replace("{p}", p ? p.id : "").replace("{m}", m ? m.name : "RTW"),
      z.pat && p ? [p.id] : []);
  }

  /* --------------------------------------------------------------- Kennzahlen */

  function kennzahlen() {
    const k = { SK1: 0, SK2: 0, SK3: 0, SK4: 0, TOT: 0, UNG: 0 };
    let gesamt = 0, gesichtet = 0, transportiert = 0, imBHP = 0, inPA = 0, offen = 0;
    let sichtSumme = 0, sichtN = 0;
    for (const p of S.patienten.values()) {
      gesamt++;
      k[p.kat]++;
      if (p.gesichtet != null) {
        gesichtet++;
        sichtSumme += p.gesichtet - p.erkannt;
        sichtN++;
      }
      if (p.zustand === "klinik") transportiert++;
      else if (p.zustand === "BHP") imBHP++;
      else if (p.zustand === "PA") inPA++;
      else if (p.zustand === "unsighted" || p.zustand === "gesichtet") offen++;
    }
    const freieRTW = [...S.mittel.values()].filter((m) => m.art === "rtw" && m.status === "frei").length;
    const rtwGesamt = [...S.mittel.values()].filter((m) => m.art === "rtw").length;
    return {
      kat: k, gesamt, gesichtet, transportiert, imBHP, inPA, offen,
      sichtSchnitt: sichtN ? sichtSumme / sichtN : 0,
      freieRTW, rtwGesamt,
      offeneWarnungen: S.warnungen.filter((w) => !w.quittiert).length,
    };
  }

  /* -------------------------------------------------------------- Lagemeldung */

  function lagemeldung() {
    const kz = kennzahlen();
    const L = [];
    L.push("LAGEMELDUNG — " + S.einsatz.name);
    L.push("Stichwort: " + S.einsatz.stichwort);
    L.push("Einsatzort: " + S.einsatz.ort);
    L.push("Stand: " + uhr(S.simSek) + " Uhr (Einsatzzeit " + zeit(S.simSek) + ")");
    L.push("Einsatzleitung: ÖEL " + S.einsatz.oel + " · LNA " + S.einsatz.lna + " · OrgL " + S.einsatz.orgl);
    L.push("");
    L.push("1. LAGE");
    L.push("   " + (S.gefahren.get("G2") ? S.gefahren.get("G2").name + ". " : "") +
      "Betroffene: " + S.einsatz.betroffene + ".");
    L.push("   Wetter: " + S.einsatz.wetter);
    L.push("");
    L.push("2. SICHTUNG (" + kz.gesichtet + " von " + kz.gesamt + " gesichtet)");
    L.push("   SK I (rot)    : " + kz.kat.SK1);
    L.push("   SK II (gelb)  : " + kz.kat.SK2);
    L.push("   SK III (grün) : " + kz.kat.SK3);
    L.push("   SK IV (blau)  : " + kz.kat.SK4);
    L.push("   verstorben    : " + kz.kat.TOT);
    L.push("   ungesichtet   : " + kz.kat.UNG);
    L.push("");
    L.push("3. VERSORGUNG UND TRANSPORT");
    L.push("   Patientenablage: " + kz.inPA + " · Behandlungsplatz: " + kz.imBHP +
      " · abtransportiert: " + kz.transportiert);
    L.push("   Rettungsmittel frei: " + kz.freieRTW + " von " + kz.rtwGesamt);
    for (const t of S.transporte.slice(0, 8)) {
      L.push("   #" + t.patient + " " + KAT[t.kat].label + " → " + t.klinikName +
        " (" + t.mittelName + ", ab " + uhr(t.ab) + ", " + t.status + ")");
    }
    L.push("");
    L.push("4. GEFAHREN UND EINSCHRÄNKUNGEN");
    for (const g of S.gefahren.values()) {
      if (!g.aktiv) continue;
      L.push("   [" + (g.stufe === 3 ? "KRITISCH" : g.stufe === 2 ? "ERHÖHT" : "GERING") + "] " +
        g.name + " — " + g.status + " (" + g.verantwortlich + ")");
    }
    L.push("");
    L.push("5. EINSATZABSCHNITTE");
    for (const a of S.abschnitte.values()) L.push("   " + a.kurz.padEnd(12) + a.name + " — " + a.leitung);
    L.push("");
    L.push("6. OFFENE PUNKTE");
    const offene = S.warnungen.filter((w) => !w.quittiert);
    if (!offene.length) L.push("   keine");
    for (const w of offene) L.push("   - " + w.titel + ": " + w.text);
    L.push("");
    L.push("Simulierte Übungslage — keine echten Personendaten. TriARge Live-Demo.");
    return L.join("\n");
  }

  function csvExport() {
    const kopf = ["ID", "Kategorie", "Zustand", "Abschnitt", "Raster", "Lat", "Lon", "Geschlecht",
      "Alter", "AF", "Puls", "SpO2", "RR", "GCS", "Verletzungen", "Maßnahmen", "Klinik"];
    const zeilen = [kopf.join(";")];
    for (const p of [...S.patienten.values()].sort((a, b) => a.id - b.id)) {
      const v = p.vit || {};
      const g = (x) => (x == null ? "" : Math.round(x));
      zeilen.push([
        p.id, KAT[p.kat].label, STATUS_TEXT[p.zustand] || p.zustand,
        p.abschnitt ? (S.abschnitte.get(p.abschnitt) || {}).name || "" : "",
        patientZelle(p), p.ll ? p.ll[0].toFixed(5) : "", p.ll ? p.ll[1].toFixed(5) : "",
        p.sex || "", p.alter ?? "", g(v.af), g(v.puls), g(v.spo2),
        v.rrs != null ? g(v.rrs) + (v.rrd != null ? "/" + g(v.rrd) : "") : "", g(v.gcs),
        (p.verletzt || []).join(" | "), (p.massnahmen || []).join(" | "),
        p.klinik ? (S.kliniken.find((k) => k.id === p.klinik) || {}).name || "" : "",
      ].map((x) => String(x).replace(/;/g, ",")).join(";"));
    }
    return zeilen.join("\r\n");
  }

  /* --------------------------------------------------------------- Steuerung */

  function auswaehlen(sel) {
    S.auswahl = sel;
    emit("auswahl", sel);
  }

  function tempoSetzen(v) { S.tempo = v; emit("steuerung"); }
  function pauseUmschalten() { S.pause = !S.pause; emit("steuerung"); }

  function truppHinzufuegen(name, notiz) {
    const id = "X" + (S.mittel.size + 1);
    const basis = S.abschnitte.get("PA");
    S.mittel.set(id, {
      id, name, kurz: name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "TR",
      art: "trupp", basis: "PA", rolle: notiz || "Transport PA → BHP", besatzung: 4,
      ll: streu(basis.ll, 12), heim: basis.ll.slice(), kurs: 0, pfad: null, pfadPos: 0,
      status: "bereit", auftrag: null, patient: null, wartet: 0, online: true,
      letzterKontakt: S.simSek, phase: 0, gefahren: 0,
    });
    ereignis("system", "Einsatzmittel " + name + " registriert");
    emit("mittel");
  }

  function truppEntfernen(id) {
    const m = S.mittel.get(id);
    if (!m) return;
    if (m.patient) {
      const p = S.patienten.get(m.patient);
      if (p) { p.traeger = null; p.belegtVon = null; p.zustand = "gesichtet"; }
    }
    S.mittel.delete(id);
    ereignis("system", "Einsatzmittel " + m.name + " abgemeldet");
    emit("mittel");
  }

  function neustart() {
    S.patienten.clear();
    S.mittel.clear();
    S.gefahren.clear();
    S.abschnitte.clear();
    S.funk.length = 0;
    S.ereignisse.length = 0;
    S.warnungen.length = 0;
    S.transporte.length = 0;
    S.zaehler = { funk: 0, ereignis: 0, warnung: 0 };
    S.auswahl = null;
    S.filter.zelle = null;
    letzterFrame = 0;
    init(window.SZENARIO, window.NB_GEO);
    emit("neustart");
    emit("patienten"); emit("mittel"); emit("gefahren");
    emit("funk"); emit("ereignisse"); emit("warnungen"); emit("transporte");
  }

  function neuerEinsatz(name) {
    S.sitzungen = S.sitzungen.map((s) => ({ ...s, aktiv: false }));
    S.sitzungen.push({ name, aktiv: true });
    S.patienten.clear();
    S.funk.length = 0;
    S.ereignisse.length = 0;
    S.warnungen.length = 0;
    S.transporte.length = 0;
    naechsterPatient = ROSTER.length;
    naechsterFunk = FUNK_SKRIPT.length;
    ereignis("system", "Neuer Einsatz eröffnet: " + name);
    emit("patienten"); emit("funk"); emit("warnungen"); emit("transporte"); emit("sitzungen");
  }

  return {
    S, KAT, STATUS_TEXT, on, emit, init, takt,
    dist, bearing, versetzt, streu, route, zelle, patientZelle, zellSchluessel, zellGrenzen,
    esc, zeit, uhr,
    kennzahlen, lagemeldung, csvExport, auswaehlen, tempoSetzen, pauseUmschalten,
    kategorieSetzen, patientLoeschen, patientVerschieben, truppHinzufuegen, truppEntfernen,
    neustart, neuerEinsatz, funken, ereignis, graph,
  };
})();
