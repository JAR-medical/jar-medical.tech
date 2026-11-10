/* TriARge - Lage "Neubiberg - Hochwasser, Drohnenauswertung".
 *
 * Anders als die Übungslagen ist diese Lage kein Drehbuch, sondern das
 * Ergebnis einer Auswertung: Sie zeigt ausschließlich, was der Drohnenschwarm
 * im ausgewerteten Gebiet erkannt hat (data/neubiberg-hochwasser.js) -
 * Wasserflächen und Fahrzeuge. Es gibt bewusst keine erfundenen Patienten,
 * Einsatzmittel, Abschnitte, Sperren, Kliniken oder Funksprüche.
 *
 * Kartengrundlage, Wegenetz und Bedienung sind dieselben wie in den übrigen
 * Lagen (OpenStreetMap, data/neubiberg.js). Das Einsatzraster und der
 * Startausschnitt decken genau das ausgewertete Gebiet ab.
 */

"use strict";

window.SZENARIEN = window.SZENARIEN || [];

window.SZENARIEN.push((function () {
  const F = window.NB_FLUT;
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const pkw = F.fahrzeuge.filter((f) => f[3] === "car").length;
  const transporter = F.fahrzeuge.length - pkw;

  // Marker der Wasserfläche: Mittelpunkt des größten Teilstücks.
  const groesste = F.wasser.coordinates
    .map((poly) => poly[0])
    .sort((a, b) => b.length - a.length)[0];
  const wasserLL = [
    groesste.reduce((s, p) => s + p[1], 0) / groesste.length,
    groesste.reduce((s, p) => s + p[0], 0) / groesste.length,
  ];

  const gefahren = [
    {
      id: "W1", code: "WASSER", art: "wasser", stufe: 2, flut: true,
      name: "Überflutungsfläche (Drohnenauswertung)",
      ll: wasserLL, r: 0, flaechen: F.wasser,
      t: 0,
      status: "erkannt",
      verantwortlich: "nicht zugewiesen",
      info: F.wasser.coordinates.length + " Teilflächen, zusammen rund " +
        fmt(F.wasserFlaecheM2) + " m². Erkannt durch Änderungserkennung im Mosaik des " +
        "Drohnenschwarms (Konfidenz " + F.wasserKonfidenz[0].toFixed(2) + "–" +
        F.wasserKonfidenz[1].toFixed(2) + ").",
    },
  ];

  return {
    id: "neubiberg-hochwasser",
    alias: ["nb-hochwasser", "drohnenauswertung"],
    auswertung: true,
    kurz: "Neubiberg · Hochwasser (Drohnenauswertung)",
    sitzung: "Neubiberg · Drohnenauswertung",
    // OSM-Wegenetz der Ortsmitte; Raster und Startausschnitt = ausgewertetes Gebiet.
    geo: { ...window.NB_GEO, bbox: F.bbox },
    raster: { spalten: 7, zeilen: 7 },   // ~50 x 50 m je Feld
    absperrung: 0,
    rollen: {},
    einsatz: {
      name: "Neubiberg - Hochwasser, Drohnenauswertung",
      stichwort: "Drohnenlagebild Hochwasser",
      ort: "Neubiberg (LK München), Auswertungsgebiet 350 × 350 m",
      oel: "nicht besetzt",
      lna: "nicht besetzt",
      orgl: "nicht besetzt",
      alarmiert: "00:00",
      betroffene: "nicht erfasst",
      wetter: "nicht erfasst",
    },
    epi: F.mitte,
    gefahren,
    objekte: {
      gebiet: F.gebiet,
      gebietText: "Auswertungsgebiet Drohnenschwarm (350 × 350 m)",
      fahrzeuge: F.fahrzeuge,
      fahrzeugText: pkw + " Pkw, " + transporter + " Transporter (VisDrone-YOLO11s)",
    },
    abschnitte: [], sperren: [], poi: [], kliniken: [], mittel: [], patienten: [], funk: [],
  };
})());
