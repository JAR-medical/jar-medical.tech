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
      quiz: [
        {
          q: {
            de: "Welche Daten liefern Erdbeobachtungs-Satelliten (z. B. DLR ZKI) für das Gesamtlagebild?",
            en: "What data do Earth observation satellites (e.g. DLR ZKI) contribute to the operational picture?",
          },
          options: [
            {
              de: "Wetterunabhängiges SAR-Radar, digitales Geländemodell (DGM) und LoD-2-Bestandsgebäude als Vorher-Referenz.",
              en: "Weather-independent SAR radar, digital elevation models (DEM) and LoD-2 building baselines as pre-event reference.",
            },
            {
              de: "Live-Videoaufnahmen von einzelnen Patienten in Innenräumen.",
              en: "Live video feeds of individual casualties inside buildings.",
            },
            {
              de: "Zentimetergenaue Erfassung von Tourniquet-Verschlüssen am Körper.",
              en: "Centimetre-accurate tracking of tourniquet clasps on the body.",
            },
            {
              de: "Echtzeit-Herzschlagmessung durch Gebäudedächer hindurch.",
              en: "Real-time heartbeat detection through building rooftops.",
            },
          ],
          answer: 0,
          explain: {
            de: "Satellitendaten bieten die makroskopische Vorher-Referenz (Gelände, LoD-2-Gebäude, Hochwassermasken), in die Drohnen- und Innenraumdaten eingepasst werden.",
            en: "Satellite data provides the macroscopic pre-event baseline (terrain, LoD-2 buildings, flood masks) into which drone and indoor scans are registered.",
          },
        },
        {
          q: {
            de: "Warum sind AR-Brillen für die 3D-Erfassung am Boden unverzichtbar?",
            en: "Why are AR headsets indispensable for 3D mapping on the ground?",
          },
          options: [
            {
              de: "Weil sie Innenräume, Keller und Trümmer erfassen, die aus der Luft nicht einsehbar sind, und Patienten in 3D verankern.",
              en: "Because they map interiors, basements and debris invisible from the air, anchoring patient positions in 3D.",
            },
            {
              de: "Weil Drohnen bei bewölktem Himmel grundsätzlich nicht fliegen dürfen.",
              en: "Because drones are strictly prohibited from flying whenever clouds are present.",
            },
            {
              de: "Weil AR-Brillen Satellitensignale im Weltraum verstärken.",
              en: "Because AR headsets amplify satellite radio signals in orbit.",
            },
            {
              de: "Weil nur AR-Brillen Straßenkarten aus dem Internet herunterladen können.",
              en: "Because only AR headsets can download street maps from the internet.",
            },
          ],
          answer: 0,
          explain: {
            de: "Wo Flugsensoren durch Dächer blockiert werden, bauen die AR-Brillen per SLAM 3D-Meshes von Räumen und Gängen auf und verankern Patienten exakt im Raum.",
            en: "Where aerial sensors are blocked by roofs, AR headsets build 3D meshes of rooms and hallways via SLAM, pinning patients precisely in 3D space.",
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
      quiz: [
        {
          q: {
            de: "Warum müssen vor dem Stitching Punkte des flachen Fußbodens (Abstand unter 0,25 m) herausgefiltert werden?",
            en: "Why must points of flat floors (clearance below 0.25 m) be stripped before stitching?",
          },
          options: [
            {
              de: "Weil ein flacher Boden in jedem beliebigen Winkel passt und sonst um 180 Grad verdrehte Räume mit 93 Prozent Überlappung fälschlich akzeptiert würden.",
              en: "Because a flat floor matches at any arbitrary angle, causing 180-degree inverted rooms to falsely score 93 percent overlap.",
            },
            {
              de: "Weil der Fußboden zu viel Speicherplatz im Hub-Server verbraucht.",
              en: "Because floor points consume too much memory on the hub server.",
            },
            {
              de: "Weil AR-Brillen Fußböden physikalisch nicht mit Kameras erfassen können.",
              en: "Because AR headsets physically cannot detect floors with their cameras.",
            },
            {
              de: "Weil die Schwerkraftausrichtung sonst auf -Y kippen würde.",
              en: "Because gravity alignment would otherwise flip to -Y.",
            },
          ],
          answer: 0,
          explain: {
            de: "Ohne Bodenfilter erzielte ein um 180 Grad verkehrter Raum 93 Prozent Überlappung bei nur 0,03 m Fehler. Das Herausfiltern der Bodenpunkte verhindert solche gravierenden Fehlanpassungen.",
            en: "Without floor stripping, a 180-degree reversed room scored 93 percent overlap with 0.03 m RMSE. Removing floor points prevents catastrophic false matches.",
          },
        },
        {
          q: {
            de: "Wie viele Freiheitsgrade (DoF) müssen bei der Ausrichtung der Headset-Karten berechnet werden und warum?",
            en: "How many degrees of freedom (DoF) must be solved during headset map registration and why?",
          },
          options: [
            {
              de: "4 Freiheitsgrade (Gierwinkel Yaw + 3D-Translation), weil die Schwerkraft (+Y oben) Neigung und Rollen bereits festlegt.",
              en: "4 degrees of freedom (yaw + 3D translation) because gravity (+Y up) already fixes pitch and roll.",
            },
            {
              de: "6 Freiheitsgrade, weil sich Brillen im Raum völlig unberechenbar drehen.",
              en: "6 degrees of freedom because headsets rotate completely unpredictably in space.",
            },
            {
              de: "Nur 2 Freiheitsgrade, da alle Karten als flache 2D-Pläne behandelt werden.",
              en: "Only 2 degrees of freedom because all maps are treated as flat 2D floor plans.",
            },
            {
              de: "12 Freiheitsgrade inklusive Dehnung und Verzerrung der Gebäude.",
              en: "12 degrees of freedom including affine stretching and shear distortion.",
            },
          ],
          answer: 0,
          explain: {
            de: "Dank IMU-Schwerkraftausrichtung ist der Aufwärtsvektor bekannt. Das reduziert den Suchraum auf eine 2D-Rotation (Yaw) plus 3D-Verschiebung (4-DoF Kabsch-Algorithmus).",
            en: "Thanks to IMU gravity alignment, the vertical vector is locked. This reduces the search space to 1D rotation (yaw) plus 3D translation (4-DoF Kabsch algorithm).",
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
      quiz: [
        {
          q: {
            de: "Welchen Nutzen bietet die Kombination aus digitalem Geländemodell (DSM) und AR-Keller-Scans bei Hochwasser?",
            en: "What is the benefit of combining surface terrain models (DSM) and AR basement scans during floods?",
          },
          options: [
            {
              de: "Die Einsatzleitung sieht im Voraus, welche Straßen, Unterführungen und Keller bei welchem Pegelstand überflutet werden.",
              en: "Incident commanders see in advance which streets, underpasses and basements flood at any given water level.",
            },
            {
              de: "Das Wasser kann durch das 3D-Modell physikalisch gestoppt werden.",
              en: "The floodwater can be physically halted by the 3D model.",
            },
            {
              de: "Alle Keller werden automatisch mit virtuellen Sandsäcken abgedichtet.",
              en: "All basements are automatically sealed with virtual sandbags.",
            },
            {
              de: "Die Berechnung ersetzt den Einsatz von Feuerwehrpumpen.",
              en: "The computation replaces the need for emergency water pumps.",
            },
          ],
          answer: 0,
          explain: {
            de: "Durch die Verschmelzung des Geländemodells mit den Innenraum-Scans der Brillen kann die Ausbreitung des Wassers zentimetergenau simuliert und Evakuierungen geplant werden.",
            en: "Fusing the terrain elevation model with indoor and basement headset scans enables centimetre-accurate flood simulation and evacuation planning.",
          },
        },
        {
          q: {
            de: "Was signalisiert ein roter Alarmstatus am virtuellen Behandlungsplatz im Lagebild?",
            en: "What does a red alert status on the virtual casualty collection point indicate?",
          },
          options: [
            {
              de: "Der Platz wird nach Berechnungen in Kürze überflutet; eine sofortige Verlegung ist erforderlich.",
              en: "The site will be flooded shortly according to simulation; immediate relocation is required.",
            },
            {
              de: "Dort befinden sich ausschließlich unverletzte Personen der Kategorie SK III.",
              en: "Only uninjured category T3 (green) individuals are located at the site.",
            },
            {
              de: "Die Funkverbindung zum Einsatzleitfahrzeug wurde dauerhaft getrennt.",
              en: "The radio connection to the command vehicle has been permanently lost.",
            },
            {
              de: "Am Behandlungsplatz sind alle Medikamentenvorräte vollständig aufgebraucht.",
              en: "All medical supplies at the collection point have been completely exhausted.",
            },
          ],
          answer: 0,
          explain: {
            de: "Das prädiktive Lagebild warnt die Einsatzleitung rechtzeitig vor der Überflutung des Behandlungsplatzes, damit Patienten verlegt werden, bevor die Zufahrtswege unpassierbar werden.",
            en: "The predictive SitRep alerts incident commanders before the treatment area floods, allowing patient relocation before access roads become impassable.",
          },
        },
      ],
    },
  ],
};
