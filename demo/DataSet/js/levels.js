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

// The avalanche map is the one level whose terrain is a character in the
// scene: a massif that towers over the station, a tree line the flank rises
// past, rock bands above it, and the track the slab tore down into the site.
// `massifs`, `rockLine`, `treeLine` and `avalanche` are all read by World.
const ALPINE = {
  amplitude: 20,
  base: 16,
  topBlock: "SNOW",
  subBlock: "STONE",
  shoreBlock: "ICE",
  rockBlock: "STONE",
  cliffSlope: 3,
  cliffMinHeight: 24,
  treeLine: 30,
  treeCount: 90,
  treeLeaves: "SNOW",
  massifs: [
    // The face the slab came off, with its summit inside the map so the player
    // can look up the full length of the track from the deposit.
    { at: [48, 4], radius: 86, height: 34, falloff: 1.9, relief: 0.24 },
    // Two shoulders that close the valley off to either side.
    { at: [106, 6], radius: 62, height: 24, falloff: 1.8, relief: 0.4 },
    { at: [4, 54], radius: 54, height: 20, falloff: 1.7, relief: 0.42 },
  ],
  avalanche: {
    crown: [50, 10],
    bends: [[54, 20], [60, 30]],
    runout: [70, 46],
    widthTop: 9,
    widthBottom: 26,
    scour: 4,
    crownDrop: 6,
    crownSpan: 0.1,
    slabDepth: 5,
    levee: 3,
    bedBlock: "ICE",
    rockChance: 0.2,
    debrisChance: 0.18,
  },
};

// The opening corridor is described once and read twice: `intro_tunnel` stamps
// the block shell, and intro.js hangs the photographs, the signage and the
// observation room on the same coordinates. Both come from this object, so the
// corridor cannot be moved in one place and left behind in the other.
//
// The player walks from `from` down to `to`; the floor sits `lift` blocks over
// the plaza, which is the four-block drop that ends the sequence.
const INTRO = Object.freeze({
  axis: 64,
  halfWidth: 3,
  height: 5,
  lift: 3,
  from: 125,
  to: 84,
  windowZ: 120,
  chamberHalfWidth: 4,
  // The corridor changes material five times on the way out. Each entry is the
  // band's *lowest* z, listed rather than derived so the last three can line up
  // with the aircraft parked at the end of it: the collar is the tail section
  // the corridor docks into, the hold is the cargo bay, the ramp is the open
  // nose door. Move the aircraft and these three move with it.
  bands: Object.freeze({
    clinic: 111,
    service: 107,
    rock: 104,
    collar: 100,
    hold: 87,
    ramp: 84,
  }),
  // One photograph per chapter. Five of them, spaced evenly enough that a
  // walking player meets one about every five seconds.
  chapterZ: Object.freeze([108, 102, 97, 92, 87]),
  // Where each chapter's wall text hangs, three blocks before its picture.
  // Listed rather than derived because the open nose ramp at the end has no
  // walls, and a panel placed by formula would float over it.
  panelZ: Object.freeze([111, 105, 100, 95, 90]),
  arrowZ: 112,
  // Crossing this line is what ends the intro: sprint is released, the level
  // banner appears, and the sequence stops listening.
  exitZ: 83.4,
});

// The aircraft the last third of the corridor runs through. Its hold *is* the
// corridor, so the two share an axis and the hull is stamped first and carved
// through second. Nose ramp at the low-z end, facing the training site; the
// tail is buried in the hillside the corridor comes out of, which is why the
// player never sees a back end that would have to be modelled.
const INTRO_VTOL = Object.freeze({
  axis: 64,
  ramp: 84,
  tail: 103,
  halfWidth: 7,
  // Height of the fuselage centre line over the apron, and the semi-axes of the
  // oval section. The hold sits low inside it; the rest is avionics and belly.
  centre: 9,
  radiusY: 6,
  wing: Object.freeze({ from: 90, to: 96, span: 17, y: 12 }),
  fin: Object.freeze({ from: 95, to: 103, height: 9 }),
});

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
    title: "Klinik",
    subtitle: "Einweisung",
    patientCount: 1,
    briefing:
      "Ein einzelner Patient liegt auf dem Klinikvorplatz. Geh hin, drücke E und sprich den Text aus der Karte laut vor.",
    sky: 0x9fd8f2,
    terrain: MEADOW,
    // Extended north to z=104 so the apron the aircraft stands on is levelled
    // and feathered by the same pass that levels the clinic forecourt.
    site: { area: [44, 48, 86, 104], feather: 4 },
    structures: [
      { type: "ground", area: [46, 50, 84, 88], block: "PATH" },
      { type: "ground", area: [56, 52, 72, 68], block: "CONCRETE" },
      { type: "blueprint", id: "clinic", at: [57, 54] },
      { type: "blueprint", id: "helipad", at: [48, 74] },
      { type: "blueprint", id: "ambulance", at: [74, 74] },
      { type: "lamppost", at: [50, 70] },
      { type: "lamppost", at: [80, 70] },
      // Pulled in front of z=84: from there north is apron, and the pave that
      // levels it would take any post standing on it back out again.
      { type: "lamppost", at: [50, 82] },
      { type: "lamppost", at: [80, 82] },
      { type: "tree", at: [44, 62] },
      { type: "tree", at: [88, 62] },
      // Not at z=88 any more: that is inside the box the airframe clears for its
      // wings, and a tree standing there is removed without a trace.
      { type: "tree", at: [44, 78] },
      { type: "tree", at: [88, 88] },
      { type: "pad", area: [62, 76, 66, 78] },
      // The apron, then the airframe, then the corridor that is carved through
      // it. Order matters: `intro_tunnel` hollows its own hold out of the hull.
      { type: "ground", area: [46, 84, 82, 104], block: "CONCRETE" },
      { type: "medical_vtol", ...INTRO_VTOL },
      { type: "intro_tunnel", ...INTRO },
    ],
    // The first thing a player ever sees is the inside of the corridor, four
    // blocks above the plaza. `lift` is the player's feet over the site floor,
    // because the height map still reports the terrain under the gallery.
    spawn: { at: [64.5, 115.5], face: [64.5, 100], lift: 4 },
    // Where a player who falls out of the world is put back. That has to stay
    // the plaza: the corridor is a one-way scene and cannot be re-entered.
    hub: [64.5, 79.5],
    intro: INTRO,
    anchors: [
      { id: "A", spots: [[64, 72], [58, 71], [71, 72], [64, 80]] },
    ],
  },

  {
    id: "street_collapse",
    title: "Hauptstrasse",
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
    title: "Crash B27",
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
    title: "Nordhafen",
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
    title: "Bergstation",
    subtitle: "Verschüttete im Lawinenkegel",
    patientCount: 6,
    briefing:
      "Ein Schneebrett ist über der Bergstation abgegangen und hat Station, Gondelbahn und Piste unter sich begraben. Sechs Verletzte — zwei liegen verschüttet oder im Inneren und sind von weitem nicht zu sehen.",
    sky: 0xd6e8f5,
    fog: 0.0065,
    terrain: ALPINE,
    snowfall: { count: 1100, spread: 52, fall: 2.6, wind: 1.8 },
    site: { area: [40, 36, 108, 100], feather: 9 },
    structures: [
      { type: "ground", area: [42, 38, 106, 98], block: "SNOW" },
      // The groomed piste the flow crossed, still readable at the edges.
      { type: "ground", area: [46, 76, 100, 84], block: "ICE" },

      // The deposit: one broad tongue down the fall line, a second lobe that
      // split off around the station, and the levees the flow shouldered aside.
      { type: "debris_flow", from: [64, 38], to: [84, 76], widthFrom: 26, widthTo: 38, height: 7, rough: 1.0, iceChance: 0.26, front: false, taper: 0.3 },
      { type: "debris_flow", from: [58, 44], to: [50, 74], widthFrom: 14, widthTo: 22, height: 5, rough: 1.0, iceChance: 0.2, front: false, taper: 0.35 },
      { type: "mound", at: [46, 62], radius: 9, height: 4, block: "SNOW" },
      { type: "mound", at: [98, 60], radius: 8, height: 4, block: "SNOW" },
      { type: "mound", at: [88, 76], radius: 7, height: 5, block: "SNOW" },

      // Everything the flow hit. The station is stamped after the deposit, so
      // the snow packs around it and its inside is clear again.
      { type: "blueprint", id: "lift_station", at: [60, 46] },
      { type: "blueprint", id: "lift_pylon", at: [80, 50] },
      { type: "blueprint", id: "lift_pylon", at: [96, 54] },
      { type: "blueprint", id: "gondola_cabin", at: [78, 62], lift: 1 },
      { type: "blueprint", id: "gondola_cabin", at: [88, 70], rotation: 1 },
      { type: "fire", at: [70, 58], height: 2, spread: [[1, 0]] },

      // Trees the slab snapped off and carried into the runout.
      { type: "log", at: [62, 66], dir: [1, 1], length: 6, stump: 2 },
      { type: "log", at: [74, 70], dir: [1, 0], length: 7, lift: 1 },
      { type: "log", at: [80, 58], dir: [0, 1], length: 5, stump: 1 },
      { type: "log", at: [54, 68], dir: [1, 1], length: 5 },

      // Torn-out slab blocks lying on the surface of the deposit.
      { type: "scatter", area: [56, 42, 94, 76], block: "ICE", count: 90, maxHeight: 1 },
      { type: "scatter", area: [58, 44, 92, 74], block: "GRAVEL", count: 45, maxHeight: 1 },
      { type: "scatter", area: [50, 40, 100, 80], block: "SNOW", count: 110, maxHeight: 1 },

      // The tunnel the first crew dug down to the station door, and the steps
      // out of it: the casualty inside can be reached without mining the whole
      // deposit away, and the dig is a way in rather than a pit.
      { type: "ramp", from: [66, 69], to: [66, 58], width: 3, headroom: 3 },
      { type: "carve", area: [64, 57, 68, 58], from: 0, to: 2 },

      // The air pocket under the deposit, and the way in that the dig opened.
      {
        type: "shelter",
        at: [62, 72],
        radius: 7,
        height: 6,
        block: "SNOW",
        mouth: [-1, 0],
        clearance: 3,
        light: true,
      },
      { type: "carve", area: [54, 71, 62, 73], from: 0, to: 2 },

      // The search line the party worked before the medics arrived.
      { type: "probes", from: [70, 78], to: [90, 74], step: 3, height: 2 },
      { type: "probes", from: [56, 60], to: [56, 74], step: 4, height: 2 },

      // Powder still hanging over the front of the deposit.
      { type: "dust", at: [78, 70], count: 22, spread: 17, radius: 2.6, height: 4, lift: 1, opacity: 0.14 },
      { type: "dust", at: [64, 44], count: 18, spread: 15, radius: 2.4, height: 5, lift: 2, opacity: 0.13 },

      // Staging sits along the western half of the apron, so the player lands
      // on open ground with the deposit and the face above it in full view.
      { type: "blueprint", id: "helipad", at: [50, 88] },
      { type: "blueprint", id: "tent_triage", at: [62, 88] },
      { type: "blueprint", id: "canopy_redcross", at: [74, 88] },
      { type: "blueprint", id: "ambulance", at: [84, 90] },
      { type: "cordon", area: [46, 42, 102, 96], step: 3 },
      { type: "lamppost", at: [46, 44], post: "STEEL", height: 4 },
      { type: "lamppost", at: [102, 44], post: "STEEL", height: 4 },
      { type: "lamppost", at: [46, 94], post: "STEEL", height: 4 },
      { type: "lamppost", at: [102, 94], post: "STEEL", height: 4 },
      { type: "tree", at: [44, 86], leaves: "SNOW" },
      { type: "tree", at: [104, 84], leaves: "SNOW" },
      { type: "tree", at: [104, 94], leaves: "SNOW" },
    ],
    spawn: { at: [98.5, 92.5], face: [58, 30] },
    anchors: [
      { id: "A", spots: [[68, 66], [64, 64], [72, 62], [70, 70]] },
      { id: "B", spots: [[84, 68], [80, 72], [88, 66], [82, 76]] },
      { id: "C", spots: [[52, 60], [48, 66], [54, 56], [50, 70]] },
      { id: "D", spots: [[92, 82], [88, 80], [96, 84], [90, 78]] },
      { id: "F", hidden: true, spots: [[63, 50], [68, 52], [65, 54], [70, 48]] },
      { id: "G", hidden: true, spots: [[62, 72], [61, 72], [60, 72], [59, 72]] },
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
