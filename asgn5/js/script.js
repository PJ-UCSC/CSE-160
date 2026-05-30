/**
 * @file Application entry — assembles the scene, wires UI, runs the render loop.
 * @see ./README.md for module map and coordinate conventions.
 */
import * as THREE from "three";
import { createTerrain, updateStreamWater } from "./terrain.js";
import { createMountainFog } from "./mountainFog.js";
import { Campfire } from "./campfire.js";
import { addSceneProps } from "./sceneProps.js";
import { createLightingController } from "./lightingController.js";
import { createSceneLights, createCameraSpotlight } from "./sceneLights.js";
import { CameraController } from "./cameraController.js";
import { bindRangeSlider, setRangeSliderValue } from "./uiBindings.js";
import { bindCampfireControls } from "./campfireControls.js";
import { initPanelUI } from "./panelUI.js";

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const overlay = document.getElementById("overlay");
const errorBox = document.getElementById("error");

function showError(message) {
  if (errorBox) {
    errorBox.hidden = false;
    errorBox.textContent = message;
  }
  console.error(message);
}

if (location.protocol === "file:") {
  showError(
    "This project must be served over HTTP (not opened as a file). Run: python -m http.server 8080 inside the web folder, then open http://localhost:8080"
  );
}

// ---------------------------------------------------------------------------
// Renderer & scene shell
// ---------------------------------------------------------------------------

function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.debug.checkShaderErrors = true;
  return renderer;
}

function createSceneShell() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2540);
  scene.fog = new THREE.FogExp2(0x3d4f6e, 0.022);
  return scene;
}

function createCamera() {
  return new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    250
  );
}

// ---------------------------------------------------------------------------
// UI — movement panel (camera only; lights/particles have own modules)
// ---------------------------------------------------------------------------

function bindCameraSliders(cameraCtrl) {
  const eyeHeightSlider = document.getElementById("eye-height");
  const eyeHeightLabel = document.getElementById("eye-height-val");
  const formatEyeHeight = (v) => v.toFixed(1);

  bindRangeSlider(
    document.getElementById("move-speed"),
    document.getElementById("move-speed-val"),
    {
      onChange: (v) => cameraCtrl.setMoveSpeed(v),
      format: (v) => `${v.toFixed(2)}×`,
    }
  );
  bindRangeSlider(eyeHeightSlider, eyeHeightLabel, {
    onChange: (v) => cameraCtrl.setEyeHeight(v),
    format: formatEyeHeight,
  });
  bindRangeSlider(
    document.getElementById("look-at-y"),
    document.getElementById("look-at-y-val"),
    {
      onChange: (v) => cameraCtrl.setLookAtYOffset(v),
      format: (v) => v.toFixed(1),
    }
  );
  bindRangeSlider(
    document.getElementById("vertical-speed"),
    document.getElementById("vertical-speed-val"),
    {
      onChange: (v) => cameraCtrl.setVerticalSpeed(v),
      format: (v) => `${v.toFixed(2)}×`,
    }
  );

  return (height) =>
    setRangeSliderValue(
      eyeHeightSlider,
      eyeHeightLabel,
      height,
      formatEyeHeight
    );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const canvas = document.getElementById("canvas");
  if (!canvas) throw new Error("Canvas element not found");

  const renderer = createRenderer(canvas);
  const scene = createSceneShell();
  const camera = createCamera();

  // World: terrain, water, distant fog
  const terrainData = createTerrain();
  terrainData.mesh.renderOrder = 0;
  terrainData.water.renderOrder = 0;
  scene.add(terrainData.mesh, terrainData.water);

  const mountainFog = createMountainFog();
  scene.add(mountainFog);

  // Camp area content
  const campWorld = terrainData.campWorld.clone();
  campWorld.y += 0.05;

  const campfire = new Campfire(campWorld);
  scene.add(campfire.group);
  bindCampfireControls(campfire);
  initPanelUI();
  addSceneProps(scene, campWorld, terrainData.heights, terrainData.size);

  // Lighting (Three.js lights + terrain shader uniforms + UI)
  const lights = createSceneLights(scene);
  const lighting = createLightingController({
    scene,
    renderer,
    overlay,
    terrainUniforms: terrainData.material.uniforms,
    mountainFog,
    lights,
  });

  // Camera — use setSpawnView / setSpawn; do not set camera.position directly
  const cameraCtrl = new CameraController(camera, terrainData, canvas);
  cameraCtrl.setSpawnView(
    new THREE.Vector3(-6, 5, 15),
    new THREE.Vector3(3, 0, 6)
  );
  const syncEyeHeightSlider = bindCameraSliders(cameraCtrl);

  const camPosEl = document.getElementById("cam-pos");
  const camLookEl = document.getElementById("cam-lookat");
  const camFovEl = document.getElementById("cam-fov");

  lighting.setupCameraSpotlight(
    createCameraSpotlight(
      scene,
      lighting.lightIntensity.spot,
      lights.spotAngle,
      lights.spotPenumbra
    )
  );
  lighting.updateCameraSpotlight(
    camera,
    new THREE.Vector3(),
    new THREE.Vector3(),
    new THREE.Vector3()
  );

  // Input
  const keys = {};
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // Reused vectors (avoid per-frame allocations)
  const fireWorldPos = new THREE.Vector3();
  const sunLightDir = new THREE.Vector3();
  const moonLightDir = new THREE.Vector3();
  const spotPos = new THREE.Vector3();
  const spotDir = new THREE.Vector3();
  const spotTarget = new THREE.Vector3();

  const clock = new THREE.Clock();
  let fireFlicker = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.getElapsedTime();

    campfire.update(dt);

    fireFlicker += dt * 9;
    const flicker =
      0.85 + Math.sin(fireFlicker) * 0.12 + Math.sin(fireFlicker * 2.7) * 0.08;

    campfire.group.updateMatrixWorld();
    fireWorldPos.setFromMatrixPosition(campfire.group.matrixWorld);
    fireWorldPos.y += 0.6;
    lighting.updateFireLight(lights.fire, fireWorldPos, flicker);

    terrainData.material.uniforms.uCameraPos.value.copy(camera.position);
    lights.sun.getWorldDirection(sunLightDir);
    lights.moon.getWorldDirection(moonLightDir);
    lighting.updateTerrainLightDirs(sunLightDir, moonLightDir);

    cameraCtrl.update(dt, keys);
    if (cameraCtrl.eyeHeightDirty) {
      syncEyeHeightSlider(cameraCtrl.eyeHeight);
    }
    cameraCtrl.updateHud(camPosEl, camLookEl, camFovEl);
    lighting.updateCameraSpotlight(camera, spotPos, spotDir, spotTarget);
    lighting.updateFogAnimation(elapsed);
    updateStreamWater(terrainData.water, elapsed, sunLightDir, moonLightDir);

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (overlay) {
    overlay.querySelector("p").textContent =
      "Left drag look · W/S move · Both mouse buttons forward · A/D turn · Q/E strafe · Space/Shift up/down · Scroll zoom";
  }

  animate();
}

try {
  if (location.protocol !== "file:") {
    main();
  }
} catch (err) {
  showError(err?.message || String(err));
}
