// Interactive visual representation for "3D-Kartierung, Sensorfusion & Flutmodell":
//   1. Multi-Scale Sensor Fusion & 4-DoF Stitching Pipeline (Satellites [DLR/ZKI
//      LoD-2 & SAR/DEM] + Drones [Optical, Thermal, Terrain DSM, 3D Mesh] +
//      AR Glasses [HoloLens 2 jarmesh/1 indoor spatial mapping] -> 4-DoF Stitcher).
//   2. Interactive Isometric 3D Terrain, Sensor Layer & Flood/Hazard Calculator
//      (inspired by DLR ZKI Altenahr 3D and the J.A.R. Halle/Saale scenario).
// Built exclusively with DOM/SVG nodes via el()/replace() (never innerHTML).
import { el, replace } from "./ui.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    node.setAttribute(k, String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const PIPELINE_NODES = [
  {
    id: "sat",
    group: "source",
    x: 22,
    y: 48,
    w: 236,
    h: 94,
    accent: "#7aa8f8",
    badge: "ORBIT · DLR ZKI / DFD",
    title: {
      de: "1. Satelliten-Fernerkundung",
      en: "1. Satellite Remote Sensing",
    },
    sub: {
      de: "SAR-Radar, DGM & LoD-2-Gebäude",
      en: "SAR radar, DEM & LoD-2 buildings",
    },
    detail: {
      de: "Auf der Makro-Ebene liefern Erdbeobachtungssatelliten (u. a. über das Zentrum für Satellitengestützte Kriseninformationen ZKI des DLR) wetterunabhängige SAR-Radardaten, optische Übersichtsaufnahmen, das Digitale Geländemodell (DGM) sowie die dreidimensionalen Bestandsgebäude im LoD-2-Standard (Level of Detail 2, Zustand vor dem Ereignis). Sie bilden das geodätische Referenzgerüst der gesamten Einsatzkarte.",
      en: "At the macro scale, Earth observation satellites (via DLR's Center for Satellite Based Crisis Information ZKI) provide weather-independent SAR radar data, optical overviews, the Digital Elevation Model (DEM) and pre-incident 3D building models in LoD-2 standard (Level of Detail 2). Together they form the geodetic reference frame for the entire incident map.",
    },
    specs: {
      de: [
        ["Datenprodukte", "LoD-2-Gebäudemodell (Vorher-Referenz), DGM-Höhennetz, SAR-Wassermasken"],
        ["Abdeckung", "Großräumiges Einzugsgebiet (Flusstäler, Zufahrtskorridore, Klinikumsumfeld)"],
        ["Vorteil", "Sofort verfügbar bei Alarmierung; Referenz für Vorher/Nachher-Schadensabgleich"],
        ["Grenze", "Keine Sicht in Innenräume, Unterführungen oder unter Dächer"],
      ],
      en: [
        ["Data products", "LoD-2 building models (pre-event baseline), DEM elevation grid, SAR flood masks"],
        ["Coverage", "Wide catchment area (river valleys, approach corridors, hospital surroundings)"],
        ["Advantage", "Immediately available on alert; baseline for pre/post damage comparison"],
        ["Limitation", "No visibility inside buildings, underpasses or beneath roofs"],
      ],
    },
  },
  {
    id: "drone",
    group: "source",
    x: 22,
    y: 158,
    w: 236,
    h: 104,
    accent: "#f0b45c",
    badge: "UAV · 4 ZKI-KARTIERUNGSEBENEN",
    title: {
      de: "2. Drohnenkartierung (UAV)",
      en: "2. Drone Mapping (UAV)",
    },
    sub: {
      de: "Optisch · Thermal · Gelände · 3D",
      en: "Optical · Thermal · Terrain · 3D",
    },
    detail: {
      de: "Drohnenüberflüge über der Schadensstelle liefern vier hochaufgelöste Produkte: (1) Optisches RGB-Orthomosaik für aktuelle Sicht auf Trümmer und Straßen, (2) Thermalkarte für Wärmesignaturen von Personen im Wasser, Glutnestern oder Gefahrstoff-/Ölfilmen, (3) Zentimetergenaues Oberflächen-/Geländemodell (DSM/DTM) für Abflussrinnen und (4) Photogrammetrisches 3D-Modell nach dem Ereignis zur Erkennung eingestürzter oder beschädigter Gebäude (wie im DLR-Beispiel Altenahr 3D).",
      en: "Drone flights over the scene deliver four high-resolution products: (1) Optical RGB orthomosaic for current views of debris and roads, (2) Thermal imagery for heat signatures of casualties in water, embers or oil films, (3) Centimetre-accurate surface/terrain model (DSM/DTM) for runoff channels, and (4) Post-event photogrammetric 3D mesh to identify collapsed or damaged buildings (as in DLR's Altenahr 3D benchmark).",
    },
    specs: {
      de: [
        ["1. Optisch & 2. Thermal", "RGB-Orthofoto + Infrarot-Wärmebild (Personenortung, Brandherde, Ölfilm)"],
        ["3. Gelände (DSM/DTM)", "Hochaufgelöste Höhenkarte für präzise Flut- und Rückstauberechnung"],
        ["4. 3D-Photogrammetrie", "3D-Mesh nach dem Unwetter → Differenz zum LoD-2-Modell zeigt Gebäudeschäden"],
        ["Kamerakalibrierung", "Georeferenziert über RTK-GNSS und optische Boden-Passpunkte"],
      ],
      en: [
        ["1. Optical & 2. Thermal", "RGB orthophoto + infrared thermal map (casualty detection, hotspots, oil slicks)"],
        ["3. Terrain (DSM/DTM)", "High-resolution elevation map for accurate flood and backwater calculation"],
        ["4. 3D Photogrammetry", "Post-storm 3D mesh → diff against LoD-2 baseline highlights damaged buildings"],
        ["Camera calibration", "Georeferenced via RTK-GNSS and optical ground control points"],
      ],
    },
  },
  {
    id: "arglasses",
    group: "source",
    x: 22,
    y: 278,
    w: 236,
    h: 94,
    accent: "#8ec7b8",
    badge: "BODEN & INDOOR · 20× HOLOLENS 2",
    title: {
      de: "3. AR-Brillen Spatial Mapping",
      en: "3. AR Glasses Spatial Mapping",
    },
    sub: {
      de: "jarmesh/1 aus Gebäuden & Kellern",
      en: "jarmesh/1 from buildings & basements",
    },
    detail: {
      de: "Wo Satelliten und Drohnen blind sind – im Inneren von Gebäuden, in Kellern, Tunneln und unter Dächern –, tasten bis zu 20 AR-Brillen (HoloLens 2 über ARFoundation ARMeshManager) ihre Umgebung kontinuierlich ab. Die Dreiecksnetze werden auf dem Gerät von Unitys linkshändigem System in das rechtshändige OpenXR-System (+Y nach oben entlang der Schwerkraft) konvertiert und als Gzip-komprimierte jarmesh/1-Chunks samt frame_id an den Hub übertragen.",
      en: "Where satellites and drones are blind – inside buildings, in basements, tunnels and under roofs – up to 20 AR headsets (HoloLens 2 via ARFoundation ARMeshManager) continuously scan their surroundings. Triangle meshes are converted on-device from Unity's left-handed space into right-handed OpenXR coordinates (+Y up along gravity) and uploaded as gzip-compressed jarmesh/1 chunks with frame_id.",
    },
    specs: {
      de: [
        ["Binärformat", "jarmesh/1 (Magic „JARM“, Positions float32, Normals, Confidence, CCW-Indices)"],
        ["Schwere-Ausrichtung", "Tracking ist gravitationsausgerichtet (+Y oben) → reduziert 6-DoF auf 4-DoF"],
        ["Frame-Sicherheit", "Neue frame_id bei App-Neustart verhindert doppelte „Geisterräume“"],
        ["Offline-Spool", "Bis zu 2 GiB lokaler Puffer; verwirft bei Volllauf nur älteste Revisionen"],
      ],
      en: [
        ["Binary format", "jarmesh/1 (magic “JARM”, float32 positions, normals, confidence, CCW indices)"],
        ["Gravity alignment", "Tracking is gravity-aligned (+Y up) → collapses 6-DoF search to 4-DoF"],
        ["Frame safety", "Fresh frame_id on app restart prevents duplicate “ghost rooms”"],
        ["Offline spool", "Up to 2 GiB local buffer; drops only oldest mesh revisions when full"],
      ],
    },
  },
  {
    id: "preprocess",
    group: "stitch",
    x: 316,
    y: 58,
    w: 256,
    h: 92,
    accent: "#8ec7b8",
    badge: "SCHRITT 1 · CLOUD & ANCHORS",
    title: {
      de: "Voxel-Filter, Boden-Abzug & Anker",
      en: "Voxel Filter, Floor Strip & Anchors",
    },
    sub: {
      de: "0,10 m Voxel · Boden > 0,25 m · Kabsch",
      en: "0.10 m voxels · floor > 0.25 m · Kabsch",
    },
    detail: {
      de: "Der Stitcher mittelt Punktwolken im 10-cm-Voxelgitter (voxel_m = 0,10 m) und bestimmt die Bodenhöhe über den stärksten Peak im 5-cm-Höhenhistogramm. Entscheidend: Der Boden selbst (floor_clearance_m < 0,25 m) wird vor dem Matching komplett entfernt, weil eine flache Bodenebene zu jeder anderen Bodenebene auch um 180° verdreht passt. Gibt es geteilte QR-/GNSS-Anker (≤ 0,40 m Residuum), löst 4-DoF-Kabsch die Lage direkt.",
      en: "The stitcher downsamples point clouds on a 10 cm voxel grid (voxel_m = 0.10 m) and finds the floor height from the lowest strong peak of a 5 cm height histogram. Crucially, the floor itself (floor_clearance_m < 0.25 m) is stripped before matching because any flat floor patch matches any other at 180° flip. When shared QR/GNSS anchors exist (≤ 0.40 m residual), closed-form 4-DoF Kabsch solves the pose directly.",
    },
    specs: {
      de: [
        ["Warum Boden entfernen?", "Verhindert 180°-Fehlmatches (ohne Abzug 0,03 m RMSE bei falscher Drehung)"],
        ["Voxel & Struktur", "voxel_m = 0,10 m · mind. 200 Strukturpunkte oberhalb von 0,25 m über Boden"],
        ["Geteilte Anker", "≥ 2 Anker: geschlossener 4-DoF-Kabsch auf XZ; > 0,40 m Widerspruch → Ablehnung"],
        ["Normalen-Berechnung", "Flächengewichtete Dreiecksnormalen direkt aus dem Mesh"],
      ],
      en: [
        ["Why remove floor?", "Prevents 180° false matches (leaving floor gave 0.03 m RMSE on flipped room)"],
        ["Voxels & structure", "voxel_m = 0.10 m · min. 200 structure points more than 0.25 m above floor"],
        ["Shared anchors", "≥ 2 anchors: closed-form 4-DoF Kabsch on XZ; > 0.40 m disagreement → refused"],
        ["Normal computation", "Area-weighted face normals computed directly from mesh triangles"],
      ],
    },
  },
  {
    id: "coarse_icp",
    group: "stitch",
    x: 316,
    y: 168,
    w: 256,
    h: 92,
    accent: "#c49bff",
    badge: "SCHRITT 2 · 4-DoF FFT + ICP",
    title: {
      de: "3°-Gier-Sweep × FFT & Point-to-Plane ICP",
      en: "3° Yaw Sweep × FFT & Point-to-Plane ICP",
    },
    sub: {
      de: "120 Winkel · Phasenkorrelation · Huber",
      en: "120 angles · phase correlation · Huber",
    },
    detail: {
      de: "Fehlt ein gemeinsamer Anker, rastert der Stitcher beide Strukturwolken in 15-cm-Höhenkarten (grid_m = 0,15 m). Für alle 120 Gierwinkel (3°-Schritte) bestimmt 2D-FFT-Phasenkorrelation in O(n log n) die beste Translation. Die Top-8-Kandidaten (nach 20°/1-m-NMS) werden per Point-to-Plane-ICP (bis 50 Iterationen, 5-cm-Huber-Gewichte gegen verschobene Möbel) verfeinert.",
      en: "When no shared anchor is present, the stitcher rasterises both structure clouds into 15 cm height maps (grid_m = 0.15 m). Across all 120 yaw angles (3° steps), 2D FFT phase correlation locates the best shift in O(n log n). The top 8 candidates (after 20°/1 m NMS) are refined by point-to-plane ICP (up to 50 iterations, 5 cm Huber weights against moved furniture).",
    },
    specs: {
      de: [
        ["Grobsuche (4-DoF)", "120 Gierwinkel (3°) × 2D-FFT-Phasenkorrelation auf 0,15-m-Höhenkarten"],
        ["Kandidaten-Bewertung", "Coverage × Höhenübereinstimmung (nicht bloße Korrelationsspitze)"],
        ["Point-to-Plane ICP", "KD-Baum (max_corr_m = 0,30 m → 0,15 m), 5-cm-Huber, SVD-Orthonormalisierung"],
        ["Flotten-Komposition", "Best-First-Wachstum + Cluster-Rescue + Warm-Start (0,5 s für 20 Brillen)"],
      ],
      en: [
        ["Coarse search (4-DoF)", "120 yaw angles (3°) × 2D FFT phase correlation on 0.15 m height maps"],
        ["Candidate scoring", "Coverage × height agreement (never raw correlation peak sharpness)"],
        ["Point-to-plane ICP", "KD-tree (max_corr_m = 0.30 m → 0.15 m), 5 cm Huber, SVD re-orthonormalisation"],
        ["Fleet composition", "Best-first growth + cluster rescue + warm start (0.5 s for 20 headsets)"],
      ],
    },
  },
  {
    id: "gates",
    group: "stitch",
    x: 316,
    y: 278,
    w: 256,
    h: 92,
    accent: "#5cc08f",
    badge: "SCHRITT 3 · 7 QUALITÄTS-GATES",
    title: {
      de: "Qualitäts-Gates & Ehrliche Ablehnung",
      en: "Quality Gates & Honest Refusal",
    },
    sub: {
      de: "5,7 mm Median · 0 False Accepts",
      en: "5.7 mm median · 0 false accepts",
    },
    detail: {
      de: "Eine falsch zusammengesetzte Karte ist gefährlicher als zwei getrennte. Deshalb durchläuft jedes Paar 7 harte Gates: Strukturpunkte ≥ 200, Überlappung ≥ 25 %, RMSE ≤ 0,12 m, Konditionszahl λ_min/λ_max ≥ 0,08 (verhindert Wand-auf-Wand-Gleiten), Gesamtqualität ≥ 0,30 und Eindeutigkeit gegen symmetrische Räume. Nicht sicher ausrichtbare Brillen werden im 3D-Viewer transparent als „unaligned“ neben der Karte gezeigt.",
      en: "A falsely merged map is more dangerous than two separate ones. Every pair therefore passes 7 strict gates: structure points ≥ 200, overlap ≥ 25 %, RMSE ≤ 0.12 m, conditioning λ_min/λ_max ≥ 0.08 (prevents plane-on-plane sliding), composite quality ≥ 0.30 and ambiguity rejection for symmetric rooms. Unaligned headsets are shown transparently beside the main map, never silently merged.",
    },
    specs: {
      de: [
        ["Konditionierungs-Gate", "4-DoF-Informationsmatrix λ_min/λ_max ≥ 0,08 + Normalen-Streuung ≥ 0,05"],
        ["Qualitäts-Gate", "quality = overlap × exp(−rmse/0,12) × min(1, cond/0,08) ≥ 0,30"],
        ["Messergebnis (20 Brillen)", "Median-Fehler 5,5–5,7 mm, 0 False Accepts über alle Live-Regressionsläufe"],
        ["Ehrliche Darstellung", "Unaligned-Geräte erhalten Identitäts-Transform, Konfidenz 0 und deutschen Grund"],
      ],
      en: [
        ["Conditioning gate", "4-DoF information matrix λ_min/λ_max ≥ 0.08 + normal spread ≥ 0.05"],
        ["Composite quality gate", "quality = overlap × exp(−rmse/0.12) × min(1, cond/0.08) ≥ 0.30"],
        ["Measured accuracy (20 HL2)", "Median error 5.5–5.7 mm, 0 false accepts across all live regression runs"],
        ["Honest display", "Unaligned devices get identity transform, 0 confidence and German reason"],
      ],
    },
  },
  {
    id: "hazard3d",
    group: "output",
    x: 628,
    y: 96,
    w: 268,
    h: 220,
    accent: "#7aa8f8",
    badge: "ERGEBNIS · GLOBAL.GLB + GEFAHRENSIMULATION",
    title: {
      de: "3D-Gesamtkarte & Hochwasserberechnung",
      en: "Unified 3D Map & Flood Calculation",
    },
    sub: {
      de: "Pegel, Gebäudeschäden & Evakuierungsrouten",
      en: "Water level, building damage & evacuation routes",
    },
    detail: {
      de: "Aus Satelliten-DGM/LoD-2, Drohnen-DSM/3D-Mesh und den gestitchten AR-Brillen-Innenraumkarten entsteht das vereinigte 3D-Modell (global.glb). Darauf berechnet J.A.R. in Echtzeit: (1) Hochwasser-Inundationsmasken und Fließwege bei steigendem Pegel, (2) beschädigte oder eingestürzte Gebäude durch Vorher/Nachher-Differenz (LoD-2 vs. Drohnen-3D), (3) überflutete Keller aus AR-Scans und (4) sichere Standorte für Patientenablage (PA), Behandlungsplatz (BHP) und Rettungswege.",
      en: "Combining satellite DEM/LoD-2, drone DSM/3D mesh and stitched AR indoor meshes yields the unified 3D model (global.glb). On top of it J.A.R. computes in real time: (1) flood inundation masks and runoff paths as water levels rise, (2) damaged or collapsed buildings via pre/post diff (LoD-2 vs. drone 3D), (3) flooded basements from AR scans, and (4) safe high-ground locations for casualty collection (PA), treatment areas (BHP) and rescue routes.",
    },
    specs: {
      de: [
        ["Hochwassermaske", "Schneidet Pegelfläche h_w(x,z,t) mit DGM/DSM + Keller-Meshes der AR-Brillen"],
        ["Schadens-Detektion", "3D-Volumendifferenz LoD-2 (vorher) ↔ Drohnen-Mesh (nachher) wie Altenahr 3D"],
        ["Routen & Infrastruktur", "Sperrt überflutete Straßen/Brücken automatisch; warnt bei Trafo-/Öl-Gefahr"],
        ["Rückkanal ans AR-HUD", "Sendet Evakuierungszonen und sichere PA-/BHP-Wege direkt in die Brillen"],
      ],
      en: [
        ["Flood inundation mask", "Intersects water surface h_w(x,z,t) with DEM/DSM + AR basement meshes"],
        ["Damage detection", "3D volume diff LoD-2 (pre) ↔ drone mesh (post) as in DLR Altenahr 3D"],
        ["Routes & infrastructure", "Automatically blocks flooded roads/bridges; flags transformer/oil hazards"],
        ["Return channel to AR HUD", "Pushes evacuation zones and safe PA/BHP routes straight to the headsets"],
      ],
    },
  },
];

// Buildings and terrain features in the interactive 3D flood scene
// (modeled after Halle/Saale Kröllwitz + Altenahr 3D)
const SCENE_OBJECTS = [
  {
    id: "river",
    name: { de: "Saale / Flussbett", en: "Saale Riverbed" },
    elev: 0.0,
    gx: 0,
    gz: 2,
    w: 6,
    d: 1.4,
    h: 0.2,
    type: "river",
  },
  {
    id: "bridge",
    name: { de: "Giebichensteinbrücke", en: "Giebichenstein Bridge" },
    elev: 3.6,
    gx: 2.2,
    gz: 1.8,
    w: 1.1,
    d: 1.8,
    h: 0.6,
    type: "bridge",
  },
  {
    id: "house_tal1",
    name: { de: "Wohnblock Talstraße 4 (Keller AR-gescannt)", en: "Residential Talstraße 4 (AR basement scan)" },
    elev: 2.1,
    basementElev: 1.5,
    gx: 1.0,
    gz: 3.6,
    w: 1.1,
    d: 0.9,
    h: 1.4,
    damaged: true,
    arIndoor: true,
  },
  {
    id: "house_tal2",
    name: { de: "Wohnhaus Amselgrund 12 (Dachstuhl beschädigt)", en: "House Amselgrund 12 (roof damaged)" },
    elev: 2.4,
    basementElev: 1.8,
    gx: 2.6,
    gz: 3.7,
    w: 1.1,
    d: 0.9,
    h: 1.2,
    damaged: true,
    arIndoor: true,
  },
  {
    id: "trafo",
    name: { de: "Netz-/Trafostation Talstraße + Heizöltank", en: "Grid Transformer + Heating Oil Tank" },
    elev: 2.9,
    gx: 4.2,
    gz: 3.5,
    w: 0.9,
    d: 0.8,
    h: 0.9,
    hazard: true,
  },
  {
    id: "clinic_road",
    name: { de: "Klinikumszufahrt & Unterführung (AR-Mesh)", en: "Hospital Approach & Underpass (AR mesh)" },
    elev: 3.3,
    basementElev: 2.6,
    gx: 0.9,
    gz: 5.0,
    w: 1.4,
    d: 0.9,
    h: 1.5,
    arIndoor: true,
  },
  {
    id: "pa1",
    name: { de: "PA 1 · Patientenablage Kröllwitzer Str.", en: "PA 1 · Casualty Collection Point" },
    elev: 4.7,
    gx: 2.9,
    gz: 5.1,
    w: 1.2,
    d: 0.9,
    h: 1.1,
    safePoint: "PA 1",
  },
  {
    id: "bhp25",
    name: { de: "BHP 25 · Halle Brandberge & ELW 2", en: "BHP 25 · Treatment Hall & Command ELW 2" },
    elev: 5.4,
    gx: 4.5,
    gz: 5.0,
    w: 1.3,
    d: 1.0,
    h: 1.5,
    safePoint: "BHP 25",
  },
];

const COPY = {
  de: {
    eyebrow: "Interaktive 3D-Visualisierung · Sensorfusion, Stitching & Hochwassermodell",
    tabPipeline: "01 · Sensorfusion (Satellit · Drohne · AR) & 4-DoF-Stitcher",
    tabFlood: "02 · Interaktive 3D-Hochwasser- & Gefahrenberechnung",
    pipeHint: "Klicken Sie auf eine Datenquelle oder eine Stufe des 4-DoF-Stitchers, um die Berechnung und die Messwerte aus dem J.A.R.-Hub anzuzeigen.",
    floodHint: "Bewegen Sie den Pegel-Regler oder schalten Sie die Sensorebenen (Satellit LoD-2, Drohne 3D/Thermal, AR-Brillen Indoor-Mesh) ein und aus, um Flutausbreitung, Gebäudeschäden und abgeschnittene Rettungswege live auf der 3D-Karte zu berechnen.",
    waterLabel: "Simulierter Wasserstand / Pegel:",
    preset1: "Normalpegel (+1,4 m)",
    preset2: "Uferübertritt Talstraße (+3,2 m)",
    preset3: "Scheitelwelle / Deichbruch (+4,9 m)",
    layerSat: "Satellit (LoD-2 & DGM)",
    layerDrone: "Drohne (3D-Schaden & Thermal)",
    layerAr: "AR-Brillen (Indoor-/Keller-Mesh)",
    layerFlood: "3D-Hochwassermaske",
    kpiArea: "Überflutete Fläche",
    kpiBuildings: "Betroffene Strukturen",
    kpiRoutes: "Rettungswege & Netz",
    kpiCommand: "Taktische KI-Auswertung",
    statusTableHead: ["Objekt / Abschnitt", "Geländehöhe", "Datenquelle", "Berechneter Status bei aktuellem Pegel"],
  },
  en: {
    eyebrow: "Interactive 3D Visualisation · Sensor Fusion, Stitching & Flood Model",
    tabPipeline: "01 · Sensor Fusion (Satellite · Drone · AR) & 4-DoF Stitcher",
    tabFlood: "02 · Interactive 3D Flood & Hazard Calculator",
    pipeHint: "Click any data source or stage of the 4-DoF stitcher to inspect the mathematics and live benchmark measurements from the J.A.R. hub.",
    floodHint: "Drag the water-level slider or toggle the sensor layers (Satellite LoD-2, Drone 3D/Thermal, AR Glasses Indoor Mesh) to calculate flood inundation, structural damage and blocked rescue routes live on the 3D map.",
    waterLabel: "Simulated water level / gauge:",
    preset1: "Normal gauge (+1.4 m)",
    preset2: "Bank overflow Talstraße (+3.2 m)",
    preset3: "Peak flood wave / breach (+4.9 m)",
    layerSat: "Satellite (LoD-2 & DEM)",
    layerDrone: "Drone (3D damage & thermal)",
    layerAr: "AR glasses (indoor/basement mesh)",
    layerFlood: "3D flood inundation mask",
    kpiArea: "Inundated area",
    kpiBuildings: "Affected structures",
    kpiRoutes: "Rescue routes & grid",
    kpiCommand: "Tactical AI assessment",
    statusTableHead: ["Structure / Sector", "Ground elevation", "Sensor source", "Calculated status at current water level"],
  },
};

export function renderMapping3dVisual(block = {}, lang = "de") {
  const L = COPY[lang === "en" ? "en" : "de"];
  const pick = (v) => (v && typeof v === "object" ? v[lang] ?? v.de ?? "" : String(v ?? ""));

  let activeTab = block.mode === "flood" ? "flood" : "pipeline";
  let selectedId = "drone";

  // Flood simulator state
  const state = {
    waterLevel: 3.2,
    sat: true,
    drone: true,
    ar: true,
    flood: true,
  };

  const tabPipeBtn = el("button", {
    class: "vis-tab",
    type: "button",
    onclick: () => switchTab("pipeline"),
  }, L.tabPipeline);

  const tabFloodBtn = el("button", {
    class: "vis-tab",
    type: "button",
    onclick: () => switchTab("flood"),
  }, L.tabFlood);

  const bodyContainer = el("div", { class: "vis-body" });

  const root = el("section", { class: "vis-card", "aria-label": L.eyebrow },
    el("div", { class: "vis-head" },
      el("span", { class: "eyebrow" }, L.eyebrow),
      el("div", { class: "vis-tabs", role: "tablist" }, tabPipeBtn, tabFloodBtn),
    ),
    bodyContainer,
  );

  function switchTab(next) {
    activeTab = next;
    tabPipeBtn.classList.toggle("is-active", activeTab === "pipeline");
    tabFloodBtn.classList.toggle("is-active", activeTab === "flood");
    tabPipeBtn.setAttribute("aria-selected", activeTab === "pipeline" ? "true" : "false");
    tabFloodBtn.setAttribute("aria-selected", activeTab === "flood" ? "true" : "false");
    if (activeTab === "pipeline") renderPipelineTab();
    else renderFloodTab();
  }

  // ── TAB 1: SENSOR FUSION & STITCHING PIPELINE ─────────────────────────────
  function renderPipelineTab() {
    const svg = svgEl("svg", {
      viewBox: "0 0 920 392",
      class: "vis-svg",
      role: "img",
      "aria-label": L.eyebrow,
    });

    // Group backdrops
    const cols = [
      { x: 10, w: 260, label: lang === "en" ? "01 · 3 SENSOR ALTITUDE TIERS" : "01 · 3 SENSOR-HÖHENEBENEN" },
      { x: 304, w: 280, label: lang === "en" ? "02 · 4-DoF HUB MAP STITCHER" : "02 · 4-DoF HUB MAP-STITCHER" },
      { x: 616, w: 292, label: lang === "en" ? "03 · UNIFIED 3D CRISIS MAP" : "03 · FUSIONIERTE 3D-LAGEKARTE" },
    ];
    for (const c of cols) {
      svg.append(
        svgEl("rect", {
          x: c.x,
          y: 12,
          width: c.w,
          height: 368,
          rx: 10,
          fill: "rgba(21, 20, 46, 0.72)",
          stroke: "rgba(255, 255, 255, 0.10)",
        }),
        svgEl("text", {
          x: c.x + c.w / 2,
          y: 34,
          "text-anchor": "middle",
          fill: "#8ec7b8",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "10.5",
          "letter-spacing": "1.3",
        }, c.label),
      );
    }

    // Connecting paths
    const links = [
      ["sat", "preprocess"],
      ["drone", "preprocess"],
      ["arglasses", "preprocess"],
      ["preprocess", "coarse_icp"],
      ["coarse_icp", "gates"],
      ["gates", "hazard3d"],
      ["sat", "hazard3d"],
      ["drone", "hazard3d"],
    ];
    const byId = new Map(PIPELINE_NODES.map((n) => [n.id, n]));
    for (const [fromId, toId] of links) {
      const a = byId.get(fromId);
      const b = byId.get(toId);
      if (!a || !b) continue;
      const active = selectedId === fromId || selectedId === toId;
      let d;
      if (a.x === b.x) {
        d = `M ${a.x + a.w / 2} ${a.y + a.h} L ${b.x + b.w / 2} ${b.y}`;
      } else {
        const x1 = a.x + a.w;
        const y1 = a.y + a.h / 2;
        const x2 = b.x;
        const y2 = b.y + b.h / 2;
        const mx = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
      }
      svg.append(
        svgEl("path", {
          d,
          fill: "none",
          stroke: active ? "#8ec7b8" : "rgba(255, 255, 255, 0.20)",
          "stroke-width": active ? "2.4" : "1.4",
          "stroke-dasharray": active ? "6 3" : null,
        }),
      );
    }

    // Draw nodes
    for (const node of PIPELINE_NODES) {
      const selected = node.id === selectedId;
      const g = svgEl("g", {
        class: "vis-svg-node" + (selected ? " is-selected" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": pick(node.title),
      });
      g.addEventListener("click", () => {
        selectedId = node.id;
        renderPipelineTab();
      });
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectedId = node.id;
          renderPipelineTab();
        }
      });

      g.append(
        svgEl("rect", {
          x: node.x,
          y: node.y,
          width: node.w,
          height: node.h,
          rx: 8,
          fill: selected ? "rgba(28, 27, 59, 0.98)" : "rgba(12, 11, 31, 0.92)",
          stroke: selected ? node.accent : "rgba(255, 255, 255, 0.18)",
          "stroke-width": selected ? "2.2" : "1",
        }),
        svgEl("rect", {
          x: node.x,
          y: node.y,
          width: 4,
          height: node.h,
          rx: 2,
          fill: node.accent,
        }),
        svgEl("text", {
          x: node.x + 14,
          y: node.y + 22,
          fill: node.accent,
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9",
          "font-weight": "600",
        }, node.badge),
        svgEl("text", {
          x: node.x + 14,
          y: node.y + 44,
          fill: "#f4f5fa",
          "font-family": "Inter, -apple-system, sans-serif",
          "font-size": "11.2",
          "font-weight": "600",
          textLength: pick(node.title).length > 30 ? String(node.w - 28) : null,
          lengthAdjust: pick(node.title).length > 30 ? "spacingAndGlyphs" : null,
        }, pick(node.title)),
        svgEl("text", {
          x: node.x + 14,
          y: node.y + 64,
          fill: "#a9afc4",
          "font-family": "Inter, -apple-system, sans-serif",
          "font-size": "10.2",
        }, pick(node.sub)),
      );

      // Inside the large output card, draw a mini preview of the 4 fused layers
      if (node.id === "hazard3d") {
        const layers = [
          { y: 182, c: "#7aa8f8", t: lang === "en" ? "• LoD-2 Pre-Event Baseline (DLR)" : "• LoD-2 Bestandsgebäude (DLR)" },
          { y: 204, c: "#f0b45c", t: lang === "en" ? "• UAV 3D Mesh + Thermal Hotspots" : "• Drohnen-3D-Mesh + Thermal" },
          { y: 226, c: "#8ec7b8", t: lang === "en" ? "• Stitched HoloLens 2 Indoor Mesh" : "• Gestitchte AR-Innenraum-Meshes" },
          { y: 248, c: "#f0776e", t: lang === "en" ? "• Real-Time Flood & Route Mask" : "• Echtzeit-Hochwasser- & Routenmaske" },
        ];
        for (const item of layers) {
          g.append(
            svgEl("text", {
              x: node.x + 16,
              y: item.y,
              fill: item.c,
              "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
              "font-size": "10",
            }, item.t),
          );
        }
        const goFloodBtn = svgEl("rect", {
          x: node.x + 16,
          y: 268,
          width: node.w - 32,
          height: 30,
          rx: 15,
          fill: "rgba(142, 199, 184, 0.18)",
          stroke: "#8ec7b8",
        });
        g.append(
          goFloodBtn,
          svgEl("text", {
            x: node.x + node.w / 2,
            y: 287,
            "text-anchor": "middle",
            fill: "#8ec7b8",
            "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
            "font-size": "10",
            "font-weight": "600",
          }, lang === "en" ? "Open 3D Flood Simulator →" : "3D-Flutsimulator öffnen →"),
        );
      }

      svg.append(g);
    }

    const activeNode = byId.get(selectedId) || PIPELINE_NODES[0];

    const pillBar = el("div", { class: "vis-pills" },
      PIPELINE_NODES.map((n) => el("button", {
        type: "button",
        class: "vis-pill" + (n.id === activeNode.id ? " is-active" : ""),
        onclick: () => {
          selectedId = n.id;
          renderPipelineTab();
        },
      }, pick(n.title))),
    );

    const inspector = el("div", { class: "vis-inspector", style: `box-shadow: inset 3px 0 0 ${activeNode.accent}, inset 0 0 0 1px var(--line)` },
      el("div", { class: "vis-inspector-head" },
        el("div", {},
          el("span", { class: "vis-badge", style: `color:${activeNode.accent}` }, activeNode.badge),
          el("h4", { class: "vis-inspector-title" }, pick(activeNode.title)),
        ),
      ),
      el("p", { class: "vis-inspector-desc" }, pick(activeNode.detail)),
      el("div", { class: "vis-specs-grid" },
        (activeNode.specs[lang] || activeNode.specs.de).map(([k, v]) =>
          el("div", { class: "vis-spec-item" },
            el("span", { class: "vis-spec-label" }, k),
            el("span", { class: "vis-spec-val" }, v),
          )),
      ),
    );

    replace(bodyContainer,
      el("p", { class: "vis-hint" }, L.pipeHint),
      el("div", { class: "vis-svg-wrap" }, svg),
      pillBar,
      inspector,
    );
  }

  // ── TAB 2: INTERACTIVE 3D FLOOD & HAZARD CALCULATOR ───────────────────────
  // Isometric projection helper: grid (gx in 0..6, gz in 0..6, elev in 0..6 m) -> 2D SVG (x, y)
  function iso(gx, gz, elev = 0) {
    const originX = 430;
    const originY = 76;
    const tileW = 54;
    const tileH = 26;
    const zScale = 18;
    const x = originX + (gx - gz) * tileW;
    const y = originY + (gx + gz) * tileH - elev * zScale;
    return [Number(x.toFixed(1)), Number(y.toFixed(1))];
  }

  function polyPts(pts) {
    return pts.map(([x, y]) => `${x},${y}`).join(" ");
  }

  function drawIsoBox(svg, gx, gz, w, d, baseElev, h, colors) {
    const p00 = iso(gx, gz, baseElev);
    const p10 = iso(gx + w, gz, baseElev);
    const p11 = iso(gx + w, gz + d, baseElev);
    const p01 = iso(gx, gz + d, baseElev);

    const t00 = iso(gx, gz, baseElev + h);
    const t10 = iso(gx + w, gz, baseElev + h);
    const t11 = iso(gx + w, gz + d, baseElev + h);
    const t01 = iso(gx, gz + d, baseElev + h);

    const g = svgEl("g", {});
    // Left face (p01 - p11 - t11 - t01)
    g.append(svgEl("polygon", {
      points: polyPts([p01, p11, t11, t01]),
      fill: colors.left,
      stroke: colors.stroke,
      "stroke-width": colors.strokeWidth || "1.2",
      "stroke-dasharray": colors.dash || null,
    }));
    // Right face (p10 - p11 - t11 - t10)
    g.append(svgEl("polygon", {
      points: polyPts([p10, p11, t11, t10]),
      fill: colors.right,
      stroke: colors.stroke,
      "stroke-width": colors.strokeWidth || "1.2",
      "stroke-dasharray": colors.dash || null,
    }));
    // Top face (t00 - t10 - t11 - t01)
    g.append(svgEl("polygon", {
      points: polyPts([t00, t10, t11, t01]),
      fill: colors.top,
      stroke: colors.stroke,
      "stroke-width": colors.strokeWidth || "1.2",
      "stroke-dasharray": colors.dash || null,
    }));
    svg.append(g);
    return t11;
  }

  function renderFloodTab() {
    const wl = state.waterLevel;

    const svg = svgEl("svg", {
      viewBox: "0 0 860 390",
      class: "vis-svg",
      role: "img",
      "aria-label": L.tabFlood,
    });

    // Background sky/grid
    svg.append(
      svgEl("rect", {
        x: 0,
        y: 0,
        width: 860,
        height: 390,
        rx: 12,
        fill: "#09081a",
        stroke: "rgba(255,255,255,0.14)",
      }),
    );

    // 1. Draw stepped terrain bands from back to front (gz = 0..6)
    const bandElevs = [
      { gz0: 0.0, gz1: 1.5, elev: 1.8, label: "Ufer Nord (+1,8 m)" },
      { gz0: 1.5, gz1: 3.0, elev: 0.3, label: "Flussbett Saale (0,3 m)" },
      { gz0: 3.0, gz1: 4.4, elev: 2.3, label: "Talstraße / Amselgrund (+2,3 m)" },
      { gz0: 4.4, gz1: 6.2, elev: 4.8, label: "Anhöhe Kröllwitz / Brandberge (+4,8 m)" },
    ];

    for (const band of bandElevs) {
      const a = iso(0, band.gz0, band.elev);
      const b = iso(6, band.gz0, band.elev);
      const c = iso(6, band.gz1, band.elev);
      const d = iso(0, band.gz1, band.elev);
      const isSubmerged = state.flood && wl > band.elev;
      svg.append(
        svgEl("polygon", {
          points: polyPts([a, b, c, d]),
          fill: band.elev < 1.0
            ? "rgba(42, 92, 168, 0.38)"
            : isSubmerged
              ? "rgba(58, 122, 214, 0.24)"
              : "rgba(28, 36, 58, 0.85)",
          stroke: state.sat ? "rgba(122, 168, 248, 0.35)" : "rgba(255,255,255,0.12)",
          "stroke-width": "1",
        }),
      );
    }

    // Satellite DEM grid lines
    if (state.sat) {
      for (let g = 1; g < 6; g++) {
        const p1 = iso(g, 0, 1.8);
        const p2 = iso(g, 3.0, 2.0);
        const p3 = iso(g, 6.0, 4.8);
        svg.append(
          svgEl("polyline", {
            points: polyPts([p1, p2, p3]),
            fill: "none",
            stroke: "rgba(122, 168, 248, 0.18)",
            "stroke-dasharray": "3 3",
          }),
        );
      }
    }

    // 2. Draw 3D flood water plane at waterLevel `wl` over low-lying zones
    if (state.flood) {
      const maxGz = wl >= 4.9 ? 5.6 : wl >= 2.3 ? 4.45 : 3.1;
      const w00 = iso(0, 0, wl);
      const w10 = iso(6, 0, wl);
      const w11 = iso(6, maxGz, wl);
      const w01 = iso(0, maxGz, wl);
      svg.append(
        svgEl("polygon", {
          points: polyPts([w00, w10, w11, w01]),
          fill: "rgba(66, 153, 245, 0.34)",
          stroke: "#7aa8f8",
          "stroke-width": "1.8",
        }),
      );
    }

    // 3. Draw 3D buildings, basements (AR mesh), and infrastructure
    for (const obj of SCENE_OBJECTS) {
      if (obj.type === "river") continue;
      const flooded = wl > obj.elev;
      const basementFlooded = obj.basementElev != null && wl > obj.basementElev;

      // AR Glasses indoor/basement mesh below/inside building
      if (state.ar && obj.arIndoor) {
        drawIsoBox(svg, obj.gx + 0.08, obj.gz + 0.08, obj.w - 0.16, obj.d - 0.16, obj.elev - 0.65, 0.62, {
          top: basementFlooded ? "rgba(240, 119, 110, 0.35)" : "rgba(142, 199, 184, 0.20)",
          left: basementFlooded ? "rgba(240, 119, 110, 0.28)" : "rgba(142, 199, 184, 0.15)",
          right: basementFlooded ? "rgba(240, 119, 110, 0.22)" : "rgba(142, 199, 184, 0.12)",
          stroke: basementFlooded ? "#f0776e" : "#8ec7b8",
          dash: "3 2",
        });
      }

      // Building / structure colors based on active sensor layers & flood state
      let colors;
      if (obj.damaged && state.drone) {
        // DLR Altenahr 3D style: post-flood damaged buildings rendered translucent red/amber
        colors = {
          top: "rgba(240, 119, 110, 0.48)",
          left: "rgba(240, 119, 110, 0.34)",
          right: "rgba(240, 119, 110, 0.26)",
          stroke: "#f0776e",
          strokeWidth: "1.8",
        };
      } else if (obj.safePoint) {
        colors = {
          top: flooded ? "rgba(240, 180, 92, 0.55)" : "rgba(92, 192, 143, 0.55)",
          left: flooded ? "rgba(240, 180, 92, 0.38)" : "rgba(92, 192, 143, 0.38)",
          right: flooded ? "rgba(240, 180, 92, 0.28)" : "rgba(92, 192, 143, 0.28)",
          stroke: flooded ? "#f0b45c" : "#5cc08f",
          strokeWidth: "1.8",
        };
      } else if (flooded) {
        colors = {
          top: "rgba(240, 180, 92, 0.48)",
          left: "rgba(240, 180, 92, 0.32)",
          right: "rgba(240, 180, 92, 0.24)",
          stroke: "#f0b45c",
        };
      } else {
        colors = {
          top: "rgba(122, 168, 248, 0.32)",
          left: "rgba(122, 168, 248, 0.22)",
          right: "rgba(122, 168, 248, 0.16)",
          stroke: state.sat ? "#7aa8f8" : "rgba(255,255,255,0.3)",
        };
      }

      const [lx, ly] = drawIsoBox(svg, obj.gx, obj.gz, obj.w, obj.d, obj.elev, obj.h, colors);

      // Label above structure
      const shortLabel = obj.safePoint || (obj.type === "bridge" ? "Brücke (+3,6m)" : obj.hazard ? "Trafo (+2,9m)" : `${obj.elev.toFixed(1)}m`);
      svg.append(
        svgEl("text", {
          x: lx,
          y: ly - 8,
          "text-anchor": "middle",
          fill: "#f4f5fa",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9.5",
          "font-weight": "600",
        }, shortLabel),
      );
    }

    // 4. Drone thermal hotspots (persons in water / heating oil plume)
    if (state.drone && wl >= 2.5) {
      const [tx, ty] = iso(4.4, 3.3, Math.max(wl, 2.9) + 0.3);
      svg.append(
        svgEl("circle", { cx: tx, cy: ty, r: 9, fill: "rgba(240, 180, 92, 0.35)", stroke: "#f0b45c", "stroke-width": "1.6" }),
        svgEl("circle", { cx: tx, cy: ty, r: 3.5, fill: "#f0776e" }),
        svgEl("text", {
          x: tx + 14,
          y: ty + 3,
          fill: "#f0b45c",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9.5",
          "font-weight": "700",
        }, lang === "en" ? "THERMAL: Oil/Heat Anomaly" : "THERMAL: Heizöl-/Wärmesignatur"),
      );
    }

    // HUD Legend overlay in top-left of 3D canvas
    const legendItems = [
      { c: "#7aa8f8", t: lang === "en" ? "Satellite LoD-2 / Flood Mask" : "Satellit LoD-2 / Hochwassermaske" },
      { c: "#f0776e", t: lang === "en" ? "Drone 3D Diff: Damaged Building" : "Drohnen-3D-Diff: Gebäudeschaden" },
      { c: "#8ec7b8", t: lang === "en" ? "HoloLens 2: Indoor/Basement Mesh" : "HoloLens 2: Indoor-/Keller-Mesh" },
      { c: "#5cc08f", t: lang === "en" ? "Safe High Ground (PA 1 / BHP 25)" : "Hochwasserfrei (PA 1 / BHP 25)" },
    ];
    svg.append(
      svgEl("rect", {
        x: 16,
        y: 16,
        width: 242,
        height: 96,
        rx: 8,
        fill: "rgba(12, 11, 31, 0.88)",
        stroke: "rgba(255,255,255,0.16)",
      }),
    );
    legendItems.forEach((item, idx) => {
      svg.append(
        svgEl("circle", { cx: 30, cy: 34 + idx * 20, r: 4.5, fill: item.c }),
        svgEl("text", {
          x: 42,
          y: 38 + idx * 20,
          fill: "#f4f5fa",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9.5",
        }, item.t),
      );
    });

    // Gauge badge in top-right of 3D canvas
    svg.append(
      svgEl("rect", {
        x: 682,
        y: 16,
        width: 162,
        height: 54,
        rx: 8,
        fill: "rgba(12, 11, 31, 0.88)",
        stroke: wl >= 3.5 ? "#f0776e" : wl >= 2.2 ? "#f0b45c" : "#8ec7b8",
      }),
      svgEl("text", {
        x: 763,
        y: 35,
        "text-anchor": "middle",
        fill: "#a9afc4",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "9",
      }, lang === "en" ? "WATER LEVEL (h_w)" : "PEGELSTAND (h_w)"),
      svgEl("text", {
        x: 763,
        y: 56,
        "text-anchor": "middle",
        fill: "#f4f5fa",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "16",
        "font-weight": "700",
      }, `+${wl.toFixed(1)} m`),
    );

    // Compute live flood metrics from `wl`
    const floodedStructures = SCENE_OBJECTS.filter((o) => o.type !== "river" && (wl > o.elev || (o.basementElev != null && wl > o.basementElev)));
    const areaPct = Math.min(88, Math.max(8, Math.round((wl - 0.8) * 16)));
    const areaHa = (areaPct * 0.24).toFixed(1);
    const bridgeBlocked = wl >= 3.6;
    const trafoFlooded = wl >= 2.9;

    const kpis = [
      [
        L.kpiArea,
        `${areaPct} % (${areaHa} ha)`,
        wl >= 3.0
          ? (lang === "en" ? "Talstraße & Amselgrund inundated" : "Talstraße & Amselgrund überflutet")
          : (lang === "en" ? "Within riverbanks / low meadows" : "Im Flussbett / flache Saaleaue"),
      ],
      [
        L.kpiBuildings,
        `${floodedStructures.length} / ${SCENE_OBJECTS.length - 1}`,
        lang === "en"
          ? "2 buildings with drone 3D roof/wall damage; AR basements monitored"
          : "2 Gebäude mit Drohnen-3D-Schaden; AR-Keller überwacht",
      ],
      [
        L.kpiRoutes,
        bridgeBlocked
          ? (lang === "en" ? "Bridge CLOSED" : "Brücke GESPERRT")
          : trafoFlooded
            ? (lang === "en" ? "Trafo flooded" : "Trafo überflutet")
            : (lang === "en" ? "Routes open" : "Wege frei"),
        bridgeBlocked
          ? (lang === "en" ? "Reroute via Kröllwitzer Str. · DLRG boats active" : "Umleitung Kröllwitzer Str. · DLRG-Boote aktiv")
          : (lang === "en" ? "Giebichenstein Bridge passable (+3.6 m)" : "Giebichensteinbrücke passierbar (+3,6 m)"),
      ],
      [
        L.kpiCommand,
        wl >= 4.8
          ? (lang === "en" ? "Relocate PA 1 → BHP 25" : "PA 1 → BHP 25 verlegen")
          : (lang === "en" ? "PA 1 & BHP 25 dry ✓" : "PA 1 & BHP 25 trocken ✓"),
        lang === "en"
          ? `PA 1 (+4.7 m) · BHP 25 (+5.4 m) · Margin +${Math.max(0, 4.7 - wl).toFixed(1)} m`
          : `PA 1 (+4,7 m) · BHP 25 (+5,4 m) · Reserve +${Math.max(0, 4.7 - wl).toFixed(1)} m`,
      ],
    ];

    const slider = el("input", {
      type: "range",
      min: "1.0",
      max: "5.6",
      step: "0.1",
      value: String(wl),
      class: "vis-slider",
      "aria-label": L.waterLabel,
      oninput: (e) => {
        state.waterLevel = Number(e.target.value);
        renderFloodTab();
      },
    });

    const presets = el("div", { class: "vis-actions" },
      [
        [1.4, L.preset1],
        [3.2, L.preset2],
        [4.9, L.preset3],
      ].map(([val, label]) =>
        el("button", {
          type: "button",
          class: "btn " + (Math.abs(wl - val) < 0.15 ? "btn-primary" : "btn-outline") + " btn-small",
          onclick: () => {
            state.waterLevel = val;
            renderFloodTab();
          },
        }, label)),
    );

    const layerToggles = el("div", { class: "vis-layer-toggles" },
      [
        ["sat", L.layerSat],
        ["drone", L.layerDrone],
        ["ar", L.layerAr],
        ["flood", L.layerFlood],
      ].map(([key, label]) =>
        el("label", { class: "vis-toggle" },
          el("input", {
            type: "checkbox",
            checked: state[key],
            onchange: (e) => {
              state[key] = e.target.checked;
              renderFloodTab();
            },
          }),
          el("span", {}, label),
        )),
    );

    const statusRows = SCENE_OBJECTS.filter((o) => o.type !== "river").map((o) => {
      const isFlood = wl > o.elev;
      const isBaseFlood = o.basementElev != null && wl > o.basementElev;
      const src = o.arIndoor
        ? "Satellit LoD-2 + Drohne 3D + AR-Brille"
        : o.damaged
          ? "Satellit LoD-2 + Drohne 3D/Thermal"
          : "Satellit DGM + Drohne DSM";
      let statusBadge;
      if (isFlood) {
        statusBadge = el("span", { class: "chip chip-declined" },
          lang === "en" ? `Flooded (+${(wl - o.elev).toFixed(1)} m)` : `Überflutet (+${(wl - o.elev).toFixed(1)} m)`);
      } else if (isBaseFlood) {
        statusBadge = el("span", { class: "chip chip-pending" },
          lang === "en" ? "Basement flooded (AR scan)" : "Keller überflutet (AR-Scan)");
      } else {
        statusBadge = el("span", { class: "chip chip-ok" },
          lang === "en" ? `Dry (+${(o.elev - wl).toFixed(1)} m margin)` : `Trocken (+${(o.elev - wl).toFixed(1)} m Reserve)`);
      }
      return el("tr", {},
        el("td", {}, pick(o.name)),
        el("td", { class: "nowrap" }, `+${o.elev.toFixed(1)} m` + (o.basementElev ? ` (Keller +${o.basementElev.toFixed(1)} m)` : "")),
        el("td", {}, src),
        el("td", {}, statusBadge),
      );
    });

    replace(bodyContainer,
      el("p", { class: "vis-hint" }, L.floodHint),
      el("div", { class: "vis-slider-bar" },
        el("label", { class: "vis-slider-label" },
          el("span", {}, `${L.waterLabel} `),
          el("strong", {}, `+${wl.toFixed(1)} m`),
        ),
        slider,
      ),
      presets,
      layerToggles,
      el("div", { class: "vis-svg-wrap" }, svg),
      el("div", { class: "vis-kpi-grid" },
        kpis.map(([label, val, sub]) =>
          el("div", { class: "vis-kpi-card" },
            el("span", { class: "vis-spec-label" }, label),
            el("strong", { class: "vis-kpi-val" }, val),
            el("span", { class: "vis-kpi-sub" }, sub),
          )),
      ),
      el("div", { class: "table-wrap" },
        el("table", { class: "data-table" },
          el("thead", {}, el("tr", {}, L.statusTableHead.map((h) => el("th", { scope: "col" }, h)))),
          el("tbody", {}, statusRows),
        ),
      ),
    );
  }

  switchTab(activeTab);
  return root;
}
