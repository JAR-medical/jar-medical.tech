// Application state and localStorage persistence for RP-XR.
// Integrates schema from js/config.js (FIELD, QUALIA, PANEL, clampParams).

import {
  FIELD,
  QUALIA,
  PANEL,
  BRIDGE,
  XR,
  clampParams,
} from './config.js';

export const SETTINGS_STORAGE_KEY = 'rp-xr-settings';

export const state = {
  // World scene
  scene: 'street', // 'street' | 'video'
  night: false, // street lighting mode (day / dusk-night)
  reduceFlashing: false, // photopsia/sparkle flicker forced to 0
  showGazeCursor: false, // debug gaze cursor ring
  renderScale: XR.framebufferScale, // XR framebuffer scale
  gazeSource: 'auto', // 'auto' | 'bridge' | 'webxr' | 'controller' | 'head' | 'mouse'
  bridgeUrl: BRIDGE.defaultUrl,
  bypass: false, // normal vision hold
};

const restitchListeners = new Set();
const stateChangeListeners = new Set();

/** Register callback for when qualia/field/panel enabled flags change. */
export function onRestitch(fn) {
  restitchListeners.add(fn);
  return () => restitchListeners.delete(fn);
}

/** Trigger restitch callbacks (recompile shader). */
export function triggerRestitch() {
  for (const fn of restitchListeners) {
    try { fn(); } catch (e) { console.error('Restitch error:', e); }
  }
}

/** Register callback for general state changes. */
export function onStateChange(fn) {
  stateChangeListeners.add(fn);
  return () => stateChangeListeners.delete(fn);
}

export function notifyStateChange() {
  for (const fn of stateChangeListeners) {
    try { fn(state); } catch (e) { console.error('State change listener error:', e); }
  }
}

/**
 * Serialize full simulator configuration to localStorage.
 */
export function saveSettings() {
  try {
    const qualiaData = {};
    for (const [qname, q] of Object.entries(QUALIA)) {
      qualiaData[qname] = {
        enabled: q.enabled,
        params: {},
      };
      for (const [pname, p] of Object.entries(q.params || {})) {
        qualiaData[qname].params[pname] = p.value;
      }
    }

    const fieldData = {
      enabled: FIELD.enabled,
      params: {},
    };
    for (const [pname, p] of Object.entries(FIELD.params || {})) {
      fieldData.params[pname] = p.value;
    }

    const panelData = {
      enabled: PANEL.enabled,
      params: {},
    };
    for (const [pname, p] of Object.entries(PANEL.params || {})) {
      panelData.params[pname] = p.value;
    }

    const payload = {
      state,
      field: fieldData,
      qualia: qualiaData,
      panel: panelData,
      timestamp: Date.now(),
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to save settings to localStorage:', err);
  }
}

/**
 * Load simulator configuration from localStorage.
 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    if (data.state && typeof data.state === 'object') {
      if (typeof data.state.scene === 'string') state.scene = data.state.scene;
      if (typeof data.state.night === 'boolean') state.night = data.state.night;
      if (typeof data.state.reduceFlashing === 'boolean') state.reduceFlashing = data.state.reduceFlashing;
      if (typeof data.state.showGazeCursor === 'boolean') state.showGazeCursor = data.state.showGazeCursor;
      if (typeof data.state.renderScale === 'number') state.renderScale = data.state.renderScale;
      if (typeof data.state.gazeSource === 'string') state.gazeSource = data.state.gazeSource;
      if (typeof data.state.bridgeUrl === 'string') state.bridgeUrl = data.state.bridgeUrl;
    }

    if (data.field && typeof data.field === 'object') {
      if (typeof data.field.enabled === 'boolean') FIELD.enabled = data.field.enabled;
      if (data.field.params) {
        for (const [pname, val] of Object.entries(data.field.params)) {
          if (FIELD.params[pname]) FIELD.params[pname].value = val;
        }
      }
      clampParams('FIELD', FIELD.params);
    }

    if (data.qualia && typeof data.qualia === 'object') {
      for (const [qname, qData] of Object.entries(data.qualia)) {
        const targetQ = QUALIA[qname];
        if (!targetQ) continue;
        if (typeof qData.enabled === 'boolean') targetQ.enabled = qData.enabled;
        if (qData.params && targetQ.params) {
          for (const [pname, val] of Object.entries(qData.params)) {
            if (targetQ.params[pname]) targetQ.params[pname].value = val;
          }
        }
        clampParams(`QUALIA.${qname}`, targetQ.params);
      }
    }

    if (data.panel && typeof data.panel === 'object') {
      if (typeof data.panel.enabled === 'boolean') PANEL.enabled = data.panel.enabled;
      if (data.panel.params) {
        for (const [pname, val] of Object.entries(data.panel.params)) {
          if (PANEL.params[pname]) PANEL.params[pname].value = val;
        }
      }
      clampParams('PANEL', PANEL.params);
    }

    return true;
  } catch (err) {
    console.warn('Failed to load settings from localStorage:', err);
    return false;
  }
}
