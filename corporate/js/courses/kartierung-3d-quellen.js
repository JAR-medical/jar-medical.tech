// Course: kartierung-3d-quellen ("Katastrophenschutz (3D-Mapping): Drohne, Satellit & AR-Brille")
// Section: understand · Icon: map
export default {
  id: "kartierung-3d-quellen",
  version: 1,
  section: "understand",
  icon: "map",
  title: {
    de: "Katastrophenschutz (3D-Mapping): Drohne, Satellit & AR-Brille",
    en: "Civil protection (3D mapping): drone, satellite & AR glasses",
  },
  subtitle: {
    de: "3D-Sensorkartierung, 4-DoF-Stitching & Lagebild",
    en: "3D sensor mapping, 4-DoF stitching & SitRep",
  },
  summary: {
    de: "Wie Satelliten (DLR ZKI), Drohnen und AR-Brillen zu einem gemeinsamen 3D-Lagebild verschmelzen: 4-DoF-Stitching, Schwerkraft-Ausrichtung, Flut- und Rauchausbreitung sowie Evakuierungsrouten.",
    en: "How satellites (DLR ZKI), drones and AR glasses fuse into a unified 3D operational picture: 4-DoF stitching, gravity alignment, flood and smoke simulation, and evacuation routing.",
  },
  audience: {
    de: "Für Einsatzleiter, Stäbe, Drohnentrupps und Katastrophenschutz-Organisationen.",
    en: "For incident commanders, command staffs, UAV pilots and emergency planners.",
  },
  minutes: 16,
  lessons: [
    {
      id: "drei-quellen",
      title: {
        de: "Drei Sensorebenen: Satellit, Drohne & AR-Brille",
        en: "Three sensor tiers: satellite, drone & AR glasses",
      },
      minutes: 5,
      blocks: [
        { type: "map-three-sources" },
        {
          type: "p",
          text: {
            de: "Ein vollständiges 3D-Lagebild verknüpft drei Höhenebenen: Satelliten (DLR ZKI) liefern weiträumige SAR-Radarbilder und LoD-2-Gebäudemodelle, Drohnen erfassen zentimetergenaue Orthofotos und 3D-Meshes, und AR-Brillen scannen Innenräume, Keller und Patientenpositionen am Boden.",
            en: "A comprehensive 3D operational picture links three altitude tiers: satellites (DLR ZKI) supply wide-area SAR radar and LoD-2 buildings, drones capture centimetre-accurate orthomosaics and 3D meshes, and AR headsets scan interiors, basements and patient locations.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Nahbereichs-Erfassung: Weder Satellit noch Drohne können durch Betondecken blicken. Die AR-Brillen der Trupps schließen diese Lücke per SLAM-Raumvermessung direkt vor Ort.",
            en: "Close-range mapping: neither satellite nor drone can penetrate concrete ceilings. Responders' AR headsets close this visibility gap via on-site SLAM spatial mapping.",
          },
        },
      ],
    },
    {
      id: "stitching-3d",
      title: {
        de: "4-DoF-Kartenfusion: Schwerkraft, Boden-Filter & Overlap",
        en: "4-DoF map fusion: gravity, floor filtering & overlap",
      },
      minutes: 5,
      blocks: [
        { type: "map-stitching" },
        {
          type: "p",
          text: {
            de: "Weil das Tracking der Brillen an der Schwerkraft ausgerichtet ist (+Y nach oben), reduziert sich die 3D-Kartenfusion von 6 auf 4 Freiheitsgrade (Gierwinkel und 3D-Verschiebung). Ein 10-cm-Voxelfilter und das Entfernen flacher Böden verhindern gefährliche Fehlausrichtungen.",
            en: "Because headset tracking is gravity-aligned (+Y up), 3D map fusion collapses from 6 to 4 degrees of freedom (yaw and 3D translation). A 10 cm voxel filter and stripping flat floors prevent dangerous misalignments.",
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "Ehrliche Georeferenzierung: Headsets ohne ausreichenden Überlappungsbereich verbleiben transparent als unaligned. In Tests wurden 18 bis 20 von 20 Brillen mit 5,5 bis 5,7 mm Medianfehler und 0 Fehlakzeptanzen ausgerichtet.",
            en: "Honest georeferencing: headsets without sufficient overlap remain transparently unaligned. Benchmarks show 18 to 20 of 20 headsets aligned with 5.5 to 5.7 mm median error and 0 false accepts.",
          },
        },
      ],
    },
    {
      id: "lagebild-vorhersage",
      title: {
        de: "Prädiktives Lagebild: Hochwasser, Brand & Patientenrettung",
        en: "Predictive SitRep: flood, fire & casualty evacuation",
      },
      minutes: 6,
      blocks: [
        { type: "map-prediction" },
        {
          type: "p",
          text: {
            de: "Das fusionierte 3D-Modell ermöglicht prädiktive Lageberechnungen: Steigende Wasserstände simulieren die Überflutung von Straßen und Kellern, während Brandzonen gefährdete Evakuierungsrouten markieren.",
            en: "The fused 3D model enables predictive operational calculations: rising water levels simulate flooding of roads and basements, while fire zones highlight compromised evacuation routes.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Taktische Vorausschau: Gefährdete Behandlungsplätze (BHP) färben sich bei drohender Überflutung rechtzeitig rot, sodass Verletzte vor dem Eintreffen der Flutwelle auf sichere Routen evakuiert werden.",
            en: "Tactical foresight: threatened casualty collection points turn red before water arrives, triggering timely relocation of patients along safe corridors.",
          },
        },
      ],
    },
  ],
};
