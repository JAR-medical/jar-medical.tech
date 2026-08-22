import * as THREE from "../vendor/three.module.js";

const SEVERITY_COLORS = { rot: 0xff4136, gelb: 0xffd23f };
const SAVED_COLOR = 0x57d94a;
const DEAD_COLOR = 0x77777c;
const SKIN_TONES = [0xd9a066, 0xc68b59, 0xb87a4b, 0xe0ac7e, 0xa8703f, 0xd29b6a];

function makeNameSprite(id, name) {
  const canvas = document.createElement("canvas");
  canvas.width = 360;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(10,12,8,0.78)";
  ctx.beginPath();
  ctx.roundRect(4, 4, 352, 56, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 22px 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${id} · ${name}`, 180, 32, 338);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  return new THREE.Sprite(material);
}

export class PatientManager {
  constructor(scene) {
    this.scene = scene;
    this.patients = [];
    this.effects = [];
  }

  spawn(cases, spots) {
    for (let i = 0; i < cases.length && i < spots.length; i++) {
      this._spawnPatient(cases[i], spots[i], i);
    }
  }

  _spawnPatient(caseTemplate, spot, index) {
    const group = new THREE.Group();
    const skinTone = SKIN_TONES[index % SKIN_TONES.length];
    const shirtColor = SEVERITY_COLORS[caseTemplate.severity] || SEVERITY_COLORS.gelb;

    const skinMat = new THREE.MeshLambertMaterial({ color: skinTone });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.28, 0.95), shirtMat);
    torso.position.set(0, 0.15, 0);
    group.add(torso);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skinMat);
    head.position.set(0, 0.22, 0.72);
    group.add(head);

    const armGeo = new THREE.BoxGeometry(0.18, 0.18, 0.78);
    const armL = new THREE.Mesh(armGeo, shirtMat);
    armL.position.set(-0.38, 0.14, -0.05);
    armL.rotation.x = 0.25;
    group.add(armL);
    const armR = new THREE.Mesh(armGeo, shirtMat);
    armR.position.set(0.38, 0.14, -0.05);
    armR.rotation.x = 0.25;
    group.add(armR);

    const legGeo = new THREE.BoxGeometry(0.22, 0.22, 0.82);
    const legL = new THREE.Mesh(legGeo, pantsMat);
    legL.position.set(-0.14, 0.13, -0.92);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, pantsMat);
    legR.position.set(0.14, 0.13, -0.92);
    group.add(legR);

    const beaconMat = new THREE.MeshBasicMaterial({
      color: shirtColor,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 6, 0.14), beaconMat);
    beacon.position.set(0, 3, 0);
    group.add(beacon);

    const sprite = makeNameSprite(
      `P${index + 1}`,
      caseTemplate.name || caseTemplate.displayName || "Patient"
    );
    sprite.position.set(0, 2.45, 0);
    sprite.scale.set(2.55, 0.45, 1);
    group.add(sprite);

    group.position.set(spot.x, spot.y, spot.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(group);

    this.patients.push({
      id: `P${index + 1}`,
      caseId: caseTemplate.id,
      name: caseTemplate.name || caseTemplate.displayName || "Patient",
      pos: new THREE.Vector3(spot.x, spot.y, spot.z),
      severity: caseTemplate.severity,
      resolved: false,
      saved: false,
      dead: false,
      mesh: group,
      torso,
      shirtMat,
      pantsMat,
      skinMat,
      beaconMat,
      phase: Math.random() * Math.PI * 2,
    });
  }

  update(dt, elapsed) {
    for (const p of this.patients) {
      if (!p.resolved) {
        p.torso.scale.y = 1 + 0.04 * Math.sin(elapsed * 2 + p.phase);
        p.beaconMat.opacity = 0.35 + 0.15 * Math.sin(elapsed * 3 + p.phase);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.age += dt;
      fx.points.position.y += dt * 1.1;
      fx.points.material.opacity = Math.max(0, 1 - fx.age / fx.ttl);
      if (fx.age >= fx.ttl) {
        this.scene.remove(fx.points);
        fx.points.geometry.dispose();
        fx.points.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  getById(id) {
    return this.patients.find((p) => p.id === id) || null;
  }

  getAll() {
    return this.patients;
  }

  getNearest(pos, maxDist) {
    let best = null;
    let bestDist = maxDist * maxDist;
    for (const p of this.patients) {
      const dx = p.pos.x - pos.x;
      const dy = p.pos.y - pos.y;
      const dz = p.pos.z - pos.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < bestDist) {
        bestDist = d2;
        best = p;
      }
    }
    return best;
  }

  markSaved(id) {
    const p = this.getById(id);
    if (!p) return;
    p.resolved = true;
    p.saved = true;
    p.shirtMat.color.setHex(SAVED_COLOR);
    p.beaconMat.color.setHex(SAVED_COLOR);
    p.beaconMat.opacity = 0.35;
  }

  markDead(id) {
    const p = this.getById(id);
    if (!p) return;
    p.resolved = true;
    p.dead = true;
    p.shirtMat.color.setHex(DEAD_COLOR);
    p.skinMat.color.setHex(DEAD_COLOR);
    p.pantsMat.color.setHex(DEAD_COLOR);
    if (p.mesh) {
      for (const child of p.mesh.children) {
        if (child.material === p.beaconMat) {
          this.scene.remove(child);
          child.geometry.dispose();
          p.beaconMat.dispose();
          break;
        }
      }
    }
  }

  treatmentFx(id, color = SAVED_COLOR) {
    const p = this.getById(id);
    if (!p) return;
    const count = 24;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = p.pos.x + (Math.random() - 0.5) * 0.9;
      positions[i * 3 + 1] = p.pos.y + 0.3 + Math.random() * 0.4;
      positions[i * 3 + 2] = p.pos.z + (Math.random() - 0.5) * 0.9;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.16,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    this.scene.add(points);
    this.effects.push({ points, age: 0, ttl: 1.6 });
  }

  healFx(id) {
    this.treatmentFx(id, SAVED_COLOR);
  }

  reset() {
    for (const p of this.patients) {
      this.scene.remove(p.mesh);
      p.mesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material && child.material !== p.shirtMat && child.material !== p.skinMat && child.material !== p.pantsMat) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      p.shirtMat.dispose();
      p.skinMat.dispose();
      p.pantsMat.dispose();
    }
    for (const fx of this.effects) {
      this.scene.remove(fx.points);
      fx.points.geometry.dispose();
      fx.points.material.dispose();
    }
    this.patients = [];
    this.effects = [];
  }
}
