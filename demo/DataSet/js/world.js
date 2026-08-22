import * as THREE from "../vendor/three.module.js";
import { emit } from "./events.js";
import { fbm2, hash3, mulberry32 } from "./noise.js";

export const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  WATER: 5,
  WOOD: 6,
  LEAVES: 7,
  PATH: 8,
  REDCROSS: 9,
  LAMP: 10,
  EMERGENCY_BLANKET: 11,
  METAL: 12,
  RUBBLE: 13,
  ASPHALT: 14,
  CONCRETE: 15,
  BRICK: 16,
  GLASS: 17,
  FIRE: 18,
  CAUTION: 19,
};

export const WORLD_SIZE = 128;
export const WORLD_HEIGHT = 40;
const CHUNK = 16;
const CHUNKS = WORLD_SIZE / CHUNK;
const WATER_LEVEL = 11;
const HEIGHT_BLOCKS = new Set([
  BLOCK.GRASS,
  BLOCK.DIRT,
  BLOCK.STONE,
  BLOCK.SAND,
  BLOCK.WATER,
  BLOCK.PATH,
  BLOCK.EMERGENCY_BLANKET,
  BLOCK.METAL,
  BLOCK.RUBBLE,
  BLOCK.ASPHALT,
  BLOCK.CONCRETE,
  BLOCK.BRICK,
  BLOCK.GLASS,
  BLOCK.CAUTION,
]);

const PALETTE = {
  [BLOCK.GRASS]: [0.42, 0.75, 0.19],
  [BLOCK.DIRT]: [0.54, 0.35, 0.2],
  [BLOCK.STONE]: [0.55, 0.55, 0.55],
  [BLOCK.SAND]: [0.87, 0.83, 0.61],
  [BLOCK.WATER]: [0.23, 0.44, 0.83],
  [BLOCK.WOOD]: [0.42, 0.27, 0.14],
  [BLOCK.LEAVES]: [0.24, 0.56, 0.18],
  [BLOCK.PATH]: [0.81, 0.79, 0.66],
  [BLOCK.REDCROSS]: [0.88, 0.23, 0.18],
  [BLOCK.LAMP]: [1.0, 0.91, 0.54],
  [BLOCK.EMERGENCY_BLANKET]: [1.0, 1.0, 1.0],
  [BLOCK.METAL]: [0.20, 0.25, 0.29],
  [BLOCK.RUBBLE]: [0.42, 0.40, 0.36],
  [BLOCK.ASPHALT]: [0.21, 0.22, 0.24],
  [BLOCK.CONCRETE]: [0.76, 0.75, 0.72],
  [BLOCK.BRICK]: [0.63, 0.34, 0.26],
  [BLOCK.GLASS]: [0.55, 0.76, 0.86],
  [BLOCK.FIRE]: [1.0, 0.45, 0.12],
  [BLOCK.CAUTION]: [0.97, 0.79, 0.15],
};

const FACE_SHADE = { py: 1.0, ny: 0.55, px: 0.7, nx: 0.7, pz: 0.8, nz: 0.8 };

const FACES = [
  { dir: "py", normal: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },
  { dir: "ny", normal: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: "px", normal: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: "nx", normal: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { dir: "pz", normal: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { dir: "nz", normal: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

function makeWoolTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#eee9dc";
  ctx.fillRect(0, 0, 64, 64);

  // A small knitted weave keeps the blanket readable as soft wool even at
  // voxel scale, with a muted rescue-red stripe for visual identification.
  ctx.strokeStyle = "rgba(190, 181, 164, 0.45)";
  ctx.lineWidth = 1;
  for (let offset = -64; offset < 128; offset += 8) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 64, 64);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(offset + 64, 0);
    ctx.lineTo(offset, 64);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(190, 52, 42, 0.65)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 32);
  ctx.lineTo(64, 32);
  ctx.stroke();

  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  for (let y = 2; y < 64; y += 8) {
    for (let x = 2; x < 64; x += 8) ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function idx(x, y, z) {
  return (y * WORLD_SIZE + z) * WORLD_SIZE + x;
}

// Minecraft renders ten opaque crack-texture stages directly on the selected
// block. These pixel paths are deliberately cumulative so the damage visibly
// deepens instead of flashing through unrelated shapes.
const BREAK_CRACK_SEGMENTS = [
  [[0.47, 0.98], [0.47, 0.75]],
  [[0.47, 0.75], [0.59, 0.58]],
  [[0.59, 0.58], [0.54, 0.39]],
  [[0.54, 0.39], [0.65, 0.21]],
  [[0.54, 0.39], [0.35, 0.31]],
  [[0.35, 0.31], [0.21, 0.41]],
  [[0.35, 0.31], [0.33, 0.11]],
  [[0.59, 0.58], [0.76, 0.66]],
  [[0.76, 0.66], [0.91, 0.54]],
  [[0.47, 0.75], [0.30, 0.64]],
  [[0.30, 0.64], [0.14, 0.72]],
  [[0.76, 0.66], [0.82, 0.87]],
  [[0.21, 0.41], [0.09, 0.24]],
];
const BREAK_STAGE_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9, 10, BREAK_CRACK_SEGMENTS.length];
const BREAK_FACE_TRANSFORMS = [
  { position: [0, 0, 0.504], rotation: [0, 0, 0] },
  { position: [0, 0, -0.504], rotation: [0, Math.PI, 0] },
  { position: [0.504, 0, 0], rotation: [0, Math.PI / 2, 0] },
  { position: [-0.504, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  { position: [0, 0.504, 0], rotation: [-Math.PI / 2, 0, 0] },
  { position: [0, -0.504, 0], rotation: [Math.PI / 2, 0, 0] },
];

function drawPixelLine(ctx, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const doubled = 2 * error;
    if (doubled >= dy) {
      error += dy;
      x0 += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y0 += sy;
    }
  }
}

function makeBreakStageTexture(stage) {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(18, 18, 18, 0.92)";
  const segmentCount = BREAK_STAGE_COUNTS[Math.max(0, Math.min(BREAK_STAGE_COUNTS.length - 1, stage))];
  for (const [[x0, y0], [x1, y1]] of BREAK_CRACK_SEGMENTS.slice(0, segmentCount)) {
    drawPixelLine(
      ctx,
      Math.round(x0 * (size - 1)),
      Math.round((1 - y0) * (size - 1)),
      Math.round(x1 * (size - 1)),
      Math.round((1 - y1) * (size - 1)),
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

export class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed >>> 0;
    this.blocks = new Uint8Array(WORLD_SIZE * WORLD_SIZE * WORLD_HEIGHT);
    this.heightMap = new Int16Array(WORLD_SIZE * WORLD_SIZE);
    this.chunkMeshes = new Array(CHUNKS * CHUNKS).fill(null);
    this.waterMeshes = new Array(CHUNKS * CHUNKS).fill(null);
    this.blanketMeshes = new Array(CHUNKS * CHUNKS).fill(null);
    this.disasterScene = null;
    this.plazaY = WATER_LEVEL + 2;
    this.disasterProps = new THREE.Group();
    this.disasterProps.name = "medicraft-disaster-scene";
    this.scene.add(this.disasterProps);
    this.solidMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.waterMaterial = new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    this.blanketMaterial = new THREE.MeshLambertMaterial({ map: makeWoolTexture() });
    this.breakEffect = this._createBreakEffect();
    this.scene.add(this.breakEffect);
    this.clinic = { x: 64.5, y: 15, z: 64.5 };
    this._generate();
  }

  _createBreakEffect() {
    const group = new THREE.Group();
    group.name = "medicraft-block-break-effect";
    group.visible = false;
    group.renderOrder = 25;

    const crackStages = [];
    for (let stage = 0; stage < 10; stage++) {
      const stageGroup = new THREE.Group();
      stageGroup.name = `minecraft-break-stage-${stage}`;
      stageGroup.visible = false;
      const texture = makeBreakStageTexture(stage);
      for (const { position, rotation } of BREAK_FACE_TRANSFORMS) {
        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.02,
          depthTest: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          side: THREE.DoubleSide,
        });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(1.006, 1.006), material);
        face.position.set(...position);
        face.rotation.set(...rotation);
        face.renderOrder = 26;
        stageGroup.add(face);
      }
      group.add(stageGroup);
      crackStages.push(stageGroup);
    }

    this.breakCrackStages = crackStages;
    return group;
  }

  setBreakEffect(progress = 0, phase = 0, target = null) {
    if (!this.breakEffect) return;
    const value = Math.max(0, Math.min(1, Number(progress) || 0));
    if (!target || value <= 0) {
      this.breakEffect.visible = false;
      return;
    }

    this.breakEffect.visible = true;
    this.breakEffect.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
    this.breakEffect.scale.setScalar(1);
    const stageNumber = Math.max(1, Math.min(10, Math.floor(Number(phase) || Math.ceil(value * 10))));
    const stageIndex = stageNumber - 1;
    for (let i = 0; i < this.breakCrackStages.length; i++) {
      this.breakCrackStages[i].visible = i === stageIndex;
    }
  }

  _baseHeight(x, z) {
    const n = fbm2(x * 0.03, z * 0.03, this.seed, 4);
    return Math.max(4, Math.min(30, Math.round(13 + (n - 0.5) * 12)));
  }

  _fillColumn(x, z, height, topBlock) {
    for (let y = 0; y < height; y++) {
      let block;
      if (y < height - 3) block = BLOCK.STONE;
      else if (y < height - 1) block = topBlock === BLOCK.SAND ? BLOCK.SAND : BLOCK.DIRT;
      else block = topBlock;
      this.blocks[idx(x, y, z)] = block;
    }
    for (let y = height; y < WORLD_HEIGHT; y++) this.blocks[idx(x, y, z)] = BLOCK.AIR;
    if (height <= WATER_LEVEL) {
      for (let y = height; y <= WATER_LEVEL; y++) this.blocks[idx(x, y, z)] = BLOCK.WATER;
      this.heightMap[z * WORLD_SIZE + x] = WATER_LEVEL + 1;
    } else {
      this.heightMap[z * WORLD_SIZE + x] = height;
    }
  }

  _generate() {
    for (let z = 0; z < WORLD_SIZE; z++) {
      for (let x = 0; x < WORLD_SIZE; x++) {
        const h = this._baseHeight(x, z);
        if (h <= WATER_LEVEL + 1) this._fillColumn(x, z, h, BLOCK.SAND);
        else this._fillColumn(x, z, h, BLOCK.GRASS);
      }
    }
    this._carveClinicPlaza();
    this._plantTrees();
    this._buildDisasterScene();
    this.clinic.y = this.heightMap[64 * WORLD_SIZE + 64];
  }

  _carveClinicPlaza() {
    const cx = 64;
    const cz = 64;
    const radius = 14;
    const plazaHeight = Math.max(this._baseHeight(cx, cz), WATER_LEVEL + 2);
    this.plazaY = plazaHeight;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        const x = cx + dx;
        const z = cz + dz;
        if (x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE) continue;
        this._fillColumn(x, z, plazaHeight, BLOCK.PATH);
      }
    }
    this.blocks[idx(cx, plazaHeight, cz)] = BLOCK.REDCROSS;
    this.blocks[idx(cx, plazaHeight + 1, cz)] = BLOCK.REDCROSS;
  }

  _plantTrees() {
    const rng = mulberry32(this.seed ^ 0x51ed270b);
    for (let attempt = 0; attempt < 110; attempt++) {
      const x = 4 + Math.floor(rng() * (WORLD_SIZE - 8));
      const z = 4 + Math.floor(rng() * (WORLD_SIZE - 8));
      const g = this.heightMap[z * WORLD_SIZE + x];
      if (g <= WATER_LEVEL + 1) continue;
      const dxClinic = x - 64;
      const dzClinic = z - 64;
      if (dxClinic * dxClinic + dzClinic * dzClinic < 20 * 20) continue;
      if (this.getBlock(x, g, z) !== BLOCK.AIR) continue;
      const trunkHeight = 3 + Math.floor(rng() * 3);
      for (let y = g; y < g + trunkHeight && y < WORLD_HEIGHT; y++) {
        this.blocks[idx(x, y, z)] = BLOCK.WOOD;
      }
      const topY = g + trunkHeight - 1;
      for (let ly = topY - 1; ly <= topY + 2; ly++) {
        const spread = ly >= topY + 1 ? 1 : 2;
        for (let lz = -spread; lz <= spread; lz++) {
          for (let lx = -spread; lx <= spread; lx++) {
            if (Math.abs(lx) === spread && Math.abs(lz) === spread && rng() < 0.6) continue;
            const bx = x + lx;
            const by = ly;
            const bz = z + lz;
            if (bx < 0 || bx >= WORLD_SIZE || bz < 0 || bz >= WORLD_SIZE || by >= WORLD_HEIGHT) continue;
            if (this.blocks[idx(bx, by, bz)] === BLOCK.AIR) this.blocks[idx(bx, by, bz)] = BLOCK.LEAVES;
          }
        }
      }
    }
  }

  _setGeneratedBlock(x, y, z, block) {
    if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_SIZE) return;
    this.blocks[idx(x, y, z)] = block;
  }

  _buildDisasterScene() {
    // The incident tells one story in blocks: the south-east corner of an
    // apartment block came down onto the main road, the debris buried the front
    // of a city bus and flattened a parked car, and the rescue services staged
    // their vehicles and an open triage area on the far side of the street.
    // Intact houses and a shop frame the damage so it reads at a glance.
    const floorY = this.plazaY;
    const dx0 = 76;
    const dx1 = 110;
    const dz0 = 50;
    const dz1 = 80;
    const streetZ0 = 61;
    const streetZ1 = 67;

    this.disasterScene = {
      x: 92.5,
      z: 64.5,
      radius: 22,
      floorY,
      title: "Einsturzstelle Hauptstrasse",
      victimSpots: [],
    };

    const put = (x, y, z, block) => this._setGeneratedBlock(x, y, z, block);
    const fill = (x0, y0, z0, x1, y1, z1, block) => {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          for (let x = x0; x <= x1; x++) put(x, floorY + y, z, block);
        }
      }
    };
    const pave = (x0, z0, x1, z1, block) => {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE) continue;
          this._fillColumn(x, z, floorY, block);
        }
      }
    };
    const ring = (x0, z0, x1, z1, y, block) => {
      for (let x = x0; x <= x1; x++) {
        put(x, floorY + y, z0, block);
        put(x, floorY + y, z1, block);
      }
      for (let z = z0; z <= z1; z++) {
        put(x0, floorY + y, z, block);
        put(x1, floorY + y, z, block);
      }
    };
    const shell = (x0, z0, x1, z1, height, wall, roof) => {
      for (let y = 0; y < height; y++) ring(x0, z0, x1, z1, y, wall);
      fill(x0, height, z0, x1, height, z1, roof);
      ring(x0, z0, x1, z1, height + 1, wall);
    };
    const windows = (x0, z0, x1, z1, y, step) => {
      for (let x = x0 + 2; x <= x1 - 2; x += step) {
        put(x, floorY + y, z0, BLOCK.GLASS);
        put(x, floorY + y, z1, BLOCK.GLASS);
      }
      for (let z = z0 + 2; z <= z1 - 2; z += step) {
        put(x0, floorY + y, z, BLOCK.GLASS);
        put(x1, floorY + y, z, BLOCK.GLASS);
      }
    };
    const lamppost = (x, z) => {
      for (let y = 0; y < 3; y++) put(x, floorY + y, z, BLOCK.WOOD);
      put(x, floorY + 3, z, BLOCK.LAMP);
    };
    const streetTree = (x, z) => {
      put(x, floorY, z, BLOCK.WOOD);
      put(x, floorY + 1, z, BLOCK.WOOD);
      put(x, floorY + 2, z, BLOCK.LEAVES);
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(x + ox, floorY + 2, z + oz, BLOCK.LEAVES);
    };

    // 1. Level the district, then feather the edges back into the terrain so
    //    the incident block never ends in a cliff.
    pave(dx0, dz0, dx1, dz1, BLOCK.GRASS);
    for (let step = 1; step <= 3; step++) {
      const t = step / 4;
      const cells = [];
      for (let x = dx0 - step; x <= dx1 + step; x++) cells.push([x, dz0 - step], [x, dz1 + step]);
      for (let z = dz0 - step; z <= dz1 + step; z++) cells.push([dx0 - step, z], [dx1 + step, z]);
      for (const [x, z] of cells) {
        if (x < 1 || x >= WORLD_SIZE - 1 || z < 1 || z >= WORLD_SIZE - 1) continue;
        if (Math.hypot(x - 64, z - 64) < 16) continue;
        const base = this._baseHeight(x, z);
        const h = Math.round(floorY + (base - floorY) * t);
        this._fillColumn(x, z, Math.max(WATER_LEVEL + 2, h), BLOCK.GRASS);
      }
    }

    // 2. The main road, its sidewalks and the approach from the clinic plaza.
    pave(72, streetZ0, dx1, streetZ1, BLOCK.ASPHALT);
    pave(dx0, 59, dx1, 60, BLOCK.CONCRETE);
    pave(dx0, 68, dx1, 69, BLOCK.CONCRETE);
    pave(80, 74, 108, 80, BLOCK.PATH);
    pave(100, 59, 108, 60, BLOCK.CONCRETE);
    for (let x = 72; x <= dx1; x++) {
      if (x % 4 < 2) this._fillColumn(x, 64, floorY, BLOCK.CONCRETE);
    }

    // 3. The apartment block. It is built whole, then sheared open along a
    //    diagonal so the south-east corner is simply gone.
    const APT_X0 = 82;
    const APT_X1 = 96;
    const APT_Z0 = 50;
    const APT_Z1 = 58;
    const APT_H = 12;
    shell(APT_X0, APT_Z0, APT_X1, APT_Z1, APT_H, BLOCK.BRICK, BLOCK.CONCRETE);
    for (let floor = 1; floor < 4; floor++) {
      fill(APT_X0 + 1, floor * 3, APT_Z0 + 1, APT_X1 - 1, floor * 3, APT_Z1 - 1, BLOCK.CONCRETE);
      windows(APT_X0, APT_Z0, APT_X1, APT_Z1, floor * 3 + 1, 2);
    }
    windows(APT_X0, APT_Z0, APT_X1, APT_Z1, 1, 2);
    fill(85, 0, APT_Z1, 86, 1, APT_Z1, BLOCK.AIR);
    for (let z = APT_Z0; z <= APT_Z1; z++) {
      for (let x = APT_X0; x <= APT_X1; x++) {
        const shear = (x - 87) * 1.15 + (z - 53) * 0.75;
        if (shear <= 0) continue;
        let keep = Math.round(APT_H - shear * 1.8);
        if ((x * 5 + z * 3) % 4 === 0) keep += 1;
        for (let y = Math.max(0, keep); y <= APT_H + 1; y++) put(x, floorY + y, z, BLOCK.AIR);
      }
    }

    // 4. The debris cone: it fills the torn-open half and spills across the
    //    northern half of the road.
    const mound = (x, z) => {
      const d = Math.hypot((x - 92) * 0.85, (z - 57.5) * 0.8);
      let h = Math.round(6.5 - d * 1.15);
      if ((x * 7 + z * 5) % 4 === 0) h += 1;
      return h;
    };
    for (let z = 51; z <= 64; z++) {
      for (let x = 86; x <= 99; x++) {
        const h = mound(x, z);
        for (let y = 0; y < h; y++) put(x, floorY + y, z, BLOCK.RUBBLE);
      }
    }
    for (const [x, z] of [[84, 61], [85, 63], [101, 62], [88, 66], [100, 60], [83, 59]]) {
      put(x, floorY, z, BLOCK.RUBBLE);
    }

    // 5. The city bus, nose-first into the debris, doors open to the south.
    //    Yellow bodywork so the wreck never washes out against the asphalt.
    const BUS_X0 = 91;
    const BUS_X1 = 100;
    const BUS_Z0 = 64;
    const BUS_Z1 = 66;
    fill(BUS_X0, 0, BUS_Z0, BUS_X1, 0, BUS_Z1, BLOCK.METAL);
    for (let y = 1; y <= 2; y++) ring(BUS_X0, BUS_Z0, BUS_X1, BUS_Z1, y, BLOCK.CAUTION);
    fill(BUS_X0, 3, BUS_Z0, BUS_X1, 3, BUS_Z1, BLOCK.CAUTION);
    for (let x = BUS_X0 + 1; x < BUS_X1; x++) {
      if ((x + BUS_Z0) % 3 === 0) continue;
      put(x, floorY + 2, BUS_Z0, BLOCK.GLASS);
      put(x, floorY + 2, BUS_Z1, BLOCK.GLASS);
    }
    for (let z = BUS_Z0 + 1; z < BUS_Z1; z++) put(BUS_X1, floorY + 2, z, BLOCK.GLASS);
    for (let y = 1; y <= 2; y++) {
      put(97, floorY + y, BUS_Z1, BLOCK.AIR);
      put(98, floorY + y, BUS_Z1, BLOCK.AIR);
    }
    fill(BUS_X0, 1, BUS_Z0, BUS_X0 + 2, 3, BUS_Z1, BLOCK.AIR);
    fill(BUS_X0, 1, BUS_Z0, BUS_X0 + 2, 1, BUS_Z1, BLOCK.RUBBLE);
    fill(BUS_X0 + 1, 2, BUS_Z0, BUS_X0 + 2, 2, BUS_Z0 + 1, BLOCK.RUBBLE);

    // 6. A parked car flattened by a falling facade slab.
    fill(83, 0, 65, 86, 0, 66, BLOCK.METAL);
    fill(84, 1, 65, 85, 1, 66, BLOCK.GLASS);
    fill(84, 2, 65, 87, 2, 66, BLOCK.CONCRETE);
    put(87, floorY + 1, 66, BLOCK.RUBBLE);
    put(83, floorY + 1, 65, BLOCK.RUBBLE);

    // 7. Untouched buildings around the incident give it a scale reference.
    shell(100, 51, 108, 58, 6, BLOCK.CONCRETE, BLOCK.BRICK);
    for (let x = 101; x <= 107; x++) {
      put(x, floorY + 1, 58, BLOCK.GLASS);
      put(x, floorY + 2, 58, BLOCK.GLASS);
    }
    fill(104, 0, 58, 105, 1, 58, BLOCK.AIR);
    windows(100, 51, 108, 58, 4, 2);
    shell(76, 50, 80, 56, 5, BLOCK.BRICK, BLOCK.CONCRETE);
    windows(76, 50, 80, 56, 2, 2);
    put(78, floorY + 6, 53, BLOCK.BRICK);
    put(78, floorY + 7, 53, BLOCK.BRICK);
    shell(76, 72, 82, 78, 5, BLOCK.CONCRETE, BLOCK.BRICK);
    windows(76, 72, 82, 78, 2, 2);
    fill(79, 0, 72, 79, 1, 72, BLOCK.AIR);
    put(80, floorY + 6, 75, BLOCK.BRICK);
    put(80, floorY + 7, 75, BLOCK.BRICK);

    // 8. Staging area: fire engine, ambulance and an open triage line.
    fill(84, 0, 71, 90, 0, 73, BLOCK.METAL);
    fill(84, 1, 71, 90, 2, 73, BLOCK.REDCROSS);
    for (const z of [71, 73]) put(90, floorY + 2, z, BLOCK.GLASS);
    fill(85, 3, 72, 89, 3, 72, BLOCK.WOOD);
    put(84, floorY + 3, 72, BLOCK.LAMP);
    put(90, floorY + 3, 72, BLOCK.LAMP);

    fill(96, 0, 71, 101, 0, 73, BLOCK.METAL);
    fill(96, 1, 71, 101, 3, 73, BLOCK.CONCRETE);
    for (const [ox, oy] of [[0, 2], [-1, 2], [1, 2], [0, 1], [0, 3]]) {
      put(98 + ox, floorY + oy, 73, BLOCK.REDCROSS);
    }
    put(101, floorY + 3, 72, BLOCK.GLASS);
    fill(96, 1, 71, 96, 2, 71, BLOCK.AIR);
    put(96, floorY + 4, 72, BLOCK.LAMP);
    put(101, floorY + 4, 72, BLOCK.LAMP);

    // The command tent stands clear of the casualty line so nothing is hidden
    // under a roof; its red cross marks the collection point from far away.
    for (const [x, z] of [[82, 75], [90, 75], [82, 79], [90, 79]]) {
      for (let y = 0; y < 4; y++) put(x, floorY + y, z, BLOCK.WOOD);
    }
    fill(82, 4, 75, 90, 4, 79, BLOCK.CONCRETE);
    for (let d = -2; d <= 2; d++) {
      put(86 + d, floorY + 4, 77, BLOCK.REDCROSS);
      put(86, floorY + 4, 77 + d, BLOCK.REDCROSS);
    }
    for (const bx of [94, 99, 104]) {
      fill(bx, 0, 76, bx + 1, 0, 78, BLOCK.EMERGENCY_BLANKET);
      put(bx - 1, floorY, 77, BLOCK.CAUTION);
    }

    // 9. Cordon, beacons, street furniture and the red-cross gate on the road.
    for (let z = 57; z <= 71; z++) {
      if (z >= streetZ0 && z <= streetZ1) continue;
      put(79, floorY, z, BLOCK.CAUTION);
      put(109, floorY, z, BLOCK.CAUTION);
    }
    for (const [x, z] of [[78, 62], [78, 66]]) {
      for (let y = 0; y < 3; y++) put(x, floorY + y, z, BLOCK.REDCROSS);
    }
    for (const [x, z] of [[81, 60], [81, 68], [103, 60], [103, 68]]) lamppost(x, z);
    for (const [x, z] of [[79, 60], [79, 68], [109, 60], [109, 68]]) put(x, floorY, z, BLOCK.LAMP);
    for (const [x, z] of [[92, 70], [106, 70], [77, 59], [107, 66]]) streetTree(x, z);

    // 10. Fire on top of the debris and on an exposed floor slab, with smoke
    //     plumes above so the incident is visible from the clinic plaza.
    for (const [x, z] of [[92, 57], [94, 60], [89, 55]]) {
      const h = Math.max(1, mound(x, z));
      for (let y = 0; y <= 2; y++) put(x, floorY + h + y, z, BLOCK.FIRE);
      put(x + 1, floorY + h, z, BLOCK.FIRE);
      put(x, floorY + h, z + 1, BLOCK.FIRE);
    }
    put(86, floorY + 7, 57, BLOCK.FIRE);
    put(86, floorY + 8, 57, BLOCK.FIRE);

    const smokeMaterial = new THREE.MeshLambertMaterial({
      color: 0x33363a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    for (const [px, pz, drift] of [[92, 57, 0.65], [94, 60, -0.5], [86, 57, 0.3]]) {
      const base = floorY + Math.max(3, mound(px, pz)) + 3;
      for (let i = 0; i < 5; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.0 + i * 0.45, 8, 6), smokeMaterial);
        puff.position.set(px + 0.5 + i * drift, base + i * 2.1, pz + 0.5 - i * 0.35);
        this.disasterProps.add(puff);
      }
    }

    // 11. Where the casualties lie: in the debris, on the road around the bus
    //     and on the triage blankets. Every candidate is validated against the
    //     blocks that were just placed, so a spot is always open ground.
    const candidates = [
      [97.5, 67.5],
      [102.5, 65.5],
      [88.5, 65.5],
      [90.5, 61.5],
      [95.5, 62.5],
      [85.5, 62.5],
      [83.5, 67.5],
      [93.5, 69.5],
      [80.5, 65.5],
      [104.5, 60.5],
      [94.5, 77.5],
      [99.5, 77.5],
      [104.5, 77.5],
      [85.5, 59.5],
      [99.5, 70.5],
    ];
    for (const [x, z] of candidates) {
      const bx = Math.floor(x);
      const bz = Math.floor(z);
      const y = this._incidentSurface(bx, bz);
      if (y === null) continue;
      if (this.getBlock(bx, y, bz) !== BLOCK.AIR) continue;
      if (this.getBlock(bx, y + 1, bz) !== BLOCK.AIR) continue;
      this.disasterScene.victimSpots.push({ x, y, z });
    }
  }

  _incidentSurface(x, z) {
    const floorY = this.disasterScene ? this.disasterScene.floorY : this.getHeight(x, z);
    const from = Math.min(WORLD_HEIGHT - 2, floorY + 4);
    for (let y = from; y >= 0; y--) {
      const block = this.getBlock(x, y, z);
      if (block === BLOCK.AIR) continue;
      if (block === BLOCK.WATER || block === BLOCK.FIRE || block === BLOCK.LEAVES) return null;
      return y + 1;
    }
    return null;
  }

  getHeight(x, z) {
    x = Math.floor(x);
    z = Math.floor(z);
    if (x < 0 || x >= WORLD_SIZE || z < 0 || z >= WORLD_SIZE) return 0;
    return this.heightMap[z * WORLD_SIZE + x];
  }

  _updateHeightAt(x, z) {
    const column = z * WORLD_SIZE + x;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (HEIGHT_BLOCKS.has(this.blocks[idx(x, y, z)])) {
        this.heightMap[column] = y + 1;
        return;
      }
    }
    this.heightMap[column] = 0;
  }

  getBlock(x, y, z) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (y < 0) return BLOCK.STONE;
    if (x < 0 || x >= WORLD_SIZE || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_SIZE) return BLOCK.AIR;
    return this.blocks[idx(x, y, z)];
  }

  isSolid(x, y, z) {
    const b = this.getBlock(x, y, z);
    return b !== BLOCK.AIR && b !== BLOCK.WATER;
  }

  setBlock(x, y, z, id) {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    if (x < 0 || x >= WORLD_SIZE || y < 0 || y >= WORLD_HEIGHT || z < 0 || z >= WORLD_SIZE) return;
    this.blocks[idx(x, y, z)] = id;
    this._updateHeightAt(x, z);
    const ci = Math.floor(x / CHUNK);
    const cj = Math.floor(z / CHUNK);
    this._rebuildChunk(ci, cj);
    if (x % CHUNK === 0 && ci > 0) this._rebuildChunk(ci - 1, cj);
    if (x % CHUNK === CHUNK - 1 && ci < CHUNKS - 1) this._rebuildChunk(ci + 1, cj);
    if (z % CHUNK === 0 && cj > 0) this._rebuildChunk(ci, cj - 1);
    if (z % CHUNK === CHUNK - 1 && cj < CHUNKS - 1) this._rebuildChunk(ci, cj + 1);
    emit("world:blockchanged", { x, y, z, block: id });
  }

  update(playerPos) {
    const pcx = Math.max(0, Math.min(CHUNKS - 1, Math.floor(playerPos.x / CHUNK)));
    const pcz = Math.max(0, Math.min(CHUNKS - 1, Math.floor(playerPos.z / CHUNK)));
    let budget = 3;
    for (let ring = 0; ring < CHUNKS && budget > 0; ring++) {
      for (let cj = Math.max(0, pcz - ring); cj <= Math.min(CHUNKS - 1, pcz + ring) && budget > 0; cj++) {
        for (let ci = Math.max(0, pcx - ring); ci <= Math.min(CHUNKS - 1, pcx + ring) && budget > 0; ci++) {
          if (Math.max(Math.abs(ci - pcx), Math.abs(cj - pcz)) !== ring) continue;
          const index = cj * CHUNKS + ci;
          if (this.chunkMeshes[index] === null) {
            this._buildChunk(ci, cj);
            budget--;
          }
        }
      }
    }
  }

  raycast(origin, dir, maxDist = 6) {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = dir.x !== 0
      ? ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) / Math.abs(dir.x))
      : Infinity;
    let tMaxY = dir.y !== 0
      ? ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) / Math.abs(dir.y))
      : Infinity;
    let tMaxZ = dir.z !== 0
      ? ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) / Math.abs(dir.z))
      : Infinity;
    let nx = 0;
    let ny = 0;
    let nz = 0;
    let t = 0;
    while (t <= maxDist) {
      const block = this.getBlock(x, y, z);
      if (block !== BLOCK.AIR && t > 0) {
        return { x, y, z, nx, ny, nz, block };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  findPatientSpots(n, options = {}) {
    const scenarioSeed = Number.isFinite(options?.seed) ? Number(options.seed) >>> 0 : Math.floor(Math.random() * 0xffffffff) >>> 0;
    const rng = mulberry32((this.seed ^ scenarioSeed ^ 0x5f3759df) >>> 0);
    const scene = this.disasterScene;
    const spots = [];
    const clearOf = (spot, gap) => spots.every((s) => Math.hypot(s.x - spot.x, s.z - spot.z) >= gap);

    // Casualties belong to the incident: the curated spots put them in the
    // debris, on the road beside the bus and on the triage blankets.
    const pool = (scene?.victimSpots || []).map((s) => ({ ...s }));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    for (const spot of pool) {
      if (spots.length >= n) break;
      if (!clearOf(spot, 4.5)) continue;
      spots.push(spot);
    }
    if (spots.length >= n || !scene) return spots;

    // Fallback: any open ground inside the cordoned district, so a shift never
    // reports fewer casualties than the mission asked for.
    for (let attempt = 0; attempt < 4000 && spots.length < n; attempt++) {
      const x = Math.floor(scene.x - scene.radius + rng() * scene.radius * 2);
      const z = Math.floor(scene.z - scene.radius + rng() * scene.radius * 2);
      if (x < 1 || x >= WORLD_SIZE - 1 || z < 1 || z >= WORLD_SIZE - 1) continue;
      if (Math.hypot(x + 0.5 - scene.x, z + 0.5 - scene.z) > scene.radius) continue;
      const y = this._incidentSurface(x, z);
      if (y === null || y > scene.floorY + 1) continue;
      if (this.getBlock(x, y, z) !== BLOCK.AIR) continue;
      if (this.getBlock(x, y + 1, z) !== BLOCK.AIR) continue;
      const spot = { x: x + 0.5, y, z: z + 0.5 };
      if (!clearOf(spot, 5)) continue;
      spots.push(spot);
    }
    return spots;
  }

  dispose() {
    for (let i = 0; i < this.chunkMeshes.length; i++) {
      this._removeMesh(this.chunkMeshes[i]);
      this.chunkMeshes[i] = null;
      this._removeMesh(this.waterMeshes[i]);
      this.waterMeshes[i] = null;
      this._removeMesh(this.blanketMeshes[i]);
      this.blanketMeshes[i] = null;
    }
    this.solidMaterial.dispose();
    this.waterMaterial.dispose();
    this.blanketMaterial.map?.dispose();
    this.blanketMaterial.dispose();
    this.scene.remove(this.breakEffect);
    this.breakEffect.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material?.map) child.material.map.dispose();
      if (child.material) child.material.dispose();
    });
    this.scene.remove(this.disasterProps);
    this.disasterProps.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }

  _removeMesh(mesh) {
    if (!mesh) return;
    this.scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
  }

  _rebuildChunk(ci, cj) {
    const index = cj * CHUNKS + ci;
    this._removeMesh(this.chunkMeshes[index]);
    this._removeMesh(this.waterMeshes[index]);
    this._removeMesh(this.blanketMeshes[index]);
    this.chunkMeshes[index] = null;
    this.waterMeshes[index] = null;
    this.blanketMeshes[index] = null;
    this._buildChunk(ci, cj);
  }

  _buildChunk(ci, cj) {
    const index = cj * CHUNKS + ci;
    const positions = [];
    const normals = [];
    const colors = [];
    const waterPositions = [];
    const waterNormals = [];
    const waterColors = [];
    const blanketPositions = [];
    const blanketNormals = [];
    const blanketUvs = [];
    const x0 = ci * CHUNK;
    const z0 = cj * CHUNK;

    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const x = x0 + lx;
        const z = z0 + lz;
        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const block = this.blocks[idx(x, y, z)];
          if (block === BLOCK.AIR) continue;
          const isWater = block === BLOCK.WATER;
          const isBlanket = block === BLOCK.EMERGENCY_BLANKET;
          for (const face of FACES) {
            const neighborBlock = this.getBlock(x + face.normal[0], y + face.normal[1], z + face.normal[2]);
            if (isWater) {
              if (neighborBlock !== BLOCK.AIR) continue;
              this._pushFace(waterPositions, waterNormals, waterColors, x, y, z, face, block, 1.0, 0);
            } else if (isBlanket) {
              if (neighborBlock !== BLOCK.AIR && neighborBlock !== BLOCK.WATER) continue;
              this._pushFace(
                blanketPositions,
                blanketNormals,
                null,
                x,
                y,
                z,
                face,
                block,
                FACE_SHADE[face.dir],
                1,
                blanketUvs
              );
            } else {
              if (neighborBlock !== BLOCK.AIR && neighborBlock !== BLOCK.WATER) continue;
              const jitter = 0.96 + hash3(x, y, z, this.seed) * 0.08;
              this._pushFace(positions, normals, colors, x, y, z, face, block, FACE_SHADE[face.dir], jitter);
            }
          }
        }
      }
    }

    if (positions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.solidMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.chunkMeshes[index] = mesh;
    } else {
      this.chunkMeshes[index] = new THREE.Object3D();
    }

    if (waterPositions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(waterPositions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(waterNormals, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(waterColors, 3));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.waterMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.waterMeshes[index] = mesh;
    } else {
      this.waterMeshes[index] = new THREE.Object3D();
    }

    if (blanketPositions.length > 0) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(blanketPositions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(blanketNormals, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(blanketUvs, 2));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, this.blanketMaterial);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.scene.add(mesh);
      this.blanketMeshes[index] = mesh;
    } else {
      this.blanketMeshes[index] = new THREE.Object3D();
    }
  }

  _pushFace(positions, normals, colors, x, y, z, face, block, shade, jitter, uvs = null) {
    const palette = PALETTE[block] || [1, 0, 1];
    const r = palette[0] * shade * jitter;
    const g = palette[1] * shade * jitter;
    const b = palette[2] * shade * jitter;
    const corners = face.corners;
    const faceUvs = [[0, 0], [0, 1], [1, 1], [1, 0]];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const c = corners[i];
      positions.push(x + c[0], y + c[1], z + c[2]);
      normals.push(face.normal[0], face.normal[1], face.normal[2]);
      if (colors) colors.push(r, g, b);
      if (uvs) uvs.push(faceUvs[i][0], faceUvs[i][1]);
    }
  }
}
