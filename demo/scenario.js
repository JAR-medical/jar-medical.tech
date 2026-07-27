/* TriARge — Einsatzszenario "Neubiberg, Ortsmitte".
 *
 * Frei erfundene Übungslage auf echtem Kartenmaterial. Alle Personendaten sind
 * simuliert. Ortsangaben (Straßen, Plätze, Gebäude) stammen aus OpenStreetMap,
 * die Einsatzabschnitte sind so gelegt, wie sie eine Einsatzleitung vor Ort
 * realistischerweise anordnen würde.
 *
 * Diese Datei legt zugleich die Liste der wählbaren Lagen an. Jede weitere Lage
 * hängt sich mit demselben Aufbau an `window.SZENARIEN` an:
 *
 *   id        Kennung für die Auswahl
 *   kurz      Name in der Auswahlliste
 *   geo       Geodaten der Lage (bbox, Wegenetz; siehe data/)
 *   raster    Einsatzraster — je größer das Gebiet, desto mehr Felder
 *   absperrung  Radius der Absperrgrenze in Metern
 *   abschnitte  Abschnitte; mit `t` entstehen sie erst im Verlauf
 *   gefahren  Gefahrenstellen; `t` = Sekunde, ab der sie erkannt sind
 *   patienten Roster; `t` = Sekunde, zu der der Marker erkannt wird
 */

"use strict";

window.SZENARIEN = window.SZENARIEN || [];

window.SZENARIEN.push((function () {
  // Schadensstelle: Wohn-/Geschäftshaus an der Hauptstraße, Höhe Rathausplatz.
  const EPI = [48.07681, 11.66221];

  const abschnitte = [
    {
      id: "SCHADEN", kurz: "SCHADEN", name: "Schadensstelle",
      ll: EPI, r: 45, art: "einsatz",
      info: "Teileinsturz nach Gasexplosion. Menschenrettung durch FW unter PA.",
      leitung: "EA 1 — Technische Rettung (BM Rieger)",
    },
    {
      id: "PA", kurz: "PA", name: "Patientenablage",
      ll: [48.07713, 11.66090], r: 34, art: "med",
      info: "Sammelpunkt gerettete Patienten, Sichtung durch LNA, Erstversorgung.",
      leitung: "EA 2 — Med / Patientenablage (OrgL Baumann)",
      kapazitaet: 20,
    },
    {
      id: "BHP", kurz: "BHP 25", name: "Behandlungsplatz BHP 25",
      ll: [48.07756, 11.65700], r: 48, art: "med",
      info: "Marktplatz. Behandlungsplatz für 25 Patienten, betrieben durch SEG BHP LK München.",
      leitung: "EA 3 — Behandlung (LNA Dr. Hofmann)",
      kapazitaet: 25,
    },
    {
      id: "RMHP", kurz: "RMHP", name: "Rettungsmittel-Halteplatz",
      ll: [48.07730, 11.65742], r: 26, art: "transport",
      info: "Abtransport ab BHP. Zuweisung durch EA Transport.",
      leitung: "EA 4 — Transport (OrgL Steinmeier)",
    },
    {
      id: "BR", kurz: "BR", name: "Bereitstellungsraum Rettungsmittel",
      ll: [48.07600, 11.66020], r: 34, art: "transport",
      info: "P+R Bahnhof Neubiberg. Anfahrt über Äußere Hauptstraße, Abfahrt Richtung Ost.",
      leitung: "EA 4 — Transport",
    },
    {
      id: "BST", kurz: "BST", name: "Betreuungsstelle Unverletzte",
      ll: [48.07885, 11.65765], r: 40, art: "betreuung",
      info: "Musisches Zentrum. Registrierung, PSNV, Angehörigensammelstelle.",
      leitung: "EA 5 — Betreuung (SEG Betreuung Ottobrunn)",
      kapazitaet: 120,
    },
    {
      id: "EL", kurz: "ELW 2", name: "Einsatzleitung / TEL",
      ll: [48.07655, 11.65995], r: 26, art: "fuehrung",
      info: "ELW 2 am Bahnhofsplatz. ÖEL, Führungsassistenz S1–S4, Fernmeldebetrieb.",
      leitung: "ÖEL Neumeier (KBM), UG-ÖEL LK München",
      hq: true,
    },
    {
      id: "FW", kurz: "FEUERWACHE", name: "Feuerwache Neubiberg — Logistik",
      ll: [48.07783, 11.65781], r: 28, art: "fuehrung",
      info: "Rückwärtige Führung, Materialnachschub, Atemschutzsammelstelle, Verpflegung.",
      leitung: "FF Neubiberg",
      hq: true,
    },
    {
      id: "RTH", kurz: "LP RTH", name: "Landeplatz RTH",
      ll: [48.07862, 11.65622], r: 34, art: "transport",
      info: "Freifläche Umweltgarten. Ausgeleuchtet, Einweiser gestellt (Florian Neubiberg 11/1).",
      leitung: "EA 4 — Transport",
    },
    {
      id: "VER", kurz: "ABL. VERST.", name: "Ablage Verstorbene",
      ll: [48.07640, 11.66175], r: 22, art: "sonstig",
      info: "Sichtgeschützt, Freigabe durch Polizei / KTU. Kein Zutritt für Presse.",
      leitung: "Polizei München Land",
    },
  ];

  const gefahren = [
    {
      id: "G1", code: "GAS", art: "gas", stufe: 3,
      name: "Gasaustritt Mitteldruck DN 100",
      ll: [48.07687, 11.66210], r: 100,
      t: 0,
      status: "laufend",
      verantwortlich: "Stadtwerke München / FW Sicherheitstrupp",
      info: "Leitung bei Tiefbauarbeiten beschädigt. Absperrarmatur Hauptstraße/Wittelsbacherstraße wird angefahren. Zündquellenverbot im Umkreis 100 m.",
      messwert: {
        label: "untere Explosionsgrenze", wert: 28, einheit: "% UEG", warn: 20, trend: 1,
        // Absperrarmatur ab Minute 5 geschlossen — danach fällt der Wert.
        wendeT: 300, wendeStatus: "abgesperrt, Wert fallend",
        wendeText: "Gasleitung abgesperrt — Messwert fällt",
        endeUnter: 5, endeText: "Gasaustritt abgesperrt — UEG unter 5 %",
        endeVon: "Sicherheitstrupp",
        endeFunk: "Gasmessung unter 5 % UEG. Trümmerbereich für Rettungstrupps freigegeben.",
      },
    },
    {
      id: "G2", code: "EIN", art: "einsturz", stufe: 3,
      name: "Einsturzgefahr Restgebäude",
      ll: [48.07681, 11.66221], r: 40,
      gebaeude: 42763911,   // OSM-Kennung des Schadensobjekts (siehe data/neubiberg.js)
      umrissText: "Schadensobjekt — Teileinsturz, Betreten nur mit Sicherungstrupp",
      t: 4,
      status: "laufend",
      verantwortlich: "Statiker LK München (ETA 25 min) / SEG Bergung",
      info: "Nordwestliche Giebelwand ohne Auflager. Trümmerbereich nur mit Sicherungstrupp und Abstützung betreten. Höhenrettung angefordert.",
    },
    {
      id: "G3", code: "BRD", art: "brand", stufe: 2,
      name: "Kellerbrand / Rauchausbreitung",
      ll: [48.07675, 11.66235], r: 0,
      t: 2,
      status: "laufend",
      verantwortlich: "EA 1 — Brandbekämpfung, 2 C-Rohre",
      info: "Verrauchung zieht mit dem Wind nach Nordost. Anwohner Hauptstraße 20–34 zum Fensterschließen aufgefordert.",
      wind: { grad: 232, kmh: 17 },
    },
    {
      id: "G4", code: "BAHN", art: "bahn", stufe: 2,
      name: "S7 gesperrt — Haltepunkt Neubiberg",
      ll: [48.07586, 11.66021], r: 0,
      t: 6,
      status: "laufend",
      verantwortlich: "DB Notfallmanagement / EA 4",
      info: "Streckensperrung zwischen Neuperlach Süd und Ottobrunn. Oberleitung geerdet. SEV über Äußere Hauptstraße eingerichtet.",
    },
    {
      id: "G5", code: "STROM", art: "strom", stufe: 1,
      name: "Stromausfall Ortsmitte",
      ll: [48.07700, 11.66240], r: 190,
      t: 8,
      status: "laufend",
      verantwortlich: "Netzbetreiber, Entstördienst vor Ort",
      info: "Rund 420 Haushalte ohne Versorgung. MVZ St. Cosmas auf Notstrom. Ampelanlage Hauptstraße/Kaiserstraße ausgefallen.",
    },
    {
      id: "G6", code: "MENGE", art: "menge", stufe: 1,
      name: "Schaulustige / Presse",
      ll: [48.07904, 11.66460], r: 45,
      t: 14,
      status: "beobachtet",
      verantwortlich: "Polizei München Land, Ordnungsdienst",
      info: "Rund 60 Personen am Rotkäppchenplatz. Drohnenflug Privatperson gemeldet — Luftraum für RTH prüfen.",
    },
    {
      id: "G7", code: "WASSER", art: "wasser", stufe: 1,
      name: "Löschwasser eingeschränkt",
      ll: [48.07742, 11.66320], r: 0,
      t: 18,
      status: "erledigt",
      verantwortlich: "EA 1 — Wasserversorgung",
      info: "Hydrant Rathausplatz ohne ausreichenden Druck. Zubringerleitung B von Hydrant Lindenallee gelegt (240 m).",
    },
  ];

  // Straßensperren an realen Knotenpunkten.
  const sperren = [
    { id: "S1", name: "Hauptstraße Ost / Kaiserstraße", ll: [48.07561, 11.66540], von: "Polizei 24/1" },
    { id: "S2", name: "Hauptstraße West / Bahnhofsplatz", ll: [48.07620, 11.66065], von: "Polizei 24/2" },
    { id: "S3", name: "Rathausplatz Nord", ll: [48.07770, 11.66245], von: "FF Neubiberg 12/1" },
    { id: "S4", name: "Wittelsbacherstraße", ll: [48.07724, 11.66451], von: "Ordnungsdienst" },
    { id: "S5", name: "Tannenstraße / Freiherr-von-Stengel-Straße", ll: [48.07495, 11.66250], von: "Polizei 24/3" },
  ];

  const poi = [
    { name: "Rathaus Neubiberg (geräumt)", ll: [48.07691, 11.66310], art: "amt" },
    { name: "S-Bahnhof Neubiberg (gesperrt)", ll: [48.07586, 11.66021], art: "bahn" },
    { name: "Grundschule Neubiberg", ll: [48.07793, 11.66360], art: "schule" },
    { name: "MVZ St. Cosmas", ll: [48.07826, 11.66233], art: "medizin" },
    { name: "Rats-Apotheke", ll: [48.07595, 11.66287], art: "medizin" },
    { name: "Feuerwehrhaus FF Neubiberg", ll: [48.07783, 11.65781], art: "feuerwehr" },
    { name: "Umweltgarten", ll: [48.07862, 11.65622], art: "gruen" },
    { name: "Haus der Weiterbildung", ll: [48.07706, 11.66245], art: "amt" },
  ];

  // Zielkliniken mit realistischen Fahrzeiten ab Neubiberg.
  const kliniken = [
    { id: "K1", name: "München Klinik Neuperlach", ll: [48.09660, 11.63890], km: 3.6, minuten: 8,
      stufe: "Regelversorgung", schockraum: 2, kinder: false, neuro: false, frei: { SK1: 2, SK2: 5, SK3: 9 } },
    { id: "K2", name: "Klinikum rechts der Isar (TUM)", ll: [48.13670, 11.60110], km: 9.4, minuten: 16,
      stufe: "Maximalversorgung / ÜRZ", schockraum: 3, kinder: false, neuro: true, frei: { SK1: 3, SK2: 4, SK3: 6 } },
    { id: "K3", name: "München Klinik Bogenhausen", ll: [48.15230, 11.62970], km: 11.8, minuten: 19,
      stufe: "Maximalversorgung", schockraum: 2, kinder: false, neuro: true, frei: { SK1: 2, SK2: 6, SK3: 8 } },
    { id: "K4", name: "LMU Klinikum Großhadern", ll: [48.11030, 11.46940], km: 17.2, minuten: 24,
      stufe: "Maximalversorgung", schockraum: 2, kinder: false, neuro: true, frei: { SK1: 2, SK2: 3, SK3: 5 } },
    { id: "K5", name: "München Klinik Schwabing — Kindertraumatologie", ll: [48.17460, 11.58420], km: 14.6, minuten: 22,
      stufe: "Kindertraumazentrum", schockraum: 1, kinder: true, neuro: true, frei: { SK1: 1, SK2: 3, SK3: 6 } },
    { id: "K6", name: "BG Unfallklinik Murnau (RTH)", ll: [47.68300, 11.19700], km: 68.0, minuten: 26,
      stufe: "Schwerbrandverletzte / ÜRZ", schockraum: 2, kinder: false, neuro: true, frei: { SK1: 2, SK2: 2, SK3: 0 } },
  ];

  // Einsatzmittel. `art` steuert Symbol und Verhalten in der Simulation.
  const mittel = [
    { id: "ELW2", name: "ELW 2 Neubiberg", kurz: "EL", art: "fuehrung", basis: "EL", rolle: "Technische Einsatzleitung", besatzung: 6 },
    { id: "FL111", name: "Florian Neubiberg 11/1", kurz: "LF", art: "loesch", basis: "SCHADEN", rolle: "Menschenrettung / Brandbekämpfung", besatzung: 9 },
    { id: "FL401", name: "Florian München-Land 40/1 (RW)", kurz: "RW", art: "loesch", basis: "SCHADEN", rolle: "Technische Rettung, Abstützung", besatzung: 6 },
    { id: "T1", name: "Rettungstrupp 1", kurz: "T1", art: "trupp", basis: "SCHADEN", rolle: "Menschenrettung, Sichtung", besatzung: 2 },
    { id: "T2", name: "Rettungstrupp 2", kurz: "T2", art: "trupp", basis: "SCHADEN", rolle: "Menschenrettung, Sichtung", besatzung: 2 },
    { id: "T3", name: "Rettungstrupp 3", kurz: "T3", art: "trupp", basis: "SCHADEN", rolle: "Menschenrettung, Sichtung", besatzung: 2 },
    { id: "T4", name: "Trag-Trupp SEG 1", kurz: "T4", art: "trupp", basis: "PA", rolle: "Rettung → Ablage → BHP", besatzung: 4 },
    { id: "T5", name: "Trag-Trupp SEG 2", kurz: "T5", art: "trupp", basis: "PA", rolle: "Rettung → Ablage → BHP", besatzung: 4 },
    { id: "T6", name: "Trag-Trupp SEG 3", kurz: "T6", art: "trupp", basis: "PA", rolle: "Rettung → Ablage → BHP", besatzung: 4 },
    { id: "GWS", name: "GW-San LK München", kurz: "GS", art: "loesch", basis: "BHP", rolle: "Material Behandlungsplatz 25", besatzung: 3 },
    { id: "LNA", name: "LNA Dr. Hofmann", kurz: "LN", art: "arzt", basis: "PA", rolle: "Leitender Notarzt, Sichtung", besatzung: 2 },
    { id: "NEF1", name: "NEF 71/1", kurz: "N1", art: "nef", basis: "PA", rolle: "Notarzt, erweiterte Maßnahmen", besatzung: 2 },
    { id: "RTW1", name: "RTW 71/1", kurz: "R1", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "RTW2", name: "RTW 71/2", kurz: "R2", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "RTW3", name: "RTW 72/1 Ottobrunn", kurz: "R3", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "RTW4", name: "RTW 73/1 Unterhaching", kurz: "R4", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "RTH1", name: "Christoph 1", kurz: "H1", art: "rth", basis: "RTH", rolle: "Luftrettung, Ferntransport", besatzung: 3 },
    { id: "POL1", name: "Polizei 24/1", kurz: "P1", art: "polizei", basis: "S1", rolle: "Absperrung Ost", besatzung: 2 },
    { id: "POL2", name: "Polizei 24/2", kurz: "P2", art: "polizei", basis: "S2", rolle: "Absperrung West", besatzung: 2 },
    { id: "DRN1", name: "Drohne EA Aufklärung", kurz: "DR", art: "drohne", basis: "SCHADEN", rolle: "Luftbild, Wärmebild", besatzung: 1 },
  ];

  /* Patientenroster.
   * `t` = Sekunde nach Einsatzbeginn, zu der der Marker erkannt wird.
   * `ll` = Auffindeort (echte Koordinate). Sichtung, Transport und Verlegung
   *        macht die Simulation. */
  const patienten = [
    { id: 1, t: 12, ll: [48.07672, 11.66232], kat: "SK1", sex: "m", alter: 47, geh: false, wach: false, atemweg: false,
      vit: { af: 32, puls: 132, spo2: 84, rrs: 90, rrd: 60, gcs: 6 },
      verletzt: ["instabiler Thorax", "SHT", "Verschüttung Unterschenkel"],
      massnahmen: ["Sauerstoff 15 l", "HWS-Immobilisation"],
      trupp: "T1", befund: "Männlich, ca. 45, aus Trümmerbereich gerettet. Bewusstlos, Schnappatmung, instabiler Thorax — rot." },
    { id: 2, t: 34, ll: [48.07692, 11.66246], kat: "SK1", sex: "w", alter: 31, geh: false, wach: true, atemweg: true,
      vit: { af: 28, puls: 126, spo2: 90, rrs: 95, rrd: 55, gcs: 13 },
      verletzt: ["offene Femurfraktur re.", "spritzende Blutung"],
      massnahmen: ["Tourniquet 09:14", "Druckverband", "Volumen"],
      trupp: "T2", befund: "Weiblich, ca. 30, spritzende Blutung Oberschenkel rechts. Tourniquet gesetzt — rot." },
    { id: 3, t: 52, ll: [48.07668, 11.66196], kat: "SK3", sex: "m", alter: 19, geh: true, wach: true, atemweg: true,
      vit: { af: 16, puls: 84, spo2: 99, rrs: 128, gcs: 15 },
      verletzt: ["Schürfwunden", "Rußantragung"], massnahmen: [],
      trupp: "T2", befund: "Männlich, jung, gehfähig, selbst aus dem Gebäude. Nur Schürfwunden — grün." },
    { id: 4, t: 68, ll: [48.07701, 11.66214], kat: "SK2", sex: "m", alter: 54, geh: false, wach: true, atemweg: true,
      vit: { af: 18, puls: 98, spo2: 96, rrs: 132, rrd: 84, gcs: 15 },
      verletzt: ["Unterschenkelfraktur geschl.", "Prellung Becken"],
      massnahmen: ["Vakuumschiene", "Analgesie"],
      trupp: "T1", befund: "Männlich, ca. 55, Unterschenkel deformiert, ansprechbar, kreislaufstabil — gelb." },
    { id: 5, t: 84, ll: [48.07659, 11.66208], kat: "SK3", sex: "w", alter: 38, geh: true, wach: true, atemweg: true,
      vit: { af: 15, puls: 78, spo2: 99, gcs: 15 },
      verletzt: ["HWS-Distorsion"], massnahmen: [],
      trupp: "T2", befund: "Weiblich, ca. 40, Nackenschmerz nach Sturz, gehfähig, stabil — grün." },
    { id: 6, t: 104, ll: [48.07688, 11.66261], kat: "SK1", sex: "w", alter: 8, geh: false, wach: false, atemweg: true,
      vit: { af: 30, puls: 142, spo2: 88, gcs: 8 },
      verletzt: ["SHT", "Platzwunde Schädel", "V. a. Milzruptur"],
      massnahmen: ["Sauerstoff", "Wärmeerhalt"],
      trupp: "T1", kind: true, befund: "Kind, ca. 8 Jahre, somnolent, GCS 8, Kopfplatzwunde — rot. NEF und Kindertraumazentrum dringend." },
    { id: 7, t: 122, ll: [48.07712, 11.66239], kat: "SK2", sex: "m", alter: 61, geh: false, wach: true, atemweg: true,
      vit: { af: 22, puls: 108, spo2: 93, rrs: 152, rrd: 96, gcs: 15 },
      verletzt: ["thorakaler Druck", "bekannte KHK"],
      massnahmen: ["Sauerstoff", "Monitoring", "12-Kanal-EKG"],
      trupp: "T1", befund: "Männlich, ca. 60, Thoraxschmerz unter Belastung, bekannte KHK — gelb, EKG angefordert." },
    { id: 8, t: 140, ll: [48.07665, 11.66252], kat: "SK2", sex: "w", alter: 26, geh: false, wach: true, atemweg: true,
      vit: { af: 20, puls: 104, spo2: 95, rrs: 112, rrd: 70, gcs: 14 },
      verletzt: ["V. a. Beckenfraktur", "Abdomen druckschmerzhaft"],
      massnahmen: ["Beckenschlinge"],
      trupp: "T2", befund: "Weiblich, ca. 25, Beckenschmerz, Abdomen gespannt — gelb, engmaschig beobachten.",
      verschlechtert: { t: 420, kat: "SK1", vit: { puls: 124, spo2: 92, rrs: 88 },
        massnahmen: ["Beckenschlinge", "Volumen", "Tranexamsäure"],
        befund: "Kreislauf verschlechtert sich — V. a. Beckenblutung, Umsichtung auf rot." } },
    { id: 9, t: 158, ll: [48.07648, 11.66231], kat: "SK3", sex: "m", alter: 27, geh: true, wach: true, atemweg: true,
      vit: { af: 16, puls: 80, spo2: 99, gcs: 15 },
      verletzt: ["Schnittwunden Unterarm (Glas)"], massnahmen: ["Verband"],
      trupp: "T2", befund: "Männlich, gehfähig, Schnittwunden durch Glassplitter — grün." },
    { id: 10, t: 176, ll: [48.07697, 11.66190], kat: "SK1", sex: "m", alter: 36, geh: false, wach: false, atemweg: false,
      vit: { af: 6, puls: 148, spo2: 79, rrs: 80, gcs: 3 },
      verletzt: ["Rauchgasintoxikation", "Verbrennung II° Gesicht/Hals 12 %"],
      massnahmen: ["Narkose", "Intubation", "Sauerstoff 100 %"],
      trupp: "T1", befund: "Männlich, ca. 35, aus dem verrauchten Treppenhaus. Rauchgasintoxikation, CO-Hb 24 % — rot, Intubation." },
    { id: 11, t: 196, ll: [48.07714, 11.66266], kat: "SK2", sex: "w", alter: 44, geh: false, wach: true, atemweg: true,
      vit: { af: 21, puls: 100, spo2: 94, rrs: 124, gcs: 15 },
      verletzt: ["Rippenserienfraktur li.", "Klavikulafraktur"],
      massnahmen: ["Analgesie", "Sauerstoff"],
      trupp: "T1", befund: "Weiblich, ca. 45, Rippenserie links, atemabhängiger Schmerz — gelb." },
    { id: 12, t: 214, ll: [48.07640, 11.66196], kat: "TOT", sex: "m", alter: 72, geh: false, wach: false, atemweg: false,
      vit: {}, verletzt: ["keine Lebenszeichen"], massnahmen: [],
      trupp: "T2", befund: "Männlich, ca. 70, keine Atmung, keine Kreislaufzeichen, sichere Todeszeichen — schwarz." },
    { id: 13, t: 236, ll: [48.07705, 11.66273], kat: "SK3", sex: "w", alter: 22, geh: true, wach: true, atemweg: true,
      vit: { af: 17, puls: 88, spo2: 98, gcs: 15 },
      verletzt: ["Hyperventilation", "akute Belastungsreaktion"], massnahmen: ["Betreuung"],
      trupp: "T2", befund: "Weiblich, ca. 20, hyperventiliert, keine Verletzung — grün, PSNV." },
    { id: 14, t: 258, ll: [48.07677, 11.66178], kat: "SK4", sex: "m", alter: 68, geh: false, wach: false, atemweg: false,
      vit: { af: 8, puls: 38, spo2: 68, gcs: 3 },
      verletzt: ["schwerstes Polytrauma", "Verschüttung Thorax"],
      massnahmen: ["Sauerstoff", "betreuende Maßnahmen"],
      trupp: "LNA", befund: "Männlich, ca. 65, infauste Prognose bei aktueller Lage — SK IV (blau), betreuende Maßnahmen." },
    { id: 15, t: 280, ll: [48.07730, 11.66230], kat: "SK3", sex: "m", alter: 45, geh: true, wach: true, atemweg: true,
      vit: { af: 16, puls: 82, spo2: 98, gcs: 15 },
      verletzt: ["Tinnitus nach Explosion", "Prellung Schulter"], massnahmen: [],
      trupp: "T1", befund: "Männlich, Passant, Knalltrauma, gehfähig — grün, HNO-Kontrolle empfohlen." },
    { id: 16, t: 302, ll: [48.07660, 11.66270], kat: "SK2", sex: "w", alter: 57, geh: false, wach: true, atemweg: true,
      vit: { af: 24, puls: 112, spo2: 92, rrs: 138, gcs: 14 },
      verletzt: ["Inhalationstrauma", "Verbrennung I° Hände"],
      massnahmen: ["Sauerstoff", "Kühlung"],
      trupp: "T2", befund: "Weiblich, ca. 55, Reizhusten, Stridor beginnend — gelb, engmaschig, Intubationsbereitschaft." },
    { id: 17, t: 326, ll: [48.07722, 11.66196], kat: "SK3", sex: "w", alter: 33, geh: true, wach: true, atemweg: true,
      vit: { af: 16, puls: 84, spo2: 99, gcs: 15 },
      verletzt: ["Schnittwunde Hand"], massnahmen: ["Verband"],
      trupp: "T1", befund: "Weiblich, Anwohnerin, kleine Schnittwunde — grün." },
    { id: 18, t: 350, ll: [48.07652, 11.66252], kat: "SK3", sex: "m", alter: 71, geh: true, wach: true, atemweg: true,
      vit: { af: 18, puls: 92, spo2: 96, rrs: 158, gcs: 15 },
      verletzt: ["Hypertone Entgleisung", "Aufregung"], massnahmen: ["Monitoring"],
      trupp: "T2", befund: "Männlich, ca. 70, RR 180/100, kein Trauma — grün, ärztliche Kontrolle BHP." },
    { id: 19, t: 376, ll: [48.07708, 11.66300], kat: "SK2", sex: "m", alter: 29, geh: false, wach: true, atemweg: true,
      vit: { af: 19, puls: 106, spo2: 95, rrs: 118, gcs: 15 },
      verletzt: ["Unterarmfraktur offen", "Platzwunde Kopf"],
      massnahmen: ["Schienung", "Analgesie", "Verband"],
      trupp: "T1", befund: "Männlich, ca. 30, offene Unterarmfraktur — gelb." },
    { id: 20, t: 404, ll: [48.07634, 11.66214], kat: "TOT", sex: "w", alter: 64, geh: false, wach: false, atemweg: false,
      vit: {}, verletzt: ["keine Lebenszeichen"], massnahmen: [],
      trupp: "LNA", befund: "Weiblich, ca. 65, Reanimation unter MANV-Bedingungen nicht indiziert — schwarz." },
    { id: 21, t: 432, ll: [48.07736, 11.66262], kat: "SK3", sex: "w", alter: 41, geh: true, wach: true, atemweg: true,
      vit: { af: 15, puls: 76, spo2: 99, gcs: 15 },
      verletzt: ["keine"], massnahmen: [],
      trupp: "T1", befund: "Weiblich, Angehörige, unverletzt, sucht Tochter — grün, an Betreuungsstelle übergeben." },
    { id: 22, t: 462, ll: [48.07666, 11.66288], kat: "SK1", sex: "m", alter: 52, geh: false, wach: false, atemweg: true,
      vit: { af: 26, puls: 128, spo2: 87, rrs: 92, gcs: 9 },
      verletzt: ["SHT", "Beckentrauma", "Verschüttung"],
      massnahmen: ["Sauerstoff", "Beckenschlinge", "Wärmeerhalt"],
      trupp: "T2", befund: "Männlich, ca. 50, spät aus Teilverschüttung geborgen — rot, Schockraum voranmelden." },
  ];

  /* Funk- und Führungsverkehr. Wird zeitgesteuert abgespielt; danach läuft der
   * Ambient-Funk aus engine.js weiter. */
  const funk = [
    { t: 0, von: "ILS München", text: "MANV 25 bestätigt — Explosion mit Teileinsturz, Hauptstraße Neubiberg, Höhe Rathausplatz. Alarmierung MANV-Alarm Stufe 3 Landkreis München läuft." },
    { t: 8, von: "Florian Neubiberg 11/1", text: "Erstmeldung: Wohn-/Geschäftshaus, drei Geschosse, Ostteil eingestürzt. Personen im Trümmerbereich. Nachforderung: MANV 25, RW, Statiker, Stadtwerke Gas." },
    { t: 26, von: "ÖEL Neumeier", text: "Einsatzabschnitte gebildet: EA 1 Technische Rettung, EA 2 Patientenablage, EA 3 Behandlung, EA 4 Transport, EA 5 Betreuung. ELW 2 am Bahnhofsplatz in Betrieb." },
    { t: 44, von: "Rettungstrupp 1", text: "Patient 1 rot — Thoraxtrauma, bewusstlos. Rettung unter PA, Trage angefordert.", refs: [1] },
    { t: 62, von: "Rettungstrupp 2", text: "Patient 2 rot — Tourniquet gesetzt, Blutung steht. Transport in die Patientenablage.", refs: [2] },
    { t: 90, von: "Sicherheitstrupp", text: "Gasmessung im Trümmerbereich: 34 % UEG. Zündquellenverbot 100 m. Stadtwerke sind an der Absperrarmatur." },
    { t: 118, von: "LNA Dr. Hofmann", text: "Sichtung in der Patientenablage läuft. Erste Lageeinschätzung: mindestens 20 Betroffene, davon vier rot." },
    { t: 150, von: "Rettungstrupp 1", text: "Patient 6 — Kind, ca. 8 Jahre, GCS 8. Rot. NEF sofort, Kindertraumazentrum voranmelden.", refs: [6] },
    { t: 182, von: "ÖEL Neumeier", text: "Behandlungsplatz BHP 25 am Marktplatz ist aufnahmebereit. Rettungsmittel-Halteplatz eingerichtet." },
    { t: 210, von: "DB Notfallmanagement", text: "Streckensperrung S7 zwischen Neuperlach Süd und Ottobrunn bestätigt, Oberleitung geerdet. SEV ab 09:55." },
    { t: 244, von: "Christoph 1", text: "Landung Umweltgarten erfolgt. Übernehme Ferntransport, Ziel nach Zuweisung EA 4." },
    { t: 276, von: "Stadtwerke München", text: "Gasleitung abgesperrt. Messwert im Trümmerbereich fallend. Nachmessung in 10 Minuten." },
    { t: 320, von: "EA 4 Transport", text: "Erster RTW mit Patient 2 ab Rettungsmittel-Halteplatz Richtung Klinikum rechts der Isar.", refs: [2] },
    { t: 366, von: "Polizei München Land", text: "Absperrgrenze steht. Rotkäppchenplatz: rund 60 Schaulustige, Presse eingetroffen. Drohnenflug einer Privatperson gemeldet — Luftraum prüfen." },
    { t: 420, von: "Trag-Trupp SEG 2", text: "Patient 8 verschlechtert sich — Kreislauf instabil, Umsichtung auf rot, Schockraum voranmelden.", refs: [8] },
    { t: 470, von: "ÖEL Neumeier", text: "Zwischenmeldung an ILS: Lage weiter unübersichtlich, Vollzähligkeit der Hausbewohner noch nicht hergestellt. Nachforderung SEG Bergung." },
  ];

  return {
    id: "neubiberg",
    kurz: "Neubiberg · Explosion mit Teileinsturz",
    sitzung: "Neubiberg · Hauptstraße",
    geo: window.NB_GEO,
    raster: { spalten: 10, zeilen: 8 },   // ~139 x 120 m je Feld
    absperrung: 250,
    // Welcher Abschnitt welche Aufgabe hat — daraus leitet die Simulation ab,
    // wohin Trupps tragen, wo Fahrzeuge stehen und woher gerettet wird.
    rollen: {
      ablagen: ["PA"], behandlung: "BHP", betreuung: "BST",
      bereitstellung: "BR", halteplatz: "RMHP", verstorbene: "VER",
      landeplatz: "RTH", schaden: ["SCHADEN"],
    },
    einsatz: {
      name: "Neubiberg · Hauptstraße — Explosion mit Teileinsturz",
      stichwort: "MANV 25 / THL 4 — Gebäudeeinsturz",
      ort: "Hauptstraße / Rathausplatz, 85579 Neubiberg (LK München)",
      oel: "KBM Neumeier",
      lna: "Dr. Hofmann",
      orgl: "Baumann",
      alarmiert: "09:07",
      betroffene: "ca. 35 (Vollzähligkeit offen)",
      wetter: "8 °C, bedeckt, Wind 230° 17 km/h, Sicht > 8 km",
    },
    epi: EPI,
    abschnitte, gefahren, sperren, poi, kliniken, mittel, patienten, funk,
  };
})());
