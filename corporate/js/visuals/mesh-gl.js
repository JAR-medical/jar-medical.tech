// WebGL renderer for the drone demo's photogrammetry model: a textured mesh,
// a hidden-line wireframe of a lighter mesh and a coloured point cloud, all in
// the model's world coordinates. Cameras follow the OpenCV convention
// (x right, y down, z forward) so the real per-frame intrinsics and poses from
// the reconstruction project the model exactly onto the video. No libraries.
//
//   const r = createModelRenderer(canvas);        // r.ok === false without WebGL
//   r.setModel({ positions, uvs, normals, indices }, textureImage);
//   r.setWire({ positions, reveal, indices });     // line list
//   r.setPoints({ positions, colors, reveal });
//   r.render({ view, proj, W, H, dpr, modelAlpha, shade, light, wireAlpha, wireReveal, pointsAlpha, pointsReveal, pointSize });

const MESH_VS = `
attribute vec3 aPos;
attribute vec2 aUV;
attribute vec3 aNormal;
uniform mat4 uView;
uniform mat4 uProj;
varying vec2 vUV;
varying vec3 vN;
void main() {
  vUV = aUV;
  vN = aNormal;
  gl_Position = uProj * uView * vec4(aPos, 1.0);
}`;

const MESH_FS = `
precision mediump float;
uniform sampler2D uTex;
uniform float uAlpha;
uniform float uShade;
uniform vec3 uLight;
varying vec2 vUV;
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  float d = abs(dot(n, uLight));
  float light = mix(1.0, 0.72 + 0.45 * d, uShade);
  gl_FragColor = vec4(texture2D(uTex, vUV).rgb * light, uAlpha);
}`;

const LINE_VS = `
attribute vec3 aPos;
attribute float aReveal;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uBias;
varying float vReveal;
void main() {
  vReveal = aReveal;
  vec4 p = uProj * uView * vec4(aPos, 1.0);
  p.z -= uBias * p.w; // pull lines in front of the surface they lie on
  gl_Position = p;
}`;

const LINE_FS = `
precision mediump float;
uniform vec4 uColor;
uniform float uReveal;
varying float vReveal;
void main() {
  if (vReveal > uReveal) discard;
  float edge = smoothstep(uReveal, uReveal - 0.04, vReveal);
  gl_FragColor = vec4(uColor.rgb, uColor.a * edge);
}`;

const POINT_VS = `
attribute vec3 aPos;
attribute vec3 aColor;
attribute float aReveal;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uSize;
varying vec3 vColor;
varying float vReveal;
void main() {
  vColor = aColor;
  vReveal = aReveal;
  vec4 p = uProj * uView * vec4(aPos, 1.0);
  p.z -= 0.0004 * p.w;
  gl_Position = p;
  gl_PointSize = uSize;
}`;

const POINT_FS = `
precision mediump float;
uniform float uAlpha;
uniform float uReveal;
varying vec3 vColor;
varying float vReveal;
void main() {
  if (vReveal > uReveal) discard;
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(mix(vColor, vec3(0.56, 0.85, 0.75), 0.35), uAlpha);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error("mesh-gl: shader: " + gl.getShaderInfoLog(s));
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("mesh-gl: link: " + gl.getProgramInfoLog(p));
  const loc = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < n; i++) { const a = gl.getActiveAttrib(p, i); loc[a.name] = gl.getAttribLocation(p, a.name); }
  const m = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < m; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
  return { p, loc };
}

export function createModelRenderer(canvas) {
  let gl = null;
  try {
    gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
  } catch { gl = null; }
  if (!gl) return { ok: false, reason: "webgl" };
  const uint = gl.getExtension("OES_element_index_uint");
  if (!uint) return { ok: false, reason: "uint-index" };

  let mesh, line, point;
  try {
    mesh = program(gl, MESH_VS, MESH_FS);
    line = program(gl, LINE_VS, LINE_FS);
    point = program(gl, POINT_VS, POINT_FS);
  } catch (e) {
    console.warn(e);
    return { ok: false, reason: "shader" };
  }
  const buffers = [];
  const buf = (target, data) => {
    const b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    buffers.push(b);
    return b;
  };
  const tex = gl.createTexture();
  let model = null, wire = null, cloud = null;

  function attrib(prog, name, b, size) {
    const l = prog.loc[name];
    if (l == null || l < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
  }
  function attribU8(prog, name, b, size) {
    const l = prog.loc[name];
    if (l == null || l < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.enableVertexAttribArray(l);
    gl.vertexAttribPointer(l, size, gl.UNSIGNED_BYTE, true, 0, 0);
  }
  function release(prog) {
    for (const k of Object.keys(prog.loc)) {
      const l = prog.loc[k];
      if (typeof l === "number" && l >= 0) gl.disableVertexAttribArray(l);
    }
  }
  function drawModel(alpha, shade, light, view, proj, colorWrite) {
    gl.useProgram(mesh.p);
    gl.uniformMatrix4fv(mesh.loc.uView, false, view);
    gl.uniformMatrix4fv(mesh.loc.uProj, false, proj);
    gl.uniform1f(mesh.loc.uAlpha, alpha);
    gl.uniform1f(mesh.loc.uShade, shade);
    gl.uniform3fv(mesh.loc.uLight, light);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(mesh.loc.uTex, 0);
    attrib(mesh, "aPos", model.pos, 3);
    attrib(mesh, "aUV", model.uv, 2);
    attrib(mesh, "aNormal", model.nrm, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.idx);
    gl.colorMask(colorWrite, colorWrite, colorWrite, colorWrite);
    gl.drawElements(gl.TRIANGLES, model.count, gl.UNSIGNED_INT, 0);
    gl.colorMask(true, true, true, true);
    release(mesh);
  }

  return {
    ok: true,
    get hasModel() { return !!model; },
    setModel({ positions, uvs, normals, indices }, image) {
      model = { pos: buf(gl.ARRAY_BUFFER, positions), uv: buf(gl.ARRAY_BUFFER, uvs), nrm: buf(gl.ARRAY_BUFFER, normals), idx: buf(gl.ELEMENT_ARRAY_BUFFER, indices), count: indices.length };
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      const pow2 = (v) => (v & (v - 1)) === 0;
      if (pow2(image.width) && pow2(image.height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    },
    setWire({ positions, reveal, indices }) {
      wire = { pos: buf(gl.ARRAY_BUFFER, positions), rev: buf(gl.ARRAY_BUFFER, reveal), idx: buf(gl.ELEMENT_ARRAY_BUFFER, indices), count: indices.length };
    },
    setPoints({ positions, colors, reveal }) {
      cloud = { pos: buf(gl.ARRAY_BUFFER, positions), col: buf(gl.ARRAY_BUFFER, colors), rev: buf(gl.ARRAY_BUFFER, reveal), count: positions.length / 3 };
    },
    render(o) {
      const { view, proj, W, H, dpr } = o;
      const bw = Math.max(1, Math.round(W * dpr)), bh = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      gl.viewport(0, 0, bw, bh);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (model) {
        // Visible model, or a depth-only pass so the wireframe hides what the
        // camera cannot see.
        if (o.modelAlpha > 0) drawModel(o.modelAlpha, o.shade ?? 0, o.light ?? [0, 1, 0], view, proj, true);
        else if (o.wireAlpha > 0 || o.pointsAlpha > 0) drawModel(1, 0, [0, 1, 0], view, proj, false);
      }
      if (cloud && o.pointsAlpha > 0) {
        gl.useProgram(point.p);
        gl.uniformMatrix4fv(point.loc.uView, false, view);
        gl.uniformMatrix4fv(point.loc.uProj, false, proj);
        gl.uniform1f(point.loc.uSize, (o.pointSize ?? 2) * dpr);
        gl.uniform1f(point.loc.uAlpha, o.pointsAlpha);
        gl.uniform1f(point.loc.uReveal, o.pointsReveal ?? 1);
        attrib(point, "aPos", cloud.pos, 3);
        attribU8(point, "aColor", cloud.col, 3);
        attrib(point, "aReveal", cloud.rev, 1);
        gl.drawArrays(gl.POINTS, 0, cloud.count);
        release(point);
      }
      if (wire && o.wireAlpha > 0) {
        gl.useProgram(line.p);
        gl.uniformMatrix4fv(line.loc.uView, false, view);
        gl.uniformMatrix4fv(line.loc.uProj, false, proj);
        gl.uniform1f(line.loc.uBias, o.wireBias ?? 0.0008);
        const c = o.wireColor ?? [0.56, 0.85, 0.75];
        gl.uniform4f(line.loc.uColor, c[0], c[1], c[2], o.wireAlpha);
        gl.uniform1f(line.loc.uReveal, o.wireReveal ?? 1);
        attrib(line, "aPos", wire.pos, 3);
        attrib(line, "aReveal", wire.rev, 1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wire.idx);
        gl.drawElements(gl.LINES, wire.count, gl.UNSIGNED_INT, 0);
        release(line);
      }
    },
    dispose() {
      buffers.forEach((b) => gl.deleteBuffer(b));
      gl.deleteTexture(tex);
      [mesh, line, point].forEach((x) => gl.deleteProgram(x.p));
    },
    // Frees everything and hands the context back to the browser.
    destroy() {
      this.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

// ---------------------------------------------------------------------------
// Camera math (column-major 4×4 for WebGL, OpenCV camera convention).

// Projection for a pinhole camera with pixel intrinsics on an image of w×h.
export function projectionFromIntrinsics(fx, fy, cx, cy, w, h, near, far) {
  const A = (far + near) / (far - near), B = (-2 * far * near) / (far - near);
  return new Float32Array([
    (2 * fx) / w, 0, 0, 0,
    0, (-2 * fy) / h, 0, 0,
    (2 * cx) / w - 1, 1 - (2 * cy) / h, A, 1,
    0, 0, B, 0,
  ]);
}

// World→camera matrix from a rotation matrix R (rows = camera axes in world
// coordinates) and the camera centre c.
export function viewFromAxes(R, c) {
  const tx = -(R[0][0] * c[0] + R[0][1] * c[1] + R[0][2] * c[2]);
  const ty = -(R[1][0] * c[0] + R[1][1] * c[1] + R[1][2] * c[2]);
  const tz = -(R[2][0] * c[0] + R[2][1] * c[1] + R[2][2] * c[2]);
  return new Float32Array([
    R[0][0], R[1][0], R[2][0], 0,
    R[0][1], R[1][1], R[2][1], 0,
    R[0][2], R[1][2], R[2][2], 0,
    tx, ty, tz, 1,
  ]);
}

export const vec = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

// Camera axes (rows: right, down, forward) looking from eye at target.
export function lookAtAxes(eye, target, up) {
  const z = vec.norm(vec.sub(target, eye));
  let x = vec.cross(z, up);
  if (Math.hypot(...x) < 1e-6) x = vec.cross(z, [up[1], up[2], up[0]]);
  x = vec.norm(x);
  const y = vec.cross(z, x);
  return [x, y, z];
}

// Rotation matrix (rows) ↔ unit quaternion [x, y, z, w].
export function quatFromAxes(R) {
  const m00 = R[0][0], m01 = R[0][1], m02 = R[0][2], m10 = R[1][0], m11 = R[1][1], m12 = R[1][2], m20 = R[2][0], m21 = R[2][1], m22 = R[2][2];
  const tr = m00 + m11 + m22;
  let x, y, z, w;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4; }
  const l = Math.hypot(x, y, z, w);
  return [x / l, y / l, z / l, w / l];
}

export function axesFromQuat([x, y, z, w]) {
  return [
    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
  ];
}

export function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bb = b;
  if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
  if (d > 0.9995) {
    const r = a.map((v, i) => v + (bb[i] - v) * t);
    const l = Math.hypot(...r);
    return r.map((v) => v / l);
  }
  const th = Math.acos(d), s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((v, i) => wa * v + wb * bb[i]);
}
