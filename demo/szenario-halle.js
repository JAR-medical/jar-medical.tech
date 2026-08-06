/* TriARge - Einsatzszenario "Halle (Saale), Kröllwitz - Hochwasser".
 *
 * Frei erfundene Übungslage auf echtem Kartenmaterial. Alle Personendaten sind
 * simuliert, ebenso Pegelstände, Einsatzmittel und Funkverkehr. Ortsangaben
 * (Kröllwitz, Talstraße, Amselgrund, Giebichensteinbrücke und Klinikum) sind
 * real, die konkrete Lage ist es nicht.
 *
 * Charakter der Lage: kein Schlagartig-Ereignis wie ein Einsturz, sondern eine
 * über Stunden wachsende Fläche - Hochwasserschutz an den Tiefpunkten der
 * Talstraße, Evakuierung aus dem Rückstau und Wasserrettung. Die Patienten
 * kommen verteilt und über einen langen Zeitraum; mehrere Abschnitte entstehen
 * erst im Verlauf.
 */

"use strict";

window.SZENARIEN = window.SZENARIEN || [];

window.SZENARIEN.push((function () {
  // Realer Lageanker: Amselgrund/Talstraße in der flachen Saaleaue.
  const EPI = [51.50334, 11.94840];
  const BRUECKE = [51.50404, 11.95224];
  const KLINIK = [51.50177, 11.93683];
  const BHP_LL = [51.50504, 11.94103];
  const SCHULE = [51.50654, 11.95214];
  const PEGEL = [51.51425, 11.95455];

  // Hand-checked exercise overlays in [lat, lon] order. The outer edges use
  // the OSM Saale/Wilde-Saale geometry and the mapped Talstraße/Amselgrund
  // lowland as anchors; they are not an official flood hazard map.
  const FLUT_AUE = [
    [51.50435, 11.94832], [51.50415, 11.94905], [51.50395, 11.94975],
    [51.50370, 11.95030], [51.50325, 11.95005], [51.50290, 11.94955],
    [51.50255, 11.94910], [51.50205, 11.94855], [51.50155, 11.94785],
    [51.50100, 11.94710], [51.50072, 11.94625], [51.50125, 11.94570],
    [51.50200, 11.94585], [51.50270, 11.94635], [51.50325, 11.94710],
    [51.50378, 11.94772], [51.50416, 11.94805],
  ];
  const FLUT_TAL = [
    [51.50420, 11.94820], [51.50400, 11.94855], [51.50375, 11.94890],
    [51.50345, 11.94905], [51.50315, 11.94880], [51.50295, 11.94845],
    [51.50270, 11.94805], [51.50280, 11.94770], [51.50315, 11.94785],
    [51.50350, 11.94805], [51.50385, 11.94802],
  ];
  const FLUT_KLINIK = [
    [51.50205, 11.93655], [51.50215, 11.93705], [51.50195, 11.93765],
    [51.50160, 11.93810], [51.50130, 11.93775], [51.50140, 11.93710],
    [51.50165, 11.93665],
  ];
  const FLUT_NETZ = [
    [51.50405, 11.94785], [51.50380, 11.94825], [51.50345, 11.94855],
    [51.50315, 11.94835], [51.50295, 11.94795], [51.50320, 11.94750],
    [51.50355, 11.94755], [51.50385, 11.94765],
  ];
  const FLUT_OEL = [
    [51.50395, 11.94745], [51.50388, 11.94775], [51.50365, 11.94795],
    [51.50345, 11.94782], [51.50350, 11.94750], [51.50372, 11.94735],
  ];
  const FLUT_PORPHYR = [
    [51.50305, 11.94555], [51.50285, 11.94610], [51.50255, 11.94635],
    [51.50225, 11.94615], [51.50235, 11.94575], [51.50265, 11.94545],
  ];
  const FLUT_BRUECKE = [
    [51.50390, 11.95185], [51.50420, 11.95175], [51.50440, 11.95235],
    [51.50410, 11.95265],
  ];
  const FLUT_BOOT = [
    [51.50305, 11.94885], [51.50325, 11.94915], [51.50345, 11.94905],
    [51.50330, 11.94875],
  ];

  const abschnitte = [
    {
      id: "DEICH", kurz: "UFER", name: "Uferabschnitt Amselgrund / Talstraße",
      ll: EPI, flaechen: [FLUT_TAL], art: "einsatz",
      info: "Sandsacklinie an den tiefsten Stellen der Talstraße. Kontrollgänge im 20-Minuten-Takt, Uferweg bleibt gesperrt.",
      leitung: "EA 1 - Ufer- und Hochwasserschutz (THW OV Halle, ZTr)",
    },
    {
      id: "EVAK", kurz: "EVAK TAL", name: "Evakuierungsabschnitt Talstraße / Amselgrund",
      ll: [51.50370, 11.94790], flaechen: [FLUT_AUE], art: "einsatz",
      info: "58 Haushalte in der tief liegenden Uferlage. Räumung von Erdgeschoss und Keller, Tierrettung über EA 5.",
      leitung: "EA 2 - Evakuierung (BF Halle, B-Dienst)",
    },
    {
      id: "WR", kurz: "BOOTE", name: "Bootseinsatzstelle Talstraße",
      ll: [51.50320, 11.94900], flaeche: FLUT_BOOT, art: "transport",
      info: "Bootseinsatzstelle am Saaleufer im Bereich Amselgrund. Zwei Mehrzweckboote, ein Rettungsboot DLRG, Sprechfunk auf Kanal Wasser.",
      leitung: "EA 3 - Wasserrettung (DLRG Bezirk Halle)",
    },
    {
      id: "PA", kurz: "PA 1", name: "Patientenablage Talstraße",
      ll: [51.50550, 11.94660], r: 60, art: "med",
      info: "Hochwasserfrei an der Kröllwitzer Straße, kurze Wege zur Talstraße, Evakuierung und Bootsstelle. Übernahme und Sichtung durch den LNA.",
      leitung: "EA 4 - Med / Patientenablage (OrgL Wendt)",
      kapazitaet: 20,
    },
    {
      id: "PA2", kurz: "PA 2", name: "Patientenablage Klinikumszufahrt",
      ll: [51.50190, 11.93720], r: 55, art: "med",
      t: 1080,
      info: "Ablage für die Verlegung aus den Pflegeeinrichtungen. Übergabe direkt an die KTW-Kette.",
      leitung: "EA 8 - Verlegung",
      kapazitaet: 15,
      funk: "Patientenablage 2 an der Klinikumszufahrt steht. Übergabe der Verlegungspatienten direkt an die KTW-Kette.",
    },
    {
      id: "BHP", kurz: "BHP 25", name: "Behandlungsplatz Leichtathletikhalle Brandberge",
      ll: BHP_LL, r: 80, art: "med",
      info: "Beheizte Halle am Kreuzvorwerk. Wärmeerhalt und Aufwärmzone für Unterkühlte, 25 Plätze.",
      leitung: "EA 4 - Behandlung (LNA Dr. Seifert)",
      kapazitaet: 25,
    },
    {
      id: "RMHP", kurz: "RMHP", name: "Rettungsmittel-Halteplatz Kreuzvorwerk",
      ll: [51.50540, 11.94040], r: 45, art: "transport",
      info: "Abtransport ab der Brandbergehalle. Anfahrt über Kreuzvorwerk und Ernst-Grube-Straße.",
      leitung: "EA 6 - Transport (OrgL Krause)",
    },
    {
      id: "BR", kurz: "BR", name: "Bereitstellungsraum Dölauer Straße",
      ll: [51.50796, 11.95181], r: 90, art: "transport",
      info: "Sammelraum für nachrückende Kräfte und Fahrzeuge auf hochwasserfreiem Gelände, Führung über EA 6. Verpflegung ab 08:00.",
      leitung: "EA 6 - Transport",
    },
    {
      id: "BST", kurz: "BST", name: "Betreuungsstelle / Notunterkunft",
      ll: SCHULE, r: 90, art: "betreuung",
      info: "Kröllwitz-Grundschule an der Petruskirche. Registrierung, Feldbetten für 180 Personen, PSNV, Tiersammelstelle im Nebenhof.",
      leitung: "EA 5 - Betreuung (DRK KV Halle)",
      kapazitaet: 180,
    },
    {
      id: "EL", kurz: "ELW 2", name: "Technische Einsatzleitung",
      ll: [51.50670, 11.94596], r: 45, art: "fuehrung",
      info: "ELW 2 am Knoten Kröllwitzer Straße/Talstraße. Stab S1–S4, Verbindung zum Krisenstab der Stadt.",
      leitung: "ÖEL Radtke (BF Halle), UG-ÖEL",
      hq: true,
    },
    {
      id: "SAND", kurz: "SANDSACK", name: "Sandsack-Füllstelle und Logistik",
      ll: BHP_LL, r: 70, art: "sonstig",
      t: 240,
      info: "Füllstelle mit Radlader, 9.000 Sandsäcke im Umlauf. Transport zur Sandsacklinie über Kreuzvorwerk und Talstraße.",
      leitung: "EA 7 - Logistik (THW FGr Log)",
      funk: "Füllstelle Kreuzvorwerk läuft. Zwei Radlader, Nachschub Sand über Dölauer Straße. Erste Kette zur Talstraße steht.",
    },
    {
      id: "EVAK2", kurz: "EVAK KLINIK", name: "Evakuierungsabschnitt Klinikumsumfeld",
      ll: [51.50190, 11.93780], flaechen: [FLUT_KLINIK], art: "einsatz",
      t: 1080,
      info: "Die tiefer liegende Zufahrt im Klinikumsumfeld droht über Rückstau unpassierbar zu werden. Vorsorgliche Verlegung von 14 immobilen Patienten aus zwei Pflegeeinrichtungen.",
      leitung: "EA 8 - Verlegung (OrgL Wendt)",
      funk: "Abschnitt Klinikumszufahrt eingerichtet. Verlegung von 14 immobilen Patienten aus zwei Pflegeeinrichtungen läuft an, KTW-Kontingent angefordert.",
    },
    {
      id: "VER", kurz: "ABL. VERST.", name: "Ablage Verstorbene",
      ll: [51.50480, 11.94250], r: 30, art: "sonstig",
      t: 1500,
      info: "Sichtgeschützt am Kreuzvorwerk. Freigabe durch Polizei, Personalien über Betreuungsstelle.",
      leitung: "Polizeirevier Halle Nord",
    },
  ];

  const gefahren = [
    {
      id: "G1", code: "PEGEL", art: "wasser", stufe: 3,
      name: "Saale - Pegel Halle-Trotha über Alarmstufe IV",
      ll: PEGEL, r: 0,
      t: 0,
      status: "steigend",
      verantwortlich: "Hochwasserzentrale / Krisenstab der Stadt",
      info: "Pegel Halle-Trotha steigt weiter. Scheitel für den Vormittag erwartet. Die flache Aue an Talstraße und Amselgrund wird zuerst überströmt.",
      messwert: {
        label: "Pegel Halle-Trotha", wert: 712, einheit: "cm", warn: 700, trend: 1,
        spanne: [640, 790], rate: 0.05, rauschen: 0.4,
        // Scheitel gegen Minute 15 der Übung, danach fällt der Pegel langsam.
        wendeT: 900, wendeTrend: -0.4, wendeStatus: "Scheitel erreicht, langsam fallend",
        wendeText: "Pegel Halle-Trotha: Scheitel erreicht - Wert fällt langsam",
        wendeFunk: "Hochwasserzentrale meldet Scheitel. Pegel fällt langsam, die Uferlinie bleibt besetzt.",
      },
    },
    {
      id: "G2", code: "UEBER", art: "wasser", stufe: 3,
      name: "Saaleübertritt im Amselgrund / Talstraße",
      ll: EPI, flaechen: [FLUT_AUE], flut: true,
      t: 0,
      status: "laufend",
      verantwortlich: "THW OV Halle (Fachberater Hochwasser) / EA 1",
      info: "Wasser tritt in den flachen Amselgrund und erreicht die Tiefpunkte der Talstraße. Uferweg und Kellerräume werden geräumt; Kontrollgänge alle zehn Minuten.",
    },
    {
      id: "G3", code: "TREIB", art: "wasser", stufe: 2,
      name: "Treibgut / Verklausung Giebichensteinbrücke",
      ll: BRUECKE, flaeche: FLUT_BRUECKE,
      t: 120,
      status: "laufend",
      verantwortlich: "Wasserstraßenamt / EA 3",
      info: "Stämme und Gartenmobiliar stauen sich an einem Brückenpfeiler. Bootsverkehr flussab der Giebichensteinbrücke gesperrt, Räumung nur bei Tageslicht.",
    },
    {
      id: "G4", code: "STROM", art: "strom", stufe: 2,
      name: "Netzausfall in der Talstraße-Uferlage",
      ll: [51.50370, 11.94790], flaeche: FLUT_NETZ,
      t: 300,
      status: "laufend",
      verantwortlich: "Netzbetreiber / EA 2",
      info: "Tief liegende Gebäude in der Talstraße-Uferlage vorsorglich freigeschaltet. Rund 340 Haushalte ohne Strom, zwei Heimbeatmungs- und ein Dialysepatient bekannt - Vorrang bei der Evakuierung.",
    },
    {
      id: "G5", code: "ÖL", art: "gas", stufe: 2,
      name: "Heizöl aus aufgeschwommenem Tank",
      ll: [51.50390, 11.94770], flaeche: FLUT_OEL,
      t: 660,
      status: "laufend",
      verantwortlich: "Umweltamt / FW Halle Gefahrgut",
      info: "Kellertank in einem tiefer liegenden Gebäude aufgeschwommen und abgerissen. Ölfilm auf dem Rückstauwasser, Ölsperre gesetzt. Kein Betreten überfluteter Keller, Zündquellen vermeiden.",
      messwert: {
        label: "Ölfilm-Ausdehnung", wert: 60, einheit: "m", warn: 80, trend: 1,
        spanne: [0, 200], rate: 0.04, rauschen: 0.3,
        wendeT: 1200, wendeTrend: -0.6, wendeStatus: "Ölsperre wirkt, Ausdehnung rückläufig",
        wendeText: "Ölsperre geschlossen - Ausdehnung rückläufig",
        endeUnter: 15, endeText: "Ölaustritt eingedämmt", endeVon: "FW Halle Gefahrgut",
        endeFunk: "Ölsperre hält, Ausdehnung unter 15 m. Ölschadenbeseitigung übernimmt Fachfirma.",
      },
    },
    {
      id: "G6", code: "ABBR", art: "einsturz", stufe: 3,
      name: "Porphyrböschung am Amselgrund",
      ll: [51.50280, 11.94580], flaeche: FLUT_PORPHYR,
      t: 1020,
      status: "laufend",
      verantwortlich: "EA 1 / Fachberater THW",
      info: "Durchfeuchtete Porphyr- und Hangkante gibt auf 25 m Länge nach. Ein Uferweg-Abschnitt ist weg; Bereich gesperrt, Aufklärung über Drohne.",
    },
    {
      id: "G7", code: "TRINK", art: "wasser", stufe: 1,
      name: "Abwasserrückstau in der Talstraße",
      ll: [51.50380, 11.94780], flaeche: FLUT_TAL, flut: true,
      t: 1320,
      status: "beobachtet",
      verantwortlich: "Stadtwerke / Gesundheitsamt",
      info: "Abwasserrückstau in tiefliegenden Kellern. Abkochgebot für die Uferlage vorbereitet, Kontakt mit verschmutztem Wasser meiden.",
    },
    {
      id: "G8", code: "MENGE", art: "menge", stufe: 1,
      name: "Schaulustige auf der Giebichensteinbrücke",
      ll: BRUECKE, flaeche: FLUT_BRUECKE,
      t: 1620,
      status: "beobachtet",
      verantwortlich: "Polizeirevier Halle Nord",
      info: "Rund 80 Personen auf dem Brückenbauwerk, Belastung und Sicht der Bootsführer beeinträchtigt. Räumung der Gehwege veranlasst.",
    },
  ];

  const sperren = [
    { id: "S1", name: "Giebichensteinbrücke - Sperrung für den Verkehr", ll: BRUECKE, von: "Polizei Halle 21/1" },
    { id: "S2", name: "Talstraße / Amselgrund", ll: [51.50360, 11.94810], von: "FW Halle 12/1" },
    { id: "S3", name: "Kröllwitzer Straße / Talstraße", ll: [51.50670, 11.94596], von: "Polizei Halle 21/2" },
    { id: "S4", name: "Kreuzvorwerk / Ernst-Grube-Straße", ll: [51.50504, 11.94103], von: "Ordnungsamt" },
    { id: "S5", name: "Ernst-Grube-Straße - Zufahrt Universitätsklinikum", ll: KLINIK, von: "Polizei Halle 21/3" },
  ];

  const poi = [
    { name: "Universitätsklinikum Halle (Kröllwitz)", ll: KLINIK, art: "medizin" },
    { name: "Giebichensteinbrücke / Kröllwitzer Brücke", ll: BRUECKE, art: "amt" },
    { name: "Kröllwitz-Grundschule (Notunterkunft)", ll: SCHULE, art: "schule" },
    { name: "Leichtathletikhalle Brandberge (BHP)", ll: BHP_LL, art: "amt" },
    { name: "Amselgrund (überflutete Saaleaue)", ll: EPI, art: "gruen" },
    { name: "Saaleufer / Bootseinsatzstelle", ll: [51.50320, 11.94900], art: "amt" },
    { name: "Talstraße / Amselgrund (Tiefpunkt)", ll: [51.50370, 11.94790], art: "amt" },
    { name: "Klinikumszufahrt Ernst-Grube-Straße", ll: [51.50190, 11.93780], art: "medizin" },
  ];

  const kliniken = [
    { id: "K1", name: "Universitätsklinikum Halle (Saale)", ll: KLINIK, km: 1.4, minuten: 6,
      stufe: "Maximalversorgung / ÜRZ", schockraum: 3, kinder: true, neuro: true, frei: { SK1: 3, SK2: 6, SK3: 10 } },
    { id: "K2", name: "BG Klinikum Bergmannstrost Halle", ll: [51.46560, 11.96900], km: 6.8, minuten: 14,
      stufe: "Schwerbrandverletzte / Querschnitt", schockraum: 2, kinder: false, neuro: true, frei: { SK1: 2, SK2: 4, SK3: 5 } },
    { id: "K3", name: "Krankenhaus St. Elisabeth und St. Barbara", ll: [51.48420, 11.96940], km: 5.1, minuten: 12,
      stufe: "Schwerpunktversorgung", schockraum: 1, kinder: false, neuro: false, frei: { SK1: 1, SK2: 5, SK3: 9 } },
    { id: "K4", name: "Krankenhaus Martha-Maria Halle-Dölau", ll: [51.50290, 11.87960], km: 5.6, minuten: 13,
      stufe: "Regelversorgung", schockraum: 1, kinder: false, neuro: false, frei: { SK1: 1, SK2: 4, SK3: 8 } },
    { id: "K5", name: "Universitätsklinikum Leipzig (RTH)", ll: [51.33170, 12.38460], km: 38.0, minuten: 18,
      stufe: "Maximalversorgung / ÜRZ", schockraum: 3, kinder: true, neuro: true, frei: { SK1: 2, SK2: 3, SK3: 4 } },
  ];

  const mittel = [
    { id: "ELW2", name: "ELW 2 Halle", kurz: "EL", art: "fuehrung", basis: "EL", rolle: "Technische Einsatzleitung", besatzung: 6 },
    { id: "HLF1", name: "Florian Halle 1/46", kurz: "HLF", art: "loesch", basis: "EVAK", rolle: "Menschenrettung, Türöffnung, Lenzarbeiten", besatzung: 9 },
    { id: "HLF2", name: "Florian Halle 3/46", kurz: "HL2", art: "loesch", basis: "DEICH", rolle: "Hochwasserschutz, Beleuchtung", besatzung: 9 },
    { id: "THW1", name: "THW Halle - Zugtrupp", kurz: "TH1", art: "loesch", basis: "DEICH", rolle: "Fachberatung Hochwasser, Sandsacklinie", besatzung: 6 },
    { id: "THW2", name: "THW Halle - FGr Wassergefahren", kurz: "TH2", art: "trupp", basis: "WR", rolle: "Bootsbetrieb, Menschenrettung aus dem Wasser", besatzung: 6 },
    { id: "BOOT1", name: "Mehrzweckboot Halle 1", kurz: "B1", art: "trupp", basis: "WR", rolle: "Evakuierung über Wasser", besatzung: 4 },
    { id: "BOOT2", name: "Rettungsboot DLRG Halle", kurz: "B2", art: "trupp", basis: "WR", rolle: "Wasserrettung, Uferabsuche", besatzung: 4 },
    { id: "T1", name: "Rettungstrupp 1", kurz: "T1", art: "trupp", basis: "EVAK", rolle: "Räumung Erdgeschosse, Sichtung", besatzung: 2 },
    { id: "T2", name: "Rettungstrupp 2", kurz: "T2", art: "trupp", basis: "EVAK", rolle: "Räumung Erdgeschosse, Sichtung", besatzung: 2 },
    { id: "T5", name: "Rettungstrupp 3", kurz: "T5", art: "trupp", basis: "DEICH", rolle: "Uferlinie, Erstversorgung", besatzung: 2 },
    { id: "T6", name: "Rettungstrupp 4", kurz: "T6", art: "trupp", basis: "EVAK", rolle: "Räumung Erdgeschosse, Sichtung", besatzung: 2 },
    { id: "T3", name: "Trag-Trupp SEG 1", kurz: "T3", art: "trupp", basis: "PA", rolle: "Ablage → Behandlungsplatz", besatzung: 4 },
    { id: "T4", name: "Trag-Trupp SEG 2", kurz: "T4", art: "trupp", basis: "PA", rolle: "Ablage → Behandlungsplatz", besatzung: 4 },
    { id: "GWS", name: "GW-San Halle", kurz: "GS", art: "loesch", basis: "BHP", rolle: "Material Behandlungsplatz 25", besatzung: 3 },
    { id: "LNA", name: "LNA Dr. Seifert", kurz: "LN", art: "arzt", basis: "PA", rolle: "Leitender Notarzt, Sichtung", besatzung: 2 },
    { id: "NEF1", name: "NEF Halle 1", kurz: "N1", art: "nef", basis: "PA", rolle: "Notarzt, erweiterte Maßnahmen", besatzung: 2 },
    { id: "RTW1", name: "RTW Halle 1/83-1", kurz: "R1", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "RTW2", name: "RTW Halle 1/83-2", kurz: "R2", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "RTW3", name: "RTW Halle 4/83-1", kurz: "R3", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "RTW4", name: "RTW Saalekreis 8/83-1", kurz: "R4", art: "rtw", basis: "BR", rolle: "Transport", besatzung: 2 },
    { id: "KTW1", name: "KTW SEG Halle 1", kurz: "K1", art: "rtw", basis: "BR", rolle: "Verlegung immobiler Patienten", besatzung: 2 },
    { id: "RTH1", name: "Christoph 84", kurz: "H1", art: "rth", basis: "BHP", rolle: "Luftrettung, Ferntransport", besatzung: 3 },
    { id: "POL1", name: "Polizei Halle 21/1", kurz: "P1", art: "polizei", basis: "S1", rolle: "Absperrung Brücke", besatzung: 2 },
    { id: "POL2", name: "Polizei Halle 21/2", kurz: "P2", art: "polizei", basis: "S3", rolle: "Absperrung Uferzone", besatzung: 2 },
    { id: "DRN1", name: "Drohne EA Aufklärung", kurz: "DR", art: "drohne", basis: "DEICH", rolle: "Uferkontrolle, Wärmebild", besatzung: 1 },
  ];

  /* Patientenroster - bei einer Hochwasserlage kommen die Betroffenen über
   * Stunden verteilt: Unterkühlung, internistische Zwischenfälle unter der
   * Evakuierung, Verletzungen beim Hochwasserschutz. */
  const patienten = [
    { id: 1, t: 20, ll: [51.50360, 11.94790], kat: "SK2", sex: "m", alter: 68, geh: false, wach: true, atemweg: true,
      vit: { af: 22, puls: 104, spo2: 93, rrs: 148, rrd: 88, gcs: 15, temp: 34.6 },
      verletzt: ["Unterkühlung 34,6 °C", "Prellung Hüfte"], massnahmen: ["Wärmeerhalt", "Sauerstoff"],
      trupp: "T1", befund: "Männlich, 68, aus dem Keller im Rückstauwasser geborgen. Zittern, verlangsamt, 34,6 °C - gelb, Wärmeerhalt." },
    { id: 2, t: 58, ll: [51.50340, 11.94820], kat: "SK1", sex: "w", alter: 79, geh: false, wach: false, atemweg: true,
      vit: { af: 26, puls: 118, spo2: 88, rrs: 96, gcs: 10, temp: 32.8 },
      verletzt: ["schwere Unterkühlung 32,8 °C", "Exsikkose"], massnahmen: ["Wärmeerhalt", "Sauerstoff", "Volumen warm"],
      trupp: "T2", befund: "Weiblich, 79, im ungeheizten Obergeschoss aufgefunden, 32,8 °C, GCS 10 - rot, aktive Erwärmung." },
    { id: 3, t: 96, ll: [51.50490, 11.94630], kat: "SK3", sex: "m", alter: 34, geh: true, wach: true, atemweg: true,
      vit: { af: 16, puls: 88, spo2: 98, gcs: 15 },
      verletzt: ["Schnittwunde Fuß (Treibgut)"], massnahmen: ["Verband", "Tetanusstatus offen"],
      trupp: "T1", befund: "Männlich, 34, Anwohner, Schnittwunde am Fuß im Wasser - grün, Tetanusschutz klären." },
    { id: 4, t: 142, ll: [51.50410, 11.94710], kat: "SK2", sex: "m", alter: 51, geh: false, wach: true, atemweg: true,
      vit: { af: 20, puls: 112, spo2: 96, rrs: 158, rrd: 94, gcs: 15 },
      verletzt: ["LWS-Distorsion", "Muskelzerrung"], massnahmen: ["Analgesie", "Lagerung"],
      trupp: "T1", befund: "Helfer, 51, beim Sandsackverbau umgeknickt, starke Rückenschmerzen - gelb." },
    { id: 5, t: 190, ll: [51.50380, 11.94800], kat: "SK1", sex: "m", alter: 74, geh: false, wach: true, atemweg: true,
      vit: { af: 24, puls: 128, spo2: 89, rrs: 104, rrd: 62, gcs: 14 },
      verletzt: ["kardiale Dekompensation", "bekannte Herzinsuffizienz"], massnahmen: ["Oberkörper hoch", "Sauerstoff", "Monitoring"],
      trupp: "T2", befund: "Männlich, 74, Atemnot unter der Evakuierung, feuchte RGs beidseits - rot, NEF nachgefordert." },
    { id: 6, t: 236, ll: [51.50320, 11.94880], kat: "SK3", sex: "w", alter: 29, geh: true, wach: true, atemweg: true,
      vit: { af: 18, puls: 92, spo2: 99, gcs: 15 },
      verletzt: ["akute Belastungsreaktion"], massnahmen: ["Betreuung"],
      trupp: "T2", befund: "Weiblich, 29, Wohnung unter Wasser, weint, keine Verletzung - grün, PSNV." },
    { id: 7, t: 288, ll: [51.50290, 11.94770], kat: "SK2", sex: "w", alter: 63, geh: false, wach: true, atemweg: true,
      vit: { af: 19, puls: 96, spo2: 95, rrs: 142, gcs: 15 },
      verletzt: ["Dialysepatientin - Termin ausgefallen"], massnahmen: ["Monitoring", "Nephrologie voranmelden"],
      trupp: "T1", befund: "Weiblich, 63, Dialyse heute ausgefallen, Ödeme zunehmend - gelb, Uniklinikum voranmelden." },
    { id: 8, t: 340, ll: [51.50460, 11.94600], kat: "SK2", sex: "m", alter: 44, geh: false, wach: true, atemweg: true,
      vit: { af: 21, puls: 106, spo2: 94, rrs: 136, gcs: 15 },
      verletzt: ["Quetschung Hand", "offene Wunde"], massnahmen: ["Verband", "Analgesie", "Schienung"],
      trupp: "T1", befund: "THW-Helfer, 44, Hand zwischen Bohle und Ladung - gelb, Handchirurgie." },
    { id: 9, t: 396, ll: [51.50390, 11.94900], kat: "SK1", sex: "m", alter: 22, geh: false, wach: false, atemweg: false,
      vit: { af: 8, puls: 132, spo2: 76, gcs: 5, temp: 31.9 },
      verletzt: ["Beinaheertrinken", "schwere Unterkühlung 31,9 °C"], massnahmen: ["Beatmung", "Wärmeerhalt", "Absaugbereitschaft"],
      trupp: "THW2", befund: "Männlich, 22, aus der Strömung geborgen, Beinaheertrinken, 31,9 °C, GCS 5 - rot, ECMO-Zentrum voranmelden.",
      verschlechtert: { t: 620, kat: "SK1", vit: { puls: 148, spo2: 71, gcs: 3 },
        massnahmen: ["Beatmung", "Katecholamine", "Wärmeerhalt", "ECMO-Zentrum angemeldet"],
        befund: "Kreislauf instabil, Sättigung fällt weiter - Ferntransport per RTH in Vorbereitung." } },
    { id: 10, t: 452, ll: [51.50270, 11.94780], kat: "SK3", sex: "w", alter: 55, geh: true, wach: true, atemweg: true,
      vit: { af: 17, puls: 86, spo2: 98, gcs: 15 },
      verletzt: ["Hautkontakt mit Abwasser"], massnahmen: ["Reinigung", "Impfstatus klären"],
      trupp: "T2", befund: "Weiblich, 55, längerer Kontakt mit Rückstauwasser, Hautreizung - grün, Impfstatus prüfen." },
    { id: 11, t: 512, ll: [51.50480, 11.94650], kat: "SK2", sex: "m", alter: 39, geh: false, wach: true, atemweg: true,
      vit: { af: 23, puls: 114, spo2: 92, rrs: 128, gcs: 15 },
      verletzt: ["Sprunggelenksfraktur V. a.", "Unterkühlung 35,4 °C"], massnahmen: ["Schienung", "Wärmeerhalt", "Analgesie"],
      trupp: "T1", befund: "Männlich, 39, im Wasser gestürzt, Sprunggelenk deformiert - gelb." },
    { id: 12, t: 580, ll: [51.50330, 11.94760], kat: "TOT", sex: "m", alter: 81, geh: false, wach: false, atemweg: false,
      vit: {}, verletzt: ["keine Lebenszeichen"], massnahmen: [],
      trupp: "T2", befund: "Männlich, 81, im überfluteten Erdgeschoss aufgefunden, sichere Todeszeichen - schwarz." },
    { id: 13, t: 650, ll: [51.50310, 11.94870], kat: "SK3", sex: "m", alter: 16, geh: true, wach: true, atemweg: true,
      vit: { af: 18, puls: 94, spo2: 99, gcs: 15 },
      verletzt: ["Unterkühlung leicht 35,8 °C"], massnahmen: ["Trockene Kleidung", "warme Getränke"],
      trupp: "THW2", befund: "Jugendlicher, 16, mit dem Boot vom Uferweg geholt, durchnässt - grün, Aufwärmzone." },
    { id: 14, t: 716, ll: [51.50240, 11.94480], kat: "SK1", sex: "w", alter: 86, geh: false, wach: true, atemweg: true,
      vit: { af: 25, puls: 122, spo2: 87, rrs: 92, gcs: 13, temp: 34.1 },
      verletzt: ["Pneumonie V. a.", "Unterkühlung", "Immobilität"], massnahmen: ["Sauerstoff", "Wärmeerhalt", "Antibiose erwogen"],
      trupp: "T3", befund: "Weiblich, 86, aus einer Pflegeeinrichtung im Klinikumsumfeld, fiebrig, Sättigung 87 % - rot, Klinikum voranmelden." },
    { id: 15, t: 790, ll: [51.50390, 11.94820], kat: "SK2", sex: "m", alter: 47, geh: false, wach: true, atemweg: true,
      vit: { af: 20, puls: 100, spo2: 95, rrs: 144, gcs: 15 },
      verletzt: ["Augenreizung (Heizöl)", "Übelkeit"], massnahmen: ["Augenspülung", "Frischluft"],
      trupp: "T1", befund: "Männlich, 47, Kontakt mit Ölfilm beim Sichern des Tanks - gelb, Augenspülung läuft." },
    { id: 16, t: 866, ll: [51.50360, 11.94720], kat: "SK3", sex: "w", alter: 71, geh: true, wach: true, atemweg: true,
      vit: { af: 17, puls: 90, spo2: 97, rrs: 162, gcs: 15 },
      verletzt: ["hypertone Entgleisung", "Aufregung"], massnahmen: ["Monitoring", "Ruhe"],
      trupp: "T2", befund: "Weiblich, 71, RR 180/100 nach Räumung der Wohnung - grün, ärztliche Kontrolle BHP." },
    { id: 17, t: 944, ll: [51.50350, 11.94910], kat: "SK2", sex: "m", alter: 58, geh: false, wach: true, atemweg: true,
      vit: { af: 22, puls: 108, spo2: 93, rrs: 132, gcs: 14 },
      verletzt: ["Aspiration Saalewasser", "Unterkühlung 34,9 °C"], massnahmen: ["Sauerstoff", "Wärmeerhalt", "Monitoring"],
      trupp: "BOOT2", befund: "Männlich, 58, vom gekenterten Kanu geborgen, hustet, hat Wasser aspiriert - gelb, engmaschig." },
    { id: 18, t: 1024, ll: [51.50200, 11.93900], kat: "SK2", sex: "w", alter: 90, geh: false, wach: true, atemweg: true,
      vit: { af: 19, puls: 98, spo2: 94, rrs: 128, gcs: 14 },
      verletzt: ["Immobilität", "Dekubitus Grad 2"], massnahmen: ["Lagerung", "Wärmeerhalt"],
      trupp: "T3", befund: "Weiblich, 90, Verlegung aus der Pflegeeinrichtung an der Klinikumszufahrt - gelb, KTW." },
    { id: 19, t: 1108, ll: [51.50180, 11.93810], kat: "SK3", sex: "m", alter: 77, geh: true, wach: true, atemweg: true,
      vit: { af: 16, puls: 84, spo2: 97, gcs: 15 },
      verletzt: ["Demenz - Orientierungsstörung"], massnahmen: ["Begleitung", "Registrierung"],
      trupp: "T4", befund: "Männlich, 77, Verlegung, desorientiert, sucht seine Frau - grün, Begleitperson zugeteilt." },
    { id: 20, t: 1196, ll: [51.50320, 11.94800], kat: "SK1", sex: "m", alter: 33, geh: false, wach: false, atemweg: true,
      vit: { af: 28, puls: 136, spo2: 85, rrs: 88, gcs: 8 },
      verletzt: ["SHT nach Böschungsabbruch", "Beckenprellung"], massnahmen: ["Sauerstoff", "HWS-Immobilisation", "Wärmeerhalt"],
      trupp: "T2", befund: "Helfer, 33, vom abrutschenden Uferweg mitgerissen, GCS 8 - rot, Schockraum voranmelden." },
    { id: 21, t: 1288, ll: [51.50530, 11.94570], kat: "SK3", sex: "w", alter: 24, geh: true, wach: true, atemweg: true,
      vit: { af: 17, puls: 88, spo2: 99, gcs: 15 },
      verletzt: ["Blasen an den Händen"], massnahmen: ["Verband"],
      trupp: "T1", befund: "Helferin, 24, Blasen vom Sandsackschleppen - grün, Ablösung empfohlen." },
    { id: 22, t: 1390, ll: [51.50230, 11.94680], kat: "SK2", sex: "m", alter: 66, geh: false, wach: true, atemweg: true,
      vit: { af: 21, puls: 102, spo2: 94, rrs: 150, gcs: 15 },
      verletzt: ["COPD-Exazerbation", "Sauerstoffgerät ohne Strom"], massnahmen: ["Sauerstoff", "Inhalation"],
      trupp: "T3", befund: "Männlich, 66, Heimsauerstoff seit der Abschaltung ohne Funktion - gelb, Transport mit O₂." },
    { id: 23, t: 1500, ll: [51.50410, 11.94920], kat: "SK3", sex: "m", alter: 41, geh: true, wach: true, atemweg: true,
      vit: { af: 16, puls: 82, spo2: 98, gcs: 15 },
      verletzt: ["Prellung Schulter"], massnahmen: [],
      trupp: "T1", befund: "Männlich, 41, gegen Absperrung gelaufen, Schulterprellung - grün." },
    { id: 24, t: 1620, ll: [51.50290, 11.94600], kat: "SK1", sex: "w", alter: 59, geh: false, wach: false, atemweg: false,
      vit: { af: 10, puls: 44, spo2: 74, gcs: 3, temp: 30.6 },
      verletzt: ["schwerste Unterkühlung 30,6 °C", "Bradykardie"], massnahmen: ["Beatmung", "Wärmeerhalt", "keine Bewegungsreize"],
      trupp: "BOOT1", befund: "Weiblich, 59, spät aus dem Obergeschoss geborgen, 30,6 °C, Bradykardie - rot, Ferntransport ECMO." },
  ];

  const funk = [
    { t: 0, von: "Leitstelle Halle", text: "Hochwasser-Alarmstufe IV für die Saale. Einsatzstichwort Wassergefahr groß, Kröllwitz Uferzone. Krisenstab der Stadt tagt ab 06:00." },
    { t: 10, von: "Florian Halle 1/46", text: "Erstmeldung Amselgrund/Talstraße: Wasser steht 40 cm über dem tiefsten Straßenabschnitt, mehrere Keller laufen voll. Nachforderung THW Fachberater Hochwasser und Sandsacklogistik." },
    { t: 30, von: "ÖEL Radtke", text: "Einsatzabschnitte gebildet: EA 1 Ufer- und Hochwasserschutz, EA 2 Evakuierung, EA 3 Wasserrettung, EA 4 Med, EA 5 Betreuung, EA 6 Transport. ELW 2 an der Talstraße in Betrieb." },
    { t: 66, von: "Rettungstrupp 1", text: "Patient 1 aus dem Rückstauwasser geborgen, 34,6 °C, gelb. Wärmeerhalt läuft, Transport zur Patientenablage.", refs: [1] },
    { t: 104, von: "THW Halle - Zugtrupp", text: "Sandsacklinie an den Tiefpunkten der Talstraße steht. Kontrollgänge alle zehn Minuten, der überschwemmte Uferweg bleibt gesperrt." },
    { t: 148, von: "DLRG Bezirk Halle", text: "Bootseinsatzstelle Talstraße in Betrieb. Zwei Mehrzweckboote und ein Rettungsboot im Wasser, Funk auf Kanal Wasser." },
    { t: 214, von: "EA 2 Evakuierung", text: "58 Haushalte in der Uferzone, davon 12 mit Pflegebedarf. Zwei Heimbeatmungs- und ein Dialysepatient bekannt - Vorrang." },
    { t: 300, von: "Netzbetreiber", text: "Tief liegende Gebäude in der Talstraße-Uferlage sind freigeschaltet. Rund 340 Haushalte ohne Strom. Heimsauerstoff- und Dialysepatienten bitte vorziehen." },
    { t: 402, von: "THW - FGr Wassergefahren", text: "Person aus der Strömung geborgen - Beinaheertrinken, stark unterkühlt, GCS 5. NEF an die Bootseinsatzstelle.", refs: [9] },
    { t: 480, von: "LNA Dr. Seifert", text: "Sichtung in der Patientenablage läuft. Schwerpunkt Unterkühlung und internistische Zwischenfälle, weniger Trauma. Aufwärmzone im Behandlungsplatz erweitert." },
    { t: 664, von: "FW Halle Gefahrgut", text: "Heizöltank in der Uferzone aufgeschwommen und abgerissen. Ölfilm auf dem Rückstauwasser, Ölsperre wird gesetzt. Keller nicht betreten." },
    { t: 820, von: "EA 6 Transport", text: "Erster Ferntransport per Christoph 84 ab Behandlungsplatz - Ziel Universitätsklinikum Leipzig, ECMO-Zentrum ist voranmeldet.", refs: [9] },
    { t: 906, von: "Hochwasserzentrale", text: "Pegel Halle-Trotha hat den Scheitel erreicht. Rückgang langsam, die Sandsacklinie an den Tiefpunkten bleibt über Nacht besetzt." },
    { t: 1026, von: "Drohne EA Aufklärung", text: "Porphyrböschung am Amselgrund auf 25 m Länge nachgegeben. Kräfte sind zurückgenommen, Bereich gesperrt." },
    { t: 1090, von: "ÖEL Radtke", text: "Zufahrt zum Klinikum droht zu überspülen. Abschnitt Verlegung eingerichtet, 14 immobile Patienten aus zwei Pflegeeinrichtungen werden vorsorglich verlegt." },
    { t: 1340, von: "Gesundheitsamt", text: "Abwasserrückstau in tiefliegenden Kellern. Abkochgebot für die Uferzone wird vorbereitet, Merkblätter über die Betreuungsstelle." },
    { t: 1560, von: "ÖEL Radtke", text: "Zwischenmeldung an den Krisenstab: Sandsacklinie hält, 71 Personen evakuiert, 24 Betroffene medizinisch versorgt. Ablösung der Uferwachen ab 14:00 eingeplant." },
  ];

  return {
    id: "halle",
    alias: ["kroellwitz", "kröllwitz", "hochwasser", "saale", "halle-saale"],
    kurz: "Halle (Saale) · Hochwasser Kröllwitz",
    sitzung: "Halle · Kröllwitz",
    geo: window.HAL_GEO,
    raster: { spalten: 14, zeilen: 11 },   // ~158 x 162 m je Feld
    absperrung: 0,
    rollen: {
      ablagen: ["PA", "PA2"], behandlungen: ["BHP"], betreuung: "BST",
      bereitstellung: "BR", halteplatz: "RMHP", verstorbene: "VER",
      landeplatz: "BHP",                        // Landung auf dem Sportplatz am BHP
      schaden: ["DEICH", "EVAK", "WR", "EVAK2"],  // hier wird gerettet und evakuiert
    },
    einsatz: {
      name: "Halle (Saale) · Kröllwitz - Hochwasser Saale, Ufer- und Hochwasserschutz an Talstraße/Amselgrund",
      stichwort: "Wassergefahr groß / MANV 20 - Alarmstufe IV",
      ort: "Talstraße / Amselgrund, Kröllwitz, 06120 Halle (Saale)",
      oel: "BF Halle, Radtke",
      lna: "Dr. Seifert",
      orgl: "Wendt",
      alarmiert: "05:40",
      betroffene: "ca. 70 evakuiert, 24 medizinisch versorgt",
      wetter: "4 °C, Dauerregen, Wind 280° 24 km/h, Sicht 3 km",
    },
    epi: EPI,
    abschnitte, gefahren, sperren, poi, kliniken, mittel, patienten, funk,
  };
})());
