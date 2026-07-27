/* Geodaten München — Altstadt und Hauptbahnhofsviertel.
 *
 * ACHTUNG, Herkunft: anders als data/neubiberg.js ist dies KEIN
 * OpenStreetMap-Auszug. Es ist ein von Hand gesetztes, grobes Achsennetz der
 * Hauptstraßen, Fußgängerzonen und Ringabschnitte. Es dient zwei Zwecken:
 *   1. Wegeführung der Einsatzmittel in der Simulation (statt Luftlinie),
 *   2. Notdarstellung, wenn keine Kartenkacheln erreichbar sind.
 * Es ist bewusst grob und nicht metergenau. Für die Anzeige im Normalbetrieb
 * wird die echte OpenStreetMap-Kachelkarte verwendet.
 *
 * ways: [name, klasse, [lat,lon, lat,lon, ...]]  klasse 0=Hauptstr. 1=Nebenstr. 2=Fuss
 */

window.MUC_GEO = {
  quelle: "vereinfachtes Achsennetz (keine OSM-Daten)",
  bbox: [48.13000, 11.55400, 48.15350, 11.59600],
  ways: [
    // Fußgängerzone Karlsplatz — Marienplatz — Tal — Isartor
    ["Neuhauser Straße / Kaufingerstraße", 2,
      [48.13940, 11.56580, 48.13900, 11.56850, 48.13850, 11.57120, 48.13740, 11.57550]],
    ["Tal", 0, [48.13740, 11.57550, 48.13660, 11.57840, 48.13580, 11.58120, 48.13520, 11.58360]],
    ["Sendlinger Straße", 1, [48.13740, 11.57550, 48.13560, 11.57080, 48.13400, 11.56760, 48.13340, 11.56650]],
    ["Theatinerstraße", 1, [48.13740, 11.57550, 48.14000, 11.57700, 48.14240, 11.57690]],
    ["Weinstraße / Marienhof", 2, [48.13740, 11.57550, 48.13860, 11.57610, 48.13960, 11.57640]],
    ["Viktualienmarkt", 2, [48.13740, 11.57550, 48.13600, 11.57640, 48.13520, 11.57620]],

    // Ringachsen und Zufahrten
    ["Sonnenstraße", 0, [48.13940, 11.56580, 48.13680, 11.56610, 48.13480, 11.56630, 48.13340, 11.56650]],
    ["Blumenstraße / Frauenstraße", 0, [48.13340, 11.56650, 48.13420, 11.57200, 48.13480, 11.57620, 48.13520, 11.58120]],
    ["Bayerstraße", 0, [48.14020, 11.55600, 48.13980, 11.56100, 48.13940, 11.56580]],
    ["Arnulfstraße", 0, [48.14060, 11.55600, 48.14200, 11.56000, 48.14320, 11.56420]],
    ["Prielmayerstraße / Elisenstraße", 0, [48.13940, 11.56580, 48.14100, 11.56520, 48.14260, 11.56480]],
    ["Brienner Straße", 0, [48.14240, 11.57690, 48.14400, 11.57180, 48.14520, 11.56660, 48.14590, 11.56520]],
    ["Ludwigstraße", 0, [48.14240, 11.57690, 48.14520, 11.58040, 48.14760, 11.58260, 48.15000, 11.58420]],
    ["Maximilianstraße", 0, [48.13970, 11.57890, 48.13940, 11.58300, 48.13910, 11.58800, 48.13880, 11.59200]],
    ["Residenzstraße / Max-Joseph-Platz", 1, [48.14240, 11.57690, 48.14090, 11.57800, 48.13970, 11.57890]],
    ["Altstadtring Ost (Thomas-Wimmer-Ring)", 0, [48.13520, 11.58360, 48.13720, 11.58540, 48.13920, 11.58620, 48.14140, 11.58560]],
    ["Altstadtring Nord (Von-der-Tann-Straße)", 0, [48.14140, 11.58560, 48.14300, 11.58200, 48.14380, 11.57840, 48.14400, 11.57180]],
    ["Oskar-von-Miller-Ring", 0, [48.14400, 11.57180, 48.14480, 11.56900, 48.14520, 11.56660]],
    ["Karlstraße", 1, [48.14260, 11.56480, 48.14440, 11.56560, 48.14520, 11.56660]],
    ["Schwanthalerstraße", 1, [48.13860, 11.55600, 48.13840, 11.56100, 48.13860, 11.56560]],
    ["Nußbaumstraße (LMU Innenstadt)", 1, [48.13340, 11.56650, 48.13260, 11.56320, 48.13200, 11.56000]],
    ["Zweibrückenstraße / Ludwigsbrücke", 0, [48.13520, 11.58360, 48.13440, 11.58800, 48.13380, 11.59200]],
    ["Sophienstraße", 1, [48.14260, 11.56480, 48.14320, 11.56800, 48.14400, 11.57180]],
    ["Kaufingertor-Passage", 2, [48.13900, 11.56850, 48.13800, 11.56900, 48.13720, 11.56980]],
    ["Rindermarkt", 2, [48.13740, 11.57550, 48.13640, 11.57420, 48.13560, 11.57300]],
    ["Odeonsplatz — Hofgarten", 2, [48.14240, 11.57690, 48.14340, 11.57900, 48.14380, 11.58120]],
    ["Salvatorplatz", 2, [48.14000, 11.57700, 48.14120, 11.57560, 48.14200, 11.57420]],
  ],
  // S-Bahn-Stammstrecke (Trasse stark vereinfacht, unterirdisch)
  rail: [
    [48.14020, 11.55800, 48.13960, 11.56500, 48.13800, 11.57200, 48.13740, 11.57560, 48.13640, 11.58200, 48.13520, 11.58800],
  ],
  buildings: [],
};
