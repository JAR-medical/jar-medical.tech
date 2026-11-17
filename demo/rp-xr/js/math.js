// Pure vector / matrix / angle helpers. WebXR conventions everywhere:
// right-handed, -Z forward, +X right, +Y up. Matrices are column-major
// Float32Array(16) (WebXR/WebGL native). Angles in DEGREES at every API
// boundary. No DOM, no WebGL: importable in node.
//
// Functions that produce a matrix accept an optional `out` as the last
// argument (allocation-free use in the render loop); without it a new
// Float32Array is returned.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export const deg2rad = d => d * D2R;
export const rad2deg = r => r * R2D;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ---- angles ----------------------------------------------------------

// Direction -> { az, el } in degrees.
//   az = atan2(x, -z): 0 straight ahead, +90 right, ±180 behind
//   el = atan2(y, hypot(x, z)): +90 straight up, -90 straight down
// The input need not be unit length. Straight up/down (x = z = 0) has no
// defined azimuth; az = 0 is returned. Signed zeros are normalised so
// the result never flips to ±180 for a forward-ish vector with -0.
export function dirToAngles(v) {
  const x = v[0] + 0, y = v[1] + 0, z = v[2] + 0;
  const h = Math.hypot(x, z);
  const el = Math.atan2(y, h) * R2D;
  if (h < 1e-12) return { az: 0, el: y > 0 ? 90 : y < 0 ? -90 : 0 };
  return { az: Math.atan2(x, -z + 0) * R2D, el };
}

// { az, el } degrees -> unit [x, y, z]; inverse of dirToAngles.
export function anglesToDir(az, el) {
  const a = az * D2R, e = el * D2R;
  const ce = Math.cos(e);
  return [ce * Math.sin(a), Math.sin(e), -ce * Math.cos(a)];
}

// ---- vec3 ------------------------------------------------------------

export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0]];
}

export function length(v) { return Math.hypot(v[0], v[1], v[2]); }

// Unit vector; the zero vector (or non-finite input) yields [0, 0, -1]
// (straight ahead) rather than NaNs.
export function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  if (!(l > 1e-12) || !Number.isFinite(l)) return [0, 0, -1];
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Angle between two directions, degrees (robust near 0 and 180).
export function angleBetween(a, b) {
  return Math.atan2(length(cross(a, b)), dot(a, b)) * R2D;
}

// ---- quaternions [x, y, z, w] ----------------------------------------

export function quatConjugate(q) { return [-q[0], -q[1], -q[2], q[3]]; }

// Hamilton product a * b (apply b first, then a).
export function quatMultiply(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by,
          aw * by - ax * bz + ay * bw + az * bx,
          aw * bz + ax * by - ay * bx + az * bw,
          aw * bw - ax * bx - ay * by - az * bz];
}

// Rotate vec3 v by unit quaternion q: v' = q v q*.
export function quatRotate(q, v) {
  const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  // t = 2 * (q.xyz x v)
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  // v' = v + w t + q.xyz x t
  return [v[0] + qw * tx + (qy * tz - qz * ty),
          v[1] + qw * ty + (qz * tx - qx * tz),
          v[2] + qw * tz + (qx * ty - qy * tx)];
}

export function quatFromAxisAngle(axis, deg) {
  const n = normalize(axis), h = deg * D2R / 2, s = Math.sin(h);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(h)];
}

// ---- mat4 (column-major) ---------------------------------------------

export function mat4Identity(out = new Float32Array(16)) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

// out = a * b (b applied first). `out` may alias a or b.
export function mat4Multiply(a, b, out = new Float32Array(16)) {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4]     = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    out[c * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    out[c * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    out[c * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
  }
  return out;
}

// General 4x4 inverse. Returns null if the matrix is singular (|det|
// below 1e-20). `out` may alias m.
export function mat4Invert(m, out = new Float32Array(16)) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-20) return null;
  const id = 1 / det;
  out[0]  = (a11 * b11 - a12 * b10 + a13 * b09) * id;
  out[1]  = (a02 * b10 - a01 * b11 - a03 * b09) * id;
  out[2]  = (a31 * b05 - a32 * b04 + a33 * b03) * id;
  out[3]  = (a22 * b04 - a21 * b05 - a23 * b03) * id;
  out[4]  = (a12 * b08 - a10 * b11 - a13 * b07) * id;
  out[5]  = (a00 * b11 - a02 * b08 + a03 * b07) * id;
  out[6]  = (a32 * b02 - a30 * b05 - a33 * b01) * id;
  out[7]  = (a20 * b05 - a22 * b02 + a23 * b01) * id;
  out[8]  = (a10 * b10 - a11 * b08 + a13 * b06) * id;
  out[9]  = (a01 * b08 - a00 * b10 - a03 * b06) * id;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * id;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * id;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * id;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * id;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * id;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * id;
  return out;
}

// OpenGL-style perspective (clip z in [-w, w]). far may be Infinity.
export function mat4Perspective(fovYdeg, aspect, near, far, out = new Float32Array(16)) {
  const f = 1 / Math.tan(fovYdeg * D2R / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[11] = -1;
  if (far === Infinity || far == null) {
    out[10] = -1;
    out[14] = -2 * near;
  } else {
    const nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  }
  return out;
}

// Camera WORLD transform (camera -> world, NOT the view matrix; invert it
// for that). Yaw/pitch follow the az/el convention of dirToAngles: the
// camera looks along anglesToDir(yawDeg, pitchDeg) — positive yaw turns
// RIGHT, positive pitch looks UP. No roll; camera up stays in the
// vertical plane. M = T(pos) * Ry(-yaw) * Rx(pitch).
export function mat4FromYawPitch(yawDeg, pitchDeg, pos = [0, 0, 0], out = new Float32Array(16)) {
  const y = -yawDeg * D2R, p = pitchDeg * D2R;
  const cy = Math.cos(y), sy = Math.sin(y), cp = Math.cos(p), sp = Math.sin(p);
  // Ry(y) * Rx(p), columns:
  // X axis: ( cy, 0, -sy)
  // Y axis: ( sy*sp, cp, cy*sp)
  // Z axis: ( sy*cp, -sp, cy*cp)
  out[0] = cy;       out[1] = 0;   out[2] = -sy;      out[3] = 0;
  out[4] = sy * sp;  out[5] = cp;  out[6] = cy * sp;  out[7] = 0;
  out[8] = sy * cp;  out[9] = -sp; out[10] = cy * cp; out[11] = 0;
  out[12] = pos[0];  out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
  return out;
}

export function mat4Translation(x, y, z, out = new Float32Array(16)) {
  mat4Identity(out);
  out[12] = x; out[13] = y; out[14] = z;
  return out;
}

// T(pos) * S(scale) — axis-aligned box placement.
export function mat4TranslateScale(pos, scale, out = new Float32Array(16)) {
  out.fill(0);
  out[0] = scale[0]; out[5] = scale[1]; out[10] = scale[2];
  out[12] = pos[0]; out[13] = pos[1]; out[14] = pos[2]; out[15] = 1;
  return out;
}

// Upper 3x3 * v (direction transform; ignores translation).
export function mat4TransformDir(m, v) {
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
          m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
          m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
}

// Full affine/projective point transform with perspective divide.
export function mat4TransformPoint(m, v) {
  const x = v[0], y = v[1], z = v[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const iw = w !== 0 ? 1 / w : 1;
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) * iw,
          (m[1] * x + m[5] * y + m[9] * z + m[13]) * iw,
          (m[2] * x + m[6] * y + m[10] * z + m[14]) * iw];
}

// ---- deterministic PRNG -----------------------------------------------

// mulberry32: tiny, fast, deterministic 32-bit PRNG; returns () => [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
