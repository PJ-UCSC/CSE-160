/**
 * @file Animated fog billboards at the mountain (+Z) end of the map.
 */
import * as THREE from "three";
import { fogVertexShader, fogFragmentShader } from "./shaders.js";

/** Planes facing the camp; Z matches heightmap mountain zone (world space). */
const LAYERS = [
  { z: -10, y: 5, w: 74, h: 16 },
  { z: -20, y: 11, w: 80, h: 22 },
  { z: -30, y: 19, w: 76, h: 28 },
  { z: -38, y: 26, w: 68, h: 32 },
];

function createFogMaterial(uniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: fogVertexShader,
    fragmentShader: fogFragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
}

export function createMountainFog() {
  const group = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0x3d4f6e) },
    uOpacity: { value: 0.55 },
  };

  for (const layer of LAYERS) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(layer.w, layer.h, 1, 1),
      createFogMaterial(uniforms)
    );
    mesh.position.set(0, layer.y, layer.z);
    mesh.renderOrder = 3;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  group.frustumCulled = false;
  group.userData.fogUniforms = uniforms;
  return group;
}

export function updateMountainFog(group, time, fogColor, opacityScale = 1) {
  const uniforms = group.userData.fogUniforms;
  if (!uniforms) return;
  uniforms.uTime.value = time;
  if (fogColor) uniforms.uColor.value.copy(fogColor);
  uniforms.uOpacity.value = 0.55 * opacityScale;
}
