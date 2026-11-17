// RP-XR Boot & UI Wiring
//
// 1. Error boundary for WebGL2, module errors and renderer.init()
// 2. Photosensitivity safety gate
// 3. Dynamic settings UI generation from FIELD, QUALIA, and PANEL schemas
// 4. WebXR immersive-vr / immersive-ar gating and desktop preview launch

import { RPRenderer } from './renderer.js';
import {
  FIELD,
  QUALIA,
  PANEL,
  SAFETY,
  BRIDGE,
  clampParams,
} from './config.js';
import {
  state,
  saveSettings,
  loadSettings,
  onRestitch,
} from './state.js';
import { GazeManager } from './gaze/manager.js';
import { CalibrationProcedure } from './calibration.js';
import { DesktopPreview } from './desktop.js';
import { XRSessionManager } from './xr.js';

// ---- Error Boundary --------------------------------------------------

function showError(title, message, stack = '') {
  const overlay = document.getElementById('errorOverlay');
  const msgEl = document.getElementById('errorMessage');
  const stackEl = document.getElementById('errorStack');
  if (overlay && msgEl) {
    overlay.hidden = false;
    msgEl.textContent = `${title}: ${message}`;
    if (stackEl) stackEl.textContent = stack || '';
  }
  console.error(`[RP-XR] ${title}:`, message, stack);
}

window.addEventListener('error', (e) => {
  showError('Runtime Error', e.message, e.error?.stack);
});

window.addEventListener('unhandledrejection', (e) => {
  showError(
    'Unhandled Rejection',
    e.reason?.message || String(e.reason),
    e.reason?.stack
  );
});

// ---- Boot ------------------------------------------------------------

async function boot() {
  const safetyGate = document.getElementById('safetyGate');
  const btnAcknowledge = document.getElementById('btnAcknowledge');
  const settingsCard = document.getElementById('settingsCard');
  const desktopHud = document.getElementById('desktopHud');
  const btnExitDesktop = document.getElementById('btnExitDesktop');
  const canvas = document.getElementById('glCanvas');
  const videoEl = document.getElementById('videoFeed');

  const btnEnterVR = document.getElementById('btnEnterVR');
  const btnEnterAR = document.getElementById('btnEnterAR');
  const btnDesktop = document.getElementById('btnDesktopPreview');
  const statusLine = document.getElementById('statusLine');

  // 1. Safety Gate
  const acked = sessionStorage.getItem(SAFETY.warningKey) === 'true';
  if (!acked && safetyGate) {
    safetyGate.hidden = false;
    btnAcknowledge?.addEventListener('click', () => {
      sessionStorage.setItem(SAFETY.warningKey, 'true');
      safetyGate.hidden = true;
      focusBestAvailableButton();
    });
  }

  // 2. WebGL2 Context
  if (!canvas) {
    showError('Canvas Missing', '#glCanvas element not found in DOM.');
    return;
  }

  const gl = canvas.getContext('webgl2', {
    xrCompatible: true,
    alpha: false,
    antialias: false,
    powerPreference: 'high-performance',
  });

  if (!gl) {
    showError(
      'WebGL2 Unavailable',
      'Your browser or hardware does not support WebGL2 Rendering Context.'
    );
    return;
  }

  // 3. Renderer
  let renderer = null;
  try {
    renderer = new RPRenderer(gl);
    await renderer.init();
  } catch (err) {
    showError('Renderer Init Failed', err.message, err.stack);
    return;
  }

  if (videoEl) {
    renderer.setVideo(videoEl);
  }

  // 4. Load persisted settings
  loadSettings();

  // 5. Gaze Subsystem
  const urlParams = new URLSearchParams(window.location.search);
  const bridgeUrlParam = urlParams.get('bridge');
  if (bridgeUrlParam) {
    state.bridgeUrl = bridgeUrlParam;
  }

  const gazeManager = new GazeManager({
    preferred: state.gazeSource || 'auto',
  });

  const bridgeProvider = gazeManager.getProvider('bridge');
  if (bridgeProvider && state.bridgeUrl) {
    bridgeProvider.setUrl(state.bridgeUrl);
  }

  const calibration = new CalibrationProcedure({
    manager: gazeManager,
    renderer,
  });
  calibration.loadSavedBias();

  // 6. Preview & XR Managers
  const desktop = new DesktopPreview({
    canvas,
    renderer,
    gazeManager,
    calibration,
  });

  const xr = new XRSessionManager({
    gl,
    renderer,
    gazeManager,
    calibration,
    videoEl,
    onSessionEnd: () => {
      settingsCard.hidden = false;
      desktopHud.hidden = true;
      focusBestAvailableButton();
    },
  });

  // debugging / automated-test handle (no behaviour depends on it)
  window.__rpxr = { renderer, gazeManager, desktop, xr };

  // Listen to restitch requests
  onRestitch(() => {
    try {
      renderer.restitch();
    } catch (e) {
      showError('Shader Restitch Error', e.message, e.stack);
    }
  });

  // Sync initial state with renderer
  renderer.setScene(state.scene);
  renderer.setNight(state.night);
  renderer.setReduceFlashing(state.reduceFlashing);

  // 7. Generate Schema UI
  buildSchemaUI(renderer);

  // 8. General Controls Wiring
  wireGeneralControls(renderer, gazeManager, calibration);

  // 9. WebXR support detection & button gating
  let vrSupported = false;
  let arSupported = false;

  async function checkXRSupport() {
    if (!window.isSecureContext) {
      btnEnterVR.disabled = true;
      btnEnterVR.title = 'Requires HTTPS secure context';
      btnEnterAR.disabled = true;
      btnEnterAR.title = 'Requires HTTPS secure context';
      return;
    }

    vrSupported = await XRSessionManager.isSupported('immersive-vr');
    arSupported = await XRSessionManager.isSupported('immersive-ar');

    btnEnterVR.disabled = !vrSupported;
    if (!vrSupported) {
      btnEnterVR.title = 'Immersive VR not supported on this device/browser';
    }

    btnEnterAR.disabled = !arSupported;
    if (!arSupported) {
      btnEnterAR.title = 'Immersive AR (passthrough) not supported on this device/browser';
    }

    focusBestAvailableButton();
  }

  function focusBestAvailableButton() {
    if (safetyGate && !safetyGate.hidden) return;
    if (vrSupported) btnEnterVR.focus();
    else if (arSupported) btnEnterAR.focus();
    else btnDesktop.focus();
  }

  await checkXRSupport();

  // 10. Actions wiring
  // play() must run inside the click (autoplay policy); a refusal is
  // reported, not swallowed — the video scene would otherwise sit frozen
  function playVideo() {
    if (!videoEl) return;
    videoEl.play().catch((err) => {
      console.warn('[RP-XR] video playback refused:', err);
      if (statusLine) statusLine.textContent = `Video could not start: ${err.message}`;
    });
  }

  btnEnterVR.addEventListener('click', async () => {
    try {
      playVideo();
      settingsCard.hidden = true;
      desktopHud.hidden = true;
      await xr.start('immersive-vr');
    } catch (err) {
      settingsCard.hidden = false;
      showError('VR Session Error', err.message, err.stack);
    }
  });

  btnEnterAR.addEventListener('click', async () => {
    try {
      playVideo();
      settingsCard.hidden = true;
      desktopHud.hidden = true;
      await xr.start('immersive-ar');
    } catch (err) {
      settingsCard.hidden = false;
      showError('AR Session Error', err.message, err.stack);
    }
  });

  btnDesktop.addEventListener('click', () => {
    playVideo();
    settingsCard.hidden = true;
    desktopHud.hidden = false;
    desktop.start();
  });

  btnExitDesktop?.addEventListener('click', () => {
    desktop.stop();
    desktopHud.hidden = true;
    settingsCard.hidden = false;
    focusBestAvailableButton();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !desktopHud.hidden) {
      desktop.stop();
      desktopHud.hidden = true;
      settingsCard.hidden = false;
      focusBestAvailableButton();
    }
  });

  // 11. Live Status Line Loop
  setInterval(() => {
    if (!statusLine) return;
    const diag = gazeManager.getStatus();
    const activeProvider = gazeManager.getProvider(diag.activeSourceId);
    const statusTxt = activeProvider?.statusText || diag.summary;

    let text = `Gaze: ${diag.preferred === 'auto' ? `auto (${diag.activeSourceId})` : diag.activeSourceId}`;
    if (diag.isEye) text += ' · eye-tracked';
    if (diag.hz > 0) text += ` · ${diag.hz} Hz`;
    text += ` · ${statusTxt}`;

    statusLine.textContent = text;
  }, 250);
}

// ---- General Controls Wiring -----------------------------------------

function wireGeneralControls(renderer, gazeManager, calibration) {
  const sceneSelect = document.getElementById('sceneSelect');
  const videoCredit = document.getElementById('videoCredit');
  const chkNight = document.getElementById('chkNight');
  const sDegen = document.getElementById('sDegen');
  const degenVal = document.getElementById('degenVal');
  const chkReduceFlashing = document.getElementById('chkReduceFlashing');
  const chkGazeCursor = document.getElementById('chkGazeCursor');
  const sRenderScale = document.getElementById('sRenderScale');
  const renderScaleVal = document.getElementById('renderScaleVal');
  const gazeSourceSelect = document.getElementById('gazeSourceSelect');
  const bridgeUrlInput = document.getElementById('bridgeUrlInput');
  const btnCalibrate = document.getElementById('btnCalibrate');

  // Scene
  if (sceneSelect) {
    sceneSelect.value = state.scene;
    if (videoCredit) videoCredit.hidden = state.scene !== 'video';
    sceneSelect.addEventListener('change', () => {
      state.scene = sceneSelect.value;
      renderer.setScene(state.scene);
      if (videoCredit) videoCredit.hidden = state.scene !== 'video';
      saveSettings();
    });
  }

  // Night mode
  if (chkNight) {
    chkNight.checked = state.night;
    chkNight.addEventListener('change', () => {
      state.night = chkNight.checked;
      renderer.setNight(state.night);
      saveSettings();
    });
  }

  // Degeneration headline slider
  if (sDegen && degenVal) {
    sDegen.value = FIELD.params.degeneration.value;
    degenVal.textContent = `${Math.round(FIELD.params.degeneration.value * 100)}%`;
    sDegen.addEventListener('input', () => {
      FIELD.params.degeneration.value = parseFloat(sDegen.value);
      degenVal.textContent = `${Math.round(FIELD.params.degeneration.value * 100)}%`;
      saveSettings();
    });
  }

  // Reduce flashing
  if (chkReduceFlashing) {
    chkReduceFlashing.checked = state.reduceFlashing;
    chkReduceFlashing.addEventListener('change', () => {
      state.reduceFlashing = chkReduceFlashing.checked;
      renderer.setReduceFlashing(state.reduceFlashing);
      saveSettings();
    });
  }

  // Gaze cursor
  if (chkGazeCursor) {
    chkGazeCursor.checked = state.showGazeCursor;
    chkGazeCursor.addEventListener('change', () => {
      state.showGazeCursor = chkGazeCursor.checked;
      saveSettings();
    });
  }

  // Render scale
  if (sRenderScale && renderScaleVal) {
    sRenderScale.value = state.renderScale;
    renderScaleVal.textContent = `${parseFloat(state.renderScale).toFixed(2)}x`;
    sRenderScale.addEventListener('input', () => {
      state.renderScale = parseFloat(sRenderScale.value);
      renderScaleVal.textContent = `${state.renderScale.toFixed(2)}x`;
      saveSettings();
    });
  }

  // Gaze source
  if (gazeSourceSelect) {
    gazeSourceSelect.value = state.gazeSource || 'auto';
    gazeSourceSelect.addEventListener('change', () => {
      state.gazeSource = gazeSourceSelect.value;
      gazeManager.setPreferred(state.gazeSource);
      saveSettings();
    });
  }

  // Bridge URL
  if (bridgeUrlInput) {
    bridgeUrlInput.value = state.bridgeUrl;
    bridgeUrlInput.addEventListener('change', () => {
      state.bridgeUrl = bridgeUrlInput.value.trim();
      const bridgeProvider = gazeManager.getProvider('bridge');
      bridgeProvider?.setUrl(state.bridgeUrl);
      saveSettings();
    });
  }

  // Calibration button
  btnCalibrate?.addEventListener('click', () => {
    calibration.start();
  });
}

// ---- Dynamic Schema UI Generation -------------------------------------

function buildSchemaUI(renderer) {
  const container = document.getElementById('schemaControls');
  if (!container) return;
  container.replaceChildren();

  // 1. Visual Field Group
  container.appendChild(createGroupEl('Visual Field', FIELD, renderer));

  // 2. Qualia Groups
  for (const [qname, quale] of Object.entries(QUALIA)) {
    const title = qname[0].toUpperCase() + qname.slice(1);
    container.appendChild(createGroupEl(title, quale, renderer));
  }

  // 3. Glance Panel Group
  container.appendChild(createGroupEl('Glance Panel (AR Aid)', PANEL, renderer));
}

function createGroupEl(title, entry, renderer) {
  const group = document.createElement('div');
  group.className = 'schema-group';

  // Group Header
  const header = document.createElement('div');
  header.className = 'group-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'group-title';
  titleEl.textContent = title;

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'group-toggle' + (entry.enabled ? ' active' : '');
  toggleBtn.textContent = entry.enabled ? 'Enabled' : 'Disabled';
  toggleBtn.setAttribute('aria-pressed', entry.enabled);

  header.append(titleEl, toggleBtn);
  group.appendChild(header);

  // Group Params
  const paramsDiv = document.createElement('div');
  paramsDiv.className = 'group-params';
  paramsDiv.hidden = !entry.enabled;

  const hasParams = entry.params && Object.keys(entry.params).length > 0;
  if (hasParams) {
    for (const [pname, p] of Object.entries(entry.params)) {
      if (p.noUI || pname === 'degeneration') continue;

      if (Array.isArray(p.value)) {
        // Pair-valued param: generate two sliders (e.g. Mild and Late)
        paramsDiv.appendChild(createSliderRow(`${p.label} (Mild / A)`, p, 0));
        paramsDiv.appendChild(createSliderRow(`${p.label} (Late / B)`, p, 1));
      } else {
        paramsDiv.appendChild(createSliderRow(p.label, p, null));
      }
    }
  }

  toggleBtn.addEventListener('click', () => {
    entry.enabled = !entry.enabled;
    toggleBtn.classList.toggle('active', entry.enabled);
    toggleBtn.textContent = entry.enabled ? 'Enabled' : 'Disabled';
    toggleBtn.setAttribute('aria-pressed', entry.enabled);
    paramsDiv.hidden = !entry.enabled;
    saveSettings();
    renderer.restitch();
  });

  group.appendChild(paramsDiv);
  return group;
}

function createSliderRow(label, param, pairIndex) {
  const row = document.createElement('div');
  row.className = 'control-row';

  const header = document.createElement('div');
  header.className = 'slider-header';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  if (param.hint) labelEl.title = param.hint;

  const valBadge = document.createElement('span');
  valBadge.className = 'val-badge';

  const curVal = pairIndex !== null ? param.value[pairIndex] : param.value;
  valBadge.textContent = Number.isInteger(curVal) ? curVal : curVal.toFixed(2);

  header.append(labelEl, valBadge);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'slider';
  slider.min = param.min;
  slider.max = param.max;

  const range = param.max - param.min;
  slider.step = range <= 1 ? '0.01' : range <= 10 ? '0.1' : '1';
  slider.value = curVal;
  if (param.hint) slider.title = param.hint;

  slider.addEventListener('input', () => {
    const val = parseFloat(slider.value);
    if (pairIndex !== null) {
      param.value[pairIndex] = val;
    } else {
      param.value = val;
    }
    valBadge.textContent = Number.isInteger(val) ? val : val.toFixed(2);
    saveSettings();
  });

  row.append(header, slider);
  return row;
}

boot();
