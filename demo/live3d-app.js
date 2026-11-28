/* J.A.R. Medical — TriARge Live3D Unified Command & Control App
 * Integrates:
 *   1. Georeferenced 2D Tactical Overview Map (Leaflet + Light OSM + Bavaria DOP20 overlay)
 *   2. Integrated Live 3D Geo-Map (Three.js + Bavaria DGM1/LoD2/DOP20 + toggleable Point Cloud OFF by default)
 *   3. Top-Down Orthophoto Minimap (independent 2D canvas, zoomable & slider-resizable)
 *   4. Synchronized Drone + BodyCam Feeds (Live MJPEG or DVR Replay snapshots)
 *   5. DVR Time-Rewind Timeline (-30s / -10s / -3s / Replay / +3s / LIVE)
 *   6. Precision Window-Size Sliders + Drag Splitters for EVERY window
 *   7. Dual Runtime: Live FastAPI WebSocket backend OR Static Real-Data Replay bundle
 */

import * as THREE from './vendor/three.module.js?v=2';
import { OrbitControls } from './vendor/OrbitControls.js?v=2';

const $ = (id) => document.getElementById(id);
const deg2rad = (d) => (d * Math.PI) / 180.0;

// ---- API Base Resolution (supports local server, ?backend=URL, or static replay) ----
const params = new URLSearchParams(location.search);
const customBackend = params.get('backend');
const API_BASE = customBackend ? customBackend.replace(/\/$/, '') : '';
const IS_STATIC_ONLY = Boolean(window.LIVE3D_STATIC_REPLAY) && !customBackend && location.protocol === 'file:';

function apiUrl(path) {
  return API_BASE ? `${API_BASE}${path}` : path;
}

// ---- Global Application State ----------------------------------------------
let latestObjects = [];
let latestCameras = {};
let latestTranscripts = [];
let staticManualTranscripts = [];
let nextStaticTrId = 9001;
let trStatusOverride = '';
let selectedObjectId = null;
let activeDockTab = 'all';
let dockSearchText = '';
let orthoImg = null;
let geoHalfExtentM = 160.0;
let geoAnchorLat = 48.072024;
let geoAnchorLon = 11.680021;
let geoBaseElev = 554.6;

// Layer visibility:
// - 3D point cloud OFF by default (zero white dot clutter)
// - 2D DOP20 satellite overlay OFF by default (clean OpenStreetMap standard, like the other TriARge demos!)
const layers = {
  points: false,
  ortho2d: false,
  trails: true,
  fov: true,
  grid: true,
  minimap: true,
};

// DVR / Replay state
let isStaticMode = false;
let staticFrames = [];
let staticIdx = 0;
let staticPlaying = true;
let staticTimer = null;

let isRewound = false;
let replayPlaying = false;
let replayTimer = null;
let histMinSeq = 0;
let histMaxSeq = 0;
let histDurationS = 0;
let currentSeq = 0;
let latestLiveTs = 0;
let lastStateSnapshot = null;

// ---- Clock -----------------------------------------------------------------
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const el = $('tb-clock');
  if (el) el.textContent = `${hh}:${mm}:${ss}`;
}
setInterval(updateClock, 1000);
updateClock();

// ---- Window-Size Sliders & Drag Splitters (adjust EVERY window!) -----------
const LAYOUT_KEY = 'triarge.live3d.layout.v2';
const PRESETS = {
  palantir: { railL: 268, mapSplit: 48, railR: 368, vidH: 270, vidSplit: 50, trH: 196, dockH: 184, mmSize: 212 },
  map2d:    { railL: 248, mapSplit: 100, railR: 340, vidH: 250, vidSplit: 50, trH: 184, dockH: 170, mmSize: 0 },
  map3d:    { railL: 248, mapSplit: 0, railR: 340, vidH: 250, vidSplit: 50, trH: 184, dockH: 170, mmSize: 236 },
  sensors:  { railL: 224, mapSplit: 40, railR: 540, vidH: 390, vidSplit: 50, trH: 196, dockH: 140, mmSize: 180 },
};

let layout = { ...PRESETS.palantir };
try {
  const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null');
  if (saved && typeof saved === 'object') layout = { ...layout, ...saved };
} catch { /* ignore */ }

function saveLayout() {
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* ignore */ }
}

function applyLayout() {
  const root = document.documentElement.style;
  const ws = $('workspace');
  const cs = $('center-stage');
  const vs = $('vid-stack');
  const mmBox = $('minimap-box');

  const rl = Math.max(0, Math.min(420, Math.round(layout.railL)));
  const rr = Math.max(0, Math.min(640, Math.round(layout.railR)));
  const dh = Math.max(0, Math.min(420, Math.round(layout.dockH)));
  const ms = Math.max(0, Math.min(100, Math.round(layout.mapSplit)));
  const vh = Math.max(110, Math.min(540, Math.round(layout.vidH)));
  const vsp = Math.max(0, Math.min(100, Math.round(layout.vidSplit)));
  const trh = Math.max(0, Math.min(380, Math.round(layout.trH ?? 196)));
  const mms = Math.max(0, Math.min(320, Math.round(layout.mmSize)));

  root.setProperty('--rail-l', `${rl}px`);
  root.setProperty('--rail-r', `${rr}px`);
  root.setProperty('--dock-h', `${dh}px`);
  root.setProperty('--map-split', `${ms}%`);
  root.setProperty('--vid-h', `${vh}px`);
  root.setProperty('--vid-split', `${vsp}%`);
  root.setProperty('--tr-h', `${trh}px`);
  root.setProperty('--mm-size', `${Math.max(120, mms)}px`);

  ws.classList.toggle('l-hidden', rl < 16);
  ws.classList.toggle('r-hidden', rr < 16);
  ws.classList.toggle('dock-hidden', dh < 16);

  cs.classList.toggle('only-3d', ms <= 2);
  cs.classList.toggle('only-2d', ms >= 98);

  vs.classList.toggle('only-body', vsp <= 2);
  vs.classList.toggle('only-drone', vsp >= 98);

  const trWrap = $('tr-wrap');
  if (trWrap) trWrap.classList.toggle('hidden', trh < 16);

  const mmVisible = layers.minimap && mms >= 60;
  mmBox.classList.toggle('hidden', !mmVisible);
  $('btn-minimap').textContent = mmVisible ? 'Minimap: Ein' : 'Minimap: Aus';
  $('btn-minimap').classList.toggle('accent-soft', mmVisible);
  $('chk-minimap').checked = mmVisible;
  $('tag-minimap').textContent = mmVisible ? 'EIN' : 'AUS';
  $('tag-minimap').className = `tag-mini ${mmVisible ? 'on' : 'off'}`;

  // Sync slider values & numeric badges
  $('sl-rail-l').value = String(rl);      $('val-rail-l').textContent = rl < 16 ? 'Aus' : `${rl} px`;
  $('sl-map-split').value = String(ms);   $('val-map-split').textContent = ms <= 2 ? '100% 3D' : (ms >= 98 ? '100% 2D' : `${ms}% / ${100 - ms}%`);
  $('sl-rail-r').value = String(rr);      $('val-rail-r').textContent = rr < 16 ? 'Aus' : `${rr} px`;
  $('sl-vid-h').value = String(vh);       $('val-vid-h').textContent = `${vh} px`;
  $('sl-vid-split').value = String(vsp);  $('val-vid-split').textContent = vsp <= 2 ? 'BodyCam' : (vsp >= 98 ? 'Drohne' : `${vsp}% / ${100 - vsp}%`);
  if ($('sl-tr-h')) {
    $('sl-tr-h').value = String(trh);
    $('val-tr-h').textContent = trh < 16 ? 'Aus' : `${trh} px`;
  }
  $('sl-dock-h').value = String(dh);      $('val-dock-h').textContent = dh < 16 ? 'Aus' : `${dh} px`;
  $('sl-mm-size').value = String(mms);    $('val-mm-size').textContent = mms < 60 ? 'Aus' : `${mms} px`;

  $('btn-layout').classList.toggle('accent-soft', rl >= 16);

  // Trigger map & renderer resize
  requestAnimationFrame(() => {
    if (leafletMap) leafletMap.invalidateSize({ animate: false });
    resizeThree();
    drawMinimap(latestObjects, latestCameras);
  });
}

function bindSliders() {
  const bind = (id, key, onChange) => {
    $(id).addEventListener('input', (e) => {
      layout[key] = Number(e.target.value);
      if (onChange) onChange(layout[key]);
      applyLayout();
      saveLayout();
    });
  };
  bind('sl-rail-l', 'railL');
  bind('sl-map-split', 'mapSplit');
  bind('sl-rail-r', 'railR');
  bind('sl-vid-h', 'vidH');
  bind('sl-vid-split', 'vidSplit');
  if ($('sl-tr-h')) bind('sl-tr-h', 'trH');
  bind('sl-dock-h', 'dockH');
  bind('sl-mm-size', 'mmSize', (v) => { layers.minimap = v >= 60; });

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = PRESETS[btn.dataset.preset];
      if (!p) return;
      layout = { ...p };
      layers.minimap = layout.mmSize >= 60;
      applyLayout();
      saveLayout();
    });
  });

  // Collapsible sections in left rail
  document.querySelectorAll('.blk-head[data-toggle]').forEach((h) => {
    h.addEventListener('click', () => {
      const blk = $(h.dataset.toggle);
      if (blk) blk.classList.toggle('collapsed');
    });
  });

  $('btn-layout').addEventListener('click', () => {
    layout.railL = layout.railL < 16 ? 268 : 0;
    applyLayout();
    saveLayout();
  });

  // Direct mouse/touch drag splitters synced with the sliders!
  function dragSplitter(elId, onMove, onDblClick) {
    const el = $(elId);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      const startX = e.clientX, startY = e.clientY;
      const startLayout = { ...layout };
      const move = (ev) => {
        onMove(ev.clientX - startX, ev.clientY - startY, startLayout);
        applyLayout();
      };
      const up = () => {
        el.classList.remove('active');
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        saveLayout();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
    });
    if (onDblClick) el.addEventListener('dblclick', () => { onDblClick(); applyLayout(); saveLayout(); });
  }

  dragSplitter('griff-l', (dx, _dy, st) => { layout.railL = Math.max(0, Math.min(420, st.railL + dx)); },
    () => { layout.railL = layout.railL < 16 ? 268 : 0; });
  dragSplitter('griff-r', (dx, _dy, st) => { layout.railR = Math.max(0, Math.min(640, st.railR - dx)); },
    () => { layout.railR = layout.railR < 16 ? 368 : 0; });
  dragSplitter('griff-dock', (_dx, dy, st) => { layout.dockH = Math.max(0, Math.min(420, st.dockH - dy)); },
    () => { layout.dockH = layout.dockH < 16 ? 184 : 0; });
  dragSplitter('griff-maps', (dx, _dy, st) => {
    const w = Math.max(200, $('center-stage').clientWidth);
    layout.mapSplit = Math.max(0, Math.min(100, st.mapSplit + (dx / w) * 100));
  }, () => { layout.mapSplit = 50; });
  dragSplitter('griff-vid', (_dx, dy, st) => {
    const h = Math.max(120, $('vid-stack').clientHeight);
    layout.vidSplit = Math.max(0, Math.min(100, st.vidSplit + (dy / h) * 100));
  }, () => { layout.vidSplit = 50; });
  dragSplitter('griff-tr', (_dx, dy, st) => {
    layout.trH = Math.max(0, Math.min(380, (st.trH ?? 196) - dy));
  }, () => { layout.trH = (layout.trH ?? 196) < 16 ? 196 : 0; });
}

// ---- 1. 2D Tactical Overview Map (Leaflet + Light OSM + Bavaria DOP20) -----
let leafletMap = null;
let tileLayers = {};
let ortho2dOverlay = null;
let lGroupObjects = null;
let lGroupTrails = null;
let lGroupFov = null;
const leafletMarkers = new Map();
const leafletCamMarkers = new Map();

function initLeaflet() {
  if (!window.L) return;
  leafletMap = L.map('leaflet-map', {
    center: [geoAnchorLat, geoAnchorLon],
    zoom: 18,
    maxZoom: 21,
    minZoom: 14,
    zoomControl: true,
    attributionControl: true,
  });

  const osmUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const osmAttr = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende';
  const commonOpt = {
    maxZoom: 21, maxNativeZoom: 19, attribution: osmAttr,
    updateWhenIdle: true, updateWhenZooming: false, keepBuffer: 1,
    referrerPolicy: 'strict-origin-when-cross-origin',
  };
  tileLayers.hell = L.tileLayer(osmUrl, { ...commonOpt, className: 'kachel-hell' });
  tileLayers.osm  = L.tileLayer(osmUrl, commonOpt);
  tileLayers.hell.addTo(leafletMap);

  lGroupTrails = L.layerGroup().addTo(leafletMap);
  lGroupFov = L.layerGroup().addTo(leafletMap);
  lGroupObjects = L.layerGroup().addTo(leafletMap);

  L.control.scale({ imperial: false, metric: true, position: 'bottomright' }).addTo(leafletMap);

  leafletMap.on('mousemove', (e) => {
    $('map2d-coord').textContent = `${e.latlng.lat.toFixed(5)}°N, ${e.latlng.lng.toFixed(5)}°E`;
  });

  document.querySelectorAll('.mtool[data-base]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.base;
      Object.values(tileLayers).forEach((t) => leafletMap.removeLayer(t));
      if (tileLayers[mode]) tileLayers[mode].addTo(leafletMap);
      document.querySelectorAll('.mtool[data-base]').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });

  $('btn-2d-ortho').addEventListener('click', () => {
    layers.ortho2d = !layers.ortho2d;
    syncOrtho2D();
  });
  $('btn-2d-center').addEventListener('click', () => {
    leafletMap.setView([geoAnchorLat, geoAnchorLon], 19, { animate: true });
  });
}

function syncOrtho2D() {
  $('btn-2d-ortho').classList.toggle('active', layers.ortho2d);
  $('chk-ortho2d').checked = layers.ortho2d;
  const tag = $('tag-ortho2d');
  if (tag) {
    tag.textContent = layers.ortho2d ? 'EIN' : 'AUS';
    tag.className = `tag-mini ${layers.ortho2d ? 'on' : 'off'}`;
  }
  if (!ortho2dOverlay || !leafletMap) return;
  if (layers.ortho2d) {
    if (!leafletMap.hasLayer(ortho2dOverlay)) ortho2dOverlay.addTo(leafletMap);
  } else {
    if (leafletMap.hasLayer(ortho2dOverlay)) leafletMap.removeLayer(ortho2dOverlay);
  }
}

function enuToLatLon(e, n) {
  const mLat = 111320.0;
  const mLon = Math.max(111320.0 * Math.cos(deg2rad(geoAnchorLat)), 1e-6);
  return [geoAnchorLat + n / mLat, geoAnchorLon + e / mLon];
}

function setGeoMap2DOverlay(meta, textureDataUrl) {
  geoAnchorLat = meta.lat0 || geoAnchorLat;
  geoAnchorLon = meta.lon0 || geoAnchorLon;
  geoHalfExtentM = meta.half_extent_m || 160.0;
  geoBaseElev = meta.base_elevation_m || 554.6;

  if (!leafletMap) return;
  const sw = enuToLatLon(-geoHalfExtentM, -geoHalfExtentM);
  const ne = enuToLatLon(+geoHalfExtentM, +geoHalfExtentM);
  if (ortho2dOverlay) {
    leafletMap.removeLayer(ortho2dOverlay);
    ortho2dOverlay = null;
  }
  if (textureDataUrl) {
    ortho2dOverlay = L.imageOverlay(textureDataUrl, [sw, ne], { opacity: 0.84, interactive: false });
    if (layers.ortho2d) ortho2dOverlay.addTo(leafletMap);
  }
  // Frame the active tactical area cleanly at OSM native zoom 18 (same clarity as other TriARge demos)
  const c = enuToLatLon(15.0, -2.0);
  leafletMap.setView(c, 18, { animate: false });
}

function syncLeafletObjects(objects, cameras) {
  if (!leafletMap || !lGroupObjects) return;
  const seen = new Set();

  // Trails & FOV wedges rebuilt cleanly (fast: < 30 items)
  lGroupTrails.clearLayers();
  lGroupFov.clearLayers();

  for (const o of objects) {
    seen.add(o.id);
    const ll = (o.lat && o.lon) ? [o.lat, o.lon] : enuToLatLon(o.enu[0], o.enu[1]);
    let html = '';
    let iconSize = [14, 14];
    let iconAnchor = [7, 7];

    if (o.group === 'vehicle') {
      const cls = o.class_name === 'police_vehicle' ? 'police'
        : (o.class_name === 'ambulance' ? 'ambulance'
          : (o.class_name === 'car' ? 'car' : ''));
      const txt = o.class_name === 'fire_truck'
        ? (o.locked ? 'FW LOCK' : 'FEUERWEHR')
        : (o.class_name === 'police_vehicle' ? 'POLIZEI'
          : (o.class_name === 'ambulance' ? 'RTW' : o.class_name.toUpperCase()));
      html = `<div class="tac-truck ${cls}">${txt}</div>`;
      iconSize = [68, 18];
      iconAnchor = [34, 9];
    } else {
      const isUnif = o.class_name === 'uniformed_person';
      const isLying = o.posture === 'lying';
      const bg = isLying ? '#d1232a' : (isUnif ? '#d97706' : (o.class_name === 'two_wheeler' ? '#7c3aed' : '#0f766e'));
      html = `<div class="tac-dot ${isUnif ? 'uniform' : ''} ${isLying ? 'lying' : ''}" style="background:${bg}"></div>`;
      iconSize = [14, 14];
      iconAnchor = [7, 7];
    }

    const icon = L.divIcon({ className: 'tac-ico', html, iconSize, iconAnchor });
    let mk = leafletMarkers.get(o.id);
    if (!mk) {
      mk = L.marker(ll, { icon }).addTo(lGroupObjects);
      mk.on('click', () => selectObject(o.id));
      leafletMarkers.set(o.id, mk);
    } else {
      mk.setLatLng(ll);
      mk.setIcon(icon);
    }
    mk.setZIndexOffset(o.group === 'vehicle' ? 500 : (o.posture === 'lying' ? 400 : 200));

    // Short live motion wake
    if (layers.trails && o.group !== 'vehicle' && o.trail && o.trail.length >= 2) {
      const pts = o.trail.map((p) => enuToLatLon(p[0], p[1]));
      const col = o.class_name === 'uniformed_person' ? '#d97706' : '#0f766e';
      L.polyline(pts, { color: col, weight: 2, opacity: 0.55, interactive: false }).addTo(lGroupTrails);
    }
  }

  for (const [id, mk] of leafletMarkers.entries()) {
    if (!seen.has(id)) {
      lGroupObjects.removeLayer(mk);
      leafletMarkers.delete(id);
    }
  }

  // Cameras + FOV cones + trails
  const camSeen = new Set();
  for (const [cid, c] of Object.entries(cameras || {})) {
    camSeen.add(cid);
    const ll = (c.lat && c.lon) ? [c.lat, c.lon] : enuToLatLon(c.enu[0], c.enu[1]);
    const isDrone = c.role === 'drone';
    const col = isDrone ? '#0284c7' : '#6d28d9';

    if (layers.fov) {
      const yaw = deg2rad(c.yaw_deg || 0);
      const halfFov = isDrone ? 0.52 : 0.68;
      const dist = isDrone ? 18.0 : 9.5;
      const polyPts = [ll];
      for (let k = -4; k <= 4; k++) {
        const a = yaw + (k / 4) * halfFov;
        polyPts.push(enuToLatLon(c.enu[0] + Math.sin(a) * dist, c.enu[1] + Math.cos(a) * dist));
      }
      L.polygon(polyPts, { color: col, weight: 1, opacity: 0.55, fillColor: col, fillOpacity: 0.14, interactive: false }).addTo(lGroupFov);
    }
    if (layers.trails && c.trail && c.trail.length >= 2) {
      L.polyline(c.trail.map((p) => enuToLatLon(p[0], p[1])), { color: col, weight: 1.5, dashArray: '3 4', opacity: 0.65, interactive: false }).addTo(lGroupTrails);
    }

    const icon = L.divIcon({
      className: 'tac-ico',
      html: `<div class="tac-cam ${isDrone ? '' : 'bodycam'}">${isDrone ? '▲ DROHNE' : '● BODYCAM'}</div>`,
      iconSize: [70, 16],
      iconAnchor: [35, 8],
    });
    let mk = leafletCamMarkers.get(cid);
    if (!mk) {
      mk = L.marker(ll, { icon, zIndexOffset: 700 }).addTo(lGroupObjects);
      leafletCamMarkers.set(cid, mk);
    } else {
      mk.setLatLng(ll);
      mk.setIcon(icon);
    }
  }
  for (const [cid, mk] of leafletCamMarkers.entries()) {
    if (!camSeen.has(cid)) {
      lGroupObjects.removeLayer(mk);
      leafletCamMarkers.delete(cid);
    }
  }
}

// ---- 2. Integrated Live 3D Geo-Map (Three.js — Light Palantir Daylight) ----
const threeHost = $('three-host');
let renderer = null, scene = null, camera = null, controls = null, gridHelper = null;
let pointCloud = null, ptPos = null, ptCol = null, ptGeom = null, ptCount = 0;
const MAX_PTS = 80000;
const objGroup = new THREE.Group();
const camGroup = new THREE.Group();
const objMeshes = new Map();
const camNodes = new Map();
let terrainMesh = null;

const enuToThree = (e, n, z) => new THREE.Vector3(e, z, -n);

function initThree() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeHost.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    // Crisp light Palantir daylight atmosphere (matching white overview style!)
    scene.background = new THREE.Color(0xeef3f8);
    scene.fog = new THREE.FogExp2(0xeef3f8, 0.0014);

    camera = new THREE.PerspectiveCamera(48, 1, 0.2, 2500);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.49;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 1.05));
    const sun = new THREE.DirectionalLight(0xfffbeb, 0.72);
    sun.position.set(110, 210, 85);
    scene.add(sun);

    gridHelper = new THREE.GridHelper(320, 32, 0x94a3b8, 0xcbd5e1);
    gridHelper.position.y = -0.06;
    gridHelper.visible = layers.grid;
    scene.add(gridHelper);

    // Optional sparse 3D point cloud — strictly OFF by default (layers.points = false)!
    ptPos = new Float32Array(MAX_PTS * 3);
    ptCol = new Float32Array(MAX_PTS * 3);
    ptGeom = new THREE.BufferGeometry();
    ptGeom.setAttribute('position', new THREE.BufferAttribute(ptPos, 3));
    ptGeom.setAttribute('color', new THREE.BufferAttribute(ptCol, 3));
    ptGeom.setDrawRange(0, 0);
    const ptMat = new THREE.PointsMaterial({ size: 0.42, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.72 });
    pointCloud = new THREE.Points(ptGeom, ptMat);
    pointCloud.visible = layers.points; // FALSE by default!
    scene.add(pointCloud);

    scene.add(objGroup);
    scene.add(camGroup);

    homeView3D();
    resizeThree();
    animateThree();
  } catch (err) {
    console.warn('WebGL unavailable; 2D map & minimap remain active:', err);
  }
}

function homeView3D() {
  if (!camera || !controls) return;
  camera.position.set(24, 46, 50);
  controls.target.set(16, 0, 2);
  controls.update();
}

function topView3D() {
  if (!camera || !controls) return;
  camera.position.set(16, 78, 3.5);
  controls.target.set(16, 0, 2);
  controls.update();
}

function resizeThree() {
  if (!renderer || !camera || !threeHost) return;
  const w = threeHost.clientWidth, h = threeHost.clientHeight;
  if (w > 4 && h > 4) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

function animateThree() {
  if (!renderer || !scene || !camera) return;
  requestAnimationFrame(animateThree);
  controls.update();
  renderer.render(scene, camera);
}

function setGeoMap3DTerrain(gm) {
  if (!scene) return;
  if (terrainMesh) {
    scene.remove(terrainMesh);
    terrainMesh.geometry.dispose();
    if (terrainMesh.material.map) terrainMesh.material.map.dispose();
    terrainMesh.material.dispose();
  }
  const dim = gm.mesh_dim || 65;
  const span = (gm.meta.half_extent_m || 160.0) * 2.0;
  const geom = new THREE.PlaneGeometry(span, span, dim - 1, dim - 1);
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position;
  const heights = gm.heights_m || [];
  for (let i = 0; i < pos.count; i++) pos.setY(i, heights[i] || 0);
  geom.computeVertexNormals();

  let mat;
  if (gm.texture_data_url) {
    const tex = new THREE.TextureLoader().load(gm.texture_data_url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.90, metalness: 0.0 });
  } else {
    mat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95 });
  }
  terrainMesh = new THREE.Mesh(geom, mat);
  scene.add(terrainMesh);
}

function appendPoints(positions, colors, reset = false) {
  if (!ptGeom || !ptPos || !ptCol) return;
  if (reset) ptCount = 0;
  const n = Math.floor((positions || []).length / 3);
  for (let i = 0; i < n; i++) {
    const idx = (ptCount % MAX_PTS) * 3;
    ptPos[idx]     = positions[i * 3];
    ptPos[idx + 1] = positions[i * 3 + 2];
    ptPos[idx + 2] = -positions[i * 3 + 1];
    ptCol[idx]     = colors[i * 3] / 255;
    ptCol[idx + 1] = colors[i * 3 + 1] / 255;
    ptCol[idx + 2] = colors[i * 3 + 2] / 255;
    ptCount++;
  }
  ptGeom.setDrawRange(0, Math.min(ptCount, MAX_PTS));
  ptGeom.attributes.position.needsUpdate = true;
  ptGeom.attributes.color.needsUpdate = true;
}

function disposeGroup(g) {
  g.traverse((ch) => {
    if (ch.geometry) ch.geometry.dispose();
    if (ch.material) {
      if (Array.isArray(ch.material)) ch.material.forEach((m) => m.dispose());
      else ch.material.dispose();
    }
  });
}

function buildObjectMesh3D(o) {
  const g = new THREE.Group();
  const colHex = o.class_name === 'fire_truck' ? '#d1232a'
    : (o.class_name === 'uniformed_person' ? '#d97706'
      : (o.posture === 'lying' ? '#dc2626'
        : (o.class_name === 'person' ? '#0f766e' : (o.color || '#475569'))));
  const col = new THREE.Color(colHex);
  const bodyMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.42, metalness: 0.12 });
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.9 });
  const h = Math.max(0.5, o.height_m || 1.7);

  if (o.class_name === 'person' || o.class_name === 'uniformed_person') {
    if (o.posture === 'lying') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 1.65), bodyMat);
      body.position.y = 0.16;
      g.add(body);
    } else {
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.20, h * 0.72, 10), bodyMat);
      torso.position.y = h * 0.36;
      g.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfde68a }));
      head.position.y = h * 0.84;
      g.add(head);
      if (o.class_name === 'uniformed_person') {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.32, 0.05, 8, 16),
          new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xd97706, emissiveIntensity: 0.55 })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = h * 0.56;
        g.add(ring);
      }
    }
  } else if (o.class_name === 'fire_truck') {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.5, h * 0.85, 7.6), bodyMat);
    cab.position.y = h * 0.46;
    g.add(cab);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.36, 7.64), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stripe.position.y = h * 0.46;
    g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 0.4), beaconMat);
    bar.position.set(0, h * 0.96, -2.8);
    g.add(bar);
  } else if (o.class_name === 'police_vehicle') {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.95, h * 0.78, 4.9), bodyMat);
    car.position.y = h * 0.42;
    g.add(car);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.35), beaconMat);
    bar.position.set(0, h * 0.92, -0.3);
    g.add(bar);
  } else if (o.class_name === 'ambulance') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.15, h * 0.85, 5.9), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    box.position.y = h * 0.46;
    g.add(box);
    const band = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 5.95), bodyMat);
    band.position.y = h * 0.50;
    g.add(band);
  } else if (o.class_name === 'truck') {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(2.45, h * 0.85, 8.0), bodyMat);
    tr.position.y = h * 0.46;
    g.add(tr);
  } else if (o.class_name === 'car') {
    const cr = new THREE.Mesh(new THREE.BoxGeometry(1.85, h * 0.75, 4.4), bodyMat);
    cr.position.y = h * 0.40;
    g.add(cr);
  } else {
    const tw = new THREE.Mesh(new THREE.BoxGeometry(0.65, h * 0.85, 1.75), bodyMat);
    tw.position.y = h * 0.45;
    g.add(tw);
  }

  const baseRing = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.50, 16),
    new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })
  );
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.05;
  g.add(baseRing);
  g.userData = { class_name: o.class_name, posture: o.posture, initialized: false };
  return g;
}

function syncThreeObjects(objects, cameras, snapInstant = false) {
  if (!scene) return;
  const seen = new Set();
  for (const o of objects) {
    seen.add(o.id);
    let m = objMeshes.get(o.id);
    if (!m || m.userData.class_name !== o.class_name || m.userData.posture !== o.posture) {
      if (m) { objGroup.remove(m); disposeGroup(m); }
      m = buildObjectMesh3D(o);
      objGroup.add(m);
      objMeshes.set(o.id, m);
    }
    const p = enuToThree(o.enu[0], o.enu[1], o.enu[2]);
    if (!m.userData.initialized || snapInstant) {
      m.position.copy(p);
      m.userData.initialized = true;
    } else if (o.locked) {
      m.position.lerp(p, 0.25);
    } else {
      m.position.lerp(p, 0.68);
    }
    if (o.heading_deg !== null && o.heading_deg !== undefined) {
      m.rotation.y = -deg2rad(o.heading_deg);
    }
  }
  for (const [id, m] of objMeshes.entries()) {
    if (!seen.has(id)) {
      objGroup.remove(m);
      disposeGroup(m);
      objMeshes.delete(id);
    }
  }

  // Cameras in 3D
  for (const [cid, c] of Object.entries(cameras || {})) {
    let node = camNodes.get(cid);
    const col = c.role === 'drone' ? 0x0284c7 : 0x6d28d9;
    if (!node) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(c.role === 'drone' ? 1.1 : 0.45, c.role === 'drone' ? 2.4 : 1.0, 4),
        new THREE.MeshBasicMaterial({ color: col, wireframe: true })
      );
      cone.rotation.x = Math.PI / 2;
      const pivot = new THREE.Group();
      pivot.add(cone);
      const line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.7 }));
      camGroup.add(pivot, line);
      node = { pivot, line };
      camNodes.set(cid, node);
    }
    node.pivot.position.copy(enuToThree(c.enu[0], c.enu[1], c.enu[2]));
    node.pivot.rotation.order = 'YXZ';
    node.pivot.rotation.y = -deg2rad(c.yaw_deg || 0);
    node.pivot.rotation.x = deg2rad(c.pitch_deg || 0);
    node.line.visible = layers.trails;
    if (c.trail && c.trail.length >= 2) {
      const pts = c.trail.map((t) => enuToThree(t[0], t[1], t[2]));
      node.line.geometry.dispose();
      node.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
    }
  }
}

// ---- 3. Top-Down Orthophoto Minimap (White Palantir style, standalone 2D Canvas) ----
const mmCanvas = $('minimap');
const mmCtx = mmCanvas.getContext('2d');
let mmHalfSpanM = 36.0;
let mmCenterE = 15.0;
let mmCenterN = -1.5;

mmCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  mmHalfSpanM = Math.max(14, Math.min(130, mmHalfSpanM * (e.deltaY > 0 ? 1.15 : 0.87)));
  $('mm-scale').textContent = `±${Math.round(mmHalfSpanM)}m · N↑`;
  drawMinimap(latestObjects, latestCameras);
}, { passive: false });

function enuToMM(e, n, W, H) {
  return [
    ((e - (mmCenterE - mmHalfSpanM)) / (2 * mmHalfSpanM)) * W,
    (((mmCenterN + mmHalfSpanM) - n) / (2 * mmHalfSpanM)) * H,
  ];
}

function drawMinimap(objects, cameras) {
  const W = mmCanvas.width, H = mmCanvas.height;
  mmCtx.clearRect(0, 0, W, H);
  mmCtx.fillStyle = '#eef3f8';
  mmCtx.fillRect(0, 0, W, H);

  const trucks = objects.filter((o) => o.class_name === 'fire_truck' || o.class_name === 'truck');
  if (trucks.length > 0) {
    mmCenterE = 0.92 * mmCenterE + 0.08 * (trucks[0].enu[0] - 4.0);
    mmCenterN = 0.92 * mmCenterN + 0.08 * trucks[0].enu[1];
  }

  // 1. Bavaria DOP20 orthophoto (Safari-safe clamped drawImage)
  if (orthoImg && orthoImg.width > 0) {
    const fullSpan = 2 * geoHalfExtentM;
    const iw = orthoImg.width, ih = orthoImg.height;
    const rawSx = ((mmCenterE - mmHalfSpanM + geoHalfExtentM) / fullSpan) * iw;
    const rawSy = ((geoHalfExtentM - (mmCenterN + mmHalfSpanM)) / fullSpan) * ih;
    const rawSw = ((2 * mmHalfSpanM) / fullSpan) * iw;
    const rawSh = ((2 * mmHalfSpanM) / fullSpan) * ih;
    const sx = Math.max(0, rawSx), sy = Math.max(0, rawSy);
    const ex = Math.min(iw, rawSx + rawSw), ey = Math.min(ih, rawSy + rawSh);
    if (ex > sx && ey > sy) {
      mmCtx.save();
      mmCtx.globalAlpha = 0.88;
      mmCtx.drawImage(orthoImg, sx, sy, ex - sx, ey - sy,
        ((sx - rawSx) / rawSw) * W, ((sy - rawSy) / rawSh) * H,
        ((ex - sx) / rawSw) * W, ((ey - sy) / rawSh) * H);
      mmCtx.restore();
    }
  }

  // 2. Crisp 10m grid
  mmCtx.strokeStyle = 'rgba(15, 58, 96, 0.16)';
  mmCtx.lineWidth = 1;
  const gStep = mmHalfSpanM > 60 ? 20 : 10;
  for (let e = Math.floor((mmCenterE - mmHalfSpanM) / gStep) * gStep; e <= mmCenterE + mmHalfSpanM; e += gStep) {
    const [x] = enuToMM(e, mmCenterN, W, H);
    mmCtx.beginPath(); mmCtx.moveTo(x, 0); mmCtx.lineTo(x, H); mmCtx.stroke();
  }
  for (let n = Math.floor((mmCenterN - mmHalfSpanM) / gStep) * gStep; n <= mmCenterN + mmHalfSpanM; n += gStep) {
    const [, y] = enuToMM(mmCenterE, n, W, H);
    mmCtx.beginPath(); mmCtx.moveTo(0, y); mmCtx.lineTo(W, y); mmCtx.stroke();
  }

  // 3. Cameras + FOV cones
  for (const c of Object.values(cameras || {})) {
    const col = c.role === 'drone' ? '#0284c7' : '#6d28d9';
    const [cx, cy] = enuToMM(c.enu[0], c.enu[1], W, H);
    if (layers.fov) {
      const yawRad = deg2rad(c.yaw_deg || 0);
      const fov = c.role === 'drone' ? 0.52 : 0.70;
      const lenPx = ((c.role === 'drone' ? 16 : 9) / (2 * mmHalfSpanM)) * W;
      mmCtx.fillStyle = col + '28';
      mmCtx.beginPath();
      mmCtx.moveTo(cx, cy);
      mmCtx.arc(cx, cy, lenPx, yawRad - Math.PI / 2 - fov, yawRad - Math.PI / 2 + fov);
      mmCtx.closePath();
      mmCtx.fill();
    }
    mmCtx.fillStyle = col;
    mmCtx.beginPath(); mmCtx.arc(cx, cy, 4, 0, Math.PI * 2); mmCtx.fill();
    mmCtx.strokeStyle = '#ffffff'; mmCtx.lineWidth = 1.4; mmCtx.stroke();
  }

  // 4. Vehicles (oriented footprints + FW LOCK) & moving characters with wakes
  const pxPerM = W / (2 * mmHalfSpanM);
  for (const o of objects) {
    const [ox, oy] = enuToMM(o.enu[0], o.enu[1], W, H);
    if (o.group === 'vehicle') {
      const lenPx = Math.max(10, (o.class_name === 'fire_truck' || o.class_name === 'truck' ? 7.8 : 4.8) * pxPerM);
      const widPx = Math.max(5, (o.class_name === 'fire_truck' || o.class_name === 'truck' ? 2.5 : 1.9) * pxPerM);
      mmCtx.save();
      mmCtx.translate(ox, oy);
      if (o.heading_deg !== null && o.heading_deg !== undefined) mmCtx.rotate(deg2rad(o.heading_deg));
      mmCtx.fillStyle = o.class_name === 'fire_truck' ? '#d1232a' : (o.color || '#475569');
      mmCtx.strokeStyle = '#ffffff';
      mmCtx.lineWidth = o.locked ? 2.0 : 1.2;
      mmCtx.fillRect(-widPx / 2, -lenPx / 2, widPx, lenPx);
      mmCtx.strokeRect(-widPx / 2, -lenPx / 2, widPx, lenPx);
      mmCtx.restore();
      if (o.locked) {
        const lbl = o.class_name === 'fire_truck' ? 'FW LOCK' : o.class_name.toUpperCase();
        mmCtx.fillStyle = 'rgba(255,255,255,0.92)';
        mmCtx.fillRect(ox + 6, oy - 14, lbl.length * 5.6 + 6, 12);
        mmCtx.fillStyle = '#b91c1c';
        mmCtx.font = 'bold 9px ui-monospace, monospace';
        mmCtx.fillText(lbl, ox + 9, oy - 5);
      }
    } else {
      const col = o.posture === 'lying' ? '#dc2626' : (o.class_name === 'uniformed_person' ? '#d97706' : '#0f766e');
      if (layers.trails && o.trail && o.trail.length >= 2) {
        mmCtx.strokeStyle = col + '88';
        mmCtx.lineWidth = 1.5;
        mmCtx.beginPath();
        o.trail.forEach((pt, idx) => {
          const [tx, ty] = enuToMM(pt[0], pt[1], W, H);
          if (idx === 0) mmCtx.moveTo(tx, ty); else mmCtx.lineTo(tx, ty);
        });
        mmCtx.stroke();
      }
      const r = o.class_name === 'uniformed_person' ? 4.4 : 3.6;
      mmCtx.fillStyle = col;
      mmCtx.beginPath(); mmCtx.arc(ox, oy, r, 0, Math.PI * 2); mmCtx.fill();
      mmCtx.strokeStyle = '#ffffff';
      mmCtx.lineWidth = 1.4;
      mmCtx.stroke();
    }
  }

  // 5. Crisp white 10m scale bar
  const barPx = 10 * pxPerM;
  mmCtx.fillStyle = 'rgba(255,255,255,0.90)';
  mmCtx.fillRect(6, H - 18, Math.max(barPx + 30, 48), 13);
  mmCtx.strokeStyle = '#0f3a60'; mmCtx.lineWidth = 2;
  mmCtx.beginPath(); mmCtx.moveTo(11, H - 11); mmCtx.lineTo(11 + barPx, H - 11); mmCtx.stroke();
  mmCtx.fillStyle = '#0f3a60'; mmCtx.font = 'bold 9px ui-monospace, monospace';
  mmCtx.fillText('10m', 14 + barPx, H - 8);
}

// ---- 4. Entity Inspector, Alerts & Bottom Dock Table -----------------------
function selectObject(id) {
  selectedObjectId = id;
  renderInspector(latestObjects);
  renderDock(latestObjects, latestCameras);
  const o = latestObjects.find((x) => x.id === id);
  if (o && leafletMap) {
    const ll = (o.lat && o.lon) ? [o.lat, o.lon] : enuToLatLon(o.enu[0], o.enu[1]);
    leafletMap.panTo(ll, { animate: true });
  }
}

function classColor(o) {
  if (o.class_name === 'fire_truck') return '#d1232a';
  if (o.class_name === 'uniformed_person') return '#d97706';
  if (o.posture === 'lying') return '#dc2626';
  if (o.class_name === 'person') return '#0f766e';
  if (o.class_name === 'police_vehicle') return '#1d4ed8';
  if (o.class_name === 'ambulance') return '#be123c';
  if (o.class_name === 'two_wheeler') return '#7c3aed';
  return '#475569';
}

function renderInspector(objects) {
  const box = $('inspector-body');
  const sel = objects.find((o) => o.id === selectedObjectId);
  $('insp-id').textContent = sel ? `Objekt #${sel.id}` : 'Kein Objekt gewählt';

  let html = '';
  if (sel) {
    const role = sel.sub_role && sel.sub_role !== 'uniformed' ? ` · ${sel.sub_role}` : '';
    const post = sel.posture === 'lying' ? ' · LIEGEND' : '';
    html += `
      <div style="margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--line)">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span class="cls-badge" style="background:${classColor(sel)}">${sel.label_de || sel.class_name}${role}${post}</span>
          ${sel.locked ? (sel.posture === 'lying' ? '<span class="lock-pill">LIEGEND · FIX</span>' : '<span class="lock-pill">ANKER FIXIERT</span>') : '<span class="live-pill">LIVE TRACK</span>'}
        </div>
        <dl class="kv">
          <dt>Objekt-ID</dt><dd>#${sel.id}</dd>
          <dt>WGS84</dt><dd>${sel.lat ? sel.lat.toFixed(6) : '–'}, ${sel.lon ? sel.lon.toFixed(6) : '–'}</dd>
          <dt>ENU (E/N/Z)</dt><dd>${sel.enu[0].toFixed(2)}, ${sel.enu[1].toFixed(2)}, ${sel.enu[2].toFixed(2)} m</dd>
          <dt>Höhe / AMSL</dt><dd>${sel.height_m.toFixed(2)} m (${sel.alt_amsl_m || '–'} m NN)</dd>
          <dt>Konfidenz</dt><dd>${(sel.confidence * 100).toFixed(0)}% (${sel.sightings} Sichtungen)</dd>
          <dt>Sensoren</dt><dd>${(sel.sources || []).join(' + ')}</dd>
        </dl>
      </div>`;
  } else {
    html += `<div class="muted" style="margin-bottom:8px;font-size:11px">Klicken Sie auf ein Objekt auf der 2D-Lagekarte oder in der Tabelle für Detaildaten.</div>`;
  }

  // Live automated operational alerts
  const lying = objects.filter((o) => o.posture === 'lying');
  const fireLocked = objects.filter((o) => o.class_name === 'fire_truck' && o.locked);
  const unif = objects.filter((o) => o.class_name === 'uniformed_person');

  html += `<div style="font-size:10px;font-weight:700;letter-spacing:.45px;text-transform:uppercase;color:var(--ink-3);margin-bottom:5px">Automatische Lagehinweise</div>`;
  if (lying.length > 0) {
    html += `<div class="alert-item crit"><b>${lying.length} liegende Person(en)</b> erkannt (IDs: ${lying.map((x) => '#' + x.id).join(', ')}) — Sichtungspriorität hoch.</div>`;
  }
  if (fireLocked.length > 0) {
    const ft = fireLocked[0];
    html += `<div class="alert-item ok"><b>Feuerwehrfahrzeug #${ft.id}</b> stabil auf Anker fixiert (${ft.enu[0].toFixed(1)}E, ${ft.enu[1].toFixed(1)}N).</div>`;
  }
  html += `<div class="alert-item"><b>${unif.length} Einsatzkräfte</b> und <b>${objects.filter((o) => o.class_name === 'person').length} Zivilpersonen</b> live geortet.</div>`;

  box.innerHTML = html;
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTranscriptTime(item) {
  if (item.source && item.source.endsWith('_audio') && typeof item.stream_t_s === 'number') {
    const s = Math.max(0, Math.floor(item.stream_t_s));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `t+${mm}:${ss}`;
  }
  if (typeof item.ts === 'number' && item.ts > 1e8) {
    const d = new Date(item.ts * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }
  return 'LIVE';
}

function tagSeverityClass(tag) {
  const t = String(tag || '').toLowerCase();
  if (t.includes('sk1') || t.includes('rot') || t.includes('liegend') || t.includes('bewusstlos')) return 'crit';
  if (t.includes('b-problem') || t.includes('atemnot') || t.includes('sk2') || t.includes('gelb') || t.includes('trage') || t.includes('transport')) return 'warn';
  return '';
}

function clientTagTranscript(text) {
  const rules = [
    ['SK1 / Rot', 'crit', /\b(sk\s*1|kategorie\s*1|rot|lebensgefahr|bewusstlos|reanimation|atemstillstand|schockraum|starke\s+blutung|tourniquet)\b/i],
    ['Liegend / Bewusstlos', 'crit', /\b(lieg|am\s+boden|kollab|ohnmacht|reglos)\b/i],
    ['B-Problem / Atemnot', 'warn', /\b(reizgas|pfefferspray|gas|atemnot|schlecht\s+luft|keine\s+luft|luftnot|ausatmen|einatmen|husten|augen|brenn|b-problem)\b/i],
    ['A-Status / Atemweg', 'info', /\b(a-problem|mund\s+auf|atemweg|frei)\b/i],
    ['C-Status / Puls', 'info', /\b(puls|kreislauf|tastbar|blutdruck|blutung|schock|regelmäßig)\b/i],
    ['SK2 / Gelb', 'warn', /\b(sk\s*2|kategorie\s*2|gelb|schwer\s+verletzt|dringlich|instabil)\b/i],
    ['Trage / Transport', 'warn', /\b(trage|transport|abtransport|rettungswagen|rtw|nef|hubschrauber|ablage|bhp|klinik|fahren)\b/i],
    ['SK3 / Grün', 'info', /\b(sk\s*3|kategorie\s*3|grün|gruen|leicht\s+verletzt|gehfähig)\b/i],
    ['Feuerwehr / FW', 'info', /\b(feuerwehr|löschfahrzeug|hlf|dlk|elw|johanniter|florian)\b/i],
    ['Polizei', 'info', /\b(polizei|streife|absperrung)\b/i],
    ['Sichtung / Triage', 'info', /\b(sichtung|triage|gesichtet|patient|verletzte|betroffene|sauerstoff|decke|rettungsdecke)\b/i],
  ];
  const tags = [];
  let sev = 'info';
  const rank = { info: 0, warn: 1, crit: 2 };
  for (const [lbl, lv, rx] of rules) {
    if (rx.test(text)) {
      tags.push(lbl);
      if (rank[lv] > rank[sev]) sev = lv;
    }
  }
  const refs = [];
  const validIds = new Set(latestObjects.map((o) => Number(o.id)));
  const idRx = /(?:#|patient\s+|objekt\s+)(\d{1,4})\b/gi;
  let m;
  while ((m = idRx.exec(text)) !== null) {
    const oid = Number(m[1]);
    if (validIds.has(oid) && !refs.includes(oid)) refs.push(oid);
  }
  if (!refs.length) {
    const low = text.toLowerCase();
    if (/(feuerwehr|fahrzeug|lkw|johanniter|lösch)/.test(low)) {
      const ft = latestObjects.find((o) => o.class_name === 'fire_truck' || o.class_name === 'truck');
      if (ft) refs.push(Number(ft.id));
    }
    if (/(patient|lieg|trage|decke|verletzt|sichtung|reizgas|atemnot|rot)/.test(low)) {
      latestObjects.filter((o) => o.posture === 'lying').slice(0, 2).forEach((o) => {
        if (!refs.includes(Number(o.id))) refs.push(Number(o.id));
      });
    }
  }
  return { tags, severity: sev, refs };
}

let lastTrRenderSig = '';

function renderTranscripts(list, force = false) {
  const items = list || [];
  const cntEl = $('cnt-tr');
  if (cntEl) cntEl.textContent = String(items.length);
  const stEl = $('tr-status');
  if (stEl && !trStatusOverride) {
    stEl.textContent = items.length === 1 ? '1 Eintrag' : `${items.length} Einträge`;
  }
  const box = $('tr-list');
  if (!box) return;
  const sig = items.length === 0
    ? 'empty'
    : `${items.length}:${items[0].id}:${items[items.length - 1].id}:${items[0].text.length}`;
  if (!force && sig === lastTrRenderSig) return;
  lastTrRenderSig = sig;
  if (items.length === 0) {
    box.innerHTML = `<div class="muted" style="font-size:11px">Warte auf BodyCam-Audio, Audio-Upload oder Live-Mikrofon…</div>`;
    return;
  }
  box.innerHTML = items.slice(0, 60).map((it) => {
    const sev = it.severity === 'crit' ? 'crit' : (it.severity === 'warn' ? 'warn' : '');
    const refsHtml = (it.refs || []).map((rid) =>
      `<button type="button" class="ref-chip" data-ref-id="${Number(rid)}" title="Objekt #${Number(rid)} auf Karte auswählen">#${Number(rid)}</button>`
    ).join('');
    const tagsHtml = (it.tags || []).length
      ? `<div class="tr-tags">${it.tags.map((tg) => `<span class="tr-tag ${tagSeverityClass(tg)}">${escHtml(tg)}</span>`).join('')}</div>`
      : '';
    return `
      <div class="tr-item ${sev}">
        <div class="tr-meta">
          <span class="mono">${escHtml(fmtTranscriptTime(it))}</span>
          <b>${escHtml(it.speaker || it.source || 'Audio')}</b>
          ${refsHtml}
        </div>
        <div>${escHtml(it.text)}</div>
        ${tagsHtml}
      </div>`;
  }).join('');

  box.querySelectorAll('.ref-chip[data-ref-id]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectObject(Number(btn.dataset.refId));
    });
  });
}

function renderDock(objects, cameras) {
  const ppl = objects.filter((o) => o.group === 'person');
  const veh = objects.filter((o) => o.group === 'vehicle');
  $('cnt-all').textContent = String(objects.length);
  $('cnt-ppl').textContent = String(ppl.length);
  $('cnt-veh').textContent = String(veh.length);
  if ($('cnt-tr')) $('cnt-tr').textContent = String(latestTranscripts.length);

  const body = $('dock-body');
  if (activeDockTab === 'transcripts') {
    let tlist = latestTranscripts || [];
    if (dockSearchText) {
      const q = dockSearchText.toLowerCase();
      tlist = tlist.filter((t) =>
        (t.text || '').toLowerCase().includes(q)
        || (t.speaker || '').toLowerCase().includes(q)
        || (t.source || '').toLowerCase().includes(q)
        || (t.tags || []).some((tg) => tg.toLowerCase().includes(q))
        || (t.refs || []).some((r) => `#${r}`.includes(q) || String(r).includes(q))
      );
    }
    if (tlist.length === 0) {
      body.innerHTML = `<div class="muted" style="padding:12px;font-size:11.5px">Noch keine Transkriptionen vorhanden. BodyCam-Audio wird synchron abgespielt; zusätzlich können Live-Mikrofon (🎙), Audio-Upload oder Funk-Notizen genutzt werden.</div>`;
      return;
    }
    body.innerHTML = `
      <table class="grid-tbl">
        <thead>
          <tr>
            <th>Zeit</th><th>Quelle / Sprecher</th><th>Transkription</th><th>Klinische / Taktische Tags</th><th>Objekte</th>
          </tr>
        </thead>
        <tbody>
          ${tlist.slice(0, 120).map((it) => `
            <tr>
              <td class="mono">${escHtml(fmtTranscriptTime(it))}</td>
              <td><b>${escHtml(it.speaker || it.source || 'Audio')}</b></td>
              <td style="white-space:normal;max-width:460px">${escHtml(it.text)}</td>
              <td>${(it.tags || []).map((tg) => `<span class="tr-tag ${tagSeverityClass(tg)}" style="margin-right:3px">${escHtml(tg)}</span>`).join('') || '<span class="muted">–</span>'}</td>
              <td>${(it.refs || []).map((rid) => `<button type="button" class="ref-chip" data-ref-id="${Number(rid)}">#${Number(rid)}</button>`).join(' ') || '<span class="muted">–</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    body.querySelectorAll('.ref-chip[data-ref-id]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectObject(Number(btn.dataset.refId));
      });
    });
    return;
  }

  if (activeDockTab === 'summary') {
    const lyingN = objects.filter((o) => o.posture === 'lying').length;
    const fireN = objects.filter((o) => o.class_name === 'fire_truck').length;
    const unifN = objects.filter((o) => o.class_name === 'uniformed_person').length;
    const civN = objects.filter((o) => o.class_name === 'person').length;
    const cams = Object.values(cameras || {});
    const recentTr = (latestTranscripts || []).slice(0, 3);
    body.innerHTML = `
      <div style="padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <div style="font-weight:700;color:var(--accent);margin-bottom:6px;text-transform:uppercase;font-size:10.5px">Aktuelle Lagemeldung (Automatisiert · Live3D)</div>
          <p style="margin:0 0 6px">Im Einsatzraum sind <b>${fireN} Feuerwehrfahrzeug(e)</b>, <b>${unifN} uniformierte Einsatzkräfte</b> sowie <b>${civN} Zivilpersonen</b> (davon <b>${lyingN} liegend</b>) georeferenziert erfasst.</p>
          <p class="muted" style="margin:0 0 8px">Grundlage: Tactical YOLO26m + YOLO26s-Depth + 6-DoF Landmark-VO auf Bayern DGM1/LoD2/DOP20 + lokale Whisper-Sprachtranskription.</p>
          ${recentTr.length ? `<div style="font-weight:700;color:var(--accent);margin-bottom:4px;text-transform:uppercase;font-size:10px">Letzte Transkriptionen (${latestTranscripts.length})</div>${recentTr.map((t) => `<div style="font-size:11px;margin-bottom:3px"><span class="mono muted">${escHtml(fmtTranscriptTime(t))}</span> <b>${escHtml(t.speaker)}:</b> ${escHtml(t.text)}</div>`).join('')}` : ''}
        </div>
        <div>
          <div style="font-weight:700;color:var(--accent);margin-bottom:6px;text-transform:uppercase;font-size:10.5px">Sensor-Telemetrie</div>
          <dl class="kv">
            ${cams.map((c) => `<dt>${c.camera_id.toUpperCase()}</dt><dd>${c.frames || 0}f · ${c.total_ms || 0}ms · ${c.pose_source || 'live'} · Z=${c.enu ? c.enu[2] : 0}m</dd>`).join('') || '<dt>Status</dt><dd>Aufzeichnungsmodus</dd>'}
          </dl>
        </div>
      </div>`;
    return;
  }

  let list = activeDockTab === 'people' ? ppl : (activeDockTab === 'vehicles' ? veh : objects);
  if (dockSearchText) {
    const q = dockSearchText.toLowerCase();
    list = list.filter((o) =>
      String(o.id).includes(q)
      || (o.class_name || '').toLowerCase().includes(q)
      || (o.label_de || '').toLowerCase().includes(q)
      || (o.sub_role || '').toLowerCase().includes(q)
      || (o.posture || '').toLowerCase().includes(q)
    );
  }
  const sorted = [...list].sort((a, b) =>
    ((b.is_emergency ? 1 : 0) - (a.is_emergency ? 1 : 0))
    || ((b.locked ? 1 : 0) - (a.locked ? 1 : 0))
    || ((b.posture === 'lying' ? 1 : 0) - (a.posture === 'lying' ? 1 : 0))
    || ((b.sightings || 0) - (a.sightings || 0))
  );

  body.innerHTML = `
    <table class="grid-tbl">
      <thead>
        <tr>
          <th>#</th><th>Klasse / Rolle</th><th>Status</th><th>Breite / Länge (WGS84)</th><th>ENU E/N/Z (m)</th><th>Höhe</th><th>Sensoren</th><th>Konf.</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.slice(0, 100).map((o) => {
          const role = o.sub_role && o.sub_role !== 'uniformed' ? `:${o.sub_role}` : '';
          const post = o.posture === 'lying' ? ' (liegend)' : '';
          return `
            <tr data-oid="${o.id}" class="${o.id === selectedObjectId ? 'selected' : ''}">
              <td class="mono">${o.id}</td>
              <td><span class="cls-badge" style="background:${classColor(o)}">${o.label_de || o.class_name}${role}${post}</span></td>
              <td>${o.locked ? '<span class="lock-pill">FIXIERT</span>' : '<span class="live-pill">LIVE</span>'}</td>
              <td class="mono">${o.lat ? o.lat.toFixed(6) : '–'}, ${o.lon ? o.lon.toFixed(6) : '–'}</td>
              <td class="mono">${o.enu[0].toFixed(1)}, ${o.enu[1].toFixed(1)}, ${o.enu[2].toFixed(1)}</td>
              <td class="mono">${(o.height_m || 0).toFixed(1)}m</td>
              <td class="mono">${(o.sources || []).join('+')}</td>
              <td class="mono">${Math.round((o.confidence || 0) * 100)}%</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  body.querySelectorAll('tr[data-oid]').forEach((tr) => {
    tr.addEventListener('click', () => selectObject(Number(tr.dataset.oid)));
  });
}

// ---- 5. Apply Unified State to ALL Windows ---------------------------------
function applyStateToUI(data, snapInstant = false) {
  lastStateSnapshot = data;
  latestObjects = data.objects || [];
  latestCameras = data.cameras || {};
  const incomingTr = Array.isArray(data.transcripts) ? data.transcripts : null;
  if (incomingTr !== null) {
    latestTranscripts = isStaticMode ? [...staticManualTranscripts, ...incomingTr] : incomingTr;
  }

  syncLeafletObjects(latestObjects, latestCameras);
  syncThreeObjects(latestObjects, latestCameras, snapInstant);
  drawMinimap(latestObjects, latestCameras);
  renderInspector(latestObjects);
  renderTranscripts(latestTranscripts);
  renderDock(latestObjects, latestCameras);

  // KPIs
  const c = data.counts || {};
  const fireN = (c.fire_truck || 0);
  const unifN = (c.uniformed_person || 0);
  const civN = (c.person || 0);
  const lyingN = latestObjects.filter((o) => o.posture === 'lying').length;
  const emvN = (c.police_vehicle || 0) + (c.ambulance || 0);
  const vehN = (c.car || 0) + (c.truck || 0) + (c.two_wheeler || 0);
  $('k-fire').textContent = String(fireN);
  $('k-unif').textContent = String(unifN);
  $('k-civ').textContent = String(civN);
  $('k-lying').textContent = String(lyingN);
  $('k-emv').textContent = String(emvN);
  $('k-veh').textContent = String(vehN);

  $('map3d-sub').textContent = `Live 3D · ${latestObjects.length} Objekte (${latestObjects.filter((o) => o.locked).length} fixiert)`;
  $('map3d-hud').textContent = `${latestObjects.length} aktive Objekte · 3D-Punktwolke: ${layers.points ? 'Ein' : 'Aus'}`;
  $('meta-voxels').textContent = `${data.voxels_total || 0} (${layers.points ? 'sichtbar' : 'ausgeblendet'})`;
  $('meta-ram').textContent = data.ram_mb ? `${data.ram_mb} MB` : 'Statisch';

  const cams = Object.values(latestCameras);
  $('cam-summary').textContent = `${cams.length} Sensor(en)`;
  if (cams.length) {
    $('meta-perf').textContent = cams.map((x) => `${x.camera_id}: ${x.total_ms || 0}ms`).join(' · ');
    cams.forEach((cm) => {
      const el = $(`stat-${cm.camera_id}`);
      if (el) el.textContent = `${cm.frames || 0}f · ${cm.total_ms || 0}ms · Z=${cm.enu ? cm.enu[2] : 0}m`;
    });
  }
}

// ---- 6. DVR / Time-Rewind Controls (Live Backend + Static Replay) ----------
const slider = $('dvr-slider');
const dvrTimeEl = $('dvr-time');
const btnGoLive = $('btn-go-live');
const btnReplayPlay = $('btn-replay-play');
const imgDrone = $('img-drone');
const imgBodycam = $('img-bodycam');

function setModePill(kind, text) {
  const p = $('b-mode');
  p.className = `status-pill ${kind}`;
  $('b-mode-txt').textContent = text;
}

function stopReplayPlayback() {
  replayPlaying = false;
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
  btnReplayPlay.textContent = '▶ Replay';
  btnReplayPlay.classList.remove('active');
}

async function scrubToSeq(seq) {
  if (isStaticMode) {
    const idx = Math.max(0, Math.min(staticFrames.length - 1, Math.round(seq)));
    staticIdx = idx;
    const fr = staticFrames[idx];
    slider.value = String(idx);
    slider.classList.add('rewound');
    dvrTimeEl.classList.add('rewound');
    dvrTimeEl.textContent = `⏪ t=${fr.t_s.toFixed(1)}s (#${idx + 1}/${staticFrames.length})`;
    setModePill('replay', 'REPLAY');
    btnGoLive.classList.add('needed');
    applyStateToUI(fr, true);
    updateStaticFramesImg(fr);
    return;
  }

  if (histMaxSeq <= 0) return;
  const clamped = Math.max(histMinSeq, Math.min(histMaxSeq, Math.round(seq)));
  if (clamped >= histMaxSeq && !replayPlaying) {
    goLive();
    return;
  }
  isRewound = true;
  currentSeq = clamped;
  slider.value = String(clamped);
  slider.classList.add('rewound');
  dvrTimeEl.classList.add('rewound');
  btnGoLive.classList.add('needed');
  setModePill('replay', 'REPLAY');

  try {
    const res = await fetch(apiUrl(`/api/history/${clamped}`));
    if (!res.ok) return;
    const snap = await res.json();
    applyStateToUI(snap, true);
    const backS = Math.max(0, latestLiveTs - snap.ts);
    dvrTimeEl.textContent = `⏪ -${backS.toFixed(1)}s (#${clamped})`;
    const avail = snap.available_cameras || [];
    if (avail.includes('drone')) {
      imgDrone.style.display = 'block'; $('empty-drone').style.display = 'none';
      imgDrone.src = apiUrl(`/api/history/${clamped}/frame/drone.jpg`);
    }
    if (avail.includes('bodycam')) {
      imgBodycam.style.display = 'block'; $('empty-bodycam').style.display = 'none';
      imgBodycam.src = apiUrl(`/api/history/${clamped}/frame/bodycam.jpg`);
    }
  } catch (e) {
    console.warn('History fetch failed:', e);
  }
}

function goLive() {
  stopReplayPlayback();
  if (isStaticMode) {
    staticPlaying = true;
    slider.classList.remove('rewound');
    dvrTimeEl.classList.remove('rewound');
    btnGoLive.classList.remove('needed');
    setModePill('static', 'REIZGAS LIVE3D');
    return;
  }
  if (!isRewound) return;
  isRewound = false;
  slider.classList.remove('rewound');
  dvrTimeEl.classList.remove('rewound');
  btnGoLive.classList.remove('needed');
  setModePill('live', 'LIVE');
  const bust = Date.now();
  imgDrone.src = apiUrl(`/api/stream/drone.mjpg?t=${bust}`);
  imgBodycam.src = apiUrl(`/api/stream/bodycam.mjpg?t=${bust}`);
}

function jumpSeconds(deltaS) {
  if (isStaticMode) {
    staticPlaying = false;
    const step = Math.round(deltaS / 0.4);
    scrubToSeq(staticIdx + step);
    return;
  }
  if (histMaxSeq <= histMinSeq) return;
  const approxHz = (histMaxSeq - histMinSeq) / Math.max(histDurationS, 0.5);
  const sign = deltaS < 0 ? -1 : 1;
  const stepSeq = sign * Math.max(1, Math.round(Math.abs(deltaS) * approxHz));
  const baseSeq = isRewound ? currentSeq : histMaxSeq;
  const target = baseSeq + stepSeq;
  if (target >= histMaxSeq) goLive();
  else { stopReplayPlayback(); scrubToSeq(target); }
}

slider.addEventListener('input', () => {
  stopReplayPlayback();
  const val = parseInt(slider.value, 10);
  if (isStaticMode) {
    staticPlaying = false;
    scrubToSeq(val);
    return;
  }
  if (val >= histMaxSeq) goLive();
  else scrubToSeq(val);
});

$('btn-back-30').onclick = () => jumpSeconds(-30);
$('btn-back-10').onclick = () => jumpSeconds(-10);
$('btn-back-3').onclick  = () => jumpSeconds(-3);
$('btn-fwd-3').onclick   = () => jumpSeconds(+3);
btnGoLive.onclick = goLive;

btnReplayPlay.onclick = () => {
  if (isStaticMode) {
    staticPlaying = !staticPlaying;
    btnReplayPlay.textContent = staticPlaying ? '⏸ Pause Replay' : '▶ Replay';
    btnReplayPlay.classList.toggle('active', staticPlaying);
    return;
  }
  if (!isRewound) jumpSeconds(-10);
  if (replayPlaying) { stopReplayPlayback(); return; }
  replayPlaying = true;
  btnReplayPlay.textContent = '⏸ Pause Replay';
  btnReplayPlay.classList.add('active');
  replayTimer = setInterval(() => {
    if (currentSeq + 1 >= histMaxSeq) goLive();
    else scrubToSeq(currentSeq + 1);
  }, 360);
};

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); jumpSeconds(e.shiftKey ? -10 : -3); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); jumpSeconds(e.shiftKey ? 10 : 3); }
  else if (e.key === 'l' || e.key === 'L') goLive();
  else if (e.key === ' ') {
    e.preventDefault();
    if (isRewound || isStaticMode) btnReplayPlay.click();
    else fetch(apiUrl('/api/pause'), { method: 'POST' });
  }
});

// ---- 6b. Live Microphone (Web Speech / Whisper), Audio Upload & Radio Entry -
function setTrStatusTemp(msg, resetAfterMs = 0) {
  trStatusOverride = msg;
  if ($('tr-status')) $('tr-status').textContent = msg || `${latestTranscripts.length} Einträge`;
  if (resetAfterMs > 0) {
    setTimeout(() => {
      if (trStatusOverride === msg) {
        trStatusOverride = '';
        renderTranscripts(latestTranscripts);
      }
    }, resetAfterMs);
  }
}

async function submitTranscriptText(text, source = 'radio', speaker = 'Sprechfunk / Leitstelle') {
  const clean = String(text || '').trim();
  if (!clean) return;
  if (isStaticMode) {
    const tagged = clientTagTranscript(clean);
    const entry = {
      id: nextStaticTrId++,
      ts: Date.now() / 1000,
      stream_t_s: 0,
      source,
      speaker,
      text: clean,
      tags: tagged.tags,
      severity: tagged.severity,
      refs: tagged.refs,
    };
    staticManualTranscripts = [entry, ...staticManualTranscripts].slice(0, 80);
    latestTranscripts = [entry, ...latestTranscripts];
    renderTranscripts(latestTranscripts);
    renderDock(latestObjects, latestCameras);
    return;
  }
  try {
    const res = await fetch(apiUrl('/api/transcript'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, source, speaker }),
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload.entry) {
        latestTranscripts = [payload.entry, ...latestTranscripts.filter((x) => x.id !== payload.entry.id)];
        renderTranscripts(latestTranscripts);
        renderDock(latestObjects, latestCameras);
      }
    }
  } catch (err) {
    console.warn('POST /api/transcript failed:', err);
  }
}

async function sendAudioToWhisper(blobOrBytes, source = 'upload', speaker = 'Audio-Upload (Whisper)') {
  if (isStaticMode) {
    setTrStatusTemp('Lokaler Whisper erfordert Live-Server', 3500);
    return;
  }
  setTrStatusTemp('Transkribiere (Whisper)…');
  try {
    const qs = `source=${encodeURIComponent(source)}&speaker=${encodeURIComponent(speaker)}`;
    const res = await fetch(apiUrl(`/api/transcribe?${qs}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: blobOrBytes,
    });
    if (!res.ok) {
      const detail = await res.text();
      setTrStatusTemp('Whisper Fehler', 3500);
      console.warn('POST /api/transcribe failed:', detail);
      return;
    }
    const payload = await res.json();
    trStatusOverride = '';
    if (payload.entry) {
      latestTranscripts = [payload.entry, ...latestTranscripts.filter((x) => x.id !== payload.entry.id)];
      renderTranscripts(latestTranscripts);
      renderDock(latestObjects, latestCameras);
    } else {
      setTrStatusTemp('Keine Sprache erkannt', 2500);
    }
  } catch (err) {
    console.warn('Audio transcription failed:', err);
    setTrStatusTemp('Audio-Fehler', 3000);
  }
}

function bindTranscriptionControls() {
  const input = $('tr-input');
  const sendBtn = $('tr-send');
  const fileIn = $('tr-file');
  const micBtn = $('btn-mic');

  const sendManual = () => {
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    input.value = '';
    submitTranscriptText(val, 'radio', 'Sprechfunk / Leitstelle');
  };
  if (sendBtn) sendBtn.addEventListener('click', sendManual);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); sendManual(); }
    });
  }
  if (fileIn) {
    fileIn.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const buf = await file.arrayBuffer();
      await sendAudioToWhisper(buf, 'upload', `${file.name} (Whisper)`);
      fileIn.value = '';
    });
  }

  if (!micBtn) return;
  let micActive = false;
  let speechRec = null;
  let mediaRec = null;
  let mediaStream = null;
  let audioChunks = [];

  const updateMicUi = (on) => {
    micBtn.classList.toggle('mic-on', on);
    micBtn.textContent = on ? '🎙 Funk / Mikro: Aktiv' : '🎙 Funk / Mikro: Aus';
  };

  const stopMic = () => {
    micActive = false;
    updateMicUi(false);
    trStatusOverride = '';
    if (speechRec) {
      try { speechRec.stop(); } catch { /* ignore */ }
      speechRec = null;
    }
    if (mediaRec && mediaRec.state !== 'inactive') {
      try { mediaRec.stop(); } catch { /* ignore */ }
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
    renderTranscripts(latestTranscripts);
  };

  micBtn.addEventListener('click', async () => {
    if (micActive) {
      stopMic();
      return;
    }
    // Ensure transcription pane is visible when mic is enabled
    if ((layout.trH ?? 196) < 80) {
      layout.trH = 196;
      applyLayout();
      saveLayout();
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRec) {
      micActive = true;
      updateMicUi(true);
      setTrStatusTemp('🎙 Höre zu (de-DE)…');
      const rec = new SpeechRec();
      rec.lang = 'de-DE';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (ev) => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          const txt = r[0] ? r[0].transcript : '';
          if (r.isFinal && txt.trim()) {
            submitTranscriptText(txt.trim(), 'microphone', 'Mikrofon (Live)');
          } else {
            interim += txt;
          }
        }
        if (interim.trim()) setTrStatusTemp(`🎙 „${interim.trim().slice(0, 36)}…“`);
        else setTrStatusTemp('🎙 Höre zu (de-DE)…');
      };
      rec.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          stopMic();
          setTrStatusTemp('Mikrofon-Zugriff verweigert', 3500);
        }
      };
      rec.onend = () => {
        if (micActive) {
          try { rec.start(); } catch { stopMic(); }
        }
      };
      speechRec = rec;
      try {
        rec.start();
      } catch {
        stopMic();
      }
      return;
    }

    // Fallback: record locally with MediaRecorder and transcribe on stop via local Whisper (/api/transcribe)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      setTrStatusTemp('Mikrofon im Browser nicht unterstützt', 3500);
      return;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      mediaRec = new MediaRecorder(mediaStream);
      mediaRec.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunks.push(e.data); };
      mediaRec.onstop = async () => {
        const blob = new Blob(audioChunks, { type: mediaRec.mimeType || 'audio/webm' });
        audioChunks = [];
        if (blob.size > 400) await sendAudioToWhisper(blob, 'microphone', 'Mikrofon (Whisper)');
      };
      micActive = true;
      updateMicUi(true);
      setTrStatusTemp('🎙 Aufnahme läuft (Stopp → Whisper)…');
      mediaRec.start();
    } catch {
      stopMic();
      setTrStatusTemp('Mikrofon-Zugriff verweigert', 3500);
    }
  });
}

// ---- 7. Point-Cloud & Layer Toggles + Exports ------------------------------
function setPointCloudVisible(on) {
  layers.points = Boolean(on);
  if (pointCloud) pointCloud.visible = layers.points;
  const txt = layers.points ? '3D-Punktwolke: Ein' : '3D-Punktwolke: Aus';
  $('btn-points').textContent = txt;
  $('btn-points').classList.toggle('active', layers.points);
  $('btn-3d-pts').textContent = layers.points ? 'Punktwolke: Ein' : 'Punktwolke: Aus';
  $('btn-3d-pts').classList.toggle('active', layers.points);
  $('chk-points').checked = layers.points;
  $('tag-points').textContent = layers.points ? 'EIN' : 'AUS';
  $('tag-points').className = `tag-mini ${layers.points ? 'on' : 'off'}`;
  if (lastStateSnapshot) {
    $('meta-voxels').textContent = `${lastStateSnapshot.voxels_total || 0} (${layers.points ? 'sichtbar' : 'ausgeblendet'})`;
    $('map3d-hud').textContent = `${latestObjects.length} aktive Objekte · 3D-Punktwolke: ${layers.points ? 'Ein' : 'Aus'}`;
  }
}

$('btn-points').onclick = () => setPointCloudVisible(!layers.points);
$('btn-3d-pts').onclick = () => setPointCloudVisible(!layers.points);
$('chk-points').onchange = (e) => setPointCloudVisible(e.target.checked);

$('btn-minimap').onclick = () => {
  layers.minimap = !layers.minimap;
  if (layers.minimap && layout.mmSize < 60) layout.mmSize = 212;
  applyLayout(); saveLayout();
};
$('chk-minimap').onchange = (e) => {
  layers.minimap = e.target.checked;
  if (layers.minimap && layout.mmSize < 60) layout.mmSize = 212;
  applyLayout(); saveLayout();
};
$('chk-ortho2d').onchange = (e) => { layers.ortho2d = e.target.checked; syncOrtho2D(); };
$('chk-trails').onchange = (e) => { layers.trails = e.target.checked; syncLeafletObjects(latestObjects, latestCameras); drawMinimap(latestObjects, latestCameras); };
$('chk-fov').onchange = (e) => { layers.fov = e.target.checked; syncLeafletObjects(latestObjects, latestCameras); drawMinimap(latestObjects, latestCameras); };
$('chk-grid').onchange = (e) => { layers.grid = e.target.checked; if (gridHelper) gridHelper.visible = layers.grid; };

$('btn-3d-home').onclick = homeView3D;
$('btn-3d-top').onclick = topView3D;

// Dock tabs + search
document.querySelectorAll('.dtab[data-tab]').forEach((t) => {
  t.addEventListener('click', () => {
    activeDockTab = t.dataset.tab;
    document.querySelectorAll('.dtab[data-tab]').forEach((b) => b.classList.toggle('active', b === t));
    renderDock(latestObjects, latestCameras);
  });
});
$('dock-search').addEventListener('input', (e) => {
  dockSearchText = e.target.value.trim();
  renderDock(latestObjects, latestCameras);
});

// CSV Export
$('btn-csv').addEventListener('click', () => {
  const rows = [['id', 'class_name', 'label_de', 'sub_role', 'posture', 'locked', 'lat', 'lon', 'alt_amsl_m', 'enu_e', 'enu_n', 'enu_z', 'height_m', 'confidence', 'sources']];
  for (const o of latestObjects) {
    rows.push([
      o.id, o.class_name, o.label_de || '', o.sub_role || '', o.posture || '',
      o.locked ? 'true' : 'false', o.lat || '', o.lon || '', o.alt_amsl_m || '',
      o.enu[0], o.enu[1], o.enu[2], o.height_m || '', o.confidence || '', (o.sources || []).join('+'),
    ]);
  }
  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'triarge-live3d-objekte.csv';
  a.click();
});

$('btn-pause').onclick = () => {
  if (isStaticMode) {
    staticPlaying = !staticPlaying;
    $('btn-pause').textContent = staticPlaying ? 'Pause' : 'Fortsetzen';
  } else {
    fetch(apiUrl('/api/pause'), { method: 'POST' });
  }
};
$('btn-reset').onclick = async () => {
  staticManualTranscripts = [];
  if (isStaticMode) {
    staticIdx = 0;
    staticPlaying = true;
    scrubToSeq(0);
    goLive();
    return;
  }
  goLive();
  await fetch(apiUrl('/api/reset'), { method: 'POST' });
  appendPoints([], [], true);
  applyStateToUI({ objects: [], cameras: {}, counts: {}, transcripts: [], voxels_total: 0, ram_mb: 0 }, true);
};

// ---- 8. Static Real-Data Playback Mode (for jar-medical.tech/demo/) --------
function updateStaticFramesImg(fr) {
  if (fr.drone_img) {
    imgDrone.style.display = 'block'; $('empty-drone').style.display = 'none';
    imgDrone.src = fr.drone_img;
  }
  if (fr.bodycam_img) {
    imgBodycam.style.display = 'block'; $('empty-bodycam').style.display = 'none';
    imgBodycam.src = fr.bodycam_img;
  }
}

function startStaticReplay(bundle) {
  isStaticMode = true;
  staticFrames = bundle.frames || [];
  setModePill('static', 'REIZGAS LIVE3D');
  $('btn-geojson').onclick = (e) => {
    e.preventDefault();
    const gj = {
      type: 'FeatureCollection',
      features: latestObjects.map((o) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [o.lon, o.lat, o.alt_amsl_m || 555] },
        properties: { ...o },
      })),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(gj, null, 2)], { type: 'application/geo+json' }));
    a.download = 'triarge-live3d-reizgas.geojson';
    a.click();
  };

  if (bundle.geomap) {
    const gm = bundle.geomap;
    $('terrain-badge').textContent = `${gm.meta.terrain_source}`;
    $('meta-anchor').textContent = `${gm.meta.lat0.toFixed(5)}°N, ${gm.meta.lon0.toFixed(5)}°E`;
    $('meta-terrain').textContent = `${gm.meta.terrain_source} · ${gm.meta.imagery_source}`;
    if (gm.texture_data_url) {
      const img = new Image();
      img.onload = () => { orthoImg = img; drawMinimap(latestObjects, latestCameras); };
      img.src = gm.texture_data_url;
    }
    setGeoMap2DOverlay(gm.meta, gm.texture_data_url);
    setGeoMap3DTerrain(gm);
  }
  if (bundle.taxonomy) renderLegend(bundle.taxonomy);

  slider.min = '0';
  slider.max = String(Math.max(0, staticFrames.length - 1));
  if (staticFrames.length > 0) {
    applyStateToUI(staticFrames[0], true);
    updateStaticFramesImg(staticFrames[0]);
  }
  staticTimer = setInterval(() => {
    if (!staticPlaying || staticFrames.length === 0) return;
    staticIdx = (staticIdx + 1) % staticFrames.length;
    const fr = staticFrames[staticIdx];
    slider.value = String(staticIdx);
    dvrTimeEl.textContent = `● ECHTDATEN t=${fr.t_s.toFixed(1)}s`;
    applyStateToUI(fr, staticIdx === 0);
    updateStaticFramesImg(fr);
  }, 400);
}

// ---- 9. Live Backend Connection (FastAPI + WebSocket + MJPEG) --------------
function renderLegend(specs) {
  $('legend-list').innerHTML = specs.map((s) =>
    `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:2px;background:${s.color_hex}"></span>${s.label_de || s.label_en}</span>`
  ).join('')
    + `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:var(--drone)"></span>Drohne</span>`
    + `<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:var(--bodycam)"></span>BodyCam</span>`;
}

async function initLiveBackend() {
  const [taxRes, gmRes] = await Promise.all([
    fetch(apiUrl('/api/taxonomy')),
    fetch(apiUrl('/api/geomap')),
  ]);
  if (!taxRes.ok || !gmRes.ok) throw new Error('Live backend unavailable');
  const specs = await taxRes.json();
  const gm = await gmRes.json();
  renderLegend(specs);

  // Wire live MJPEG streams only after live backend is verified
  const wireImg = (img, emptyEl, path) => {
    img.onerror = () => { img.style.display = 'none'; emptyEl.style.display = 'block'; };
    img.onload = () => { img.style.display = 'block'; emptyEl.style.display = 'none'; };
    img.src = apiUrl(path);
  };
  wireImg(imgDrone, $('empty-drone'), '/api/stream/drone.mjpg');
  wireImg(imgBodycam, $('empty-bodycam'), '/api/stream/bodycam.mjpg');
  $('btn-geojson').href = apiUrl('/api/objects.geojson');

  const m = gm.meta;
  $('terrain-badge').textContent = `${m.terrain_source}`;
  $('meta-anchor').textContent = `${m.lat0.toFixed(5)}°N, ${m.lon0.toFixed(5)}°E (${m.base_elevation_m}m)`;
  $('meta-terrain').textContent = `${m.terrain_source} · ${m.imagery_source}`;
  if (gm.texture_data_url) {
    const img = new Image();
    img.onload = () => { orthoImg = img; drawMinimap(latestObjects, latestCameras); };
    img.src = gm.texture_data_url;
  }
  setGeoMap2DOverlay(m, gm.texture_data_url);
  setGeoMap3DTerrain(gm);

  // Connect WebSocket
  function connectWS() {
    const wsUrl = API_BASE
      ? API_BASE.replace(/^http/, 'ws') + '/ws'
      : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    ws.onopen = () => { if (!isRewound) setModePill('live', 'LIVE'); };
    ws.onclose = () => {
      if (!isRewound) setModePill('', 'Verbinde neu…');
      setTimeout(connectWS, 1500);
    };
    ws.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.voxel_snapshot) appendPoints(data.voxel_snapshot.positions, data.voxel_snapshot.colors, true);
      if (data.voxel_delta && data.voxel_delta.positions.length) appendPoints(data.voxel_delta.positions, data.voxel_delta.colors, false);

      latestLiveTs = data.ts || latestLiveTs;
      const hm = data.history || {};
      if (hm.max_seq > 0) {
        histMinSeq = hm.min_seq;
        histMaxSeq = hm.max_seq;
        histDurationS = hm.duration_s || 0;
        slider.min = String(histMinSeq);
        slider.max = String(histMaxSeq);
        if (!isRewound) {
          slider.value = String(histMaxSeq);
          dvrTimeEl.textContent = `● LIVE (${histDurationS.toFixed(0)}s Puffer)`;
        }
      }
      $('btn-pause').textContent = data.paused ? 'Fortsetzen' : 'Pause';
      if (!isRewound) applyStateToUI(data, false);
    };
  }
  connectWS();
}

// ---- Boot Sequence ---------------------------------------------------------
initLeaflet();
initThree();
bindSliders();
bindTranscriptionControls();
setPointCloudVisible(false); // Strictly OFF by default!
applyLayout();
renderTranscripts([]);
drawMinimap([], {});
window.addEventListener('resize', () => {
  if (leafletMap) leafletMap.invalidateSize({ animate: false });
  resizeThree();
});

(async function boot() {
  if (IS_STATIC_ONLY) {
    startStaticReplay(window.LIVE3D_STATIC_REPLAY);
    return;
  }
  try {
    await initLiveBackend();
  } catch (err) {
    if (window.LIVE3D_STATIC_REPLAY) {
      startStaticReplay(window.LIVE3D_STATIC_REPLAY);
    } else {
      setModePill('', 'Offline');
      console.warn('No live backend or static replay bundle found:', err);
    }
  }
})();
