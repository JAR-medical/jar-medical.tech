// RPRenderer — the central renderer contract for RP-XR.
// Raw WebGL2, two passes:
//   Pass 1: Scene pass -> offscreen FBO (sized to viewport, skipped in AR)
//   Pass 2: RP pass -> fullscreen triangle into target framebuffer
//
// Matches the "Renderer contract" in SPEC.md exactly.

import { SOURCES, RP_VERTEX } from './shaders/chunks.js';
import { stitchShader } from './stitch.js';
import { FIELD, QUALIA, PANEL } from './config.js';
import { mat4Invert, normalize } from './math.js';
import { StreetScene } from './scene/street.js';
import { VideoScene } from './scene/video.js';
import { Hud } from './hud.js';

const UNIFORM_NAMES = [
  'uScene',
  'uTime',
  'uInvProj',
  'uProj',
  'uGazeDir',
  'uBypass',
  'uEdgeBase',
  'uNetDensity',
  'uSeeThru',
  'uNetScale',
  'uNetWarp',
  'uNetFlicker',
  'uOuterEdge',
  'uOuterCover',
  'uIslandSeed',
  'uSparkleFlicker',
  'uSparkleBandIn',
  'uEdgeScale',
  'uSparkleBandOut',
  'uPanelPos',
  'uPanelW',
  'uPanelAspect',
  'uPanelZoom',
  'uPanelFocus',
  'uPanelGain',
  'uPanelOpaque',
  'uPanelHi',
  'uPanelSee',
  'uNightThresh',
  'uNightKnee',
  'uHudTex',
  'uHudAlpha',
  'uHudRect',
  'uTargetCount',
  'uTargetDir',
  'uTargetStyle',
  'uCursor',
];

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const infoLog = gl.getShaderInfoLog(shader) || 'Unknown compilation error';
    gl.deleteShader(shader);
    const sourceWithLines = source
      .split('\n')
      .map((line, idx) => `${String(idx + 1).padStart(4, ' ')}: ${line}`)
      .join('\n');
    throw new Error(`Shader compile failed:\n${infoLog}\n\nStitched source:\n${sourceWithLines}`);
  }
  return shader;
}

function linkProgram(gl, vs, fs) {
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const infoLog = gl.getProgramInfoLog(prog) || 'Unknown link error';
    gl.deleteProgram(prog);
    throw new Error(`Program link failed:\n${infoLog}`);
  }
  return prog;
}

export class RPRenderer {
  constructor(gl) {
    this.gl = gl;
    this.mode = 'vr'; // 'vr' | 'ar' | 'desktop'
    this.sceneName = 'street'; // 'street' | 'video'
    this.videoEl = null;
    this.isNight = false;
    this.reduceFlashing = false;
    this.panelHighlight = false;

    this.time = 0;
    this.dt = 0;

    this.streetScene = new StreetScene();
    this.videoScene = new VideoScene();
    this.hud = new Hud(gl);

    this.rpProg = null;
    this.rpUniforms = {};

    this.quadVao = null;
    this.quadVbo = null;

    this.sceneFbo = null;
    this.sceneColorTex = null;
    this.sceneDepthRb = null;
    this.fboWidth = 0;
    this.fboHeight = 0;

    this.invProjTemp = new Float32Array(16);
    this.targetDirBuffer = new Float32Array(27);
    this.targetStyleBuffer = new Float32Array(36);
  }

  async init() {
    const gl = this.gl;
    if (!gl) return;

    // Build scene meshes
    this.streetScene.init(gl);
    this.videoScene.init(gl);
    this.hud.init();

    // Build fullscreen quad for RP pass
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);

    this.quadVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
    // Fullscreen single triangle covering [-1, 1] in NDC
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    // Initial compile of RP program
    this.restitch();
  }

  setMode(mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.restitch();
    }
  }

  setScene(sceneName) {
    this.sceneName = sceneName;
  }

  setVideo(videoEl) {
    this.videoEl = videoEl;
    this.videoScene.setVideo(videoEl);
  }

  setNight(bool) {
    this.isNight = Boolean(bool);
  }

  setReduceFlashing(bool) {
    this.reduceFlashing = Boolean(bool);
  }

  restitch() {
    const gl = this.gl;
    if (!gl) return;

    const fsSource = stitchShader(SOURCES, QUALIA, FIELD, PANEL, this.mode);
    const vs = compileShader(gl, gl.VERTEX_SHADER, RP_VERTEX);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const newProg = linkProgram(gl, vs, fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    // Delete old program
    if (this.rpProg) {
      gl.deleteProgram(this.rpProg);
    }

    this.rpProg = newProg;
    this.rpUniforms = {};
    for (const name of UNIFORM_NAMES) {
      this.rpUniforms[name] = gl.getUniformLocation(newProg, name);
    }
  }

  beginFrame(timeSec, dtSec) {
    this.time = timeSec;
    this.dt = dtSec;

    this.hud.update(dtSec);

    // Animate street
    this.streetScene.animate(dtSec);

    // Video texture upload once per frame if video scene
    if (this.sceneName === 'video') {
      this.videoScene.updateVideoTexture();
    }
  }

  _checkFbo(width, height) {
    if (this.fboWidth === width && this.fboHeight === height && this.sceneFbo) {
      return;
    }
    const gl = this.gl;

    if (this.sceneFbo) {
      gl.deleteFramebuffer(this.sceneFbo);
      gl.deleteTexture(this.sceneColorTex);
      gl.deleteRenderbuffer(this.sceneDepthRb);
      this.sceneFbo = null;
      this.sceneColorTex = null;
      this.sceneDepthRb = null;
    }

    this.fboWidth = width;
    this.fboHeight = height;

    this.sceneFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);

    this.sceneColorTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.sceneColorTex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.sceneColorTex,
      0
    );

    this.sceneDepthRb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.sceneDepthRb);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      this.sceneDepthRb
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`FBO reallocation failed: status ${status}`);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  renderView({
    viewMatrix,
    projectionMatrix,
    viewport,
    framebuffer = null,
    gazeDirView = [0, 0, -1],
    bypass = false,
    targets = null,
    gazeCursor = false,
  }) {
    const gl = this.gl;
    if (!gl) return;

    const vpW = Math.max(1, Math.floor(viewport.width));
    const vpH = Math.max(1, Math.floor(viewport.height));
    const isAR = this.mode === 'ar';

    // -------------------------------------------------------------
    // Pass 1: Scene Pass (Offscreen FBO) — skipped in AR
    // -------------------------------------------------------------
    if (!isAR) {
      this._checkFbo(vpW, vpH);

      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFbo);
      gl.viewport(0, 0, vpW, vpH);
      gl.scissor(0, 0, vpW, vpH);
      gl.enable(gl.SCISSOR_TEST);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
      // the previous RP pass left this FBO's colour texture bound; any draw
      // that samples unit 0/1 before binding its own texture would be a
      // feedback loop (INVALID_OPERATION — the video room was silently lost)
      for (const unit of [gl.TEXTURE0, gl.TEXTURE1]) {
        gl.activeTexture(unit);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }
      gl.activeTexture(gl.TEXTURE0);

      // the video room is dark; the street clears to its sky
      if (this.isNight || this.sceneName === 'video') {
        gl.clearColor(0.015, 0.02, 0.04, 1.0);
      } else {
        gl.clearColor(0.68, 0.78, 0.90, 1.0);
      }
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      if (this.sceneName === 'video') {
        // the curved screen and the room dome are seen from INSIDE: their
        // winding faces away from the viewer, so culling removed both
        gl.disable(gl.CULL_FACE);
        this.videoScene.render(viewMatrix, projectionMatrix);
      } else {
        this.streetScene.render(viewMatrix, projectionMatrix, this.isNight, this.time);
      }
    }

    // -------------------------------------------------------------
    // Pass 2: Retinitis Pigmentosa Pass (RP Pass)
    // -------------------------------------------------------------
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.viewport(viewport.x, viewport.y, vpW, vpH);
    gl.scissor(viewport.x, viewport.y, vpW, vpH);
    gl.enable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);

    if (isAR) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      gl.disable(gl.BLEND);
    }

    gl.useProgram(this.rpProg);
    const U = this.rpUniforms;

    // Textures:
    // Unit 0: Scene FBO (when not in AR)
    if (!isAR && this.sceneColorTex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sceneColorTex);
      if (U.uScene) gl.uniform1i(U.uScene, 0);
    }

    // Unit 1: HUD texture
    this.hud.bind(1);
    if (U.uHudTex) gl.uniform1i(U.uHudTex, 1);
    if (U.uHudAlpha) gl.uniform1f(U.uHudAlpha, this.hud.getAlpha());
    if (U.uHudRect) {
      const hr = this.hud.getRect();
      gl.uniform4f(U.uHudRect, hr[0], hr[1], hr[2], hr[3]);
    }

    // Core uniforms:
    if (U.uTime) gl.uniform1f(U.uTime, this.time);
    if (U.uProj) gl.uniformMatrix4fv(U.uProj, false, projectionMatrix);
    if (U.uInvProj) {
      const invProj = mat4Invert(projectionMatrix, this.invProjTemp);
      if (invProj) {
        gl.uniformMatrix4fv(U.uInvProj, false, invProj);
      }
    }
    if (U.uGazeDir) {
      const g = normalize(gazeDirView);
      gl.uniform3f(U.uGazeDir, g[0], g[1], g[2]);
    }
    if (U.uBypass) gl.uniform1f(U.uBypass, bypass ? 1.0 : 0.0);

    // Apply qualia uniforms
    this._applyQualia(U);
    this._applyField(U);
    this._applyPanel(U);

    // Calibration targets (up to 9)
    const tCount = targets ? Math.min(9, targets.length) : 0;
    if (U.uTargetCount) gl.uniform1i(U.uTargetCount, tCount);
    if (tCount > 0) {
      this.targetDirBuffer.fill(0);
      this.targetStyleBuffer.fill(0);
      for (let i = 0; i < tCount; i++) {
        const t = targets[i];
        const dir = normalize(t.dirView || [0, 0, -1]);
        this.targetDirBuffer[i * 3 + 0] = dir[0];
        this.targetDirBuffer[i * 3 + 1] = dir[1];
        this.targetDirBuffer[i * 3 + 2] = dir[2];

        const c = t.color || [1.0, 1.0, 1.0];
        const rad = t.radiusDeg ?? 1.0;
        this.targetStyleBuffer[i * 4 + 0] = c[0];
        this.targetStyleBuffer[i * 4 + 1] = c[1];
        this.targetStyleBuffer[i * 4 + 2] = c[2];
        this.targetStyleBuffer[i * 4 + 3] = rad;
      }
      if (U.uTargetDir) gl.uniform3fv(U.uTargetDir, this.targetDirBuffer);
      if (U.uTargetStyle) gl.uniform4fv(U.uTargetStyle, this.targetStyleBuffer);
    }

    // Gaze debug cursor
    if (U.uCursor) gl.uniform1f(U.uCursor, gazeCursor ? 1.0 : 0.0);

    // Draw fullscreen triangle
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  _applyQualia(U) {
    const gl = this.gl;
    const qualia = QUALIA;

    if (qualia.photopsia?.params) {
      const net = qualia.photopsia.params;
      if (U.uNetDensity) gl.uniform1f(U.uNetDensity, net.density.value);
      if (U.uNetScale) gl.uniform1f(U.uNetScale, net.scale.value);
      if (U.uNetWarp) gl.uniform1f(U.uNetWarp, net.messiness.value);
      const fHz = this.reduceFlashing ? 0 : net.flickerHz.value;
      if (U.uNetFlicker) gl.uniform1f(U.uNetFlicker, 2 * Math.PI * fHz);
    }

    if (qualia.murk?.params) {
      if (U.uSeeThru) gl.uniform1f(U.uSeeThru, qualia.murk.params.transparency.value);
    }

    if (qualia.sparkle?.params) {
      const spk = qualia.sparkle.params;
      const fHz = this.reduceFlashing ? 0 : spk.flickerHz.value;
      if (U.uSparkleFlicker) gl.uniform1f(U.uSparkleFlicker, 2 * Math.PI * fHz);
      const es = FIELD.edgeScale;
      if (U.uSparkleBandIn) gl.uniform2f(U.uSparkleBandIn, spk.bandIn.value[0] * es, spk.bandIn.value[1] * es);
      if (U.uSparkleBandOut) gl.uniform2f(U.uSparkleBandOut, spk.bandOut.value[0] * es, spk.bandOut.value[1] * es);
    }

    if (qualia.nyctalopia?.params) {
      const nyc = qualia.nyctalopia.params;
      if (U.uNightThresh) gl.uniform1f(U.uNightThresh, nyc.threshold.value);
      if (U.uNightKnee) gl.uniform1f(U.uNightKnee, nyc.knee.value);
    }
  }

  _applyField(U) {
    const gl = this.gl;
    const field = FIELD;
    if (!field?.params) return;

    const d2r = deg => deg / 180;
    const lerp = (a, b, t) => a + (b - a) * t;
    const p = field.params;
    const degen = p.degeneration.value;

    if (U.uEdgeScale) gl.uniform1f(U.uEdgeScale, FIELD.edgeScale);
    if (U.uEdgeBase) gl.uniform1f(U.uEdgeBase, d2r(lerp(p.inner.value[0], p.inner.value[1], degen)));
    if (U.uOuterEdge) gl.uniform1f(U.uOuterEdge, d2r(lerp(p.outer.value[0], p.outer.value[1], degen)));
    if (U.uOuterCover) {
      gl.uniform1f(U.uOuterCover, p.outerCoverage.value * (1 - p.erosion.value * degen));
    }
    if (U.uIslandSeed) gl.uniform1f(U.uIslandSeed, p.islandSeed.value);
  }

  _applyPanel(U) {
    const gl = this.gl;
    const panel = PANEL;
    if (!panel?.params) return;

    const p = panel.params;
    if (U.uPanelPos) gl.uniform2f(U.uPanelPos, p.position.value[0], p.position.value[1]);
    if (U.uPanelW) gl.uniform1f(U.uPanelW, p.size.value);
    if (U.uPanelAspect) gl.uniform1f(U.uPanelAspect, panel.aspect);
    if (U.uPanelZoom) gl.uniform1f(U.uPanelZoom, p.zoom.value);
    if (U.uPanelFocus) gl.uniform2f(U.uPanelFocus, p.focus.value[0], p.focus.value[1]);
    if (U.uPanelGain) gl.uniform1f(U.uPanelGain, Math.min(1, 1 / p.ambient.value));
    if (U.uPanelOpaque) {
      gl.uniform1f(U.uPanelOpaque, 1 - p.transparency.value * (1 - panel.minOpacity));
    }
    if (U.uPanelHi) gl.uniform1f(U.uPanelHi, this.panelHighlight ? 1 : 0);
    if (U.uPanelSee) gl.uniform1f(U.uPanelSee, panel.repositionSeeThru);
  }

  setHud(text, seconds = 2.5) {
    this.hud.setText(text, seconds);
  }

  dispose() {
    const gl = this.gl;
    if (!gl) return;

    if (this.streetScene) this.streetScene.dispose();
    if (this.videoScene) this.videoScene.dispose();
    if (this.hud) this.hud.dispose();

    if (this.sceneFbo) gl.deleteFramebuffer(this.sceneFbo);
    if (this.sceneColorTex) gl.deleteTexture(this.sceneColorTex);
    if (this.sceneDepthRb) gl.deleteRenderbuffer(this.sceneDepthRb);

    if (this.rpProg) gl.deleteProgram(this.rpProg);
    if (this.quadVbo) gl.deleteBuffer(this.quadVbo);
    if (this.quadVao) gl.deleteVertexArray(this.quadVao);

    this.sceneFbo = null;
    this.sceneColorTex = null;
    this.sceneDepthRb = null;
    this.rpProg = null;
    this.quadVbo = null;
    this.quadVao = null;
    this.rpUniforms = {};
  }
}
