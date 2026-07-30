/* WebXR passthrough session (Meta Quest Browser).
 *
 * Goal: show the real world through the Quest's cameras (passthrough / "see
 * through") with the patient HUD floating on top. We do this the lightweight
 * way — an `immersive-ar` session with the `dom-overlay` feature:
 *
 *   • immersive-ar on Quest composites our WebGL layer over passthrough.
 *   • We render an *empty, fully transparent* GL layer (clear to alpha 0) so
 *     nothing occludes passthrough — the world shows through untouched.
 *   • The `dom-overlay` feature draws our normal HTML HUD (the same markup used
 *     everywhere else) on top, so the medic sees vitals over the real patient.
 *
 * Controller trigger / hand pinch fire the XR `select` event, which we surface
 * via onSelect so the app can advance to the next patient hands-free.
 *
 * No Three.js / heavy renderer needed — the HUD is HTML, the GL layer is just a
 * transparent hole for passthrough.
 */

"use strict";

export async function passthroughSupported() {
  if (typeof navigator === "undefined" || !navigator.xr) return false;
  try {
    return await navigator.xr.isSessionSupported("immersive-ar");
  } catch (_) {
    return false;
  }
}

export class XRPassthrough {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.overlayRoot  DOM element used as the AR HUD overlay
   * @param {()=>void} [opts.onStart]
   * @param {()=>void} [opts.onEnd]
   * @param {(source:XRInputSource)=>void} [opts.onSelect]  controller/hand trigger
   */
  constructor({ overlayRoot, onStart, onEnd, onSelect } = {}) {
    this.overlayRoot = overlayRoot;
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onSelect = onSelect || (() => {});
    this.session = null;
    this.gl = null;
    this.canvas = null;
    this.refSpace = null;
    this._onSelectBound = (ev) => this.onSelect(ev.inputSource);
  }

  get active() { return !!this.session; }

  async start() {
    if (this.session) return;
    if (!(await passthroughSupported())) {
      throw new Error("Passthrough-AR wird auf diesem Gerät/Browser nicht unterstützt.");
    }

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl", {
      xrCompatible: true, alpha: true, antialias: false, depth: false, stencil: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error("WebGL für die AR-Ebene nicht verfügbar.");
    await gl.makeXRCompatible();

    const session = await navigator.xr.requestSession("immersive-ar", {
      requiredFeatures: ["dom-overlay"],
      optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
      domOverlay: { root: this.overlayRoot },
    });

    session.updateRenderState({
      baseLayer: new XRWebGLLayer(session, gl, { alpha: true }),
    });

    // A reference space is required to drive the frame loop; 'local' is enough
    // for a head-locked HUD. Fall back to 'viewer' if unavailable.
    this.refSpace = await session
      .requestReferenceSpace("local")
      .catch(() => session.requestReferenceSpace("viewer"));

    this.canvas = canvas;
    this.gl = gl;
    this.session = session;

    session.addEventListener("select", this._onSelectBound);
    session.addEventListener("end", () => this._cleanup());

    this.onStart();
    session.requestAnimationFrame((t, frame) => this._onFrame(t, frame));
  }

  _onFrame(_t, frame) {
    const session = this.session;
    if (!session) return;
    const gl = this.gl;
    const layer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    // Fully transparent clear → passthrough shows through, HUD sits on top.
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    session.requestAnimationFrame((t, f) => this._onFrame(t, f));
  }

  async end() {
    if (this.session) {
      try { await this.session.end(); } catch (_) { this._cleanup(); }
    }
  }

  _cleanup() {
    if (!this.session) return;
    try { this.session.removeEventListener("select", this._onSelectBound); } catch (_) {}
    this.session = null;
    this.gl = null;
    this.canvas = null;
    this.refSpace = null;
    this.onEnd();
  }
}
