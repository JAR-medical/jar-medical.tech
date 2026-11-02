// Demo course: situation map from a simulated four-drone survey. Interactive
// map and video come from the same run of the TriARge lagebild simulation
// (assets/lagekarte/, credited in assets/lagekarte/CREDITS.json).
// Visuals live in js/visuals/lagekarte.js.
export default {
  id: "demo-lagebild-drohnen",
  version: 1,
  section: "test",
  icon: "map",
  title: {
    de: "Demo: Lagebild aus vier Drohnen",
    en: "Demo: situation map from four drones",
  },
  subtitle: {
    de: "Simulierter Drohnenschwarm, interaktive Lagekarte",
    en: "Simulated drone swarm, interactive situation map",
  },
  summary: {
    de: "Vier simulierte Drohnen überfliegen 700 × 700 m in Neubiberg, in die vier Einsatzlagen gemalt sind: MANV, Sturm, Hochwasser und Brand. Aus 211 Bildern entsteht ein gemeinsames Mosaik, ein Netz vergleicht es mit dem Luftbild von 2022 und meldet, was neu ist. Auf der Lagekarte blenden Sie jede Zwischenstufe ein und aus.",
    en: "Four simulated drones survey 700 × 700 m in Neubiberg, with four incidents painted in: a mass-casualty incident, storm, flood and fire. 211 images become one mosaic, a network compares it with the 2022 aerial image and reports what is new. On the situation map you can switch every intermediate step on and off.",
  },
  audience: {
    de: "Für Einsatzleitungen, Drohnen- und Geoinformations-Fachberater sowie technische Projektpartner.",
    en: "For incident commanders, drone and geoinformation specialists and technical project partners.",
  },
  minutes: 16,
  lessons: [
    {
      id: "lagekarte-erkunden",
      title: { de: "Die Lagekarte erkunden", en: "Explore the situation map" },
      minutes: 10,
      blocks: [
        {
          type: "p",
          text: {
            de: "Die Karte zeigt einen simulierten Einsatz über echtem Luftbild. Die Lagen sind in das amtliche Luftbild von 2024 gemalt, das Luftbild von 2022 dient als Vorher-Bild. Bis auf die Grundwahrheit hat das System alles selbst aus den Drohnenbildern berechnet.",
            en: "The map shows a simulated incident over a real aerial image. The incidents are painted into the official 2024 aerial image, the 2022 aerial image serves as the before image. Apart from the ground truth, the system computed everything itself from the drone images.",
          },
        },
        { type: "lagekarte-viewer" },
        { type: "h", text: { de: "Worauf Sie achten sollten", en: "What to look for" } },
        {
          type: "steps",
          items: {
            de: [
              "Mit **MANV** springen Sie zur Unfallstelle. Ein Tipp auf eine Meldung zeigt Klasse, Konfidenz, Fläche und die OpenStreetMap-Fläche darunter.",
              "Schalten Sie **Erkennung ohne Vorher-Bild** dazu. Ohne den Vergleich mit 2022 meldet das Netz auch Dinge, die schon damals da waren: 5 der 8 weiß gestrichelten Stellen statt 1.",
              "**Pixelvergleich ohne Lernen** zeigt, warum ein einfacher Farbvergleich nicht reicht: Schatten, Belichtung und Bewuchs ergeben über 6.000 Flächen, die er melden würde.",
              "Unter **Naht zwischen zwei Drohnen** sehen Sie, was der Verbund leistet: Nach Flug-Log allein liegen die Bilder zweier Drohnen gut 5 m versetzt, nach dem Verbund 16 cm.",
            ],
            en: [
              "**MCI** takes you to the crash site. Tapping a report shows class, confidence, area and the OpenStreetMap area underneath.",
              "Switch on **Detection without before image**. Without the comparison with 2022 the network also reports things that were already there: 5 of the 8 white dashed spots instead of 1.",
              "**Pixel comparison without learning** shows why a plain colour comparison is not enough: shadows, exposure and vegetation add up to more than 6,000 areas it would report.",
              "**Seam between two drones** shows what the joint adjustment does: from the flight log alone the images of two drones are offset by more than 5 m, after the adjustment by 16 cm.",
            ],
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Am Rechner verschieben Sie die Karte mit der Maus und zoomen mit Strg oder ⌘ und Mausrad, auf dem Tablet mit zwei Fingern. Die Knöpfe oben rechts zoomen ebenfalls.",
            en: "On a computer, drag the map with the mouse and zoom with Ctrl or ⌘ and the mouse wheel; on a tablet, use two fingers. The buttons in the top right corner zoom as well.",
          },
        },
      ],
    },
    {
      id: "so-entsteht-das-lagebild",
      title: { de: "So entsteht das Lagebild", en: "How the situation map is made" },
      minutes: 6,
      blocks: [
        { type: "lagebild-video" },
        {
          type: "steps",
          items: {
            de: [
              "**Flugplanung:** Vier Drohnen teilen sich das Gebiet. Zwei Multikopter fliegen auf 100 m je etwa eine Hälfte ab, ein Starrflügler auf 120 m das ganze Gebiet, ein dritter Multikopter auf 40 m nur die Umgebung des MANV.",
              "**Verknüpfen:** Wo sich Bilder überlappen, sucht das System gemeinsame Punkte, auch zwischen verschiedenen Drohnen. Im Beispiel sind es 2.460 Bildpaare.",
              "**Verbund:** Ein Ausgleich verschiebt jedes Bild so, dass alle Verknüpfungen passen, und richtet den Block am Luftbild von 2022 aus. Der mittlere Lagefehler sinkt von 3,96 m auf 0,40 m.",
              "**Mosaik:** Alle Bilder werden zu einem Bild verschmolzen, Helligkeitsunterschiede zwischen den Kameras werden ausgeglichen.",
              "**Erkennung:** Ein siamesisches Netz vergleicht das Mosaik mit dem Luftbild von 2022 und meldet nur, was neu ist, mit Klasse und Umriss.",
              "**Lagekarte:** Jede Meldung wird mit OpenStreetMap abgeglichen, etwa „Hindernis auf Straße: Zufahrt prüfen“, und als GeoJSON ausgegeben, das eine Lagekarte der Einsatzleitung einlesen kann.",
            ],
            en: [
              "**Flight planning:** four drones share the area. Two multicopters cover about one half each at 100 m, a fixed-wing covers the whole area at 120 m, a third multicopter flies at 40 m over the surroundings of the MCI only.",
              "**Tie points:** wherever images overlap, the system looks for shared points, also between different drones. In this example, 2,460 image pairs.",
              "**Joint adjustment:** each image is shifted until all tie points agree, and the block is aligned with the 2022 aerial image. The mean position error drops from 3.96 m to 0.40 m.",
              "**Mosaic:** all images are blended into one, brightness differences between the cameras are evened out.",
              "**Detection:** a siamese network compares the mosaic with the 2022 aerial image and reports only what is new, with class and outline.",
              "**Situation map:** every report is checked against OpenStreetMap, for example \"obstacle on road: check access\", and written out as GeoJSON that an incident-command map can load.",
            ],
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "Die Einsatzlagen sind gemalt, die Drohnen fliegen virtuell. Weil das Luftbild 20 cm pro Pixel hat, bleiben einzelne Personen schwer zu erkennen: 3 von 9 gefunden. Ohne aktuelles Vorher-Bild bleiben zwischen den Drohnen Nähte von etwa 0,6 m. Prototyp für Übungen, kein zertifiziertes Produkt.",
            en: "The incidents are painted and the drones fly virtually. Because the aerial image has 20 cm per pixel, individual people remain hard to detect: 3 of 9 found. Without a recent before image, seams of about 0.6 m remain between drones. Prototype for exercises, not a certified product.",
          },
        },
      ],
    },
  ],
};
