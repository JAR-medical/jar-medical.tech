// Blueprint library. Maps are declared, not hand-placed: every level lists
// structures by id and the world stamps them, so a new scene is a data edit.
//
// A blueprint is a Minecraft-schematic-shaped record — size plus one ASCII
// layer per Y level, rows running along Z, characters along X — which is
// exactly what `scripts/make_prefabs.py` emits when it converts a downloaded
// `.schematic` / `.schem` file into this format.

import { IMPORTED_BLUEPRINTS } from "./prefabs_imported.js";

export const CHAR_BLOCKS = Object.freeze({
  " ": null,
  ".": null,
  _: "AIR",
  g: "GRASS",
  d: "DIRT",
  S: "STONE",
  s: "SAND",
  w: "WATER",
  W: "WOOD",
  E: "LEAVES",
  p: "PATH",
  X: "REDCROSS",
  L: "LAMP",
  B: "EMERGENCY_BLANKET",
  M: "METAL",
  R: "RUBBLE",
  A: "ASPHALT",
  C: "CONCRETE",
  "#": "BRICK",
  G: "GLASS",
  F: "FIRE",
  Y: "CAUTION",
  N: "SNOW",
  I: "ICE",
  P: "PLANKS",
  O: "ROOF",
  V: "GRAVEL",
  T: "STEEL",
  Z: "TENT",
  J: "RAIL",
  Q: "MOSS",
  H: "SANDSTONE",
  K: "DARKSTONE",
  U: "NEON",
});

function blueprint(size, layers) {
  return Object.freeze({ size: Object.freeze(size), layers: Object.freeze(layers.map((rows) => Object.freeze(rows))) });
}

const BUILT_IN_BLUEPRINTS = {
  car: blueprint([5, 3, 3], [
    ["MMMMM", "MMMMM", "MMMMM"],
    [".MGM.", ".M_M.", ".MGM."],
    [".MMM.", ".MMM.", ".MMM."],
  ]),

  car_wreck: blueprint([5, 3, 3], [
    ["MMMMM", "MMRMM", "MMMMM"],
    [".RM..", ".M_R.", "..MR."],
    ["..R..", ".R...", "....."],
  ]),

  van: blueprint([7, 4, 4], [
    ["MMMMMMM", "MMMMMMM", "MMMMMMM", "MMMMMMM"],
    ["CCCCCCC", "C_____C", "C_____C", "CCCCCCC"],
    ["CGCGCGC", "C_____C", "C_____C", "CGCGCGC"],
    ["CCCCCCC", "CCCCCCC", "CCCCCCC", "CCCCCCC"],
  ]),

  ambulance: blueprint([7, 5, 4], [
    ["MMMMMMM", "MMMMMMM", "MMMMMMM", "MMMMMMM"],
    ["CCCCCCC", "C_____C", "C_____C", "CCCCCCC"],
    ["CGCXCGC", "C_____C", "C_____C", "CGCXCGC"],
    ["CCCCCCC", "CCCCCCC", "CCCCCCC", "CCCCCCC"],
    ["L.....L", ".......", ".......", "L.....L"],
  ]),

  fire_engine: blueprint([9, 5, 4], [
    ["MMMMMMMMM", "MMMMMMMMM", "MMMMMMMMM", "MMMMMMMMM"],
    ["XXXXXXXXX", "X_______X", "X_______X", "XXXXXXXXX"],
    ["XGXXXXXGX", "X_______X", "X_______X", "XGXXXXXGX"],
    ["XXXXXXXXX", "XXXXXXXXX", "XXXXXXXXX", "XXXXXXXXX"],
    ["L.......L", ".........", ".........", "L.......L"],
  ]),

  // A helicopter, nose at the low-z end. Nine wide so it fits the helipad
  // blueprint, eleven long so the tail boom has somewhere to go, and the rotor
  // is a symmetric four-arm cross that reads from the ground and from above.
  //
  // Every livery is this one blueprint with a `palette` override: `C` is the
  // airframe, `T` the rotor and skids, `X` the marking on the cabin door — set
  // `X` to the body colour and the red cross disappears, which is the whole
  // difference between the medical ones and the military ones.
  helicopter: blueprint([9, 6, 11], [
    [".........", ".........", "..T...T..", "..T...T..", "..T...T..", "..T...T..", "..T...T..", "..T...T..", ".........", ".........", "........."],
    [".........", "...CCC...", "..CCCCC..", "..CCCCC..", "..CCCCC..", "..CCCCC..", "..CCCCC..", "...CCC...", ".........", ".........", "........."],
    [".........", "...GGG...", "..GGGGG..", "..GCCCG..", "..XCCCX..", "..CCCCC..", "..CCCCC..", "....C....", "....C....", "....C....", "....C...."],
    [".........", ".........", "...CCC...", "..CCCCC..", "..CCCCC..", "..CCCCC..", "...CCC...", "....C....", "....C....", "...CCC...", "....C...."],
    [".........", ".........", ".........", ".........", "....T....", ".........", ".........", ".........", ".........", ".........", "...TCT..."],
    ["....T....", "....T....", "....T....", "....T....", "TTTTTTTTT", "....T....", "....T....", "....T....", "....T....", ".........", "....C...."],
  ]),

  bus: blueprint([11, 4, 4], [
    ["MMMMMMMMMMM", "MMMMMMMMMMM", "MMMMMMMMMMM", "MMMMMMMMMMM"],
    ["YYYYYYYYYYY", "Y_________Y", "Y_________Y", "YYYYYYYYYYY"],
    ["YGYGYGYGYGY", "Y_________Y", "Y_________Y", "YGYGYGYGYGY"],
    ["YYYYYYYYYYY", "YYYYYYYYYYY", "YYYYYYYYYYY", "YYYYYYYYYYY"],
  ]),

  truck_trailer: blueprint([13, 5, 4], [
    ["MMMMMMMMMMMMM", "MMMMMMMMMMMMM", "MMMMMMMMMMMMM", "MMMMMMMMMMMMM"],
    ["TTTTTTTTTTTTT", "T___________T", "T___________T", "TTTTTTTTTTTTT"],
    ["TGTTTTTTTTTTT", "T___________T", "T___________T", "TGTTTTTTTTTTT"],
    ["TTTTTTTTTTTTT", "TTTTTTTTTTTTT", "TTTTTTTTTTTTT", "TTTTTTTTTTTTT"],
    ["....YYYYYYYYY", ".............", ".............", "....YYYYYYYYY"],
  ]),

  container: blueprint([7, 4, 4], [
    ["MMMMMMM", "MMMMMMM", "MMMMMMM", "MMMMMMM"],
    ["M_____M", "M_____M", "M_____M", "MMMMMMM"],
    ["M_____M", "M_____M", "M_____M", "MMMMMMM"],
    ["MMMMMMM", "MMMMMMM", "MMMMMMM", "MMMMMMM"],
  ]),

  guardrail: blueprint([8, 2, 1], [
    ["T.T.T.T."],
    ["TTTTTTTT"],
  ]),

  canopy_redcross: blueprint([7, 5, 5], [
    ["W.....W", ".BBBBB.", ".BBBBB.", ".BBBBB.", "W.....W"],
    ["W.....W", ".......", ".......", ".......", "W.....W"],
    ["W.....W", ".......", ".......", ".......", "W.....W"],
    ["W.....W", ".......", ".......", ".......", "W.....W"],
    ["XXXXXXX", "XXXXXXX", "XXXXXXX", "XXXXXXX", "XXXXXXX"],
  ]),

  tent_triage: blueprint([7, 4, 7], [
    ["ZZZZZZZ", "Z_____Z", "Z_____Z", "Z_____Z", "Z_____Z", "Z_____Z", "ZZZ_ZZZ"],
    ["ZZZZZZZ", "Z_____Z", "Z_____Z", "Z_____Z", "Z_____Z", "Z_____Z", "ZZZ_ZZZ"],
    ["ZZZZZZZ", "Z_____Z", "Z_____Z", "Z__L__Z", "Z_____Z", "Z_____Z", "ZZZZZZZ"],
    [".ZZZZZ.", ".ZZZZZ.", ".ZZZZZ.", ".ZZZZZ.", ".ZZZZZ.", ".ZZZZZ.", ".ZZZZZ."],
  ]),

  house: blueprint([9, 8, 9], [
    ["#########", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "####_####"],
    ["#########", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "#_______#", "####_####"],
    ["##G###G##", "#_______#", "G_______G", "#_______#", "#_______#", "#_______#", "G_______G", "#_______#", "##G###G##"],
    ["#########", "#_______#", "#_______#", "#_______#", "#___L___#", "#_______#", "#_______#", "#_______#", "#########"],
    ["PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP", "PPPPPPPPP"],
    [".OOOOOOO.", ".OOOOOOO.", ".OOOOOOO.", ".OOOOOOO.", ".OOOOOOO.", ".OOOOOOO.", ".OOOOOOO.", ".OOOOOOO.", ".OOOOOOO."],
    ["..OOOOO..", "..OOOOO..", "..OOOOO..", "..OOOOO..", "..OOOOO..", "..OOOOO..", "..OOOOO..", "..OOOOO..", "..OOOOO.."],
    ["...OOO...", "...OOO...", "...OOO...", "...OOO...", "...OOO...", "...OOO...", "...OOO...", "...OOO...", "...OOO..."],
  ]),

  shop: blueprint([11, 6, 7], [
    ["###########", "#_________#", "#_________#", "#_________#", "#_________#", "#_________#", "####___####"],
    ["###########", "#_________#", "#_________#", "#_________#", "#_________#", "#_________#", "####___####"],
    ["##GG#GG####", "#_________#", "#_________#", "#____L____#", "#_________#", "#_________#", "###GGGGG###"],
    ["###########", "#_________#", "#_________#", "#_________#", "#_________#", "#_________#", "###########"],
    ["CCCCCCCCCCC", "CCCCCCCCCCC", "CCCCCCCCCCC", "CCCCCCCCCCC", "CCCCCCCCCCC", "CCCCCCCCCCC", "CCCCCCCCCCC"],
    ["Y.........Y", "...........", "...........", "...........", "...........", "...........", "Y.........Y"],
  ]),

  gondola_cabin: blueprint([5, 5, 5], [
    ["TTTTT", "T___T", "T___T", "T___T", "TTTTT"],
    ["TGGGT", "G___G", "G___G", "G___G", "TGG_T"],
    ["TGGGT", "G___G", "G___G", "G___G", "TGG_T"],
    ["TTTTT", "TTTTT", "TTTTT", "TTTTT", "TTTTT"],
    ["..T..", ".....", ".....", ".....", "..T.."],
  ]),

  lift_pylon: blueprint([3, 12, 3], [
    ["TTT", "T_T", "TTT"],
    ["T.T", "...", "T.T"],
    ["T.T", "...", "T.T"],
    ["T.T", "...", "T.T"],
    ["TTT", "...", "TTT"],
    ["T.T", "...", "T.T"],
    ["T.T", "...", "T.T"],
    ["T.T", "...", "T.T"],
    ["TTT", "...", "TTT"],
    ["T.T", "...", "T.T"],
    ["T.T", "...", "T.T"],
    ["TTT", "TTT", "TTT"],
  ]),

  lift_station: blueprint([13, 8, 11], [
    ["TTTTTTTTTTTTT", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "TTTTT___TTTTT"],
    ["TTTTTTTTTTTTT", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "TTTTT___TTTTT"],
    ["TGGTTTTTTGGT.", "T___________T", "G___________G", "G___________G", "T_____L_____T", "G___________G", "G___________G", "T___________T", "G___________G", "T___________T", "TTTGGGGGGGTTT"],
    ["TTTTTTTTTTTTT", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "T___________T", "TTTTTTTTTTTTT"],
    ["CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC", "CCCCCCCCCCCCC"],
    [".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN.", ".NNNNNNNNNNN."],
    ["..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN..", "..NNNNNNNNN.."],
    ["L...........L", ".............", ".............", ".............", ".............", ".............", ".............", ".............", ".............", ".............", "L...........L"],
  ]),

  clinic: blueprint([15, 7, 13], [
    ["CCCCCCCCCCCCCCC", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "CCCCCC___CCCCCC"],
    ["CCCCCCCCCCCCCCC", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "C_____________C", "CCCCCC___CCCCCC"],
    ["CCGGCCXCCGGCCCC", "C_____________C", "G_____________G", "G_____________G", "C_____________C", "G______L______G", "G_____________G", "C_____________C", "G_____________G", "G_____________G", "C_____________C", "C_____________C", "CCGGGCXXXCGGGCC"],
    ["CCCCCCCCCCCCCCC", "C_____________C", "G_____________G", "C_____________C", "G_____________G", "C_____________C", "G_____________G", "C_____________C", "G_____________G", "C_____________C", "G_____________G", "C_____________C", "CCGGGCCCCCGGGCC"],
    ["CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC", "CCCCCCCCCCCCCCC"],
    ["L.............L", "...............", "......XXX......", "......X.X......", "......XXX......", "...............", "...............", "...............", "...............", "...............", "...............", "...............", "L.............L"],
    ["...............", "...............", ".......X.......", "......XXX......", ".......X.......", "...............", "...............", "...............", "...............", "...............", "...............", "...............", "..............."],
  ]),

  helipad: blueprint([9, 1, 9], [
    ["CCCCCCCCC", "CYYYYYYYC", "CY.....YC", "CY.XXX.YC", "CY.X.X.YC", "CY.XXX.YC", "CY.....YC", "CYYYYYYYC", "CCCCCCCCC"],
  ]),
};

// Anything `scripts/make_prefabs.py` converted from a downloaded Minecraft
// schematic joins the library under its file name and can be placed by a level
// exactly like a built-in structure.
export const BLUEPRINTS = Object.freeze({ ...BUILT_IN_BLUEPRINTS, ...IMPORTED_BLUEPRINTS });

function rotatePoint(x, z, sizeX, sizeZ, rotation) {
  switch (rotation) {
    case 1:
      return [sizeZ - 1 - z, x];
    case 2:
      return [sizeX - 1 - x, sizeZ - 1 - z];
    case 3:
      return [z, sizeX - 1 - x];
    default:
      return [x, z];
  }
}

export function blueprintFootprint(id, rotation = 0) {
  const bp = BLUEPRINTS[id];
  if (!bp) return null;
  const [sx, sy, sz] = bp.size;
  const turn = ((rotation % 4) + 4) % 4;
  return turn % 2 === 1 ? { x: sz, y: sy, z: sx } : { x: sx, y: sy, z: sz };
}

// `api` is the small facade the World hands to the blueprint layer:
// { put(x,y,z,blockName), pave(x0,z0,x1,z1,blockName), surfaceY, rng }.
export function stampBlueprint(api, id, ox, oy, oz, options = {}) {
  const bp = BLUEPRINTS[id];
  if (!bp) return false;
  const rotation = (((options.rotation || 0) % 4) + 4) % 4;
  const [sx, , sz] = bp.size;
  const overrides = options.palette || {};
  for (let y = 0; y < bp.layers.length; y++) {
    const rows = bp.layers[y];
    for (let z = 0; z < rows.length; z++) {
      const row = rows[z];
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        const name = overrides[char] !== undefined ? overrides[char] : CHAR_BLOCKS[char];
        if (name === null || name === undefined) continue;
        const [rx, rz] = rotatePoint(x, z, sx, sz, rotation);
        api.put(ox + rx, oy + y, oz + rz, name);
      }
    }
  }
  return true;
}

export const STRUCTURE_BUILDERS = {
  blueprint(api, entry) {
    stampBlueprint(api, entry.id, entry.at[0], api.surfaceY + (entry.lift || 0), entry.at[1], entry);
  },

  ground(api, entry) {
    const [x0, z0, x1, z1] = entry.area;
    api.pave(x0, z0, x1, z1, entry.block || "GRASS");
  },

  road(api, entry) {
    const [x0, z0, x1, z1] = entry.area;
    api.pave(x0, z0, x1, z1, entry.block || "ASPHALT");
    if (!entry.markings) return;
    const alongX = x1 - x0 >= z1 - z0;
    const mid = alongX ? Math.floor((z0 + z1) / 2) : Math.floor((x0 + x1) / 2);
    const from = alongX ? x0 : z0;
    const to = alongX ? x1 : z1;
    for (let v = from; v <= to; v++) {
      if (v % 4 >= 2) continue;
      if (alongX) api.pave(v, mid, v, mid, "CONCRETE");
      else api.pave(mid, v, mid, v, "CONCRETE");
    }
  },

  hall(api, entry) {
    const [x0, z0] = entry.at;
    const x1 = x0 + entry.width - 1;
    const z1 = z0 + entry.depth - 1;
    const h = entry.height || 6;
    const wall = entry.wall || "CONCRETE";
    const roof = entry.roof || "METAL";
    for (let y = 0; y < h; y++) {
      for (let x = x0; x <= x1; x++) {
        api.put(x, api.surfaceY + y, z0, wall);
        api.put(x, api.surfaceY + y, z1, wall);
      }
      for (let z = z0; z <= z1; z++) {
        api.put(x0, api.surfaceY + y, z, wall);
        api.put(x1, api.surfaceY + y, z, wall);
      }
    }
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) api.put(x, api.surfaceY + h, z, roof);
    }
    for (const [wx, wz] of entry.windows || []) {
      api.put(wx, api.surfaceY + (entry.windowY || 2), wz, "GLASS");
    }
    for (const [dx, dz] of entry.doors || []) {
      for (let y = 0; y < (entry.doorHeight || 3); y++) {
        for (let w = 0; w < (entry.doorWidth || 1); w++) {
          api.put(dx + w, api.surfaceY + y, dz, "AIR");
        }
      }
    }
    if (entry.light) api.put(x0 + Math.floor(entry.width / 2), api.surfaceY + h - 1, z0 + Math.floor(entry.depth / 2), "LAMP");
  },

  mound(api, entry) {
    const [cx, cz] = entry.at;
    const radius = entry.radius || 5;
    const peak = entry.height || 4;
    const block = entry.block || "RUBBLE";
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.hypot(dx, dz);
        if (dist > radius) continue;
        const h = Math.round(peak * (1 - dist / radius) + api.rng() * 0.9 - 0.4);
        for (let y = 0; y < h; y++) api.put(cx + dx, api.surfaceY + y, cz + dz, block);
      }
    }
  },

  // A mound with a walk-in cavity: the hollow is where a hidden casualty lies.
  shelter(api, entry) {
    const [cx, cz] = entry.at;
    const radius = entry.radius || 6;
    STRUCTURE_BUILDERS.mound(api, { ...entry, radius, height: entry.height || 5, block: entry.block || "SNOW" });
    const [mx, mz] = entry.mouth || [0, 1];
    const dirX = Math.sign(mx);
    const dirZ = Math.sign(mz);
    const clearance = entry.clearance || 3;
    for (let step = 0; step <= radius; step++) {
      const x = cx + dirX * (radius - step);
      const z = cz + dirZ * (radius - step);
      for (let y = 0; y < clearance; y++) {
        api.put(x, api.surfaceY + y, z, "AIR");
        api.put(x + (dirZ ? 1 : 0), api.surfaceY + y, z + (dirX ? 1 : 0), "AIR");
        api.put(x - (dirZ ? 1 : 0), api.surfaceY + y, z - (dirX ? 1 : 0), "AIR");
      }
    }
    if (entry.light) api.put(cx, api.surfaceY + clearance - 1, cz, "LAMP");
  },

  // The deposit an avalanche leaves once it runs out of slope: lobes of packed
  // snow and torn-out ice piled along the flow line, deepest in the middle,
  // thinning to nothing at the edges, and highest at the blunt front where the
  // flow finally stopped. `from`/`to` are the flow line; everything else is how
  // far it spread and how rough it came to rest.
  debris_flow(api, entry) {
    const [x0, z0] = entry.from;
    const [x1, z1] = entry.to;
    const length = Math.hypot(x1 - x0, z1 - z0);
    if (length <= 0) return;
    const dirX = (x1 - x0) / length;
    const dirZ = (z1 - z0) / length;
    const perpX = -dirZ;
    const perpZ = dirX;
    const widthFrom = entry.widthFrom ?? 12;
    const widthTo = entry.widthTo ?? 22;
    const peak = entry.height ?? 4;
    const rough = entry.rough ?? 1.2;
    const iceChance = entry.iceChance ?? 0.22;
    // Flowing snow scrapes up whatever it crosses, so the deposit is dirty in
    // patches. It also stops the tongue reading as more of the same snowfield.
    const dirtChance = entry.dirtChance ?? 0.12;
    const block = entry.block || "SNOW";
    const iceBlock = entry.iceBlock || "ICE";
    const dirtBlock = entry.dirtBlock || "GRAVEL";
    const steps = Math.max(1, Math.round(length * 2));

    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const cx = x0 + dirX * length * u;
      const cz = z0 + dirZ * length * u;
      const half = (widthFrom + (widthTo - widthFrom) * u) / 2;
      // Thin where the flow was still moving fast, piled up at the front —
      // unless the level asks for a runout margin instead, which tapers away
      // to nothing so the deposit stays walkable from the downhill side.
      const along =
        entry.front === false
          ? (1 - u * 0.4) * Math.min(1, (1 - u) / (entry.taper ?? 0.28))
          : 0.55 + Math.pow(u, 1.6) * 0.9;
      for (let d = -Math.ceil(half); d <= Math.ceil(half); d++) {
        const x = Math.round(cx + perpX * d);
        const z = Math.round(cz + perpZ * d);
        const across = 1 - Math.pow(Math.abs(d) / half, 2);
        if (across <= 0) continue;
        const h = Math.round(peak * across * along + api.rng() * rough - rough / 2);
        for (let y = 0; y < h; y++) {
          if (y < h - 1) {
            api.put(x, api.surfaceY + y, z, block);
            continue;
          }
          const roll = api.rng();
          api.put(x, api.surfaceY + y, z, roll < iceChance ? iceBlock : roll < iceChance + dirtChance ? dirtBlock : block);
        }
      }
    }
  },

  // A tree the flow snapped off and carried: the trunk lies pointing the way
  // the snow went, with the splintered stump left standing behind it.
  log(api, entry) {
    const [x, z] = entry.at;
    const [dx, dz] = entry.dir || [1, 0];
    const length = entry.length || 5;
    const lift = entry.lift || 0;
    for (let i = 0; i < length; i++) {
      api.put(Math.round(x + dx * i), api.surfaceY + lift, Math.round(z + dz * i), entry.block || "WOOD");
    }
    for (let y = 0; y < (entry.stump || 0); y++) {
      api.put(Math.round(x - dx), api.surfaceY + y, Math.round(z - dz), entry.block || "WOOD");
    }
  },

  // The probe line a search party leaves behind, one pole per step.
  probes(api, entry) {
    const [x0, z0] = entry.from;
    const [x1, z1] = entry.to;
    const length = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0)));
    const step = entry.step || 3;
    const height = entry.height || 2;
    for (let i = 0; i <= length; i += step) {
      const t = i / length;
      const x = Math.round(x0 + (x1 - x0) * t);
      const z = Math.round(z0 + (z1 - z0) * t);
      const lift = api.surfaceY + (entry.lift || 0);
      for (let y = 0; y < height; y++) api.put(x, lift + y, z, entry.post || "STEEL");
      if (entry.flag !== false) api.put(x, lift + height, z, entry.tip || "CAUTION");
    }
  },

  // A dug ramp out of a trench: a lane of one-block steps with the headroom
  // above it cleared, so anything sunk below the surface can be walked back
  // out of instead of becoming a pit.
  ramp(api, entry) {
    const [x0, z0] = entry.from;
    const [x1, z1] = entry.to;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));
    if (steps === 0) return;
    const width = entry.width ?? 3;
    const spread = Math.floor((width - 1) / 2);
    // Left unset, the high end meets whatever the structures before it piled
    // up here, so the ramp joins the surface instead of ending a step short.
    const fromY = entry.fromY ?? api.topAt?.(x0, z0) ?? 0;
    const toY = entry.toY ?? 0;
    const headroom = entry.headroom ?? 3;
    const block = entry.block || "SNOW";
    const perpX = dz === 0 ? 0 : 1;
    const perpZ = dz === 0 ? 1 : 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = Math.round(fromY + (toY - fromY) * t);
      const cx = Math.round(x0 + dx * t);
      const cz = Math.round(z0 + dz * t);
      for (let w = -spread; w <= spread; w++) {
        const x = cx + perpX * w;
        const z = cz + perpZ * w;
        for (let fy = 0; fy < y; fy++) api.put(x, api.surfaceY + fy, z, block);
        for (let cy = y; cy < y + headroom; cy++) api.put(x, api.surfaceY + cy, z, "AIR");
      }
    }
  },

  // Clears a box back to air. Used to keep a way into a hollow open after
  // later structures have piled snow over the top of it.
  carve(api, entry) {
    const [x0, z0, x1, z1] = entry.area;
    const from = entry.from ?? 0;
    const to = entry.to ?? 2;
    for (let y = from; y <= to; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) api.put(x, api.surfaceY + y, z, "AIR");
      }
    }
  },

  // Placed by the world as three.js props, not blocks — listed here so an
  // unknown-type warning never fires on a level that uses it.
  dust() {},

  scatter(api, entry) {
    const [x0, z0, x1, z1] = entry.area;
    const block = entry.block || "RUBBLE";
    for (let i = 0; i < (entry.count || 20); i++) {
      const x = x0 + Math.floor(api.rng() * (x1 - x0 + 1));
      const z = z0 + Math.floor(api.rng() * (z1 - z0 + 1));
      const h = 1 + Math.floor(api.rng() * (entry.maxHeight || 2));
      for (let y = 0; y < h; y++) api.put(x, api.surfaceY + y, z, block);
    }
  },

  cordon(api, entry) {
    const [x0, z0, x1, z1] = entry.area;
    const step = entry.step || 1;
    for (let x = x0; x <= x1; x += step) {
      api.put(x, api.surfaceY, z0, "CAUTION");
      api.put(x, api.surfaceY, z1, "CAUTION");
    }
    for (let z = z0; z <= z1; z += step) {
      api.put(x0, api.surfaceY, z, "CAUTION");
      api.put(x1, api.surfaceY, z, "CAUTION");
    }
  },

  lamppost(api, entry) {
    const [x, z] = entry.at;
    const h = entry.height || 3;
    for (let y = 0; y < h; y++) api.put(x, api.surfaceY + y, z, entry.post || "WOOD");
    api.put(x, api.surfaceY + h, z, "LAMP");
  },

  tree(api, entry) {
    const [x, z] = entry.at;
    const trunk = entry.height || 3;
    const crown = entry.leaves || "LEAVES";
    for (let y = 0; y < trunk; y++) api.put(x, api.surfaceY + y, z, "WOOD");
    for (let dy = 0; dy <= 1; dy++) {
      const spread = dy === 0 ? 2 : 1;
      for (let dz = -spread; dz <= spread; dz++) {
        for (let dx = -spread; dx <= spread; dx++) {
          if (Math.abs(dx) === spread && Math.abs(dz) === spread) continue;
          api.put(x + dx, api.surfaceY + trunk + dy, z + dz, crown);
        }
      }
    }
    api.put(x, api.surfaceY + trunk + 2, z, crown);
  },

  fire(api, entry) {
    const [x, z] = entry.at;
    const lift = entry.lift || 0;
    for (let y = 0; y < (entry.height || 2); y++) api.put(x, api.surfaceY + lift + y, z, "FIRE");
    for (const [ox, oz] of entry.spread || []) api.put(x + ox, api.surfaceY + lift, z + oz, "FIRE");
  },

  pad(api, entry) {
    const [x0, z0, x1, z1] = entry.area;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) api.put(x, api.surfaceY, z, entry.block || "EMERGENCY_BLANKET");
    }
  },

  rail(api, entry) {
    const [x0, z0, x1, z1] = entry.area;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) api.put(x, api.surfaceY, z, "RAIL");
    }
  },


  // The aircraft the end of the intro corridor runs through.
  //
  // It exists for one moment: the player drops off the nose door, turns round,
  // and instead of a hole in a bank they are looking up at a medevac VTOL the
  // size of the clinic. So it is built the way that moment reads — a fat oval
  // fuselage, a shoulder wing carrying four lift-fan ducts, a fin, red crosses
  // on the flanks — and nothing is modelled that the player cannot see. The
  // tail sits in the hillside the corridor comes out of, so there is no back.
  //
  // Stamped *before* `intro_tunnel`, which hollows the cargo hold out of it.
  // The frontmost ring is deliberately left uncapped: that opening is the door.
  medical_vtol(api, entry) {
    const axis = entry.axis ?? 64;
    const zRamp = entry.ramp ?? 84;
    const zTail = entry.tail ?? 103;
    const halfWidth = entry.halfWidth ?? 7;
    const cy = api.surfaceY + (entry.centre ?? 7);
    const radiusY = entry.radiusY ?? 6;
    const wing = entry.wing || {};
    const fin = entry.fin || {};
    const wingY = api.surfaceY + (wing.y ?? 10);
    const span = wing.span ?? 17;

    // Terrain is levelled under the apron but not above it, so anything that
    // would grow through a wing or the fin is cleared first.
    for (let z = zRamp; z <= zTail + 2; z++) {
      for (let x = axis - span - 3; x <= axis + span + 3; x++) {
        for (let y = api.surfaceY; y <= cy + radiusY + (fin.height ?? 9) + 2; y++) {
          api.put(x, y, z, "AIR");
        }
      }
    }

    // Fuselage: an oval section per slice, drawn as a one-block shell so the
    // hold can be carved out of the inside without leaving a solid block.
    const halfAt = (z) => {
      const fromNose = z - zRamp;
      let scale = 1;
      if (fromNose < 4) scale = 0.84 + fromNose * 0.04;
      if (z > zTail - 5) scale = Math.max(0.42, 1 - (z - (zTail - 5)) * 0.12);
      return Math.max(3, Math.round(halfWidth * scale));
    };
    const inOval = (dx, dy, a) => (dx / a) ** 2 + (dy / radiusY) ** 2 <= 1;
    const crossZ = Math.round(((wing.from ?? 90) + (wing.to ?? 96)) / 2);

    for (let z = zRamp; z <= zTail; z++) {
      const a = halfAt(z);
      for (let dy = -radiusY; dy <= radiusY; dy++) {
        for (let dx = -a; dx <= a; dx++) {
          if (!inOval(dx, dy, a)) continue;
          const skin =
            !inOval(dx - 1, dy, a) || !inOval(dx + 1, dy, a) ||
            !inOval(dx, dy - 1, a) || !inOval(dx, dy + 1, a);
          if (!skin) continue;
          const flank = Math.abs(dx) >= a - 1;
          let block = dy < -1 ? "STEEL" : "CONCRETE";
          // A red cross on each flank, big enough to read from the apron, plus
          // the cheatline that runs the length of the hull.
          if (flank && dy === 1) block = "REDCROSS";
          if (flank && ((Math.abs(z - crossZ) <= 3 && dy === -1) || (z === crossZ && dy >= -3 && dy <= 3))) {
            block = "REDCROSS";
          }
          if (flank && dy === 4 && z % 2 === 0) block = "GLASS";
          // Flight deck: glazed over the top of the nose, on the skin itself.
          // Anything hung inside the hull at this height is carved away again
          // when `intro_tunnel` hollows the hold out of it.
          if (z <= zRamp + 4 && dy >= 2) block = "GLASS";
          api.put(axis + dx, cy + dy, z, block);
        }
      }
    }

    // The door frame in hazard stripes, so the opening reads as a way out
    // rather than as damage. Both columns sit outside the hold, which is the
    // only reason they survive the carve that follows.
    for (let y = cy - radiusY; y <= cy + 2; y++) {
      api.put(axis - 5, y, zRamp, "CAUTION");
      api.put(axis + 5, y, zRamp, "CAUTION");
    }
    api.put(axis - 6, cy - 3, zRamp, "LAMP");
    api.put(axis + 6, cy - 3, zRamp, "LAMP");

    // Shoulder wing: a tapered slab per side, with the trailing edge cut back
    // harder than the leading edge so it reads as swept from underneath.
    const reach = Math.max(1, span - halfWidth);
    for (const side of [-1, 1]) {
      for (let out = 0; out <= reach; out++) {
        const t = out / reach;
        const z0 = (wing.from ?? 90) + Math.round(t * 2);
        const z1 = (wing.to ?? 96) - Math.round(t * 3);
        const x = axis + side * (halfWidth + out);
        for (let z = z0; z <= z1; z++) {
          api.put(x, wingY, z, out > reach - 2 ? "CAUTION" : "CONCRETE");
          api.put(x, wingY - 1, z, "STEEL");
        }
      }
      // Two lift-fan ducts per side. A ring three blocks tall is unmistakable
      // as a fan from the ground, where a flat disc would be edge-on.
      for (const out of [4, reach]) {
        const cx = axis + side * (halfWidth + out);
        for (let dz = -3; dz <= 3; dz++) {
          for (let dx = -3; dx <= 3; dx++) {
            const r = Math.hypot(dx, dz);
            if (r > 2.7 || r < 1.9) continue;
            for (let y = wingY - 1; y <= wingY + 1; y++) api.put(cx + dx, y, crossZ + dz, "STEEL");
          }
        }
        api.put(cx, wingY, crossZ, "NEON");
      }
      api.put(axis + side * span, wingY + 1, wing.to ?? 96, "NEON");
    }

    // Fin and tailplane, over the part of the hull the corridor docks into.
    const finTop = cy + radiusY + (fin.height ?? 9);
    for (let z = fin.from ?? 95; z <= (fin.to ?? 103); z++) {
      const lean = (z - (fin.from ?? 95)) / Math.max(1, (fin.to ?? 103) - (fin.from ?? 95));
      const top = Math.round(cy + radiusY + lean * (fin.height ?? 9));
      for (let y = cy + radiusY; y <= top; y++) api.put(axis, y, z, y >= finTop - 1 ? "REDCROSS" : "CONCRETE");
    }
    api.put(axis, finTop, fin.to ?? 103, "NEON");
    for (let x = axis - 6; x <= axis + 6; x++) {
      for (let z = (fin.to ?? 103) - 3; z <= (fin.to ?? 103); z++) api.put(x, cy + radiusY + 1, z, "CONCRETE");
    }

    // Gear on outboard sponsons, so the hull stands off the apron instead of
    // lying on it. They have to be outboard: the hold runs the full width of
    // the belly, and anything under it is overwritten by the deck structure
    // `intro_tunnel` lays down afterwards.
    for (const side of [-1, 1]) {
      for (const gz of [88, 97]) {
        const gx = axis + side * 6;
        for (let y = api.surfaceY + 1; y <= cy - 3; y++) api.put(gx, y, gz, "STEEL");
        api.put(gx, api.surfaceY, gz, "DARKSTONE");
        api.put(gx + side, api.surfaceY, gz, "DARKSTONE");
      }
    }
  },

  // The shell of the campaign's opening corridor. It is one builder rather than
  // a hand-placed scene because every part of it follows from the direction of
  // travel: a raised gallery that starts as a clinic wing behind an observation
  // window, sheds its cladding band by band, and ends as a hole in a grass bank
  // four blocks above the first patient's plaza.
  //
  // The player always walks from `from` (the sealed back wall) towards `to`
  // (the last floor block before the drop), so z falls as the corridor turns
  // from building into landscape. intro.js hangs the photographs and the
  // observation room on the same numbers; both read them from one level entry.
  intro_tunnel(api, entry) {
    const axis = entry.axis ?? 64;
    const half = entry.halfWidth ?? 3;
    const clear = entry.height ?? 5;
    const fy = api.surfaceY + (entry.lift ?? 3);
    const ceilY = fy + clear + 1;
    const zBack = entry.from ?? 125;
    const zMouth = entry.to ?? 89;
    const windowZ = entry.windowZ ?? zBack - 5;
    const chamberHalf = entry.chamberHalfWidth ?? half + 1;
    const span = Math.max(1, zBack - zMouth);
    const plinthTo = Math.max(1, api.surfaceY - 3);

    // Six bands read as one slow handover: sterile wing, service corridor, rock
    // cut through the hillside, the steel collar where the corridor meets the
    // aircraft, the cargo hold itself, and the open nose ramp. Each entry in
    // `bands` is the highest z of that band, so the corridor can be lengthened
    // by editing one table instead of retuning ratios.
    const bands = entry.bands || {};
    const BAND = {
      clinic: { wall: "CONCRETE", alt: "CONCRETE", altChance: 0, floor: "CONCRETE", ceiling: "CONCRETE", support: "CONCRETE", wallTop: clear, glass: { every: 3, from: 3, to: 3 }, line: "REDCROSS" },
      service: { wall: "CONCRETE", alt: "STONE", altChance: 0.34, floor: "PATH", ceiling: "CONCRETE", support: "STONE", wallTop: clear, glass: { every: 4, from: 2, to: 4 }, line: null },
      rock: { wall: "STONE", alt: "DIRT", altChance: 0.42, floor: "PATH", ceiling: "STONE", support: "STONE", wallTop: clear, glass: null, line: "CAUTION" },
      // The seam. Hazard stripes all the way round say "you are leaving the
      // building" without a word of text.
      collar: { wall: "STEEL", alt: "CAUTION", altChance: 0.3, floor: "CAUTION", ceiling: "STEEL", support: "STEEL", wallTop: clear, glass: null, line: null },
      hold: { plinth: 2, wall: "STEEL", alt: "METAL", altChance: 0.35, floor: "METAL", ceiling: "METAL", support: "METAL", wallTop: clear, glass: null, line: "REDCROSS" },
      // Ramp down, roof open: the last three blocks are the only place in the
      // corridor where the player can see straight up into the sky.
      ramp: { plinth: 2, wall: "STEEL", alt: "CAUTION", altChance: 0.25, floor: "METAL", ceiling: null, support: "METAL", wallTop: 2, glass: null, line: "CAUTION" },
    };
    const ORDER = ["clinic", "service", "rock", "collar", "hold", "ramp"];
    // Each entry in `bands` is that band's lowest z, and the list runs from the
    // back of the corridor forwards, so the first match walking down the list is
    // the band this slice belongs to.
    const bandAt = (z) => {
      for (const name of ORDER) {
        const from = bands[name];
        if (from !== undefined && z >= from) return { ...BAND[name], name };
      }
      return { ...BAND.ramp, name: "ramp" };
    };

    // Terrain outside the site is never guaranteed to be below the gallery, so
    // every slice is emptied before it is built. That turns a hill in the way
    // into a genuine tunnel instead of a corridor buried in dirt.
    const hollow = (x0, x1, z, floorY, roofY) => {
      for (let x = x0; x <= x1; x++) {
        for (let y = floorY; y <= roofY; y++) api.put(x, y, z, "AIR");
      }
    };

    // Without a plinth the gallery floats wherever the meadow dips away. Filling
    // down to just under the plaza reads as the embankment it is standing on.
    // Inside the aircraft there is a hull doing that job already, so those bands
    // ask for a shallow deck structure instead of a column to the ground.
    const plinth = (x0, x1, z, floorY, block, depth) => {
      const stopAt = depth ? floorY - depth : plinthTo;
      for (let y = floorY - 1; y >= stopAt; y--) {
        for (let x = x0; x <= x1; x++) api.put(x, y, z, block);
      }
    };

    for (let z = zBack; z >= zMouth; z--) {
      const band = bandAt(z);

      if (z >= windowZ) {
        // Observation room: one step up from the corridor, so the four people
        // behind the glass are looking down at the player rather than across.
        const x0 = axis - chamberHalf - 1;
        const x1 = axis + chamberHalf + 1;
        const floorY = fy + 1;
        hollow(x0, x1, z, floorY, ceilY + 2);
        for (let x = x0; x <= x1; x++) api.put(x, floorY, z, "DARKSTONE");
        plinth(x0, x1, z, floorY, "CONCRETE");

        if (z === zBack) {
          // Back wall, with a bank of screens at head height. Nothing behind it
          // is ever reachable, so it is solid all the way up.
          for (let y = floorY + 1; y <= ceilY; y++) {
            for (let x = x0; x <= x1; x++) api.put(x, y, z, "CONCRETE");
          }
          for (let y = floorY + 2; y <= floorY + 3; y++) {
            for (let x = axis - 3; x <= axis + 3; x++) api.put(x, y, z, x % 2 === 0 ? "NEON" : "DARKSTONE");
          }
          continue;
        }

        for (let y = floorY + 1; y <= ceilY; y++) {
          api.put(x0, y, z, "CONCRETE");
          api.put(x1, y, z, "CONCRETE");
        }
        for (let x = x0; x <= x1; x++) api.put(x, ceilY, z, "CONCRETE");

        if (z === windowZ) {
          // The window itself: a solid wall with one pane at the eye height of
          // someone standing in the corridor a step below.
          for (let y = floorY + 1; y <= ceilY - 1; y++) {
            for (let x = x0; x <= x1; x++) api.put(x, y, z, "CONCRETE");
          }
          // Three courses of glass, leaving the band above it solid: that is
          // where intro.js hangs the plaque, and a pane there would put the
          // lettering across the faces behind it.
          for (let y = fy + 2; y <= fy + 4; y++) {
            for (let x = axis - 3; x <= axis + 3; x++) api.put(x, y, z, "GLASS");
          }
          for (let x = axis - 4; x <= axis + 4; x += 2) api.put(x, ceilY - 1, z, "LAMP");
          continue;
        }

        if ((zBack - z) % 2 === 1) {
          api.put(axis - 2, ceilY - 1, z, "LAMP");
          api.put(axis + 2, ceilY - 1, z, "LAMP");
        }
        continue;
      }

      // Corridor.
      const x0 = axis - half - 1;
      const x1 = axis + half + 1;
      // Always stop one above the ceiling line. A band with no ceiling of its
      // own opens into whatever is above it — inside the aircraft that is the
      // full height of the hull, which is exactly the view the hold wants.
      hollow(x0, x1, z, fy, ceilY + 1);
      for (let x = x0; x <= x1; x++) api.put(x, fy, z, band.floor);
      plinth(x0, x1, z, fy, band.support, band.plinth);

      // A painted guide line down the middle: the hospital red line, hazard tape
      // through the rock cut, a red cross again on the aircraft's deck. It is
      // the same instruction the arrow gives, written into the floor.
      if (band.line === "REDCROSS") api.put(axis, fy, z, "REDCROSS");
      else if (band.line === "CAUTION" && z % 2 === 0) api.put(axis, fy, z, "CAUTION");

      // The lip is left bare so the drop reads as an opening, not a doorway.
      const lip = z <= zMouth + 1;
      if (!lip) {
        for (let y = fy + 1; y <= fy + band.wallTop; y++) {
          // Keep both sides of the beginning corridor solid. The opening reads
          // as a focused passage to the pictures instead of a windowed gallery.
          const left = api.rng() < band.altChance ? band.alt : band.wall;
          const right = api.rng() < band.altChance ? band.alt : band.wall;
          api.put(x0, y, z, left);
          api.put(x1, y, z, right);
        }
      }

      if (band.ceiling && !lip) {
        for (let x = x0; x <= x1; x++) api.put(x, ceilY, z, band.ceiling);
        if (band.name === "clinic" && z % 4 === 0) {
          api.put(axis - 1, ceilY, z, "LAMP");
          api.put(axis + 1, ceilY, z, "LAMP");
        } else if (band.name === "hold" && z % 3 === 0) {
          api.put(axis - 2, ceilY, z, "LAMP");
          api.put(axis + 2, ceilY, z, "LAMP");
        } else if (z % 6 === 0) {
          api.put(axis, ceilY, z, "LAMP");
        }
      }
    }
  },
};

export function buildStructure(api, entry) {
  const builder = STRUCTURE_BUILDERS[entry.type];
  if (!builder) return false;
  builder(api, entry);
  return true;
}

export function validateBlueprints() {
  const problems = [];
  for (const [id, bp] of Object.entries(BLUEPRINTS)) {
    const [sx, sy, sz] = bp.size;
    if (bp.layers.length !== sy) problems.push(`${id}: ${bp.layers.length} layers, size says ${sy}`);
    bp.layers.forEach((rows, y) => {
      if (rows.length !== sz) problems.push(`${id}: layer ${y} has ${rows.length} rows, size says ${sz}`);
      rows.forEach((row, z) => {
        if (row.length !== sx) problems.push(`${id}: layer ${y} row ${z} is ${row.length} wide, size says ${sx}`);
        for (const char of row) {
          if (!(char in CHAR_BLOCKS)) problems.push(`${id}: layer ${y} row ${z} uses unknown char "${char}"`);
        }
      });
    });
  }
  return problems;
}
