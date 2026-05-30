/**
 * @file Campfire scene object: log geometry + stacked particle layers.
 *
 * Particle simulation: `particleLayer.js`. UI: `campfireControls.js`.
 */
import * as THREE from "three";
import {
  createFireParticleLayer,
  createSmokeParticles,
  RENDER_ORDER_EMBERS,
  RENDER_ORDER_FIRE,
  RENDER_ORDER_SMOKE,
} from "./particleLayer.js";

/** Max particles per layer (`count` in particleLayer); density slider uses a fraction. */
const FIRE_LAYER_DEFAULTS = {
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
  /**
   * @param {THREE.Vector3} position — world position of camp center (from heightmap).
   */
  constructor(position) {
    this.group = new THREE.Group();
    this.group.position.copy(position);

    this._buildLogs();
    this._addParticleLayers();

    this.group.userData.fireLightPosition = new THREE.Vector3(0, 0.6, 0);
  }

  _addParticleLayers() {
    this.fireEmbers = createFireParticleLayer(FIRE_LAYER_DEFAULTS.embers);
    this.fireEmbers.system.position.y = 0.32;
    this.fireEmbers.system.renderOrder = RENDER_ORDER_EMBERS;
    this.group.add(this.fireEmbers.system);

    this.fire = createFireParticleLayer(FIRE_LAYER_DEFAULTS.core);
    this.fire.system.position.y = 0.35;
    this.fire.system.renderOrder = RENDER_ORDER_FIRE;
    this.group.add(this.fire.system);

    this.smoke = createSmokeParticles(FIRE_LAYER_DEFAULTS.smoke);
    this.smoke.system.position.y = 0.5;
    this.smoke.system.renderOrder = RENDER_ORDER_SMOKE;
    this.group.add(this.smoke.system);
  }

  _buildLogs() {
    const logMat = new THREE.MeshStandardMaterial({
      color: 0x3d2817,
      roughness: 0.9,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4a,
      roughness: 0.85,
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.12, 8, 24),
      rockMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.06;
    // Optional stone ring: this.group.add(ring);

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

  /** Advance fire, ember, and smoke simulations. */
  update(dt) {
    this.fire.update(dt);
    this.fireEmbers.update(dt);
    this.smoke.update(dt);
  }
}
