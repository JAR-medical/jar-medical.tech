/* Geodaten Halle (Saale) — Kröllwitz und Saaleaue.
 *
 * ACHTUNG, Herkunft: anders als data/neubiberg.js ist dies KEIN
 * OpenStreetMap-Auszug. Es ist ein von Hand gesetztes, grobes Achsennetz der
 * Hauptstraßen und Uferwege. Es dient zwei Zwecken:
 *   1. Wegeführung der Einsatzmittel in der Simulation (statt Luftlinie),
 *   2. Notdarstellung, wenn keine Kartenkacheln erreichbar sind.
 * Es ist bewusst grob und nicht metergenau. Für die Anzeige im Normalbetrieb
 * wird die echte OpenStreetMap-Kachelkarte verwendet.
 *
 * ways: [name, klasse, [lat,lon, lat,lon, ...]]  klasse 0=Hauptstr. 1=Nebenstr. 2=Fuss
 */

window.HAL_GEO = {
  quelle: "vereinfachtes Achsennetz (keine OSM-Daten)",
  bbox: [51.49850, 11.92900, 51.51450, 11.96100],
  ways: [
    // Durchgangsachse Kröllwitz: Heideallee — Kröllwitzer Straße — Brücke
    ["Heideallee", 0, [51.51180, 11.93150, 51.50960, 11.93620, 51.50790, 11.94010]],
    ["Kröllwitzer Straße", 0, [51.50790, 11.94010, 51.50700, 11.94290, 51.50600, 11.94560]],
    ["Kröllwitzer Brücke", 0, [51.50600, 11.94560, 51.50540, 11.94880, 51.50500, 11.95120]],
    ["Talstraße", 0, [51.50790, 11.94010, 51.50560, 11.94120, 51.50360, 11.94210]],
    ["Ernst-Grube-Straße", 0, [51.50360, 11.94210, 51.50190, 11.94020, 51.50050, 11.93800]],
    ["Am Zollrain", 1, [51.50600, 11.94560, 51.50420, 11.94700, 51.50260, 11.94820]],
    ["Blücherstraße", 1, [51.51180, 11.93150, 51.51020, 11.92980, 51.50840, 11.93000]],
    ["Forsterstraße", 1, [51.50960, 11.93620, 51.50820, 11.93380, 51.50700, 11.93120]],
    ["Uferweg Saale West", 2, [51.50950, 11.94420, 51.50760, 11.94480, 51.50560, 11.94620, 51.50340, 11.94760]],
    ["Uferweg Saale Ost", 2, [51.50820, 11.95080, 51.50620, 11.95160, 51.50400, 11.95220]],
    ["Peißnitzweg", 2, [51.50500, 11.95120, 51.50320, 11.95040, 51.50140, 11.94960]],
    ["Anfahrt Nord (Dölauer Straße)", 0, [51.51420, 11.93400, 51.51300, 11.93220, 51.51180, 11.93150]],
    ["Anfahrt Ost (Burgstraße)", 0, [51.50500, 11.95120, 51.50440, 11.95540, 51.50380, 11.95940]],
    ["Kirchbergweg", 1, [51.50790, 11.94010, 51.50900, 11.94180, 51.50950, 11.94420]],
    ["Wohnstraße Am Hang", 1, [51.50700, 11.94290, 51.50840, 11.94440, 51.50950, 11.94420]],
    ["Zufahrt Klinikum", 1, [51.50190, 11.94020, 51.50120, 11.94260, 51.50060, 11.94480]],
  ],
  rail: [],
  buildings: [],
};
