/**
 * @file GPU point-sprite particle systems for campfire fire and smoke.
 *
 * Each layer exposes:
 * - `system` — THREE.Points mesh
 * - `update(dt)` — simulation step
 * - `setEnabled`, `setSpeedMul`, `setSizeMul`, `setOpacityMul`, `setRadiusMul`, `setDensityMul`
 *
 * GLSL sources live in `shaders.js`.
 */
import * as THREE from "three";
import {
  fireParticleVertexShader,
  fireParticleFragmentShader,
  smokeParticleVertexShader,
  smokeParticleFragmentShader,
} from "./shaders.js";

/** Nudge sprites toward camera in clip space (used when depthTest is enabled). */
export const PARTICLE_DEPTH_BIAS = 0.02;

/** Draw order: water/fog below, particles above (see terrain renderOrder). */
export const RENDER_ORDER_EMBERS = 100;
export const RENDER_ORDER_FIRE = 101;
export const RENDER_ORDER_SMOKE = 102;

const DEFAULT_DENSITY = 0.3;

// ---------------------------------------------------------------------------
// Runtime tuning (sliders in campfireControls.js)
// ---------------------------------------------------------------------------

function createParticleTuning(base) {
  return {
    enabled: true,
    speedMul: 1,
    sizeMul: 1,
    opacityMul: 1,
    radiusMul: 1,
    densityMul: DEFAULT_DENSITY,
    base,
    effectiveSpeed() {
      return this.base.speedMul * this.speedMul;
    },
    effectiveSpread() {
      return this.base.spreadMul * this.radiusMul;
    },
  };
}

function activeParticleCount(count, densityMul) {
  return Math.max(1, Math.round(count * densityMul));
}

function applyFireUniforms(material, tuning) {
  material.uniforms.uPointSize.value = tuning.base.pointSize * tuning.sizeMul;
  material.uniforms.uAlphaScale.value =
    tuning.base.alphaScale * tuning.opacityMul;
}

function applySmokeUniforms(material, tuning) {
  material.uniforms.uPointSize.value = tuning.base.pointSize * tuning.sizeMul;
  material.uniforms.uAlphaScale.value =
    tuning.base.alphaScale * tuning.opacityMul;
}

function makeParticleApi(system, tuning, applyUniforms, sim) {
  return {
    system,
    tuning,
    get count() {
      return sim.count;
    },
    setEnabled(on) {
      tuning.enabled = on;
      system.visible = on;
    },
    setSpeedMul(m) {
      const prev = tuning.speedMul;
      tuning.speedMul = m;
      return prev;
    },
    setSizeMul(m) {
      tuning.sizeMul = m;
      applyUniforms(system.material, tuning);
    },
    setOpacityMul(m) {
      tuning.opacityMul = m;
      applyUniforms(system.material, tuning);
    },
    setRadiusMul(m) {
      tuning.radiusMul = m;
    },
    setDensityMul(m) {
      const prev = activeParticleCount(sim.count, tuning.densityMul);
      tuning.densityMul = THREE.MathUtils.clamp(m, 0.1, 1);
      const next = activeParticleCount(sim.count, tuning.densityMul);
      if (next > prev) {
        for (let i = prev; i < next; i++) sim.reset(i, true);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Fire (additive sprites)
// ---------------------------------------------------------------------------

function resetFireParticle(
  i,
  positions,
  velocities,
  lifetimes,
  sizes,
  initial,
  { speedMul, lifeMul, spreadMul }
) {
  const spread = (initial ? 0.35 : 0.22) * spreadMul;
  positions[i * 3] = (Math.random() - 0.5) * spread;
  positions[i * 3 + 1] = Math.random() * 0.15 * spreadMul;
  positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  const life = (0.35 + Math.random() * 0.45) * lifeMul;
  lifetimes[i] = life;
  sizes[i] = 1;
  velocities[i] = {
    x: (Math.random() - 0.5) * 0.4 * speedMul,
    y: (1.0 + Math.random() * 1.6) * speedMul,
    z: (Math.random() - 0.5) * 0.4 * speedMul,
    maxLife: life,
    driftPhase: Math.random() * Math.PI * 2,
  };
}

/**
 * Additive fire/ember point layer.
 * @param {object} opts — count, pointSize, speedMul, lifeMul, spreadMul, alphaScale, warmth, drift, sizeShrink
 */
export function createFireParticleLayer({
  count,
  pointSize,
  speedMul,
  lifeMul,
  spreadMul,
  alphaScale,
  warmth,
  drift = false,
  sizeShrink = 1,
}) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  const lifetimes = new Float32Array(count);
  const sizes = new Float32Array(count);

  const tuning = createParticleTuning({
    pointSize,
    alphaScale,
    speedMul,
    lifeMul,
    spreadMul,
  });

  const reset = (i, initial) =>
    resetFireParticle(i, positions, velocities, lifetimes, sizes, initial, {
      speedMul: tuning.effectiveSpeed(),
      lifeMul: tuning.base.lifeMul,
      spreadMul: tuning.effectiveSpread(),
    });

  for (let i = 0; i < count; i++) reset(i, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uPointSize: { value: pointSize },
      uAlphaScale: { value: alphaScale },
      uWarmth: { value: warmth },
      uSizeShrink: { value: sizeShrink },
      uDepthBias: { value: PARTICLE_DEPTH_BIAS },
    },
    vertexShader: fireParticleVertexShader,
    fragmentShader: fireParticleFragmentShader,
  });

  const system = new THREE.Points(geometry, material);
  let driftTime = 0;

  const api = makeParticleApi(system, tuning, applyFireUniforms, { count, reset });

  return {
    ...api,
    update(dt) {
      if (!tuning.enabled) return;
      driftTime += dt;
      const pos = geometry.attributes.position.array;
      const active = activeParticleCount(count, tuning.densityMul);
      for (let i = 0; i < count; i++) {
        if (i >= active) {
          sizes[i] = 0;
          continue;
        }
        lifetimes[i] -= dt;
        if (lifetimes[i] <= 0) reset(i, false);
        const v = velocities[i];
        pos[i * 3] += v.x * dt;
        pos[i * 3 + 1] += v.y * dt;
        pos[i * 3 + 2] += v.z * dt;
        if (drift) {
          const phase = v.driftPhase;
          pos[i * 3] += Math.sin(driftTime * 2.4 + phase) * 0.35 * dt;
          pos[i * 3 + 2] += Math.cos(driftTime * 2.0 + phase * 1.3) * 0.35 * dt;
        }
        sizes[i] = Math.max(0, lifetimes[i] / v.maxLife);
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.size.needsUpdate = true;
    },
    rescaleVelocity(speedRatio) {
      for (const v of velocities) {
        v.x *= speedRatio;
        v.y *= speedRatio;
        v.z *= speedRatio;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Smoke (alpha-blended sprites)
// ---------------------------------------------------------------------------

function resetSmokeParticle(
  i,
  positions,
  velocities,
  lifetimes,
  opacities,
  initial,
  speedMul,
  spreadMul
) {
  const spread = (initial ? 0.22 : 0.16) * spreadMul;
  positions[i * 3] = (Math.random() - 0.5) * spread;
  positions[i * 3 + 1] = 0.25 + Math.random() * 0.35 * spreadMul;
  positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  const life = 2.0 + Math.random() * 2.5;
  lifetimes[i] = life;
  opacities[i] = 0;
  velocities[i] = {
    x: (Math.random() - 0.5) * 0.3 * speedMul,
    y: (0.9 + Math.random() * 0.7) * speedMul,
    z: (Math.random() - 0.5) * 0.3 * speedMul,
    maxLife: life,
  };
}

/** Smoke plume layer (fixed pool size; density slider controls active count). */
export function createSmokeParticles({
  count = 130,
  pointSize = 88,
  alphaScale = 0.48,
  baseSpeed = 1,
} = {}) {
  const positions = new Float32Array(count * 3);
  const velocities = [];
  const lifetimes = new Float32Array(count);
  const opacities = new Float32Array(count);

  const tuning = createParticleTuning({
    pointSize,
    alphaScale,
    speedMul: baseSpeed,
    lifeMul: 1,
    spreadMul: 1,
  });

  const reset = (i, initial) =>
    resetSmokeParticle(
      i,
      positions,
      velocities,
      lifetimes,
      opacities,
      initial,
      tuning.effectiveSpeed(),
      tuning.effectiveSpread()
    );

  for (let i = 0; i < count; i++) reset(i, true);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("opacity", new THREE.BufferAttribute(opacities, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uPointSize: { value: pointSize },
      uAlphaScale: { value: alphaScale },
    },
    vertexShader: smokeParticleVertexShader,
    fragmentShader: smokeParticleFragmentShader,
  });

  const system = new THREE.Points(geometry, material);
  const api = makeParticleApi(system, tuning, applySmokeUniforms, { count, reset });

  return {
    ...api,
    count,
    update(dt) {
      if (!tuning.enabled) return;
      const pos = geometry.attributes.position.array;
      const active = activeParticleCount(count, tuning.densityMul);
      for (let i = 0; i < count; i++) {
        if (i >= active) {
          opacities[i] = 0;
          continue;
        }
        lifetimes[i] -= dt;
        if (lifetimes[i] <= 0) reset(i, false);
        const v = velocities[i];
        pos[i * 3] += v.x * dt;
        pos[i * 3 + 1] += v.y * dt;
        pos[i * 3 + 2] += v.z * dt;
        const age = 1 - lifetimes[i] / v.maxLife;
        const fadeIn = Math.min(1, age / 0.12);
        const fadeOut = Math.min(1, (1 - age) / 0.3);
        opacities[i] = fadeIn * fadeOut * 0.75;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.opacity.needsUpdate = true;
    },
    rescaleVelocity(speedRatio) {
      for (const v of velocities) {
        v.x *= speedRatio;
        v.y *= speedRatio;
        v.z *= speedRatio;
      }
    },
  };
}
