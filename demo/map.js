/* TriARge — Kartendarstellung (Leaflet + OpenStreetMap).
 *
 * Die Karte ist das Hauptelement des Lagebilds: echte Kartengrundlage von
 * Neubiberg, darüber das Einsatzraster, die Einsatzabschnitte, die Gefahrenlage
 * und alle bewegten Einsatzmittel und Patienten. Gezeichnet wird ausschließlich
 * aus dem Zustand in engine.js.
 */

"use strict";

const KARTE = (function () {
  const S = TR.S;
  let map, basis = {}, aktiveBasis = "hell";
  const G = {};              // LayerGroups
  const patMarker = new Map();
  const mitMarker = new Map();
  const spurLinien = new Map();
  let rasterZellen = [];
  let rauchPoly = null, gasKreis = null, absperrKreis = null;
  let planOverlay = null;
  let messModus = false, messPunkte = [], messLinie = null, messLabel = null;
  let behaelterEl = null;

  const KACHELN = {
    hell: {
      url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      opt: { maxZoom: 19, subdomains: "abcd",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, &copy; <a href="https://carto.com/attributions">CARTO</a>' },
    },
    osm: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      opt: { maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende' },
    },
  };

  /* ------------------------------------------------------------------ Aufbau */

  function init(el) {
    const behaelter = typeof el === "string" ? document.getElementById(el) : el;
    behaelterEl = behaelter;
    map = L.map(behaelter, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
      minZoom: 13,
      maxZoom: 19,

      /* Stufenloses Zoomen statt fester Zoomstufen.
       *
       * `zoomSnap: 0` erlaubt jede Zwischenstufe — mit der Voreinstellung 1
       * rastet jede Zoomänderung auf ganze Stufen ein, der Ausschnitt springt
       * also in Sprüngen von Faktor 2.
       *
       * `zoomAnimation: false` schaltet Leaflets Zoom-Trickbild ab: dabei wird
       * die gesamte Kartenebene per CSS vergrößert und erst am Ende neu
       * gezeichnet — währenddessen wachsen und wandern alle Symbole sichtbar
       * und rasten danach wieder ein. Ohne diese Animation wird jede
       * Zoomänderung sofort und maßstabsgetreu gezeichnet; die weichen
       * Übergänge übernehmen die Zoomfahrten weiter unten Bild für Bild. */
      zoomSnap: 0,
      zoomDelta: 0.5,
      zoomAnimation: false,
      bounceAtZoomLimits: false,
    });
    startAusschnitt();

    /* Leaflet merkt sich die Containergröße beim Anlegen. Steht das Layout zu
     * diesem Zeitpunkt noch nicht (verstecktes Fenster, später geladene
     * Stylesheets), bleibt die Größe 0 und der Ausschnitt springt auf die
     * höchste Zoomstufe. Deshalb wird die Größe beobachtet und der Ausschnitt
     * beim ersten echten Messwert einmal neu gesetzt. */
    let ausschnittGesetzt = map.getSize().x > 0 && map.getSize().y > 0;
    const nachmessen = () => {
      const vorher = map.getSize();
      map.invalidateSize({ animate: false });
      const jetzt = map.getSize();
      if (!ausschnittGesetzt && jetzt.x > 0 && jetzt.y > 0) {
        ausschnittGesetzt = true;
        startAusschnitt();
      }
      return vorher;
    };
    if (window.ResizeObserver) new ResizeObserver(nachmessen).observe(behaelter);
    window.addEventListener("resize", nachmessen);
    requestAnimationFrame(nachmessen);
    setTimeout(nachmessen, 400);
    // Rückfall über einen Timer: greift auch dort, wo ResizeObserver und
    // requestAnimationFrame nicht laufen (z. B. nicht dargestelltes Fenster).
    setInterval(() => {
      const s = map.getSize();
      if (s.x !== behaelter.clientWidth || s.y !== behaelter.clientHeight) nachmessen();
    }, 1000);

    zoomEinrichten(behaelter);

    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.scale({ position: "bottomright", imperial: false, maxWidth: 140 }).addTo(map);

    map.createPane("pNetz").style.zIndex = 340;
    map.createPane("pRaster").style.zIndex = 350;
    map.createPane("pFlaeche").style.zIndex = 400;
    map.createPane("pLinie").style.zIndex = 430;
    map.createPane("pLabel").style.zIndex = 560;
    map.getPane("pLabel").style.pointerEvents = "none";

    basis.hell = L.tileLayer(KACHELN.hell.url, KACHELN.hell.opt);
    basis.osm = L.tileLayer(KACHELN.osm.url, KACHELN.osm.opt);
    basis.hell.addTo(map);

    // Ohne Netz kommen keine Kacheln an. Dann wird auf das mitgelieferte
    // OSM-Wegenetz umgeschaltet, damit das Lagebild trotzdem lesbar bleibt.
    let kachelnDa = 0;
    basis.hell.on("tileload", () => { kachelnDa++; });
    basis.osm.on("tileload", () => { kachelnDa++; });
    setTimeout(() => {
      if (kachelnDa === 0 && aktiveBasis !== "leer") {
        basisSetzen("leer");
        const sel = document.getElementById("basiskarte");
        if (sel) sel.value = "leer";
        TR.ereignis("system", "Keine Kartenkacheln erreichbar — Anzeige auf mitgeliefertes Wegenetz umgestellt");
      }
    }, 7000);

    for (const k of ["netz", "raster", "abschnitte", "gefahren", "sperren", "poi",
      "spuren", "patienten", "mittel", "label"]) {
      G[k] = L.layerGroup().addTo(map);
    }

    wegenetzZeichnen();
    rasterZeichnen();
    abschnitteZeichnen();
    gefahrenZeichnen();
    sperrenZeichnen();
    poiZeichnen();
    mittelZeichnen();
    patientenZeichnen();
    ebenenAnwenden();

    map.on("mousemove", (e) => {
      const el2 = document.getElementById("koord");
      if (el2) {
        el2.textContent = e.latlng.lat.toFixed(5) + ", " + e.latlng.lng.toFixed(5) +
          "  ·  Raster " + TR.zelle([e.latlng.lat, e.latlng.lng]);
      }
    });
    map.on("click", (e) => {
      if (messModus) { messPunktSetzen(e.latlng); return; }
      TR.auswaehlen(null);
    });
    // Beim stufenlosen Zoomen laufen die Zwischenstufen über "zoom"; nur auf
    // "zoomend" zu hören würde die Beschriftungsstufe hinterherhinken lassen.
    const zoomStufeAnzeigen = () => {
      document.getElementById("karte").classList.toggle("zoom-weit", map.getZoom() < 16);
    };
    map.on("zoom zoomend", zoomStufeAnzeigen);
    zoomStufeAnzeigen();

    TR.on("frame", frameTakt);
    TR.on("patienten", patientenZeichnen);
    TR.on("mittel", mittelZeichnen);
    TR.on("gefahren", gefahrenZeichnen);
    TR.on("auswahl", auswahlZeigen);
    TR.on("abschnitte", abschnitteZeichnen);
    TR.on("neustart", () => {
      patMarker.forEach((m) => G.patienten.removeLayer(m));
      patMarker.clear();
      mitMarker.forEach((m) => G.mittel.removeLayer(m));
      mitMarker.clear();
      abschnitteZeichnen();
      gefahrenZeichnen();
    });
    /* Lagewechsel: anderes Gebiet, anderes Raster, anderes Wegenetz — alle
     * Ebenen werden neu gezeichnet und der Ausschnitt neu gesetzt. */
    TR.on("szenario", () => {
      messZuruecksetzen();
      planEntfernen();
      spurLinien.forEach((l) => G.spuren.removeLayer(l));
      spurLinien.clear();
      wegenetzZeichnen();
      rasterZeichnen();
      sperrenZeichnen();
      poiZeichnen();
      startAusschnitt(false);
    });

    return map;
  }

  /* Auf Telefonbreite ist der gesamte Einsatzraum nur ein Gedränge aus
   * Symbolen. Dort beginnt die Karte an der Schadensstelle — der Überblick
   * ist eine Schaltfläche entfernt. */
  function startAusschnitt(animate) {
    const b = S.bbox;
    if (!b) return;
    if (behaelterEl && behaelterEl.clientWidth > 0 && behaelterEl.clientWidth < 620) {
      map.setView(S.epi, 16.2, { animate: !!animate });
    } else {
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: [8, 8], animate: !!animate });
    }
  }

  /* ------------------------------------------------------------------ Zoomen
   *
   * Gezoomt wird stufenlos und am Zeiger verankert: der Punkt unter dem
   * Mauszeiger (bzw. zwischen den Fingern) bleibt genau dort, wo er ist, und
   * jede Zwischenstufe wird sofort maßstabsgetreu gezeichnet. Dadurch bleibt
   * jedes Symbol über seiner Koordinate stehen, statt während einer Animation
   * mitzuwandern.
   *
   * Weiche Übergänge (Doppelklick, Zoomschaltflächen, Tastatur) laufen als
   * Zoomfahrt Bild für Bild: jedes einzelne Bild ist ein vollständig gültiger
   * Kartenzustand, kein Zwischenbild einer Animation. */

  const ZOOM_PRO_PIXEL = 1 / 340;   // Zoomstufen je Pixel Radweg
  const ZOOM_JE_BILD = 0.6;         // Deckel gegen Sprünge bei groben Rädern
  const GESTE_PAUSE = 250;          // ms ohne Rad = neue Geste, neuer Anker
  let radAkku = 0, radPunkt = null, radBild = 0, zoomFahrtBild = 0;
  let radAnker = null;              // { ll, punkt, zeit } der laufenden Radgeste

  function zoomEinrichten(behaelter) {
    // Leaflets eigene Rad- und Doppelklicksteuerung arbeitet in ganzen Stufen
    // und mit Zwischenanimation; beides wird hier ersetzt.
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();

    behaelter.addEventListener("wheel", (e) => {
      e.preventDefault();
      zoomFahrtAbbrechen();
      // Zeilen- und Seitenraster mancher Mäuse in Pixel umrechnen; die
      // Kneifgeste auf dem Trackpad meldet sich als Strg+Rad.
      const einheit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? map.getSize().y : 1;
      radAkku += -e.deltaY * einheit * ZOOM_PRO_PIXEL * (e.ctrlKey ? 2.5 : 1);
      radPunkt = map.mouseEventToContainerPoint(e);
      if (!radBild) radBild = requestAnimationFrame(radAnwenden);
    }, { passive: false });

    behaelter.addEventListener("dblclick", (e) => {
      if (messModus) return;              // im Messmodus setzt der Klick Punkte
      if (e.target.closest(".leaflet-control")) return;
      zoomFahrt(map.getZoom() + (e.shiftKey || e.altKey ? -1 : 1),
        map.mouseEventToContainerPoint(e));
    });

    // Zoomschaltflächen und Tastatur laufen als weiche Fahrt statt als Sprung.
    map.zoomIn = (delta) => zoomFahrt(map.getZoom() + (delta || map.options.zoomDelta), null);
    map.zoomOut = (delta) => zoomFahrt(map.getZoom() - (delta || map.options.zoomDelta), null);
  }

  // Alle Radereignisse eines Bildes werden zusammengefasst: ein Zoomschritt je
  // Bild, sonst rechnet die Karte mehrfach pro Bild neu.
  function radAnwenden() {
    radBild = 0;
    const dz = Math.max(-ZOOM_JE_BILD, Math.min(ZOOM_JE_BILD, radAkku));
    radAkku = 0;
    if (!dz || !radPunkt) return;
    zoomSetzen(map.getZoom() + dz, radPunkt, ankerHalten(radPunkt).ll);
  }

  /* Der Ankerpunkt einer Radgeste wird einmal bestimmt und für alle weiteren
   * Schritte behalten. Würde er bei jedem Schritt neu aus dem aktuellen
   * Kartenzustand gelesen, summierte sich die Pixelrundung, die Leaflet bei
   * jedem Ausschnittwechsel vornimmt — die Karte kröche unter dem Zeiger weg
   * (gemessen: rund 10 px über fünf Zoomstufen). */
  function ankerHalten(punkt) {
    const jetzt = performance.now();
    if (!radAnker || jetzt - radAnker.zeit > GESTE_PAUSE ||
        Math.abs(radAnker.punkt.x - punkt.x) > 4 || Math.abs(radAnker.punkt.y - punkt.y) > 4) {
      radAnker = { ll: map.containerPointToLatLng(punkt), punkt, zeit: jetzt };
    }
    radAnker.zeit = jetzt;
    return radAnker;
  }

  function zoomGrenzen(z) {
    return Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), z));
  }

  /* Setzt die Zoomstufe so, dass `ankerLL` genau auf `punkt` liegen bleibt.
   * Der neue Mittelpunkt wird direkt gerechnet, statt sich über den aktuellen
   * (bereits gerundeten) Zustand zu hangeln. */
  function zoomSetzen(z, punkt, ankerLL) {
    const ziel = zoomGrenzen(z);
    if (Math.abs(ziel - map.getZoom()) < 1e-4) return;
    if (!punkt) {
      map.setZoom(ziel, { animate: false });
      return;
    }
    const anker = ankerLL || map.containerPointToLatLng(punkt);
    const halb = map.getSize().divideBy(2);
    const zentrum = map.unproject(map.project(anker, ziel).subtract(punkt).add(halb), ziel);
    map.setView(zentrum, ziel, { animate: false });
  }

  function zoomFahrt(zielZoom, punkt, dauer) {
    zoomFahrtAbbrechen();
    const start = map.getZoom();
    const ziel = zoomGrenzen(zielZoom);
    if (Math.abs(ziel - start) < 1e-3) return map;
    // Anker einmal für die ganze Fahrt festhalten — aus demselben Grund wie
    // bei der Radgeste.
    const anker = punkt ? map.containerPointToLatLng(punkt) : null;
    const t0 = performance.now(), d = dauer || 240;
    const schritt = (jetzt) => {
      const t = Math.min(1, (jetzt - t0) / d);
      zoomSetzen(start + (ziel - start) * (1 - Math.pow(1 - t, 3)), punkt, anker);
      zoomFahrtBild = t < 1 ? requestAnimationFrame(schritt) : 0;
    };
    zoomFahrtBild = requestAnimationFrame(schritt);
    return map;
  }

  function zoomFahrtAbbrechen() {
    if (zoomFahrtBild) cancelAnimationFrame(zoomFahrtBild);
    zoomFahrtBild = 0;
  }

  /* --------------------------------------------------------------- Wegenetz */

  function wegenetzZeichnen() {
    G.netz.clearLayers();
    const geo = TR.geo();
    for (const [, klasse, pts] of geo.ways || []) {
      const ll = [];
      for (let i = 0; i < pts.length; i += 2) ll.push([pts[i], pts[i + 1]]);
      L.polyline(ll, {
        pane: "pNetz",
        color: klasse === 0 ? "#9aa3ac" : klasse === 1 ? "#b9c0c7" : "#cfd4d9",
        weight: klasse === 0 ? 3 : klasse === 1 ? 2 : 1,
        opacity: 0.9, interactive: false,
      }).addTo(G.netz);
    }
  }

  /* ----------------------------------------------------------------- Raster */

  function rasterZeichnen() {
    G.raster.clearLayers();
    rasterZellen = [];
    const b = S.bbox;
    const dw = (b[3] - b[1]) / S.raster.spalten;
    const dh = (b[2] - b[0]) / S.raster.zeilen;
    for (let r = 0; r < S.raster.zeilen; r++) {
      for (let c = 0; c < S.raster.spalten; c++) {
        const ref = String.fromCharCode(65 + c) + (r + 1);
        const sued = b[2] - (r + 1) * dh, nord = b[2] - r * dh;
        const west = b[1] + c * dw, ost = b[1] + (c + 1) * dw;
        const rect = L.rectangle([[sued, west], [nord, ost]], {
          pane: "pRaster", color: "#7b848d", weight: 0.7, opacity: 0.55,
          fillColor: "#000", fillOpacity: 0, className: "raster-zelle",
        }).addTo(G.raster);
        rect.zellRef = ref;
        rect.on("click", (e) => {
          L.DomEvent.stop(e);
          if (messModus) { messPunktSetzen(e.latlng); return; }
          TR.auswaehlen({ typ: "zelle", id: ref });
        });
        rect.bindTooltip(ref, { permanent: false, direction: "center", className: "tt-zelle" });
        rasterZellen.push(rect);

        L.marker([nord, west], {
          pane: "pLabel", interactive: false,
          icon: L.divIcon({ className: "raster-label", html: ref, iconSize: [22, 12], iconAnchor: [-2, -2] }),
        }).addTo(G.raster);
      }
    }
    belegungFaerben();
  }

  function belegungFaerben() {
    const an = S.ebenen.belegung;
    const zaehl = new Map();
    if (an) {
      for (const p of S.patienten.values()) {
        if (!p.ll) continue;
        const z = TR.zelle(p.ll);
        const e = zaehl.get(z) || { n: 0, rot: 0 };
        e.n++;
        if (p.kat === "SK1") e.rot++;
        zaehl.set(z, e);
      }
    }
    for (const rect of rasterZellen) {
      if (!an) { rect.setStyle({ fillOpacity: 0 }); continue; }
      const e = zaehl.get(rect.zellRef);
      if (!e) { rect.setStyle({ fillOpacity: 0 }); continue; }
      const stufe = Math.min(1, (e.n + e.rot * 1.5) / 6);
      rect.setStyle({ fillColor: e.rot ? "#d1232a" : "#1f5fa8", fillOpacity: 0.06 + stufe * 0.22 });
    }
  }

  /* ----------------------------------------------------------- Abschnitte */

  const ABSCHNITT_FARBE = {
    einsatz: "#c0392b", med: "#1f6f43", transport: "#1f5fa8",
    betreuung: "#7a5c1e", fuehrung: "#4a4f55", sonstig: "#6b7178",
  };

  function abschnitteZeichnen() {
    G.abschnitte.clearLayers();
    G.label.clearLayers();
    for (const a of S.abschnitte.values()) {
      if (a.aktiv === false) continue;   // noch nicht eingerichtet
      const farbe = ABSCHNITT_FARBE[a.art] || "#555";
      const kreis = L.circle(a.ll, {
        pane: "pFlaeche", radius: a.r, color: farbe, weight: 1.4,
        dashArray: a.hq ? null : "5 4", fillColor: farbe, fillOpacity: 0.06,
      }).addTo(G.abschnitte);
      kreis.on("click", (e) => { L.DomEvent.stop(e); TR.auswaehlen({ typ: "abschnitt", id: a.id }); });
      kreis.bindTooltip(a.name, { sticky: true });

      // Die Beschriftung sitzt am Nordrand des Abschnitts und ist dort
      // geografisch verankert. Ein Pixelversatz aus dem Meter-Radius (früher
      // r/3) säße auf jeder Zoomstufe woanders — die Beschriftung wanderte
      // beim Zoomen aus ihrem Abschnitt heraus.
      // Feste Symbolgröße: sonst richtet Leaflet die Beschriftung an ihrer
      // Textbreite aus und sie sitzt nicht mittig über dem Abschnitt.
      L.marker(TR.versetzt(a.ll, a.r, 0), {
        pane: "pLabel", interactive: false,
        icon: L.divIcon({
          className: "abschnitt-label" + (a.hq ? " ist-hq" : ""),
          html: '<b>' + TR.esc(a.kurz) + '</b>' + (a.hq ? '<i>Führung</i>' : ''),
          iconSize: [160, 28], iconAnchor: [80, 30],
        }),
      }).addTo(G.label);
    }
  }

  /* ------------------------------------------------------------- Gefahren */

  function gefahrenZeichnen() {
    G.gefahren.clearLayers();
    const gasG = S.gefahren.get("G1");

    const rAbsperr = S.absperrung || 250;
    absperrKreis = L.circle(S.epi, {
      pane: "pFlaeche", radius: rAbsperr, color: "#b0262c", weight: 1.2, dashArray: "3 5",
      fill: false, interactive: false,
    }).addTo(G.gefahren);
    L.marker(TR.versetzt(S.epi, rAbsperr, 315), {
      pane: "pLabel", interactive: false,
      icon: L.divIcon({ className: "kreis-label", html: "Absperrgrenze " + rAbsperr + " m",
        iconSize: [130, 12], iconAnchor: [65, 6] }),
    }).addTo(G.gefahren);

    for (const g of S.gefahren.values()) {
      if (!g.aktiv) continue;
      const farbe = g.stufe === 3 ? "#b0262c" : g.stufe === 2 ? "#c07a10" : "#6b7178";
      if (g.r > 0) {
        const k = L.circle(g.ll, {
          pane: "pFlaeche", radius: g.r, color: farbe, weight: 1.2,
          fillColor: farbe, fillOpacity: g.art === "gas" ? 0.1 : 0.07, dashArray: "4 4",
        }).addTo(G.gefahren);
        k.on("click", (e) => { L.DomEvent.stop(e); TR.auswaehlen({ typ: "gefahr", id: g.id }); });
        k.bindTooltip(g.name, { sticky: true });
        if (g.art === "gas") gasKreis = k;
      }
      // Umriss des Schadensobjekts: entweder direkt in der Gefahr hinterlegt
      // oder als Gebäude-Kennung im Geodatensatz der Lage.
      const umriss = g.umriss ||
        (g.gebaeude ? gebaeudeUmriss(g.gebaeude) : null);
      if (umriss) {
        L.polygon(umriss, {
          pane: "pFlaeche", color: "#8c1c22", weight: 2, fillColor: "#b0262c", fillOpacity: 0.35,
        }).bindTooltip(g.umrissText || ("Schadensobjekt — " + g.name), { sticky: true })
          .addTo(G.gefahren);
      }
      const m = L.marker(g.ll, {
        icon: L.divIcon({
          className: "mk mk-haz haz-" + g.stufe,
          html: "<span>" + TR.esc(g.code) + "</span>", iconSize: [30, 16], iconAnchor: [15, 8],
        }),
      }).addTo(G.gefahren);
      m.on("click", (e) => { L.DomEvent.stop(e); TR.auswaehlen({ typ: "gefahr", id: g.id }); });
      m.bindTooltip(g.name, { direction: "top" });
    }
    rauchAktualisieren();
  }

  // Umriss eines Gebäudes aus dem Geodatensatz der Lage (OSM-Kennung).
  function gebaeudeUmriss(kennung) {
    const bau = (TR.geo().buildings || []).find((x) => x[0] === kennung);
    if (!bau) return null;
    const ll = [];
    for (let i = 0; i < bau[2].length; i += 2) ll.push([bau[2][i], bau[2][i + 1]]);
    return ll;
  }

  function rauchAktualisieren() {
    const brand = S.gefahren.get("G3");
    if (!brand || !brand.aktiv || !brand.wind) return;
    const richtung = (brand.wind.grad + 180) % 360;   // Windrichtung = woher; Fahne zieht dorthin
    const laenge = brand.fahneLaenge || 160;
    const punkte = [brand.ll];
    for (let i = -1; i <= 1; i += 0.25) {
      punkte.push(TR.versetzt(brand.ll, laenge * (1 - Math.abs(i) * 0.28), richtung + i * 16));
    }
    if (rauchPoly) G.gefahren.removeLayer(rauchPoly);
    rauchPoly = L.polygon(punkte, {
      pane: "pFlaeche", color: "#6b7178", weight: 1, opacity: 0.5,
      fillColor: "#6b7178", fillOpacity: 0.16, interactive: false,
    }).addTo(G.gefahren);
  }

  function sperrenZeichnen() {
    G.sperren.clearLayers();
    for (const s of S.sperren) {
      const m = L.marker(s.ll, {
        icon: L.divIcon({ className: "mk mk-sperre", html: "<span></span>", iconSize: [14, 14], iconAnchor: [7, 7] }),
      }).addTo(G.sperren);
      m.bindTooltip("Straßensperre — " + s.name + " (" + s.von + ")", { direction: "top" });
      m.on("click", (e) => { L.DomEvent.stop(e); TR.auswaehlen({ typ: "sperre", id: s.id }); });
    }
    for (const pts of TR.geo().rail || []) {
      const ll = [];
      for (let i = 0; i < pts.length; i += 2) ll.push([pts[i], pts[i + 1]]);
      L.polyline(ll, { pane: "pLinie", color: "#b0262c", weight: 3, dashArray: "10 6", opacity: 0.8 })
        .bindTooltip("S7 gesperrt — Haltepunkt Neubiberg", { sticky: true })
        .addTo(G.sperren);
    }
  }

  function poiZeichnen() {
    G.poi.clearLayers();
    for (const p of S.poi) {
      L.marker(p.ll, {
        pane: "pLabel", interactive: false,
        icon: L.divIcon({
          className: "poi-label", html: TR.esc(p.name),
          iconSize: [170, 12], iconAnchor: [-6, 6],   // 6 px rechts neben und über dem Punkt
        }),
      }).addTo(G.poi);
      L.circleMarker(p.ll, {
        pane: "pLinie", radius: 2.5, color: "#5a6068", weight: 1, fillColor: "#fff", fillOpacity: 1,
      }).addTo(G.poi);
    }
  }

  /* ------------------------------------------------------------- Patienten */

  function patientIcon(p) {
    const sel = S.auswahl && S.auswahl.typ === "patient" && S.auswahl.id === p.id;
    const kritisch = p.vit && p.vit.spo2 != null && p.vit.spo2 < 90 && p.kat !== "TOT";
    return L.divIcon({
      className: "mk mk-pat kat-" + p.kat + (sel ? " ausgewaehlt" : "") + (kritisch ? " kritisch" : "") +
        (p.zustand === "getragen" ? " bewegt" : ""),
      html: "<span>" + p.id + "</span>",
      iconSize: [20, 20], iconAnchor: [10, 10],
    });
  }

  function patientenZeichnen() {
    const gesehen = new Set();
    for (const p of S.patienten.values()) {
      if (!p.ll) continue;
      if (!sichtbar(p)) continue;
      gesehen.add(p.id);
      let m = patMarker.get(p.id);
      if (!m) {
        m = L.marker(p.ll, { icon: patientIcon(p), draggable: true, riseOnHover: true, zIndexOffset: 200 });
        m.on("click", (e) => { L.DomEvent.stop(e); TR.auswaehlen({ typ: "patient", id: p.id }); });
        m.on("dragstart", () => { m.wirdGezogen = true; });
        m.on("dragend", (e) => {
          m.wirdGezogen = false;
          const ll = e.target.getLatLng();
          TR.patientVerschieben(p.id, [ll.lat, ll.lng]);
        });
        m.addTo(G.patienten);
        patMarker.set(p.id, m);
      }
      const neuKlasse = patientIcon(p);
      if (m.letzteKlasse !== neuKlasse.options.className) {
        m.setIcon(neuKlasse);
        m.letzteKlasse = neuKlasse.options.className;
      }
      const tt = tooltipPatient(p);
      if (m.getTooltip()) m.setTooltipContent(tt);
      else m.bindTooltip(tt, { direction: "top", offset: [0, -8] });
    }
    for (const [id, m] of patMarker) {
      if (!gesehen.has(id)) { G.patienten.removeLayer(m); patMarker.delete(id); }
    }
    belegungFaerben();
  }

  function tooltipPatient(p) {
    const v = p.vit || {};
    const vit = [
      v.af != null ? "AF " + Math.round(v.af) : null,
      v.puls != null ? "Puls " + Math.round(v.puls) : null,
      v.spo2 != null ? "SpO₂ " + Math.round(v.spo2) + " %" : null,
      v.gcs != null ? "GCS " + Math.round(v.gcs) : null,
    ].filter(Boolean).join(" · ");
    return "<b>Patient #" + p.id + "</b> — " + TR.KAT[p.kat].label + "<br>" +
      TR.esc(TR.STATUS_TEXT[p.zustand] || p.zustand) + " · Raster " + TR.zelle(p.ll) +
      (vit ? "<br>" + vit : "");
  }

  function sichtbar(p) {
    const f = S.filter;
    if (f.kats.size && !f.kats.has(p.kat)) return false;
    if (f.zelle && TR.zelle(p.ll) !== f.zelle) return false;
    if (f.nurOffen && (p.zustand === "klinik" || p.zustand === "BST")) return false;
    if (f.text) {
      const t = f.text.toLowerCase();
      const hay = ("#" + p.id + " " + TR.KAT[p.kat].label + " " + (p.verletzt || []).join(" ") + " " +
        (p.massnahmen || []).join(" ") + " " + (p.befund || "")).toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  }

  /* ---------------------------------------------------------- Einsatzmittel */

  function mittelIcon(m) {
    const sel = S.auswahl && S.auswahl.typ === "mittel" && S.auswahl.id === m.id;
    const beladen = !!m.patient;
    return L.divIcon({
      className: "mk mk-unit u-" + m.art + (sel ? " ausgewaehlt" : "") + (beladen ? " beladen" : "") +
        (m.pfad ? " faehrt" : ""),
      html: "<span>" + TR.esc(m.kurz) + "</span>",
      iconSize: [26, 16], iconAnchor: [13, 8],
    });
  }

  function mittelZeichnen() {
    const gesehen = new Set();
    for (const m of S.mittel.values()) {
      gesehen.add(m.id);
      let mk = mitMarker.get(m.id);
      if (!mk) {
        mk = L.marker(m.ll, { icon: mittelIcon(m), riseOnHover: true, zIndexOffset: 100 });
        mk.on("click", (e) => { L.DomEvent.stop(e); TR.auswaehlen({ typ: "mittel", id: m.id }); });
        mk.addTo(G.mittel);
        mitMarker.set(m.id, mk);
      }
      const ic = mittelIcon(m);
      if (mk.letzteKlasse !== ic.options.className) {
        mk.setIcon(ic);
        mk.letzteKlasse = ic.options.className;
      }
      const txt = "<b>" + TR.esc(m.name) + "</b><br>" + TR.esc(m.rolle) + "<br>Status: " + TR.esc(m.status) +
        (m.patient ? "<br>Patient #" + m.patient + " an Bord" : "");
      if (mk.getTooltip()) mk.setTooltipContent(txt);
      else mk.bindTooltip(txt, { direction: "top", offset: [0, -8] });
    }
    for (const [id, mk] of mitMarker) {
      if (!gesehen.has(id)) { G.mittel.removeLayer(mk); mitMarker.delete(id); }
    }
  }

  /* -------------------------------------------------------------- Animation */

  let rauchAkku = 0;

  function frameTakt() {
    for (const [id, mk] of mitMarker) {
      const m = S.mittel.get(id);
      if (!m) continue;
      const ll = mk.getLatLng();
      if (Math.abs(ll.lat - m.ll[0]) > 1e-7 || Math.abs(ll.lng - m.ll[1]) > 1e-7) mk.setLatLng(m.ll);
    }
    for (const [id, mk] of patMarker) {
      const p = S.patienten.get(id);
      if (!p || !p.ll || mk.wirdGezogen) continue;
      const ll = mk.getLatLng();
      if (Math.abs(ll.lat - p.ll[0]) > 1e-7 || Math.abs(ll.lng - p.ll[1]) > 1e-7) mk.setLatLng(p.ll);
    }
    spurenAktualisieren();

    rauchAkku += 1;
    if (rauchAkku > 25) { rauchAkku = 0; rauchAktualisieren(); gasRadius(); }

    if (S.verfolgt) {
      const m = S.mittel.get(S.verfolgt);
      if (m) map.panTo(m.ll, { animate: true, duration: 0.4, noMoveStart: true });
    }
  }

  function gasRadius() {
    const g = S.gefahren.get("G1");
    if (g && gasKreis && g.messwert) {
      const r = 40 + g.messwert.wert * 1.8;
      gasKreis.setRadius(r);
      gasKreis.setStyle({ fillOpacity: 0.05 + Math.min(0.14, g.messwert.wert / 400) });
    }
  }

  function spurenAktualisieren() {
    if (!S.ebenen.spuren) {
      spurLinien.forEach((l) => G.spuren.removeLayer(l));
      spurLinien.clear();
      return;
    }
    for (const m of S.mittel.values()) {
      const alt = spurLinien.get(m.id);
      if (!m.pfad) {
        if (alt) { G.spuren.removeLayer(alt); spurLinien.delete(m.id); }
        continue;
      }
      const rest = m.pfad.slice(m.pfadPos);
      rest[0] = m.ll;
      if (alt) alt.setLatLngs(rest);
      else {
        spurLinien.set(m.id, L.polyline(rest, {
          pane: "pLinie", color: m.patient ? "#b0262c" : "#4a76a8", weight: 1.6,
          opacity: 0.55, dashArray: "4 4", interactive: false,
        }).addTo(G.spuren));
      }
    }
  }

  /* ------------------------------------------------------------- Steuerung */

  function ebenenAnwenden() {
    const e = S.ebenen;
    umschalten(G.netz, e.wege);
    umschalten(G.raster, e.raster);
    umschalten(G.abschnitte, e.abschnitte);
    umschalten(G.label, e.abschnitte && e.beschriftung);
    umschalten(G.gefahren, e.gefahren);
    umschalten(G.sperren, e.sperren);
    umschalten(G.poi, e.poi && e.beschriftung);
    umschalten(G.patienten, e.patienten);
    umschalten(G.mittel, e.mittel);
    umschalten(G.spuren, e.spuren);
    belegungFaerben();
  }

  function umschalten(gruppe, an) {
    if (!gruppe) return;
    if (an && !map.hasLayer(gruppe)) map.addLayer(gruppe);
    if (!an && map.hasLayer(gruppe)) map.removeLayer(gruppe);
  }

  function basisSetzen(name) {
    aktiveBasis = name;
    for (const k of Object.keys(basis)) {
      if (map.hasLayer(basis[k])) map.removeLayer(basis[k]);
    }
    if (basis[name]) map.addLayer(basis[name]);
    // Ohne Kachelkarte wird das gebackene Wegenetz eingeblendet.
    if (name === "leer") { S.ebenen.wege = true; ebenenAnwenden(); }
    document.getElementById("karte").classList.toggle("basis-leer", name === "leer");
  }

  function rasterSetzen(spalten, zeilen) {
    S.raster.spalten = Math.max(2, Math.min(26, spalten | 0));
    S.raster.zeilen = Math.max(2, Math.min(40, zeilen | 0));
    rasterZeichnen();
    ebenenAnwenden();
  }

  /* Eine Auswahl darf das Lagebild nicht unter der Hand verschieben: liegt das
   * Ziel schon gut sichtbar im Ausschnitt, bleibt die Karte stehen. Erst wenn
   * es außerhalb liegt (oder die Mindestzoomstufe unterschritten ist), fährt
   * die Karte weich dorthin. */
  function imBild(ll, rand) {
    const p = map.latLngToContainerPoint(ll);
    const s = map.getSize();
    const r = rand === undefined ? 60 : rand;
    return p.x >= r && p.y >= r && p.x <= s.x - r && p.y <= s.y - r;
  }

  function zeigeAuf(ll, mindestZoom) {
    const brauchtZoom = mindestZoom !== undefined && map.getZoom() < mindestZoom - 0.01;
    if (imBild(ll) && !brauchtZoom) return;
    if (brauchtZoom) map.flyTo(ll, mindestZoom, { duration: 0.7 });
    else map.panTo(ll, { animate: true, duration: 0.5 });
  }

  function auswahlZeigen(sel) {
    patientenZeichnen();
    mittelZeichnen();
    if (!sel) return;
    if (sel.typ === "patient") {
      const p = S.patienten.get(sel.id);
      if (p && p.ll) zeigeAuf(p.ll, 16);
    } else if (sel.typ === "mittel") {
      const m = S.mittel.get(sel.id);
      if (m) zeigeAuf(m.ll, 16);
    } else if (sel.typ === "abschnitt") {
      const a = S.abschnitte.get(sel.id);
      if (a) zeigeAuf(a.ll, 17);
    } else if (sel.typ === "gefahr") {
      const g = S.gefahren.get(sel.id);
      if (g) zeigeAuf(g.ll, 17);
    } else if (sel.typ === "sperre") {
      const s = S.sperren.find((x) => x.id === sel.id);
      if (s) zeigeAuf(s.ll, 18);
    } else if (sel.typ === "zelle") {
      const b = TR.zellGrenzen(sel.id);
      if (b) map.flyToBounds(b, { maxZoom: 18, duration: 0.7 });
    }
  }

  // Beide Ansichten fahren weich: flyTo zeichnet Bild für Bild neu, statt die
  // Kartenebene zu skalieren — die Symbole bleiben dabei auf ihrer Koordinate.
  function gesamtansicht() {
    const b = S.bbox;
    S.verfolgt = null;
    zoomFahrtAbbrechen();
    map.flyToBounds([[b[0], b[1]], [b[2], b[3]]], { padding: [8, 8], duration: 0.8 });
  }

  function schadensansicht() {
    S.verfolgt = null;
    zoomFahrtAbbrechen();
    map.flyTo(S.epi, 18, { duration: 0.8 });
  }

  /* ----------------------------------------------------------- Messwerkzeug */

  function messenUmschalten(an) {
    messModus = an === undefined ? !messModus : an;
    document.getElementById("karte").classList.toggle("misst", messModus);
    if (!messModus) messZuruecksetzen();
    return messModus;
  }

  function messZuruecksetzen() {
    messPunkte = [];
    if (messLinie) { map.removeLayer(messLinie); messLinie = null; }
    if (messLabel) { map.removeLayer(messLabel); messLabel = null; }
  }

  function messPunktSetzen(latlng) {
    messPunkte.push([latlng.lat, latlng.lng]);
    if (messLinie) messLinie.setLatLngs(messPunkte);
    else messLinie = L.polyline(messPunkte, { pane: "pLinie", color: "#1a4f8a", weight: 2, dashArray: "6 4" }).addTo(map);
    let s = 0;
    for (let i = 1; i < messPunkte.length; i++) s += TR.dist(messPunkte[i - 1], messPunkte[i]);
    const txt = s < 1000 ? Math.round(s) + " m" : (s / 1000).toFixed(2) + " km";
    const gehZeit = Math.round(s / 1.4 / 60);
    const html = txt + (messPunkte.length > 1 ? " · zu Fuß ca. " + gehZeit + " min" : "");
    if (messLabel) messLabel.setLatLng(latlng).setIcon(L.divIcon({ className: "mess-label", html, iconSize: null }));
    else messLabel = L.marker(latlng, { pane: "pLabel", interactive: false,
      icon: L.divIcon({ className: "mess-label", html, iconSize: null }) }).addTo(map);
  }

  /* ---------------------------------------------------------- Planoverlay */

  function planLaden(dataUrl) {
    const b = S.bbox;
    if (planOverlay) map.removeLayer(planOverlay);
    planOverlay = L.imageOverlay(dataUrl, [[b[0], b[1]], [b[2], b[3]]], { opacity: 0.75, pane: "pNetz" }).addTo(map);
  }

  function planDeckkraft(v) { if (planOverlay) planOverlay.setOpacity(v); }
  function planEntfernen() { if (planOverlay) { map.removeLayer(planOverlay); planOverlay = null; } }

  return {
    init, ebenenAnwenden, basisSetzen, rasterSetzen, zeigeAuf, gesamtansicht, schadensansicht,
    messenUmschalten, messZuruecksetzen, planLaden, planDeckkraft, planEntfernen,
    patientenZeichnen, mittelZeichnen, gefahrenZeichnen, karte: () => map,
  };
})();
