/* Geodaten Halle (Saale) - Talstraße, Amselgrund und Kröllwitz.
 *
 * Herkunft: handgeprüfte Ortsanker aus OpenStreetMap, aber KEIN vollständiger
 * OpenStreetMap-Auszug. Das vereinfachte Achsennetz dient zwei Zwecken:
 *   1. Wegeführung der Einsatzmittel in der Simulation (statt Luftlinie),
 *   2. Notdarstellung, wenn keine Kartenkacheln erreichbar sind.
 * Die Linien sind bewusst grob; im Normalbetrieb wird die echte
 * OpenStreetMap-Kachelkarte verwendet.
 *
 * ways: [name, klasse, [lat,lon, lat,lon, ...]]  klasse 0=Hauptstr. 1=Nebenstr. 2=Fuss
 */

window.HAL_GEO = {
  quelle: "handgeprüfte Ortsanker, vereinfachtes Achsennetz (kein OSM-Auszug)",
  bbox: [51.50080, 11.93580, 51.51580, 11.95620],
  ways: [
    // Talstraße/Amselgrund - der flache, hochwassergefährdete Uferraum.
    ["Talstraße / Amselgrund", 0, [51.50404, 11.95224, 51.50334, 11.94840, 51.50280, 11.94560, 51.50177, 11.93683]],
    ["Kröllwitzer Straße", 0, [51.50670, 11.94596, 51.50480, 11.94800, 51.50404, 11.95224]],
    ["Giebichensteinbrücke", 0, [51.50404, 11.95224, 51.50460, 11.95330]],
    ["Dölauer Straße", 0, [51.50796, 11.95181, 51.50670, 11.94596]],
    ["Untere Papiermühlenstraße", 1, [51.50906, 11.95401, 51.50796, 11.95181, 51.50404, 11.95224]],
    ["Ernst-Grube-Straße", 0, [51.50177, 11.93683, 51.50195, 11.93920, 51.50310, 11.94320, 51.50410, 11.94820]],
    ["Kreuzvorwerk", 0, [51.50504, 11.94103, 51.50390, 11.94050, 51.50177, 11.93683]],
    ["Heideallee", 0, [51.50177, 11.93683, 51.49960, 11.93710, 51.49702, 11.93724]],
    ["Weinbergweg", 1, [51.49702, 11.93724, 51.49880, 11.93800, 51.50177, 11.93683]],
    ["Uferweg Amselgrund", 2, [51.50334, 11.94840, 51.50300, 11.94920, 51.50260, 11.94980]],
  ],
  rail: [],
  buildings: [],
};
