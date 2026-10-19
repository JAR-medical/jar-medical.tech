// Course 2: "3D-Kartierung: Drohne, Satellit, AR & Flutmodell" (DE + EN)
// Covers multi-scale sensor fusion (Satellites [DLR/ZKI LoD-2 & SAR/DEM],
// Drones [Optical, Thermal, Terrain DSM, 3D Photogrammetry] and AR Glasses
// [HoloLens 2 jarmesh/1 indoor spatial mapping]), the 4-DoF Map Stitcher on
// the Hub (voxel filtering, floor stripping, Kabsch anchors, 3° yaw sweep x
// 2D-FFT phase correlation, Point-to-Plane ICP, 7 quality gates) and real-time
// flood inundation, building damage and evacuation route calculation.
export default {
  id: "kartierung-3d-flut",
  version: 1,
  section: "understand",
  icon: "layers3d",
  title: {
    de: "3D-Kartierung: Drohne, Satellit, AR & Flutmodell",
    en: "3D Mapping: Drone, Satellite, AR & Flood Model",
  },
  subtitle: {
    de: "Sensorfusion, 4-DoF-Stitching und Hochwasserberechnung",
    en: "Sensor fusion, 4-DoF stitching and flood simulation",
  },
  summary: {
    de: "Erleben Sie visuell und interaktiv, wie J.A.R. Geodaten von Satelliten (DLR/ZKI LoD-2 & SAR), Drohnen (Optisch, Thermal, Gelände, 3D) und bis zu 20 AR-Brillen am Boden (`jarmesh/1`) über unseren 4-DoF-Map-Stitcher zu einer einzigen 3D-Einsatzkarte zusammenführt – und darauf Hochwasserausbreitung, Gebäudeschäden und sichere Rettungswege berechnet.",
    en: "Explore visually and interactively how J.A.R. fuses geospatial data from satellites (DLR/ZKI LoD-2 & SAR), drones (optical, thermal, terrain, 3D) and up to 20 ground AR headsets (`jarmesh/1`) via our 4-DoF map stitcher into a single 3D incident map – and computes flood inundation, building damage and safe rescue routes on top of it.",
  },
  audience: {
    de: "Für Einsatzleitungen, Katastrophenschutzstäbe, Fachberater Geoinformation/Drohne sowie Forschungs- und Technologiepartner.",
    en: "For incident commanders, civil-protection staffs, GIS/drone specialists and research and technology partners.",
  },
  minutes: 24,
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: "sensorfusion-satellit-drohne-ar",
      title: {
        de: "Drei Ebenen der Datenerfassung: Satellit, Drohne & AR-Brille",
        en: "Three tiers of data capture: satellite, drone & AR glasses",
      },
      minutes: 8,
      blocks: [
        {
          type: "p",
          text: {
            de: "Keine einzelne Sensorplattform sieht bei einer Großschadenslage alles: Satelliten überblicken ganze Flusstäler, Drohnen liefern zentimetergenaue Luft- und Wärmebilder, und nur die AR-Brillen der Trupps blicken in das Innere von Gebäuden, Unterführungen und Kellern. J.A.R. führt diese drei Höhenstufen in einer gemeinsamen 3D-Karte zusammen.",
            en: "No single sensor platform sees everything in a major incident: satellites cover entire river valleys, drones deliver centimetre-accurate aerial and thermal views, and only the responders' AR headsets see inside buildings, underpasses and basements. J.A.R. fuses all three altitude tiers into one shared 3D map.",
          },
        },
        {
          type: "mapping-3d-visual",
          mode: "pipeline",
        },
        {
          type: "h",
          text: {
            de: "Die vier Ergebnisse der Drohnenkartierung & ihre Partner-Ebenen",
            en: "The four drone mapping products & their partner tiers",
          },
        },
        {
          type: "table",
          head: {
            de: ["Sensorebene", "Gelieferte Datenebenen", "Rolle im gemeinsamen 3D-Lagebild"],
            en: ["Sensor tier", "Delivered data layers", "Role in the shared 3D operating picture"],
          },
          rows: {
            de: [
              [
                "1. Satellit (Orbit · DLR ZKI / DFD)",
                "SAR-Radar, Optisch, DGM-Höhennetz & LoD-2-Gebäudemodell",
                "Liefert das großräumige Geländemodell vor dem Ereignis sowie die dreidimensionalen Bestandsgebäude (Level of Detail 2) als Referenz.",
              ],
              [
                "2. Drohne – Optisch & Thermal",
                "RGB-Orthomosaik + Infrarot-Wärmebild",
                "Zeigt aktuelle Trümmerlagen, überflutete Straßen sowie Wärmesignaturen von Personen im Wasser, Glutnestern oder ausgelaufenen Heizölfilmen.",
              ],
              [
                "2. Drohne – Gelände & 3D",
                "Oberflächenmodell (DSM/DTM) + 3D-Photogrammetrie-Mesh",
                "Berechnet ein hochaufgelöstes 3D-Modell nach dem Ereignis; der Abgleich mit dem LoD-2-Bestandsmodell markiert beschädigte Gebäude sofort.",
              ],
              [
                "3. AR-Brillen (Boden · HoloLens 2)",
                "Kontinuierliches Spatial Mapping (`jarmesh/1`, Gzip, `frame_id`)",
                "Kartiert Innenräume, Keller, Treppenhäuser und Patientenpositionen am Boden, die aus der Luft verdeckt sind.",
              ],
            ],
            en: [
              [
                "1. Satellite (Orbit · DLR ZKI / DFD)",
                "SAR radar, optical, DEM elevation grid & LoD-2 building model",
                "Provides the wide-area pre-incident terrain model and 3D baseline buildings (Level of Detail 2) as reference.",
              ],
              [
                "2. Drone – Optical & Thermal",
                "RGB orthomosaic + infrared thermal imagery",
                "Shows current debris, flooded roads and heat signatures of casualties in water, embers or heating-oil slicks.",
              ],
              [
                "2. Drone – Terrain & 3D",
                "Surface model (DSM/DTM) + 3D photogrammetry mesh",
                "Builds a high-resolution post-event 3D model; diffing against the LoD-2 baseline immediately highlights damaged buildings.",
              ],
              [
                "3. AR glasses (Ground · HoloLens 2)",
                "Continuous spatial mapping (`jarmesh/1`, gzip, `frame_id`)",
                "Maps indoor rooms, basements, stairwells and ground patient positions hidden from aerial view.",
              ],
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Welche vier Kartierungsergebnisse liefert die Drohnenaufklärung (analog zum DLR-ZKI-Standard) für das Lagebild?",
            en: "Which four mapping products does drone reconnaissance (following the DLR ZKI standard) provide for the operating picture?",
          },
          options: [
            {
              de: "Optisch (RGB), Thermal (Wärmebild), Gelände (Höhenmodell) und 3D (Photogrammetrie-Modell)",
              en: "Optical (RGB), Thermal (infrared), Terrain (elevation model) and 3D (photogrammetry model)",
            },
            {
              de: "Nur analoge Funkwellen und Luftdruckwerte",
              en: "Only analogue radio waves and barometric pressure",
            },
            {
              de: "Ausschließlich Textdateien ohne Ortsbezug",
              en: "Exclusively text files without coordinates",
            },
          ],
          answer: 0,
          explain: {
            de: "Die Drohnenkartierung vereint optische Luftbilder, Thermalkarten, digitale Geländemodelle und dreidimensionale Oberflächennetze.",
            en: "Drone mapping combines optical orthophotos, thermal imagery, digital terrain models and 3D surface meshes.",
          },
        },
        {
          q: {
            de: "Warum sind die 3D-Raumscans (`jarmesh/1`) der AR-Brillen trotz vorhandener Satelliten- und Drohnendaten unverzichtbar?",
            en: "Why are the 3D spatial scans (`jarmesh/1`) from the AR glasses indispensable even when satellite and drone data are available?",
          },
          options: [
            {
              de: "Weil Satelliten und Drohnen nicht in Gebäudeinnere, Keller, Unterführungen oder unter Dächer blicken können",
              en: "Because satellites and drones cannot see inside buildings, basements, underpasses or beneath roofs",
            },
            {
              de: "Weil Satelliten nur nachts arbeiten",
              en: "Because satellites only operate at night",
            },
            {
              de: "Weil Drohnen keine Kameras tragen dürfen",
              en: "Because drones cannot carry cameras",
            },
          ],
          answer: 0,
          explain: {
            de: "Die AR-Brillen schließen die Lücke am Boden und im Gebäudeinneren und liefern die exakten 3D-Positionen der Patienten und Innenräume.",
            en: "AR headsets close the gap at ground level and indoors, providing exact 3D geometry of rooms, basements and patient locations.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 2
    {
      id: "stitching-4dof-pipeline",
      title: {
        de: "Der 4-DoF-Map-Stitcher: Vom Einzelscan zur 3D-Gesamtkarte",
        en: "The 4-DoF map stitcher: from single scans to a unified 3D map",
      },
      minutes: 8,
      blocks: [
        {
          type: "p",
          text: {
            de: "Jede AR-Brille startet ihr Tracking in einem eigenen lokalen Koordinatensystem (`device_session`), dessen Ursprung dort liegt, wo die Brille eingeschaltet wurde. Damit der Hub bis zu 20 Brillen-Teilnetze und die Geodaten zusammenführen kann, nutzt `hub/services/stitcher` eine entscheidende physikalische Eigenschaft: **Das Tracking ist am Schwerefeld ausgerichtet (+Y zeigt immer nach oben).**",
            en: "Every AR headset starts tracking in its own local coordinate frame (`device_session`) whose origin sits wherever the device was switched on. To merge up to 20 headset meshes with geospatial layers, `hub/services/stitcher` exploits one key physical property: **tracking is gravity-aligned (+Y always points up).**",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**4 Freiheitsgrade statt 6 (Gravitations-Vorteil):** Da die Hochachse (+Y) bekannt ist, reduziert sich die unbekannte Starrkörper-Transformation zwischen zwei Karten auf **einen Gierwinkel um Y plus eine 3D-Translation (4-DoF)**. Das macht eine globale Suche über alle Drehwinkel überhaupt erst schnell und zuverlässig.",
              "**Voxel-Downsampling (10 cm) & Entfernen des Bodens (ab 25 cm):** Ein 5-cm-Höhenhistogramm erkennt den Boden und liefert die vertikale Verschiebung fast kostenlos. Danach wird der Boden zwingend entfernt – denn eine flache Bodenebene passt in jedem Winkel (auch 180° verkehrt herum!) perfekt auf jede andere Bodenebene.",
              "**Geteilte Anker zuerst (4-DoF-Kabsch):** Haben zwei Geräte denselben QR-/ArUco-Anker oder GNSS-Fix gesehen (Widerspruch maximal 0,40 m), wird die Ausrichtung direkt in geschlossener Form gelöst.",
              "**3°-Gier-Sweep × 2D-FFT-Phasenkorrelation:** Ohne Anker werden beide Wolken als 15-cm-Höhenkarten gerastert und in 120 Gierwinkeln (3°-Schritte) per schneller Fourier-Phasenkorrelation verglichen, gefolgt von **Point-to-Plane-ICP** mit 5-cm-Huber-Gewichtung.",
              "**Sieben harte Qualitäts-Gates & ehrliche Ablehnung:** Jede Ausrichtung muss mindestens 200 Strukturpunkte, mindestens 25 % Überlappung, maximal 0,12 m RMSE, eine Konditionszahl von mindestens 0,08 sowie den Eindeutigkeitstest gegen symmetrische Flure bestehen. Unsichere Teilkarten werden niemals falsch eingemischt, sondern transparent als `unaligned` markiert.",
            ],
            en: [
              "**4 degrees of freedom instead of 6 (gravity advantage):** because the up vector (+Y) is shared, the unknown rigid transform between two maps collapses to **a yaw rotation about Y plus a 3D translation (4-DoF)**, making a global angular sweep fast and tractable.",
              "**Voxel downsampling (10 cm) & floor removal (above 25 cm):** a 5 cm height histogram locates the floor and gives the vertical offset almost for free. The floor is then stripped – because a flat floor patch matches any other floor patch at any angle, including 180° wrong.",
              "**Shared anchors first (4-DoF Kabsch):** when two devices observe the same QR/ArUco anchor or GNSS fix (disagreement at most 0.40 m), the transform is solved in closed form.",
              "**3° yaw sweep × 2D FFT phase correlation:** without anchors, both clouds are rasterised into 15 cm height maps and searched across 120 yaw angles (3° steps) via FFT phase correlation, then refined by **point-to-plane ICP** with 5 cm Huber weights.",
              "**Seven strict quality gates & honest refusal:** every alignment must clear at least 200 structure points, at least 25 % overlap, at most 0.12 m RMSE, conditioning of at least 0.08 and an ambiguity check against symmetric corridors. Uncertain maps are never falsely merged, but displayed transparently as `unaligned`.",
            ],
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "**Gemessene Genauigkeit im 20-Brillen-Betrieb:** In den Live-Läufen des J.A.R.-Hubs richtet der Stitcher 18 bis 20 von 20 Headsets mit einem **Median-Fehler von 5,5 bis 5,7 mm** aus – bei **null falschen Akzeptanzen (0 False Accepts)**, selbst wenn Brillen mitten im Einsatz neu gestartet werden (`frame_id`).",
            en: "**Measured accuracy across 20 headsets:** in live hub runs the stitcher aligns 18 to 20 of 20 headsets with a **median error of 5.5 to 5.7 mm** and **zero false accepts**, even when headsets restart mid-deployment (`frame_id`).",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Warum entfernt der J.A.R.-Stitcher nach der Höhenbestimmung zwingend alle Bodenpunkte (`floor_clearance_m` = 0,25 m) vor dem eigentlichen Geometrie-Abgleich?",
            en: "Why does the J.A.R. stitcher strip all floor points (`floor_clearance_m` = 0.25 m) after finding the floor height before matching geometry?",
          },
          options: [
            {
              de: "Weil ein flacher Boden strukturlos ist und bei jedem Drehwinkel (auch 180° verkehrt herum) scheinbar perfekt auf einen anderen Boden passt",
              en: "Because a flat floor is featureless and matches any other floor patch at any rotation, including 180° flipped",
            },
            {
              de: "Weil im 3D-Viewer grundsätzlich kein Boden dargestellt werden kann",
              en: "Because the 3D viewer cannot render floors at all",
            },
            {
              de: "Um die Farbe der Wände zu verändern",
              en: "To change the colour of the walls",
            },
          ],
          answer: 0,
          explain: {
            de: "Ohne Boden-Abzug lieferte ein um 180° falsch gedrehter Raum im Test 93 % Überlappung und 0,03 m RMSE. Erst durch das Matching ausschließlich an Wänden und Strukturen über 25 cm Höhe wird die Drehung eindeutig.",
            en: "With the floor left in, a 180°-flipped scan scored 93 % overlap and 0.03 m RMSE. Matching only on walls and structure above 25 cm makes the pose unambiguous.",
          },
        },
        {
          q: {
            de: "Wie geht J.A.R. mit einer AR-Brille um, deren 3D-Teilnetz noch nicht genügend Überlappung mit der restlichen Flotte hat?",
            en: "How does J.A.R. handle an AR headset whose 3D sub-map does not yet have enough overlap with the rest of the fleet?",
          },
          options: [
            {
              de: "Der Stitcher lehnt eine unsichere Zusammenführung ehrlich ab (Status „unaligned“) und zeigt das Teilnetz transparent getrennt an, bis mehr Struktur oder ein Cluster-Rescue vorliegt",
              en: "The stitcher honestly refuses an uncertain merge (state “unaligned”) and renders the sub-map transparently aside until more structure or cluster rescue succeeds",
            },
            {
              de: "Er würfelt eine zufällige Position auf der Karte aus",
              en: "It picks a random position on the map",
            },
            {
              de: "Er löscht alle bisherigen Daten des Einsatzes",
              en: "It deletes all incident data collected so far",
            },
          ],
          answer: 0,
          explain: {
            de: "Eine falsch zusammengesetzte Karte ist gefährlicher als zwei getrennte – deshalb weist das System nicht ausgerichtete Geräte ehrlich als „unaligned“ aus.",
            en: "A falsely merged map is worse than two separate ones – so the system honestly marks unaligned devices rather than guessing.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 3
    {
      id: "flutberechnung-gefahrenanalyse",
      title: {
        de: "Hochwasser-, Schadens- & Routenberechnung im 3D-Modell",
        en: "Flood, structural damage & route calculation on the 3D model",
      },
      minutes: 8,
      blocks: [
        {
          type: "p",
          text: {
            de: "Sobald Satelliten-DGM/LoD-2, Drohnen-3D-Mesh und AR-Innenraumscans in einem gemeinsamen Koordinatensystem liegen, wird aus der reinen Darstellung ein **prädiktives Simulationsmodell**. Erproben Sie im interaktiven 3D-Hochwassersimulator, wie steigende Pegelstände, Gebäudeschäden und gesperrte Rettungswege in Echtzeit berechnet werden:",
            en: "Once satellite DEM/LoD-2, drone 3D meshes and AR indoor scans share one coordinate frame, the map becomes a **predictive simulation model**. Use the interactive 3D flood simulator below to see how rising water levels, building damage and blocked rescue routes are calculated in real time:",
          },
        },
        {
          type: "mapping-3d-visual",
          mode: "flood",
        },
        {
          type: "h",
          text: {
            de: "Was auf der fusionierten 3D-Karte berechnet wird",
            en: "What is computed on top of the fused 3D map",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Dynamische 3D-Hochwassermaske (Inundationsberechnung):** Durch Verschneiden des Pegelstands und des topografischen Gefälles mit dem Drohnen-Geländemodell (DSM) und den AR-Kellerscans berechnet das System, welche Uferabschnitte (z. B. Talstraße / Amselgrund in Halle-Kröllwitz), Unterführungen und Keller wann volllaufen.",
              "**Vorher/Nachher-Gebäudeschäden (LoD-2 vs. Drohnen-3D):** Wie in der DLR-ZKI-Analyse zu Altenahr wird das LoD-2-Gebäudemodell (vor dem Unwetter) mit dem aus Drohnenbildern generierten 3D-Modell (nach dem Unwetter) verglichen – beschädigte oder teilweise eingestürzte Gebäude erscheinen sofort farbig/transparent hervorgehoben.",
              "**Infrastruktur- & Gefahrstoff-Warnungen:** Liegen Trafo-/Netzstationen oder Heizöltanks unterhalb der berechneten Flutkote, oder erkennt die Thermal-Drohne einen Ölfilm bzw. eine Person im Wasser, erzeugt das Lagebild automatisch eine priorisierte Gefahrenwarnung.",
              "**Hochwasserfreie Standort- & Routenwahl:** Das System prüft kontinuierlich die Höhenreserve von **Patientenablage (PA)**, **Behandlungsplatz (BHP)** und **Brücken/Zufahrten** und schlägt bei Überflutung automatisch sichere Ausweichrouten und Boots-Anlandepunkte (DLRG) vor.",
            ],
            en: [
              "**Dynamic 3D flood inundation mask:** by intersecting water level and topographic gradient with the drone terrain model (DSM) and AR basement scans, the system computes which riverbank sectors (e.g. Talstraße / Amselgrund in Halle-Kröllwitz), underpasses and basements flood and when.",
              "**Pre/post structural damage (LoD-2 vs. drone 3D):** following the DLR ZKI Altenahr methodology, the pre-storm LoD-2 building model is compared against the post-storm drone 3D mesh – damaged or partially collapsed buildings are highlighted immediately.",
              "**Infrastructure & hazmat alerts:** if grid transformers or heating-oil tanks sit below the projected flood line, or if the thermal drone detects an oil plume or a casualty in the water, the command board raises an automatic hazard alert.",
              "**Flood-safe site & route planning:** the system continuously monitors the elevation margin of **casualty collection points (PA)**, **treatment areas (BHP)** and **bridges/approaches**, recommending safe detours and boat landing points (DLRG) before routes are cut off.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/halle/",
          label: {
            de: "Hochwasser-Übungslage Halle (Saale) im Live-Lagebild öffnen →",
            en: "Open Halle (Saale) flood scenario in the live operating picture →",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Wie erkennt das 3D-System nach einem Unwetter automatisch beschädigte oder teilweise eingestürzte Gebäude (wie im DLR-Beispiel Altenahr 3D)?",
            en: "How does the 3D system automatically identify damaged or partially collapsed buildings after a storm (as in the DLR Altenahr 3D case)?",
          },
          options: [
            {
              de: "Durch den 3D-Vergleich zwischen dem LoD-2-Bestandsmodell der Gebäude (vor dem Hochwasser) und dem aus Drohnenflügen generierten 3D-Modell (nach dem Hochwasser)",
              en: "By comparing the pre-flood LoD-2 building baseline model with the post-flood 3D model generated from drone flights",
            },
            {
              de: "Durch manuelles Nachmessen jedes Hauses mit einem Maßband",
              en: "By manually measuring every house with a tape measure",
            },
            {
              de: "Allein über die Telefonnummern der Anwohner",
              en: "Solely from residents' telephone numbers",
            },
          ],
          answer: 0,
          explain: {
            de: "Die Überlagerung von LoD-2-Bestandsdaten (vorher) und photogrammetrischem Drohnen-3D-Modell (nachher) macht fehlende Gebäudeteile und Strukturschäden sofort sichtbar.",
            en: "Overlaying pre-event LoD-2 building models with post-event drone 3D meshes immediately reveals missing volume and structural damage.",
          },
        },
        {
          q: {
            de: "Welchen taktischen Vorteil bietet die Verschneidung der 3D-Hochwassermaske mit den Standorten von Patientenablage (PA), Behandlungsplatz (BHP) und Brücken?",
            en: "What tactical advantage comes from intersecting the 3D flood mask with casualty collection points (PA), treatment areas (BHP) and bridges?",
          },
          options: [
            {
              de: "Die Einsatzleitung erkennt frühzeitig die verbleibende Höhenreserve, wann Brücken/Zufahrten überflutet werden und ob PA oder BHP verlegt werden müssen",
              en: "Incident command sees the remaining elevation margin early, knows when bridges/roads will flood, and whether PA or BHP must be relocated",
            },
            {
              de: "Das Hochwasser fließt dadurch langsamer ab",
              en: "It causes the floodwater to recede more slowly",
            },
            {
              de: "Es ersetzt alle Rettungsboote vor Ort",
              en: "It replaces all rescue boats on scene",
            },
          ],
          answer: 0,
          explain: {
            de: "Durch den Vergleich von Pegelprognose und Geländehöhe lassen sich Rettungswege, Bootseinsatzstellen und hochwasserfreie Behandlungsplätze vorausschauend disponieren.",
            en: "Comparing projected water levels against terrain elevation allows command to plan rescue routes, boat launch sites and flood-safe treatment areas ahead of time.",
          },
        },
      ],
    },
  ],
};
