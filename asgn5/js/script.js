import * as THREE from "three";
import { createTerrain, updateStreamWater } from "./terrain.js";
import { createMountainFog } from "./mountainFog.js";
import { Campfire } from "./campfire.js";
import { addSceneProps } from "./sceneProps.js";
import { scatterModels, bindScatterControls } from "./scatterModels.js";
import { createLightingController } from "./lightingController.js";
import { createSceneLights, createCameraSpotlight } from "./sceneLights.js";
import { CameraController } from "./cameraController.js";
import { bindRangeSlider } from "./uiBindings.js";
import { bindCampfireControls } from "./campfireControls.js";
import { initPanelUI } from "./panelUI.js";
import { createSkyController, bindSkyControls } from "./skybox.js";

const overlay = document.getElementById("overlay");
const errorBox = document.getElementById("error");

function showError(msg) {
  if (errorBox) {
    errorBox.hidden = false;
    errorBox.textContent = msg;
  }
  console.error(msg);
}

if (location.protocol === "file:") {
  showError(
    "Open with a local server: cd web && python -m http.server 8080, then http://localhost:8080/asg5.html"
  );
}

function bindCamSliders(cam) {
  const eyeSlider = document.getElementById("eye-height");
  const eyeLabel = document.getElementById("eye-height-val");

  bindRangeSlider(
    document.getElementById("move-speed"),
    document.getElementById("move-speed-val"),
    {
      onChange: (v) => cam.setMoveSpeed(v),
      format: (v) => `${v.toFixed(2)}×`,
    }
  );
  bindRangeSlider(eyeSlider, eyeLabel, {
    onChange: (v) => cam.setEyeHeight(v),
    format: (v) => v.toFixed(1),
  });
  bindRangeSlider(
    document.getElementById("look-at-y"),
    document.getElementById("look-at-y-val"),
    {
      onChange: (v) => cam.setLookAtYOffset(v),
      format: (v) => v.toFixed(1),
    }
  );
  bindRangeSlider(
    document.getElementById("vertical-speed"),
    document.getElementById("vertical-speed-val"),
    {
      onChange: (v) => cam.setVertSpeed(v),
      format: (v) => `${v.toFixed(2)}×`,
    }
  );

  return () => {
    if (!eyeSlider) return;
    eyeSlider.value = cam.eyeHeight;
    if (eyeLabel) eyeLabel.textContent = cam.eyeHeight.toFixed(1);
  };
}

function main() {
  const canvas = document.getElementById("canvas");
  if (!canvas) throw new Error("no canvas");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a2540);
  scene.fog = new THREE.FogExp2(0x3d4f6e, 0.022);

  const sky = createSkyController(scene, renderer);

  const camera = new THREE.PerspectiveCamera(
    55,
    window.innerWidth / window.innerHeight,
    0.1,
    250
  );

  const terrain = createTerrain();
  terrain.mesh.renderOrder = 0;
  terrain.water.renderOrder = 0;
  scene.add(terrain.mesh, terrain.water);

  const mtFog = createMountainFog();
  scene.add(mtFog);

  const campPos = terrain.campWorld.clone();
  campPos.y += 0.05;

  const campfire = new Campfire(campPos);
  scene.add(campfire.group);
  bindCampfireControls(campfire);
  initPanelUI();
  addSceneProps(scene, campPos, terrain.heights, terrain.size);
  scatterModels(scene, terrain.heights, terrain.size, campPos)
    .then(bindScatterControls)
    .catch((err) => {
      console.warn("model scatter failed:", err);
    });

  const lights = createSceneLights(scene);
  const lighting = createLightingController({
    scene,
    renderer,
    overlay,
    terrainUniforms: terrain.material.uniforms,
    mountainFog: mtFog,
    lights,
    onPresetBackground: (hex) => sky.setFallback(hex),
  });

  bindSkyControls(sky);

  const cam = new CameraController(camera, terrain, canvas);
  cam.setSpawnView(new THREE.Vector3(-6, 5, 15), new THREE.Vector3(3, 0, 6));
  const syncEyeSlider = bindCamSliders(cam);

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

  const keys = {};
  window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  const firePos = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const spotPos = new THREE.Vector3();
  const spotDir = new THREE.Vector3();
  const spotTarget = new THREE.Vector3();

  const clock = new THREE.Clock();
  let flickerT = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.getElapsedTime();

    campfire.update(dt);

    flickerT += dt * 9;
    const flicker =
      0.85 + Math.sin(flickerT) * 0.12 + Math.sin(flickerT * 2.7) * 0.08;

    campfire.group.updateMatrixWorld();
    firePos.setFromMatrixPosition(campfire.group.matrixWorld);
    firePos.y += 0.6;
    lighting.updateFireLight(lights.fire, firePos, flicker);

    terrain.material.uniforms.uCameraPos.value.copy(camera.position);
    lights.sun.getWorldDirection(sunDir);
    lights.moon.getWorldDirection(moonDir);
    lighting.updateTerrainLightDirs(sunDir, moonDir);

    cam.update(dt, keys);
    if (cam.eyeDirty) syncEyeSlider();
    cam.updateHud(camPosEl, camLookEl, camFovEl);
    lighting.updateCameraSpotlight(camera, spotPos, spotDir, spotTarget);
    lighting.updateFogAnimation(t);
    updateStreamWater(terrain.water, t, sunDir, moonDir);

    renderer.render(scene, camera);
  }

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  if (overlay) {
    overlay.querySelector("p").textContent =
      "Drag to look · W/S move · Both mouse buttons = forward · A/D turn · Q/E strafe · Space/Shift height · Scroll FOV";
  }

  animate();
}

try {
  if (location.protocol !== "file:") main();
} catch (err) {
  showError(err?.message || String(err));
}
