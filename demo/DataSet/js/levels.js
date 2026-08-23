// Campaign levels. Each entry is pure data: the terrain profile, the list of
// blueprint/structure placements that make the map, where the player lands and
// where casualties may lie. Adding a level means adding an object here.
//
// `anchors` is the "set but not random" placement rule: one casualty per
// anchor, and each anchor offers three to five candidate spots. A shift picks
// one spot per anchor, so the same map never plays out identically while the
// casualty pattern stays authored rather than scattered.

const MEADOW = {
  amplitude: 12,
  base: 13,
  topBlock: "GRASS",
  shoreBlock: "SAND",
  treeCount: 110,
};

const COUNTRYSIDE = {
  amplitude: 9,
  base: 13,
  topBlock: "GRASS",
  shoreBlock: "SAND",
  treeCount: 150,
};

const INDUSTRIAL = {
  amplitude: 6,
  base: 13,
  topBlock: "GRASS",
  shoreBlock: "GRAVEL",
  treeCount: 40,
};

const ALPINE = {
  amplitude: 20,
  base: 16,
  topBlock: "SNOW",
  subBlock: "STONE",
  shoreBlock: "ICE",
  treeCount: 70,
  treeLeaves: "SNOW",
};

function guardrailRun(z, fromX, toX, rotation = 0) {
  const entries = [];
  for (let x = fromX; x + 7 <= toX; x += 8) {
    entries.push({ type: "blueprint", id: "guardrail", at: [x, z], rotation });
  }
  return entries;
}

export const LEVELS = Object.freeze([
  {
    id: "tutorial_clinic",
    title: "Übungsplatz Klinik",
    subtitle: "Einweisung",
    patientCount: 1,
    briefing:
      "Ein einzelner Patient liegt auf dem Klinikvorplatz. Geh hin, drücke E und sprich den Text aus der Karte laut vor.",
    sky: 0x9fd8f2,
    terrain: MEADOW,
    site: { area: [44, 48, 86, 90], feather: 4 },
    structures: [
      { type: "ground", area: [46, 50, 84, 88], block: "PATH" },
      { type: "ground", area: [56, 52, 72, 68], block: "CONCRETE" },
      { type: "blueprint", id: "clinic", at: [57, 54] },
      { type: "blueprint", id: "helipad", at: [48, 74] },
      { type: "blueprint", id: "ambulance", at: [74, 74] },
      { type: "lamppost", at: [50, 70] },
      { type: "lamppost", at: [80, 70] },
      { type: "lamppost", at: [50, 84] },
      { type: "lamppost", at: [80, 84] },
      { type: "tree", at: [44, 62] },
      { type: "tree", at: [88, 62] },
      { type: "tree", at: [44, 88] },
      { type: "tree", at: [88, 88] },
      { type: "pad", area: [62, 76, 66, 78] },
    ],
    spawn: { at: [64.5, 85.5], face: [64, 70] },
    anchors: [
      { id: "A", spots: [[64, 72], [58, 71], [71, 72], [64, 80]] },
    ],
  },

  {
    id: "street_collapse",
    title: "Einsturz Hauptstrasse",
    subtitle: "Wohnhaus auf die Fahrbahn",
    patientCount: 2,
    briefing:
      "Ein Wohnhaus ist auf die Hauptstrasse gestürzt. Zwei Verletzte liegen im Trümmerfeld und auf der Fahrbahn.",
    sky: 0x87ceeb,
    terrain: MEADOW,
    build: "collapse",
    clinicPlaza: true,
    spawn: { at: [67.5, 67.5], face: [92, 64] },
    anchors: [
      { id: "A", spots: [[97, 67], [102, 65], [95, 62], [93, 69], [99, 70]] },
      { id: "B", spots: [[88, 65], [90, 61], [85, 62], [83, 67]] },
    ],
  },

  {
    id: "highway_pileup",
    title: "Massenkarambolage B27",
    subtitle: "Auffahrunfall im Nebel",
    patientCount: 4,
    briefing:
      "Auf der Bundesstrasse sind im Nebel mehrere Fahrzeuge aufeinander gefahren. Vier Verletzte, verteilt über die gesamte Unfallstelle.",
    sky: 0xb8c9d4,
    fog: 0.012,
    terrain: COUNTRYSIDE,
    site: { area: [18, 52, 112, 80], feather: 4 },
    structures: [
      { type: "ground", area: [18, 54, 112, 78], block: "GRASS" },
      { type: "road", area: [16, 60, 114, 70], block: "ASPHALT", markings: true },
      { type: "ground", area: [16, 58, 114, 59], block: "GRAVEL" },
      { type: "ground", area: [16, 71, 114, 72], block: "GRAVEL" },
      ...guardrailRun(57, 24, 108),
      ...guardrailRun(74, 24, 108),
      { type: "blueprint", id: "bus", at: [44, 62] },
      { type: "blueprint", id: "car_wreck", at: [57, 66] },
      { type: "blueprint", id: "truck_trailer", at: [62, 61] },
      { type: "blueprint", id: "car_wreck", at: [36, 63] },
      { type: "blueprint", id: "car", at: [78, 63] },
      { type: "blueprint", id: "van", at: [86, 66] },
      { type: "scatter", area: [34, 60, 90, 70], block: "GRAVEL", count: 70, maxHeight: 1 },
      { type: "scatter", area: [40, 61, 80, 69], block: "RUBBLE", count: 30, maxHeight: 1 },
      { type: "fire", at: [56, 63], height: 3, spread: [[1, 0], [0, 1], [-1, 0]] },
      { type: "fire", at: [69, 62], height: 2, spread: [[1, 0]] },
      { type: "blueprint", id: "fire_engine", at: [92, 61] },
      { type: "blueprint", id: "ambulance", at: [98, 71] },
      { type: "blueprint", id: "canopy_redcross", at: [88, 74] },
      { type: "cordon", area: [28, 56, 108, 74], step: 2 },
      { type: "lamppost", at: [30, 58] },
      { type: "lamppost", at: [30, 72] },
      { type: "lamppost", at: [104, 58] },
      { type: "lamppost", at: [104, 72] },
      { type: "tree", at: [24, 78] },
      { type: "tree", at: [50, 78] },
      { type: "tree", at: [76, 52] },
      { type: "tree", at: [100, 78] },
    ],
    spawn: { at: [104.5, 66.5], face: [60, 65] },
    anchors: [
      { id: "A", spots: [[40, 68], [43, 59], [38, 66], [46, 69]] },
      { id: "B", spots: [[57, 69], [59, 59], [54, 67], [61, 70]] },
      { id: "C", spots: [[76, 68], [80, 59], [73, 69], [84, 67]] },
      { id: "D", spots: [[90, 76], [92, 72], [86, 76], [98, 73]] },
    ],
  },

  {
    id: "industrial_fire",
    title: "Werkhalle Nordhafen",
    subtitle: "Brand in der Lagerhalle",
    patientCount: 6,
    briefing:
      "Im Hafengelände brennt eine Lagerhalle. Sechs Verletzte — einer davon liegt nicht im Freien, sondern in einem der Gebäude.",
    sky: 0xc3b7a6,
    fog: 0.011,
    terrain: INDUSTRIAL,
    site: { area: [26, 28, 112, 104], feather: 4 },
    structures: [
      { type: "ground", area: [28, 30, 110, 102], block: "CONCRETE" },
      { type: "road", area: [28, 92, 110, 98], block: "ASPHALT", markings: true },
      { type: "ground", area: [28, 30, 110, 31], block: "GRAVEL" },
      {
        type: "hall",
        at: [40, 40],
        width: 26,
        depth: 22,
        height: 8,
        wall: "CONCRETE",
        roof: "METAL",
        light: true,
        doors: [[50, 61], [51, 61], [52, 61], [40, 50], [40, 51]],
        doorHeight: 4,
        windows: [[44, 40], [48, 40], [52, 40], [56, 40], [60, 40], [65, 45], [65, 50], [65, 55]],
        windowY: 3,
      },
      {
        type: "hall",
        at: [72, 38],
        width: 22,
        depth: 18,
        height: 7,
        wall: "BRICK",
        roof: "ROOF",
        light: true,
        doors: [[72, 46], [72, 47]],
        doorHeight: 4,
        windows: [[78, 38], [84, 38], [90, 38], [93, 44], [93, 50]],
        windowY: 3,
      },
      { type: "blueprint", id: "container", at: [40, 70] },
      { type: "blueprint", id: "container", at: [48, 70] },
      { type: "blueprint", id: "container", at: [56, 70] },
      { type: "blueprint", id: "container", at: [40, 70], lift: 4 },
      { type: "blueprint", id: "container", at: [48, 76], rotation: 1 },
      { type: "blueprint", id: "truck_trailer", at: [70, 72] },
      { type: "blueprint", id: "van", at: [70, 84] },
      { type: "fire", at: [52, 62], height: 3, spread: [[1, 0], [-1, 0], [0, 1]] },
      { type: "fire", at: [58, 48], lift: 8, height: 2, spread: [[1, 0], [0, 1]] },
      { type: "fire", at: [46, 48], lift: 8, height: 3, spread: [[-1, 0]] },
      { type: "scatter", area: [34, 62, 66, 90], block: "RUBBLE", count: 60, maxHeight: 2 },
      { type: "scatter", area: [70, 60, 104, 90], block: "GRAVEL", count: 50, maxHeight: 1 },
      { type: "blueprint", id: "fire_engine", at: [84, 78] },
      { type: "blueprint", id: "ambulance", at: [96, 78] },
      { type: "blueprint", id: "tent_triage", at: [86, 84] },
      { type: "blueprint", id: "canopy_redcross", at: [96, 86] },
      { type: "cordon", area: [32, 34, 106, 100], step: 3 },
      { type: "lamppost", at: [34, 36], post: "STEEL", height: 5 },
      { type: "lamppost", at: [104, 36], post: "STEEL", height: 5 },
      { type: "lamppost", at: [34, 98], post: "STEEL", height: 5 },
      { type: "lamppost", at: [104, 98], post: "STEEL", height: 5 },
      { type: "lamppost", at: [68, 66], post: "STEEL", height: 5 },
    ],
    spawn: { at: [100.5, 96.5], face: [60, 60] },
    anchors: [
      { id: "A", spots: [[68, 66], [64, 68], [72, 64], [66, 62]] },
      { id: "B", spots: [[44, 80], [52, 82], [60, 80], [46, 86]] },
      { id: "C", spots: [[80, 95], [70, 95], [90, 94], [60, 95], [50, 95]] },
      { id: "D", spots: [[92, 88], [84, 90], [96, 92], [90, 82]] },
      { id: "E", spots: [[36, 88], [40, 84], [34, 78], [44, 90]] },
      { id: "F", hidden: true, spots: [[78, 44], [84, 48], [90, 44], [80, 52]] },
    ],
  },

  {
    id: "alpine_avalanche",
    title: "Lawinenabgang Bergstation",
    subtitle: "Verschüttete am Lift",
    patientCount: 7,
    briefing:
      "Eine Lawine hat die Bergstation und die Gondelbahn getroffen. Sieben Verletzte — drei liegen verschüttet oder im Inneren und sind von weitem nicht zu sehen.",
    sky: 0xd6e8f5,
    fog: 0.013,
    terrain: ALPINE,
    site: { area: [40, 36, 108, 100], feather: 5 },
    structures: [
      { type: "ground", area: [42, 38, 106, 98], block: "SNOW" },
      { type: "ground", area: [56, 58, 96, 76], block: "ICE" },
      { type: "blueprint", id: "lift_station", at: [60, 46] },
      { type: "blueprint", id: "lift_pylon", at: [80, 50] },
      { type: "blueprint", id: "lift_pylon", at: [96, 54] },
      { type: "blueprint", id: "gondola_cabin", at: [78, 62] },
      { type: "blueprint", id: "gondola_cabin", at: [88, 70], rotation: 1 },
      { type: "fire", at: [77, 66], height: 2, spread: [[1, 0]] },
      { type: "mound", at: [70, 68], radius: 8, height: 5, block: "SNOW" },
      { type: "mound", at: [86, 56], radius: 7, height: 4, block: "SNOW" },
      { type: "mound", at: [56, 84], radius: 6, height: 4, block: "SNOW" },
      {
        type: "shelter",
        at: [50, 80],
        radius: 7,
        height: 6,
        block: "SNOW",
        mouth: [0, 1],
        clearance: 3,
        light: true,
      },
      {
        type: "shelter",
        at: [98, 44],
        radius: 6,
        height: 6,
        block: "ICE",
        mouth: [-1, 0],
        clearance: 3,
        light: true,
      },
      { type: "scatter", area: [56, 56, 96, 82], block: "ICE", count: 60, maxHeight: 1 },
      { type: "scatter", area: [60, 50, 100, 78], block: "SNOW", count: 80, maxHeight: 2 },
      { type: "blueprint", id: "tent_triage", at: [76, 86] },
      { type: "blueprint", id: "canopy_redcross", at: [88, 86] },
      { type: "blueprint", id: "ambulance", at: [96, 90] },
      { type: "blueprint", id: "helipad", at: [62, 88] },
      { type: "cordon", area: [46, 42, 102, 96], step: 3 },
      { type: "lamppost", at: [46, 44], post: "STEEL", height: 4 },
      { type: "lamppost", at: [102, 44], post: "STEEL", height: 4 },
      { type: "lamppost", at: [46, 94], post: "STEEL", height: 4 },
      { type: "lamppost", at: [102, 94], post: "STEEL", height: 4 },
      { type: "tree", at: [44, 60], leaves: "SNOW" },
      { type: "tree", at: [44, 72], leaves: "SNOW" },
      { type: "tree", at: [104, 66], leaves: "SNOW" },
      { type: "tree", at: [104, 78], leaves: "SNOW" },
    ],
    spawn: { at: [94.5, 94.5], face: [66, 56] },
    anchors: [
      { id: "A", spots: [[68, 60], [64, 64], [72, 58], [66, 56]] },
      { id: "B", spots: [[84, 66], [80, 70], [88, 64], [82, 74]] },
      { id: "C", spots: [[54, 62], [50, 66], [58, 68], [52, 58]] },
      { id: "D", spots: [[92, 82], [88, 80], [96, 84], [90, 78]] },
      { id: "F", hidden: true, spots: [[63, 50], [68, 52], [65, 54], [70, 48]] },
      { id: "G", hidden: true, spots: [[50, 80], [50, 82], [49, 84], [50, 86]] },
      { id: "H", hidden: true, spots: [[98, 44], [96, 44], [94, 44], [93, 44]] },
    ],
  },
]);

export function levelAt(index) {
  if (!Number.isInteger(index) || index < 0 || index >= LEVELS.length) return null;
  return LEVELS[index];
}

export function hiddenCount(level) {
  return (level?.anchors || []).filter((anchor) => anchor.hidden).length;
}

export const LEVEL_COUNT = LEVELS.length;
