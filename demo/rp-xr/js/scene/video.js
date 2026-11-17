// Curved-screen geometry and dark room for the video scene.
// Cylinder segment: radius 4 m, 150° arc, height from the video aspect,
// centre at eye height 1.6 m facing -Z.
// Dark room around it (floor + dim dome).
// Video texture: black until readyState >= 2.

import { mat4Identity } from '../math.js';
import { VIDEO_VS, VIDEO_FS } from '../shaders/scene.js';

export class VideoScene {
  constructor() {
    this.gl = null;
    this.program = null;
    this.videoEl = null;
    this.videoTexture = null;
    this.hasCallback = false;
    this.frameChanged = false;

    this.currentAspect = 16 / 9;
    this.screenVao = null;
    this.screenVbo = null;
    this.screenIbo = null;
    this.screenIndexCount = 0;

    this.roomVao = null;
    this.roomVbo = null;
    this.roomVertexCount = 0;
  }

  setVideo(videoEl) {
    this.videoEl = videoEl;
    this.frameChanged = true;

    if (this.videoEl && typeof this.videoEl.requestVideoFrameCallback === 'function') {
      const onFrame = () => {
        this.frameChanged = true;
        if (this.videoEl && typeof this.videoEl.requestVideoFrameCallback === 'function') {
          this.videoEl.requestVideoFrameCallback(onFrame);
        }
      };
      this.videoEl.requestVideoFrameCallback(onFrame);
      this.hasCallback = true;
    } else {
      this.hasCallback = false;
    }
  }

  init(gl) {
    this.gl = gl;

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, VIDEO_VS);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error(`Video VS compile failed: ${gl.getShaderInfoLog(vs)}`);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, VIDEO_FS);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error(`Video FS compile failed: ${gl.getShaderInfoLog(fs)}`);
    }

    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error(`Video Program link failed: ${gl.getProgramInfoLog(this.program)}`);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    this.uView = gl.getUniformLocation(this.program, 'uView');
    this.uProj = gl.getUniformLocation(this.program, 'uProj');
    this.uModel = gl.getUniformLocation(this.program, 'uModel');
    this.uVideoTex = gl.getUniformLocation(this.program, 'uVideoTex');
    this.uIsScreen = gl.getUniformLocation(this.program, 'uIsScreen');

    // Create 1x1 black video texture
    this.videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 255])
    );

    this._buildScreenMesh(this.currentAspect);
    this._buildRoomMesh();
  }

  _buildScreenMesh(aspect) {
    const gl = this.gl;
    if (!gl) return;

    this.currentAspect = aspect;
    const radius = 4.0;
    const arcDeg = 150.0;
    const arcRad = (arcDeg * Math.PI) / 180.0;
    const arcLength = radius * arcRad;
    const height = arcLength / Math.max(0.1, aspect);
    const eyeH = 1.6;
    const yMin = eyeH - height * 0.5;
    const yMax = eyeH + height * 0.5;

    const hSegs = 32;
    const vSegs = 8;
    const vertices = [];
    const indices = [];

    // Vertex layout: [x, y, z, u, v]
    for (let j = 0; j <= vSegs; j++) {
      const v = j / vSegs;
      const y = yMin + v * (yMax - yMin);

      for (let i = 0; i <= hSegs; i++) {
        const u = i / hSegs;
        // From -75° to +75° around Y axis: theta = 0 faces -Z
        const theta = (u - 0.5) * arcRad;
        const x = radius * Math.sin(theta);
        const z = -radius * Math.cos(theta);

        // Uploaded video is top-down (v=0 top, v=1 bottom if un-flipped),
        // or standard UV: u left->right, v bottom->top
        vertices.push(x, y, z, u, 1.0 - v);
      }
    }

    for (let j = 0; j < vSegs; j++) {
      for (let i = 0; i < hSegs; i++) {
        const p0 = j * (hSegs + 1) + i;
        const p1 = p0 + 1;
        const p2 = (j + 1) * (hSegs + 1) + i;
        const p3 = p2 + 1;

        indices.push(p0, p2, p1);
        indices.push(p1, p2, p3);
      }
    }

    this.screenIndexCount = indices.length;

    if (!this.screenVao) {
      this.screenVao = gl.createVertexArray();
      this.screenVbo = gl.createBuffer();
      this.screenIbo = gl.createBuffer();
    }

    gl.bindVertexArray(this.screenVao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.screenVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.screenIbo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    // aPos (0, vec3), aUV (1, vec2), stride = 5 floats = 20 bytes
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

    gl.bindVertexArray(null);
  }

  _buildRoomMesh() {
    const gl = this.gl;
    if (!gl) return;

    const vertices = [];

    // Dark room floor: quad at y = 0, x in [-20, 20], z in [-20, 20]
    const floorPts = [
      [-20, 0, 20, 0, 0],
      [20, 0, 20, 1, 0],
      [20, 0, -20, 1, 1],
      [-20, 0, 20, 0, 0],
      [20, 0, -20, 1, 1],
      [-20, 0, -20, 0, 1],
    ];
    for (const pt of floorPts) {
      vertices.push(...pt);
    }

    // Dim dome: hemisphere (radius 25 m)
    const domeR = 25.0;
    const slices = 16;
    const stacks = 8;
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

        const p00 = [Math.cos(th1) * r1, y1, Math.sin(th1) * r1, 0, 0];
        const p10 = [Math.cos(th2) * r1, y1, Math.sin(th2) * r1, 1, 0];
        const p01 = [Math.cos(th1) * r2, y2, Math.sin(th1) * r2, 0, 1];
        const p11 = [Math.cos(th2) * r2, y2, Math.sin(th2) * r2, 1, 1];

        // Triangle 1: p00, p01, p10
        vertices.push(...p00, ...p01, ...p10);
        // Triangle 2: p10, p01, p11
        vertices.push(...p10, ...p01, ...p11);
      }
    }

    this.roomVertexCount = vertices.length / 5;

    this.roomVao = gl.createVertexArray();
    this.roomVbo = gl.createBuffer();

    gl.bindVertexArray(this.roomVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.roomVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);

    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);

    gl.bindVertexArray(null);
  }

  updateVideoTexture() {
    const gl = this.gl;
    if (!gl || !this.videoEl || !this.videoTexture) return;

    if (this.videoEl.readyState >= 2) {
      if (!this.hasCallback || this.frameChanged) {
        gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          this.videoEl
        );
        this.frameChanged = false;

        // Check if aspect ratio changed
        if (this.videoEl.videoWidth > 0 && this.videoEl.videoHeight > 0) {
          const aspect = this.videoEl.videoWidth / this.videoEl.videoHeight;
          if (Math.abs(aspect - this.currentAspect) > 0.02) {
            this._buildScreenMesh(aspect);
          }
        }
      }
    }
  }

  render(viewMatrix, projMatrix) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uView, false, viewMatrix);
    gl.uniformMatrix4fv(this.uProj, false, projMatrix);
    gl.uniformMatrix4fv(this.uModel, false, mat4Identity());

    // 1. Draw dark room (uIsScreen = 0.0)
    gl.uniform1f(this.uIsScreen, 0.0);
    gl.bindVertexArray(this.roomVao);
    gl.drawArrays(gl.TRIANGLES, 0, this.roomVertexCount);

    // 2. Draw curved video screen (uIsScreen = 1.0)
    gl.uniform1f(this.uIsScreen, 1.0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(this.uVideoTex, 0);

    gl.bindVertexArray(this.screenVao);
    gl.drawElements(gl.TRIANGLES, this.screenIndexCount, gl.UNSIGNED_SHORT, 0);

    gl.bindVertexArray(null);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;

    if (this.videoTexture) gl.deleteTexture(this.videoTexture);
    if (this.screenVbo) gl.deleteBuffer(this.screenVbo);
    if (this.screenIbo) gl.deleteBuffer(this.screenIbo);
    if (this.screenVao) gl.deleteVertexArray(this.screenVao);
    if (this.roomVbo) gl.deleteBuffer(this.roomVbo);
    if (this.roomVao) gl.deleteVertexArray(this.roomVao);
    if (this.program) gl.deleteProgram(this.program);

    this.videoTexture = null;
    this.screenVbo = null;
    this.screenIbo = null;
    this.screenVao = null;
    this.roomVbo = null;
    this.roomVao = null;
    this.program = null;
  }
}
