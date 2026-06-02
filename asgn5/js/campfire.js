import * as THREE from "three";
import { createFireParticleLayer, createSmokeParticles } from "./particleLayer.js";

const FIRE_OPTS = {
  embers: {
    count: 1024,
    pointSize: 108,
    speedMul: 0.82,
    lifeMul: 1.15,
    spreadMul: 1.1,
    alphaScale: 0.48,
    warmth: 0.65,
    drift: true,
    sizeShrink: 0.45,
  },
  core: {
    count: 1024,
    pointSize: 90,
    speedMul: 1,
    lifeMul: 1,
    spreadMul: 1,
    alphaScale: 0.9,
    warmth: 0,
  },
  smoke: {
    count: 1024,
    pointSize: 88,
    alphaScale: 0.48,
    baseSpeed: 1,
  },
};

export class Campfire {
  constructor(pos) {
    this.group = new THREE.Group();
    this.group.position.copy(pos);

    this._buildLogs();
    this._addParticles();

    this.group.userData.fireLightPosition = new THREE.Vector3(0, 0.6, 0);
  }

  _addParticles() {
    this.fireEmbers = createFireParticleLayer(FIRE_OPTS.embers);
    this.fireEmbers.system.position.y = 0.32;
    this.fireEmbers.system.renderOrder = 100;
    this.group.add(this.fireEmbers.system);

    this.fire = createFireParticleLayer(FIRE_OPTS.core);
    this.fire.system.position.y = 0.35;
    this.fire.system.renderOrder = 101;
    this.group.add(this.fire.system);

    this.smoke = createSmokeParticles(FIRE_OPTS.smoke);
    this.smoke.system.position.y = 0.5;
    this.smoke.system.renderOrder = 102;
    this.group.add(this.smoke.system);
  }

  _buildLogs() {
    const logMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.9,
    });

    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8),
        logMat
      );
      const angle = (i / 5) * Math.PI * 2;
      log.position.set(Math.cos(angle) * 0.25, 0.12, Math.sin(angle) * 0.25);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = angle;
      this.group.add(log);
    }
  }

  update(dt) {
    this.fire.update(dt);
    this.fireEmbers.update(dt);
    this.smoke.update(dt);
  }
}
