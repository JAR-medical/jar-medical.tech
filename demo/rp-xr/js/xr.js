// WebXR session management, per-view rendering loop, controller button edge detection,
// two-hand squeeze calibration trigger, and session cleanup.

import {
  quatConjugate,
  quatMultiply,
  quatRotate,
  clamp,
} from './math.js';
import {
  XR as XR_CONFIG,
  DEGENERATION_STEPS,
  FIELD,
  PANEL,
  QUALIA,
} from './config.js';
import { state, triggerRestitch } from './state.js';

export class XRSessionManager {
  constructor({ gl, renderer, gazeManager, calibration, videoEl, onSessionEnd } = {}) {
    this.gl = gl;
    this.renderer = renderer;
    this.gazeManager = gazeManager;
    this.calibration = calibration;
    this.videoEl = videoEl;
    this.onSessionEnd = onSessionEnd;

    this.session = null;
    this.refSpace = null;
    this.refSpaceType = 'local-floor';
    this.baseLayer = null;
    this.rafId = null;
    this.lastTime = 0;

    // Button states per input source for edge detection: source -> boolean[6]
    this.prevButtons = new Map();

    // Two-hand squeeze 1-second hold
    this.squeezeHoldTimer = 0;
    this.squeezeTriggered = false;

    // Degeneration cycle index
    this.degenStepIndex = 2; // Default 0.82 in DEGENERATION_STEPS [0.3, 0.6, 0.82, 1.0]

    this.bypass = false;

    this.boundOnXRFrame = this.onXRFrame.bind(this);
    this.boundOnSessionEnd = this.handleSessionEnd.bind(this);
    this.boundOnVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  static async isSupported(mode) {
    if (!navigator.xr || !window.isSecureContext) return false;
    try {
      return await navigator.xr.isSessionSupported(mode);
    } catch {
      return false;
    }
  }

  async start(mode = 'immersive-vr') {
    if (this.session) return;

    // Video playback is started by the click handler itself (main.js);
    // awaiting play() here would spend the click's user activation before
    // requestSession, which needs it.

    const sessionInit = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking'],
    };

    let session = null;
    try {
      session = await navigator.xr.requestSession(mode, sessionInit);
      this.refSpaceType = 'local-floor';
    } catch (err) {
      console.warn('local-floor requestSession failed, retrying with local:', err);
      try {
        session = await navigator.xr.requestSession(mode, {
          requiredFeatures: ['local'],
          optionalFeatures: ['hand-tracking'],
        });
        this.refSpaceType = 'local';
      } catch (e2) {
        throw new Error(`WebXR session request failed: ${e2.message}`);
      }
    }

    this.session = session;
    session.addEventListener('end', this.boundOnSessionEnd);
    session.addEventListener('visibilitychange', this.boundOnVisibilityChange);

    try {
      await this.setupSession(session, mode);
    } catch (err) {
      // a half-initialised session must not linger: ending it runs the
      // normal cleanup (and clears this.session, so Enter works again)
      try { await session.end(); } catch {}
      if (this.session === session) this.handleSessionEnd();
      throw err;
    }
  }

  async setupSession(session, mode) {
    if (this.gl.makeXRCompatible) {
      await this.gl.makeXRCompatible();
    }

    const baseLayer = this.createBaseLayer(session);
    this.baseLayer = baseLayer;
    this.layerCheckPending = true; // verified on the first frame (onXRFrame)
    this.layerRetries = 0;
    this.layerSwapInFlight = false;

    try {
      if (typeof session.updateTargetFrameRate === 'function') {
        await session.updateTargetFrameRate(XR_CONFIG.targetFrameRate);
      }
    } catch {}

    await session.updateRenderState({ baseLayer });

    this.refSpace = await session.requestReferenceSpace(this.refSpaceType);

    // Configure renderer
    this.renderer.setMode(mode === 'immersive-ar' ? 'ar' : 'vr');
    this.renderer.setScene(state.scene);
    this.renderer.setNight(state.night);
    this.renderer.setReduceFlashing(state.reduceFlashing);

    // Start gaze providers
    this.gazeManager.start({ session, refSpace: this.refSpace, canvas: this.gl.canvas });

    this.lastTime = performance.now();
    this.squeezeHoldTimer = 0;
    this.squeezeTriggered = false;
    this.prevButtons.clear();

    this.bypassShown = false;
    this.readoutPending = true; // shown on the first frame, once gaze is known

    this.rafId = session.requestAnimationFrame(this.boundOnXRFrame);
  }

  // Two-line status at session start: where the gaze comes from and how big
  // the surviving island is. Makes "no effects" diagnosable in the headset:
  // an island wider than the view, a disabled field or no symptoms enabled.
  showSessionReadout() {
    const src = this.gazeManager.getActiveSourceId();
    const line1 = this.gazeManager.isEye
      ? `Gaze: ${src} (eye-tracked)`
      : `Gaze: ${src} (no eye tracker)`;
    const p = FIELD.params;
    const degen = p.degeneration.value;
    const island = p.inner.value[0] + (p.inner.value[1] - p.inner.value[0]) * degen;
    const symptoms = Object.values(QUALIA).filter((q) => q?.enabled).length;
    let line2;
    if (!FIELD.enabled) line2 = 'Visual field is OFF in settings';
    else if (symptoms === 0) line2 = 'All symptoms are OFF in settings';
    else if (island > 45) line2 = `Island ${island.toFixed(0)}° fills the view: press A`;
    else line2 = `Island ${island.toFixed(0)}° · degeneration ${(degen * 100).toFixed(0)}%`;
    this.renderer.setHud(`${line1}\n${line2}`, 6.0);
  }

  async stop() {
    if (this.session) {
      try {
        await this.session.end();
      } catch {}
    }
  }

  // The RP pass never uses depth (the scene renders into its own FBO), so
  // the XR layer is created without one.
  createBaseLayer(session) {
    const layer = new XRWebGLLayer(session, this.gl, {
      framebufferScaleFactor: state.renderScale || XR_CONFIG.framebufferScale,
      depth: false,
    });
    if (layer.fixedFoveation !== undefined && XR_CONFIG.foveation !== undefined) {
      layer.fixedFoveation = XR_CONFIG.foveation;
    }
    return layer;
  }

  // PICO Browser 3.3 (Chrome 105) can hand an immersive-ar session a layer
  // whose framebuffer is FRAMEBUFFER_INCOMPLETE_DIMENSIONS for good: every
  // clear and draw then fails with INVALID_FRAMEBUFFER_OPERATION and only
  // passthrough shows. A layer created afresh during the session is
  // complete, so check the framebuffer on the first visible frame and
  // replace the layer while it is not. Returns true when the frame may draw.
  ensureLayerComplete() {
    if (!this.layerCheckPending) return true;
    if (this.layerSwapInFlight) return false;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.baseLayer.framebuffer);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status === gl.FRAMEBUFFER_COMPLETE) {
      this.layerCheckPending = false;
      return true;
    }
    if (this.layerRetries >= 5) {
      console.error(`[RP-XR] XR layer framebuffer stays incomplete (status 0x${status.toString(16)})`);
      this.renderer.setHud(`XR layer failed (0x${status.toString(16)})\nExit and enter again`, 3600);
      this.layerCheckPending = false;
      return false;
    }
    this.layerRetries += 1;
    console.warn(`[RP-XR] XR layer framebuffer incomplete (status 0x${status.toString(16)}), recreating (try ${this.layerRetries})`);
    const session = this.session;
    const layer = this.createBaseLayer(session);
    this.layerSwapInFlight = true;
    session.updateRenderState({ baseLayer: layer })
      .then(() => { if (this.session === session) this.baseLayer = layer; })
      .catch((err) => console.error('[RP-XR] replacing the XR layer failed:', err))
      .finally(() => { this.layerSwapInFlight = false; });
    return false;
  }

  handleVisibilityChange() {
    if (!this.session) return;
    const vis = this.session.visibilityState;
    // a session that was hidden may come back with a different framebuffer
    if (vis === 'visible') this.layerCheckPending = true;
    if (vis !== 'visible') {
      if (this.videoEl && !this.videoEl.paused) {
        try { this.videoEl.pause(); } catch {}
      }
    } else {
      if (this.videoEl && state.scene === 'video') {
        try { this.videoEl.play(); } catch {}
      }
    }
  }

  handleSessionEnd() {
    if (this.rafId && this.session) {
      this.session.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.session) {
      this.session.removeEventListener('end', this.boundOnSessionEnd);
      this.session.removeEventListener('visibilitychange', this.boundOnVisibilityChange);
      this.session = null;
    }

    this.refSpace = null;
    this.baseLayer = null;
    this.prevButtons.clear();

    if (this.calibration && this.calibration.isActive()) {
      this.calibration.abort();
    }

    this.gazeManager.stop();

    if (typeof this.onSessionEnd === 'function') {
      this.onSessionEnd();
    }
  }

  processControllers(session, dt) {
    if (!session || !session.inputSources) return;

    let anyTriggerHeld = false;
    let leftSqueeze = false;
    let rightSqueeze = false;

    const activeSourceId = this.gazeManager.getActiveSourceId();
    const canSteerGaze = activeSourceId === 'controller' || activeSourceId === 'head';

    for (const src of session.inputSources) {
      const gp = src.gamepad;
      if (!gp || !gp.buttons) continue;

      const handedness = src.handedness || 'none';
      let prev = this.prevButtons.get(src);
      if (!prev) {
        prev = new Array(gp.buttons.length).fill(false);
        this.prevButtons.set(src, prev);
      }

      // Button 0: Trigger -> hold for bypass (normal vision)
      if (gp.buttons[0] && gp.buttons[0].pressed) {
        anyTriggerHeld = true;
      }

      // Button 1: Squeeze (grip)
      if (gp.buttons[1] && gp.buttons[1].pressed) {
        if (handedness === 'left') leftSqueeze = true;
        else if (handedness === 'right') rightSqueeze = true;
        else {
          // Handedness unknown: treat single source as one squeeze
          leftSqueeze = true;
        }
      }

      // Button edge helper
      const isJustPressed = (btnIdx) => {
        const isDown = Boolean(gp.buttons[btnIdx] && gp.buttons[btnIdx].pressed);
        const wasDown = Boolean(prev[btnIdx]);
        return isDown && !wasDown;
      };

      // Button 3: Thumbstick click -> cycle scene
      if (isJustPressed(3)) {
        state.scene = state.scene === 'street' ? 'video' : 'street';
        this.renderer.setScene(state.scene);
        this.renderer.setHud(`Scene: ${state.scene}`, 2.0);
        if (this.videoEl) {
          if (state.scene === 'video') this.videoEl.play?.().catch(() => {});
          else this.videoEl.pause?.();
        }
      }

      // Button 4: A/X -> cycle DEGENERATION_STEPS
      if (isJustPressed(4)) {
        this.degenStepIndex = (this.degenStepIndex + 1) % DEGENERATION_STEPS.length;
        const step = DEGENERATION_STEPS[this.degenStepIndex];
        FIELD.params.degeneration.value = step;
        this.renderer.setHud(`Degeneration: ${(step * 100).toFixed(0)}%`, 2.0);
      }

      // Button 5: B/Y -> toggle glance panel
      if (isJustPressed(5)) {
        PANEL.enabled = !PANEL.enabled;
        triggerRestitch();
        this.renderer.restitch();
        this.renderer.setHud(`Glance Panel: ${PANEL.enabled ? 'ON' : 'OFF'}`, 2.0);
      }

      // Axes 2, 3: Thumbstick
      if (gp.axes && gp.axes.length >= 4) {
        const axisX = gp.axes[2];
        const axisY = gp.axes[3];

        if (canSteerGaze) {
          const controllerProvider = this.gazeManager.getProvider('controller');
          controllerProvider?.setDeflection(axisX, axisY, dt);
        } else {
          // When eye tracking is active, stick up/down adjusts degeneration continuously
          if (Math.abs(axisY) > 0.18) {
            // axisY < 0 is stick pushed forward/up -> increase degeneration
            const change = -axisY * 0.25 * dt;
            const cur = FIELD.params.degeneration.value;
            FIELD.params.degeneration.value = clamp(cur + change, 0, 1);
          }
        }
      }

      // Store current button states for next frame edge detection
      for (let i = 0; i < gp.buttons.length; i++) {
        prev[i] = Boolean(gp.buttons[i] && gp.buttons[i].pressed);
      }
    }

    this.bypass = anyTriggerHeld;
    // say so while the trigger counts as held: a resting finger or an
    // emulated trigger would otherwise silently hide every effect
    if (this.bypass && !this.bypassShown) {
      this.bypassShown = true;
      this.renderer.setHud('Normal vision (trigger held)', 3600);
    } else if (!this.bypass && this.bypassShown) {
      this.bypassShown = false;
      this.renderer.setHud('', 0.1);
    }

    // Two-hand squeeze 1-second hold
    if (leftSqueeze && rightSqueeze) {
      this.squeezeHoldTimer += dt;
      if (this.squeezeHoldTimer >= 1.0 && !this.squeezeTriggered) {
        this.squeezeTriggered = true;
        // start() puts its own message on the HUD (or why it refused)
        this.calibration?.start();
      }
    } else {
      this.squeezeHoldTimer = 0;
      this.squeezeTriggered = false;
    }
  }

  onXRFrame(time, frame) {
    if (!this.session) return;

    this.rafId = this.session.requestAnimationFrame(this.boundOnXRFrame);

    const pose = frame.getViewerPose(this.refSpace);
    if (!pose) return;
    if (!this.ensureLayerComplete()) return;

    // clamped both ways: some runtimes stamp XR frames on another clock
    const dt = Math.min(0.1, Math.max(0, (time - this.lastTime) / 1000));
    this.lastTime = time;

    this.processControllers(this.session, dt);

    if (this.calibration && this.calibration.isActive()) {
      this.calibration.update(dt);
    }

    const gaze = this.gazeManager.update(frame, pose, this.refSpace, dt);
    const dirHead = gaze.dirHead;
    if (this.readoutPending) {
      this.readoutPending = false;
      this.showSessionReadout();
    }

    this.renderer.beginFrame(time / 1000, dt);

    const headOri = pose.transform.orientation;
    const headQ = [headOri.x, headOri.y, headOri.z, headOri.w];

    for (const view of pose.views) {
      const viewport = this.baseLayer.getViewport(view);

      // Coordinate transform from head space to view space:
      // gazeDirView = rotate(conj(eyeQ) ∘ headQ, dirHead)
      const eyeOri = view.transform.orientation;
      const eyeQ = [eyeOri.x, eyeOri.y, eyeOri.z, eyeOri.w];
      const relQ = quatMultiply(quatConjugate(eyeQ), headQ);
      const gazeDirView = quatRotate(relQ, dirHead);

      // calibration targets are head-space directions: same rotation as gaze
      const targets = this.calibration?.getTargets()?.map((t) => ({
        ...t, dirView: quatRotate(relQ, t.dirView),
      })) ?? null;

      this.renderer.renderView({
        viewMatrix: view.transform.inverse.matrix,
        projectionMatrix: view.projectionMatrix,
        viewport,
        framebuffer: this.baseLayer.framebuffer,
        gazeDirView,
        bypass: this.bypass || state.bypass,
        targets,
        gazeCursor: state.showGazeCursor,
      });
    }
  }
}
