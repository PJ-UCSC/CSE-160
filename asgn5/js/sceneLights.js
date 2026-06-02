import * as THREE from "three";

const SHADOW_FRUSTUM = 40;
const SHADOW_MAP_DIR = 2048;

export function configureDirectionalShadow(light, mapSize = SHADOW_MAP_DIR) {
  light.castShadow = true;
  light.shadow.mapSize.set(mapSize, mapSize);
  const cam = light.shadow.camera;
  cam.near = 0.5;
  cam.far = 120;
  cam.left = cam.bottom = -SHADOW_FRUSTUM;
  cam.right = cam.top = SHADOW_FRUSTUM;
  return light;
}

export function addDirectionalLight(scene, color, intensity, position) {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(position.x, position.y, position.z);
  configureDirectionalShadow(light);
  scene.add(light);
  scene.add(light.target);
  return light;
}

export function createSceneLights(scene) {
  return {
    sun: addDirectionalLight(scene, 0xfff4e0, 0, { x: -45, y: 70, z: 35 }),
    moon: addDirectionalLight(scene, 0xb8c8ff, 0.55, { x: 30, y: 50, z: 20 }),
    fire: (() => {
      const light = new THREE.PointLight(0xff8833, 2.4, 30, 2);
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      scene.add(light);
      return light;
    })(),
    fill: (() => {
      const light = new THREE.HemisphereLight(0x4a6090, 0x2a1810, 0.5);
      scene.add(light);
      return light;
    })(),
    spotAngle: Math.PI / 5,
    spotPenumbra: 0.35,
  };
}

export function createCameraSpotlight(scene, intensity, spotAngle, spotPenumbra) {
  const spot = new THREE.SpotLight(
    0xfff4e8,
    intensity,
    70,
    spotAngle,
    spotPenumbra,
    1
  );
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = 0.5;
  spot.shadow.camera.far = 70;
  spot.shadow.bias = -0.0002;
  scene.add(spot);
  scene.add(spot.target);
  return spot;
}
