// Procedural street world geometry and animation.
// Ground with road (6 m wide along -Z), sidewalks, ~24 box buildings,
// lamp posts, ~12 pedestrians, ~4 cars, sky gradient dome.
// Viewer origin at (0, 0, 0) on the sidewalk edge.
// Deterministic (seeded mulberry32 PRNG).

import { mulberry32, mat4Identity } from '../math.js';
import { STREET_VS, STREET_FS } from '../shaders/scene.js';

function addBox(
  posList,
  normList,
  colList,
  matList,
  minX,
  minY,
  minZ,
  maxX,
  maxY,
  maxZ,
  color,
  material
) {
  // 6 faces * 2 triangles * 3 vertices = 36 vertices
  const [r, g, b] = color;
  const faces = [
    // Front (+Z)
    { norm: [0, 0, 1], pts: [[minX, minY, maxZ], [maxX, minY, maxZ], [maxX, maxY, maxZ], [minX, minY, maxZ], [maxX, maxY, maxZ], [minX, maxY, maxZ]] },
    // Back (-Z)
    { norm: [0, 0, -1], pts: [[maxX, minY, minZ], [minX, minY, minZ], [minX, maxY, minZ], [maxX, minY, minZ], [minX, maxY, minZ], [maxX, maxY, minZ]] },
    // Top (+Y)
    { norm: [0, 1, 0], pts: [[minX, maxY, maxZ], [maxX, maxY, maxZ], [maxX, maxY, minZ], [minX, maxY, maxZ], [maxX, maxY, minZ], [minX, maxY, minZ]] },
    // Bottom (-Y)
    { norm: [0, -1, 0], pts: [[minX, minY, minZ], [maxX, minY, minZ], [maxX, minY, maxZ], [minX, minY, minZ], [maxX, minY, maxZ], [minX, minY, maxZ]] },
    // Right (+X)
    { norm: [1, 0, 0], pts: [[maxX, minY, maxZ], [maxX, minY, minZ], [maxX, maxY, minZ], [maxX, minY, maxZ], [maxX, maxY, minZ], [maxX, maxY, maxZ]] },
    // Left (-X)
    { norm: [-1, 0, 0], pts: [[minX, minY, minZ], [minX, minY, maxZ], [minX, maxY, maxZ], [minX, minY, minZ], [minX, maxY, maxZ], [minX, maxY, minZ]] },
  ];

  for (const f of faces) {
    for (const pt of f.pts) {
      posList.push(pt[0], pt[1], pt[2]);
      normList.push(f.norm[0], f.norm[1], f.norm[2]);
      colList.push(r, g, b);
      matList.push(material);
    }
  }
}

export class StreetScene {
  constructor(seed = 0xcafe1234) {
    this.seed = seed;
    this.gl = null;
    this.program = null;
    this.staticVao = null;
    this.staticVbo = null;
    this.staticVertexCount = 0;
    this.dynamicVao = null;
    this.dynamicVbo = null;
    this.dynamicVertexCount = 0;
    this.dynamicBuffer = null;

    this.cars = [];
    this.pedestrians = [];

    this._generate();
  }

  _generate() {
    const rand = mulberry32(this.seed);

    const pos = [];
    const norm = [];
    const col = [];
    const mat = [];

    // --- 1. Road (6 m wide along -Z, x in [-6, 0], z in [-130, 30]) ---
    // Viewer origin (0, 0, 0) is right on the sidewalk edge
    addBox(pos, norm, col, mat, -6.0, -0.05, -130.0, 0.0, 0.0, 30.0, [0.18, 0.19, 0.2], 0.0);

    // Center yellow lane dashes (built as static geometry or handled in fragment shader)
    // Extra road shoulders:
    addBox(pos, norm, col, mat, -6.05, -0.04, -130.0, -6.0, 0.02, 30.0, [0.12, 0.12, 0.12], 0.0);
    addBox(pos, norm, col, mat, 0.0, -0.04, -130.0, 0.05, 0.02, 30.0, [0.12, 0.12, 0.12], 0.0);

    // --- 2. Sidewalks (y = 0.15 high) ---
    // East sidewalk (viewer side): x in [0.0, 3.5]
    addBox(pos, norm, col, mat, 0.0, 0.0, -130.0, 3.5, 0.15, 30.0, [0.65, 0.63, 0.6], 1.0);
    // Curb step
    addBox(pos, norm, col, mat, 0.0, 0.0, -130.0, 0.15, 0.15, 30.0, [0.55, 0.54, 0.52], 1.0);

    // West sidewalk (across road): x in [-9.5, -6.0]
    addBox(pos, norm, col, mat, -9.5, 0.0, -130.0, -6.0, 0.15, 30.0, [0.65, 0.63, 0.6], 1.0);
    // Curb step
    addBox(pos, norm, col, mat, -6.15, 0.0, -130.0, -6.0, 0.15, 30.0, [0.55, 0.54, 0.52], 1.0);

    // --- 3. ~24 Box Buildings ---
    const buildingColors = [
      [0.45, 0.32, 0.28], // reddish brick
      [0.68, 0.65, 0.58], // limestone
      [0.28, 0.30, 0.35], // dark slate
      [0.55, 0.56, 0.54], // concrete
      [0.72, 0.60, 0.48], // warm sandstone
      [0.35, 0.40, 0.42], // modern steel/glass
    ];

    // 12 buildings on East side (behind east sidewalk: x > 3.5)
    let curZ = -120;
    for (let i = 0; i < 12; i++) {
      const bWidth = 9.0 + rand() * 4.0;
      const bHeight = 12.0 + rand() * 26.0;
      const bDepth = 12.0 + rand() * 6.0;
      const bX = 3.5;
      const bColor = buildingColors[Math.floor(rand() * buildingColors.length)];

      addBox(pos, norm, col, mat, bX, 0.0, curZ, bX + bDepth, bHeight, curZ + bWidth, bColor, 2.0);
      curZ += bWidth + 1.0 + rand() * 2.0;
    }

    // 12 buildings on West side (behind west sidewalk: x < -9.5)
    curZ = -120;
    for (let i = 0; i < 12; i++) {
      const bWidth = 9.0 + rand() * 4.0;
      const bHeight = 14.0 + rand() * 24.0;
      const bDepth = 12.0 + rand() * 6.0;
      const bX = -9.5 - bDepth;
      const bColor = buildingColors[Math.floor(rand() * buildingColors.length)];

      addBox(pos, norm, col, mat, bX, 0.0, curZ, -9.5, bHeight, curZ + bWidth, bColor, 2.0);
      curZ += bWidth + 1.0 + rand() * 2.0;
    }

    // --- 4. Lamp Posts along both sidewalks ---
    // Every 20 m along Z from 15 to -105
    for (let lz = 15; lz >= -105; lz -= 20) {
      // East lamp post (x = 0.3)
      // Base & pole (y from 0.15 to 4.5)
      addBox(pos, norm, col, mat, 0.25, 0.15, lz - 0.05, 0.35, 4.5, lz + 0.05, [0.15, 0.16, 0.18], 3.0);
      // Arm reaching toward road (-X)
      addBox(pos, norm, col, mat, -0.3, 4.45, lz - 0.04, 0.3, 4.55, lz + 0.04, [0.15, 0.16, 0.18], 3.0);
      // Fixture head
      addBox(pos, norm, col, mat, -0.4, 4.4, lz - 0.12, -0.2, 4.58, lz + 0.12, [0.95, 0.9, 0.75], 4.0);

      // West lamp post (x = -6.3)
      addBox(pos, norm, col, mat, -6.35, 0.15, lz - 0.05, -6.25, 4.5, lz + 0.05, [0.15, 0.16, 0.18], 3.0);
      // Arm reaching toward road (+X)
      addBox(pos, norm, col, mat, -6.3, 4.45, lz - 0.04, -5.7, 4.55, lz + 0.04, [0.15, 0.16, 0.18], 3.0);
      // Fixture head
      addBox(pos, norm, col, mat, -5.8, 4.4, lz - 0.12, -5.6, 4.58, lz + 0.12, [0.95, 0.9, 0.75], 4.0);
    }

    // --- 5. Sky gradient dome ---
    // Inverted hemisphere around the scene (radius 140 m)
    const domeR = 140;
    const slices = 20;
    const stacks = 10;
    for (let i = 0; i < stacks; i++) {
      const phi1 = (i / stacks) * (Math.PI * 0.5);
      const phi2 = ((i + 1) / stacks) * (Math.PI * 0.5);
      const y1 = Math.sin(phi1) * domeR;
      const y2 = Math.sin(phi2) * domeR;
      const r1 = Math.cos(phi1) * domeR;
      const r2 = Math.cos(phi2) * domeR;

      for (let j = 0; j < slices; j++) {
        const th1 = (j / slices) * Math.PI * 2;
        const th2 = ((j + 1) / slices) * Math.PI * 2;

        const p00 = [Math.cos(th1) * r1, y1, Math.sin(th1) * r1];
        const p10 = [Math.cos(th2) * r1, y1, Math.sin(th2) * r1];
        const p01 = [Math.cos(th1) * r2, y2, Math.sin(th1) * r2];
        const p11 = [Math.cos(th2) * r2, y2, Math.sin(th2) * r2];

        // Inward facing normals
        const n = [0, -1, 0];
        const skyCol = [1, 1, 1];

        // Triangle 1: p00, p01, p10
        for (const pt of [p00, p01, p10]) {
          pos.push(pt[0], pt[1], pt[2]);
          norm.push(n[0], n[1], n[2]);
          col.push(skyCol[0], skyCol[1], skyCol[2]);
          mat.push(8.0);
        }
        // Triangle 2: p10, p01, p11
        for (const pt of [p10, p01, p11]) {
          pos.push(pt[0], pt[1], pt[2]);
          norm.push(n[0], n[1], n[2]);
          col.push(skyCol[0], skyCol[1], skyCol[2]);
          mat.push(8.0);
        }
      }
    }

    // Pack static buffer: [x,y,z, nx,ny,nz, r,g,b, mat] = 10 floats per vertex
    this.staticVertexCount = pos.length / 3;
    this.staticData = new Float32Array(this.staticVertexCount * 10);
    for (let i = 0; i < this.staticVertexCount; i++) {
      const idx = i * 10;
      this.staticData[idx + 0] = pos[i * 3 + 0];
      this.staticData[idx + 1] = pos[i * 3 + 1];
      this.staticData[idx + 2] = pos[i * 3 + 2];
      this.staticData[idx + 3] = norm[i * 3 + 0];
      this.staticData[idx + 4] = norm[i * 3 + 1];
      this.staticData[idx + 5] = norm[i * 3 + 2];
      this.staticData[idx + 6] = col[i * 3 + 0];
      this.staticData[idx + 7] = col[i * 3 + 1];
      this.staticData[idx + 8] = col[i * 3 + 2];
      this.staticData[idx + 9] = mat[i];
    }

    // --- 6. Set up 4 Cars ---
    // 2 driving South (-Z, x = -1.5)
    this.cars.push(
      { x: -1.5, z: 15.0, speed: -12.0, color: [0.8, 0.15, 0.15] }, // Red
      { x: -1.5, z: -55.0, speed: -10.5, color: [0.2, 0.4, 0.8] }  // Blue
    );
    // 2 driving North (+Z, x = -4.5)
    this.cars.push(
      { x: -4.5, z: -105.0, speed: 13.0, color: [0.85, 0.85, 0.85] }, // Silver
      { x: -4.5, z: -35.0, speed: 11.5, color: [0.15, 0.15, 0.18] }   // Black
    );

    // --- 7. Set up 12 Pedestrians ---
    const pedColors = [
      [0.2, 0.35, 0.6], [0.7, 0.2, 0.2], [0.3, 0.5, 0.3],
      [0.8, 0.6, 0.2], [0.4, 0.2, 0.4], [0.6, 0.6, 0.6],
    ];

    // 6 on East sidewalk (x ~ 1.5)
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      this.pedestrians.push({
        x: 1.2 + rand() * 1.0,
        z: -110.0 + i * 22.0 + rand() * 5.0,
        speed: dir * (1.2 + rand() * 0.4),
        color: pedColors[i % pedColors.length],
        phase: rand() * Math.PI * 2,
      });
    }
    // 6 on West sidewalk (x ~ -7.8)
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      this.pedestrians.push({
        x: -8.5 + rand() * 1.2,
        z: -110.0 + i * 22.0 + rand() * 5.0,
        speed: dir * (1.2 + rand() * 0.4),
        color: pedColors[(i + 3) % pedColors.length],
        phase: rand() * Math.PI * 2,
      });
    }

    // Allocate dynamic vertex buffer (boxes for cars & pedestrians)
    // 4 cars * (chassis + cabin + 2 headlights + 2 taillights = 6 boxes = 216 verts) = 864 verts
    // 12 peds * (torso + head = 2 boxes = 72 verts) = 864 verts
    // Total = 1,728 vertices * 10 floats = 17,280 floats
    this.dynamicVertexCount = (4 * 6 + 12 * 2) * 36;
    this.dynamicBuffer = new Float32Array(this.dynamicVertexCount * 10);

    this._updateDynamicBuffer();
  }

  _updateDynamicBuffer() {
    const pos = [];
    const norm = [];
    const col = [];
    const mat = [];

    // Cars
    for (const car of this.cars) {
      const { x, z, color, speed } = car;
      const isSouth = speed < 0; // facing -Z

      // Chassis: w=1.8, h=0.65, l=4.0
      addBox(pos, norm, col, mat, x - 0.9, 0.1, z - 2.0, x + 0.9, 0.75, z + 2.0, color, 5.0);
      // Cabin: w=1.4, h=0.6, l=2.2
      addBox(pos, norm, col, mat, x - 0.7, 0.75, z - 0.8, x + 0.7, 1.35, z + 1.2, [0.15, 0.18, 0.22], 5.0);

      // Headlights and Taillights
      if (isSouth) {
        // Headlights at -Z
        addBox(pos, norm, col, mat, x - 0.75, 0.35, z - 2.05, x - 0.45, 0.55, z - 2.0, [1.0, 0.98, 0.9], 6.0);
        addBox(pos, norm, col, mat, x + 0.45, 0.35, z - 2.05, x + 0.75, 0.55, z - 2.0, [1.0, 0.98, 0.9], 6.0);
        // Taillights at +Z
        addBox(pos, norm, col, mat, x - 0.75, 0.35, z + 2.0, x - 0.45, 0.55, z + 2.05, [0.95, 0.05, 0.02], 6.0);
        addBox(pos, norm, col, mat, x + 0.45, 0.35, z + 2.0, x + 0.75, 0.55, z + 2.05, [0.95, 0.05, 0.02], 6.0);
      } else {
        // Headlights at +Z
        addBox(pos, norm, col, mat, x - 0.75, 0.35, z + 2.0, x - 0.45, 0.55, z + 2.05, [1.0, 0.98, 0.9], 6.0);
        addBox(pos, norm, col, mat, x + 0.45, 0.35, z + 2.0, x + 0.75, 0.55, z + 2.05, [1.0, 0.98, 0.9], 6.0);
        // Taillights at -Z
        addBox(pos, norm, col, mat, x - 0.75, 0.35, z - 2.05, x - 0.45, 0.55, z - 2.0, [0.95, 0.05, 0.02], 6.0);
        addBox(pos, norm, col, mat, x + 0.45, 0.35, z - 2.05, x + 0.75, 0.55, z - 2.0, [0.95, 0.05, 0.02], 6.0);
      }
    }

    // Pedestrians
    for (const ped of this.pedestrians) {
      const { x, z, color, phase } = ped;
      const bob = Math.abs(Math.sin(phase)) * 0.04;
      const baseY = 0.15 + bob;

      // Torso / legs: w=0.45, h=0.9, d=0.28
      addBox(pos, norm, col, mat, x - 0.22, baseY, z - 0.14, x + 0.22, baseY + 0.9, z + 0.14, color, 7.0);
      // Head: w=0.22, h=0.24, d=0.22
      addBox(pos, norm, col, mat, x - 0.11, baseY + 0.92, z - 0.11, x + 0.11, baseY + 1.16, z + 0.11, [0.85, 0.72, 0.6], 7.0);
    }

    const count = pos.length / 3;
    for (let i = 0; i < count; i++) {
      const idx = i * 10;
      this.dynamicBuffer[idx + 0] = pos[i * 3 + 0];
      this.dynamicBuffer[idx + 1] = pos[i * 3 + 1];
      this.dynamicBuffer[idx + 2] = pos[i * 3 + 2];
      this.dynamicBuffer[idx + 3] = norm[i * 3 + 0];
      this.dynamicBuffer[idx + 4] = norm[i * 3 + 1];
      this.dynamicBuffer[idx + 5] = norm[i * 3 + 2];
      this.dynamicBuffer[idx + 6] = col[i * 3 + 0];
      this.dynamicBuffer[idx + 7] = col[i * 3 + 1];
      this.dynamicBuffer[idx + 8] = col[i * 3 + 2];
      this.dynamicBuffer[idx + 9] = mat[i];
    }
  }

  animate(dt) {
    // Animate cars
    for (const car of this.cars) {
      car.z += car.speed * dt;
      if (car.speed < 0 && car.z < -130.0) {
        car.z = 25.0;
      } else if (car.speed > 0 && car.z > 25.0) {
        car.z = -130.0;
      }
    }

    // Animate pedestrians
    for (const ped of this.pedestrians) {
      ped.z += ped.speed * dt;
      ped.phase += Math.abs(ped.speed) * dt * 4.0;
      if (ped.speed < 0 && ped.z < -130.0) {
        ped.z = 25.0;
      } else if (ped.speed > 0 && ped.z > 25.0) {
        ped.z = -130.0;
      }
    }

    this._updateDynamicBuffer();

    if (this.gl && this.dynamicVbo) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.dynamicVbo);
      this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, this.dynamicBuffer);
    }
  }

  init(gl) {
    this.gl = gl;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, STREET_VS);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error(`Street VS compile failed: ${gl.getShaderInfoLog(vs)}`);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, STREET_FS);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error(`Street FS compile failed: ${gl.getShaderInfoLog(fs)}`);
    }

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(`Street Program link failed: ${gl.getProgramInfoLog(this.program)}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uProj = gl.getUniformLocation(this.program, 'uProj');
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uNight = gl.getUniformLocation(this.program, 'uNight');
    this.uTime = gl.getUniformLocation(this.program, 'uTime');
    this.uEyePos = gl.getUniformLocation(this.program, 'uEyePos');

    const stride = 10 * 4; // 10 floats

    // Static VAO & VBO
    this.staticVao = gl.createVertexArray();
    gl.bindVertexArray(this.staticVao);

    this.staticVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.staticVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.staticData, gl.STATIC_DRAW);

    // layout: aPos (0, vec3), aNormal (1, vec3), aColor (2, vec3), aMaterial (3, float)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);

    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);

    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 36);

    // Dynamic VAO & VBO
    this.dynamicVao = gl.createVertexArray();
    gl.bindVertexArray(this.dynamicVao);

    this.dynamicVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynamicVbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.dynamicBuffer, gl.DYNAMIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);

    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 24);

    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 36);

    gl.bindVertexArray(null);
  }

  render(viewMatrix, projMatrix, isNight, time, eyePos = [0, 1.6, 0]) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    gl.useProgram(this.program);

    gl.uniformMatrix4fv(this.uView, false, viewMatrix);
    gl.uniformMatrix4fv(this.uProj, false, projMatrix);
    gl.uniformMatrix4fv(this.uModel, false, mat4Identity());
    gl.uniform1f(this.uNight, isNight ? 1.0 : 0.0);
    gl.uniform1f(this.uTime, time);
    gl.uniform3f(this.uEyePos, eyePos[0], eyePos[1], eyePos[2]);

    // Draw static world
    gl.bindVertexArray(this.staticVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.staticVertexCount);

    // Draw dynamic cars & pedestrians
    gl.bindVertexArray(this.dynamicVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.dynamicVertexCount);

    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;

    if (this.staticVbo) gl.deleteBuffer(this.staticVbo);
    if (this.staticVao) gl.deleteVertexArray(this.staticVao);
    if (this.dynamicVbo) gl.deleteBuffer(this.dynamicVbo);
    if (this.dynamicVao) gl.deleteVertexArray(this.dynamicVao);
    if (this.program) gl.deleteProgram(this.program);

    this.staticVbo = null;
    this.staticVao = null;
    this.dynamicVbo = null;
    this.dynamicVao = null;
    this.program = null;
  }
}
