import { LIGHT_DEFAULTS, TIME_PRESETS } from "./lighting.js";
import { bindRangeSlider, bindCheckbox } from "./uiBindings.js";
import { updateMountainFog } from "./mountainFog.js";

const INTENSITY_DECIMALS = { sun: 2, moon: 2, fire: 1, fill: 2, spot: 1 };
const TERRAIN_LIGHT_SCALE = { sun: 1.35, moon: 1.25 };

export function createLightingController({
  scene,
  renderer,
  overlay,
  terrainUniforms,
  mountainFog,
  lights,
  onPresetBackground,
}) {
  const { sun, moon, fire, fill, spotAngle, spotPenumbra } = lights;
  let cameraSpot = null;
  let timeOfDay = "night";

  const lightControlPanels = {
    sun: document.getElementById("light-control-sun"),
    moon: document.getElementById("light-control-moon"),
  };

  const lightToggles = {
    sun: document.getElementById("light-sun"),
    moon: document.getElementById("light-moon"),
    fire: document.getElementById("light-fire"),
    fill: document.getElementById("light-fill"),
    camera: document.getElementById("light-camera"),
  };

  const lightSliders = {
    sun: document.getElementById("intensity-sun"),
    moon: document.getElementById("intensity-moon"),
    fire: document.getElementById("intensity-fire"),
    fill: document.getElementById("intensity-fill"),
    spot: document.getElementById("intensity-spot"),
  };

  const lightSliderLabels = {
    sun: document.getElementById("intensity-sun-val"),
    moon: document.getElementById("intensity-moon-val"),
    fire: document.getElementById("intensity-fire-val"),
    fill: document.getElementById("intensity-fill-val"),
    spot: document.getElementById("intensity-spot-val"),
  };

  const lightIntensity = Object.fromEntries(
    Object.keys(LIGHT_DEFAULTS).map((key) => [
      key,
      parseFloat(lightSliders[key]?.value ?? LIGHT_DEFAULTS[key]),
    ])
  );

  const lightState = {
    sun: lightToggles.sun?.checked ?? false,
    moon: lightToggles.moon?.checked ?? true,
    fire: lightToggles.fire?.checked ?? true,
    fill: lightToggles.fill?.checked ?? true,
    camera: lightToggles.camera?.checked ?? true,
  };

  const baseColors = {
    moon: terrainUniforms.uMoonColor.value.clone(),
    sun: terrainUniforms.uSunColor.value.clone(),
    fire: terrainUniforms.uFireColor.value.clone(),
    fill: terrainUniforms.uFillColor.value.clone(),
    spot: terrainUniforms.uSpotColor.value.clone(),
  };

  const fogSettings = {
    density: 0.022,
    strength: 0.92,
    near: 8,
    far: 50,
    color: 0x3d4f6e,
    shaderColor: 0x2e3d58,
  };

  const fogSliders = {
    density: document.getElementById("fog-density"),
    strength: document.getElementById("fog-strength"),
  };
  const fogLabels = {
    density: document.getElementById("fog-density-val"),
    strength: document.getElementById("fog-strength-val"),
  };

  function lightMultiplier(key) {
    return lightState[key] ? lightIntensity[key] / LIGHT_DEFAULTS[key] : 0;
  }

  function applyFogState() {
    scene.fog.color.setHex(fogSettings.color);
    scene.fog.density = fogSettings.density;
    terrainUniforms.uFogColor.value.setHex(fogSettings.shaderColor);
    terrainUniforms.uFogNear.value = fogSettings.near;
    terrainUniforms.uFogFar.value = fogSettings.far;
    terrainUniforms.uFogStrength.value = fogSettings.strength;
    updateMountainFog(mountainFog, 0, scene.fog.color, fogSettings.strength);
  }

  function applyLightState() {
    const sunActive = lightState.sun && lightIntensity.sun > 0;
    const moonActive = lightState.moon && lightIntensity.moon > 0;

    sun.visible = sunActive;
    sun.intensity = lightIntensity.sun;
    sun.castShadow = sunActive;

    moon.visible = moonActive;
    moon.intensity = lightIntensity.moon;
    moon.castShadow = moonActive && !sunActive;

    fire.visible = lightState.fire && lightIntensity.fire > 0;
    fill.visible = lightState.fill && lightIntensity.fill > 0;
    fill.intensity = lightIntensity.fill;

    if (cameraSpot) {
      cameraSpot.visible = lightState.camera && lightIntensity.spot > 0;
      cameraSpot.intensity = lightIntensity.spot;
    }

    terrainUniforms.uSunColor.value
      .copy(baseColors.sun)
      .multiplyScalar(lightMultiplier("sun") * TERRAIN_LIGHT_SCALE.sun);
    terrainUniforms.uMoonColor.value
      .copy(baseColors.moon)
      .multiplyScalar(lightMultiplier("moon") * TERRAIN_LIGHT_SCALE.moon);
    terrainUniforms.uFireColor.value
      .copy(baseColors.fire)
      .multiplyScalar(lightMultiplier("fire"));
    terrainUniforms.uFillColor.value
      .copy(baseColors.fill)
      .multiplyScalar(lightMultiplier("fill"));
    terrainUniforms.uSpotColor.value
      .copy(baseColors.spot)
      .multiplyScalar(lightMultiplier("camera"));
    terrainUniforms.uSpotIntensity.value = lightMultiplier("camera");
  }

  function syncSliderUI(key) {
    const slider = lightSliders[key];
    const label = lightSliderLabels[key];
    if (slider) slider.value = String(lightIntensity[key]);
    if (label) {
      label.textContent = lightIntensity[key].toFixed(INTENSITY_DECIMALS[key] ?? 1);
    }
  }

  function syncFogUI() {
    if (fogSliders.density) fogSliders.density.value = String(fogSettings.density);
    if (fogLabels.density) fogLabels.density.textContent = fogSettings.density.toFixed(3);
    if (fogSliders.strength) fogSliders.strength.value = String(fogSettings.strength);
    if (fogLabels.strength) fogLabels.strength.textContent = fogSettings.strength.toFixed(2);
  }

  function applyTimeOfDay(mode) {
    const preset = TIME_PRESETS[mode];
    if (!preset) return;

    timeOfDay = mode;
    document.getElementById("btn-day")?.classList.toggle("is-active", mode === "day");
    document.getElementById("btn-night")?.classList.toggle("is-active", mode === "night");

    if (onPresetBackground) {
      onPresetBackground(preset.background);
    } else if (scene.background?.isColor) {
      scene.background.setHex(preset.background);
    }
    renderer.toneMappingExposure = preset.exposure;

    Object.assign(fogSettings, {
      color: preset.fogColor,
      shaderColor: preset.fogShader,
      density: preset.fogDensity,
      strength: preset.fogStrength,
      near: preset.fogNear,
      far: preset.fogFar,
    });

    const applyPresetLight = (name, toggleName = name, sliderName = name) => {
      const p = preset[name];
      lightState[toggleName] = p.on;
      lightIntensity[sliderName] = p.intensity;
      if (lightToggles[toggleName]) lightToggles[toggleName].checked = p.on;
      syncSliderUI(sliderName);
    };

    applyPresetLight("sun");
    applyPresetLight("moon");
    applyPresetLight("fire");
    applyPresetLight("fill");
    applyPresetLight("camera", "camera", "spot");

    fill.color.setHex(mode === "day" ? 0x9ec8ff : 0x4a6090);
    fill.groundColor.setHex(mode === "day" ? 0x6a7a48 : 0x2a1810);
    if (mode === "day") baseColors.fill.set(0.52, 0.6, 0.74);
    else baseColors.fill.set(0.25, 0.3, 0.45);

    const title = overlay?.querySelector("h1");
    if (title) title.textContent = preset.overlayTitle;

    const isDay = mode === "day";
    lightControlPanels.sun?.classList.toggle("is-hidden", !isDay);
    lightControlPanels.moon?.classList.toggle("is-hidden", isDay);
    if (!isDay) {
      lightState.sun = false;
      if (lightToggles.sun) lightToggles.sun.checked = false;
    } else {
      lightState.moon = false;
      if (lightToggles.moon) lightToggles.moon.checked = false;
    }

    syncFogUI();
    applyFogState();
    applyLightState();
  }

  // Wire UI
  bindCheckbox(lightToggles.sun, (on) => {
    lightState.sun = on;
    applyLightState();
  });
  bindCheckbox(lightToggles.moon, (on) => {
    lightState.moon = on;
    applyLightState();
  });
  bindCheckbox(lightToggles.fire, (on) => {
    lightState.fire = on;
    applyLightState();
  });
  bindCheckbox(lightToggles.fill, (on) => {
    lightState.fill = on;
    applyLightState();
  });
  bindCheckbox(lightToggles.camera, (on) => {
    lightState.camera = on;
    applyLightState();
  });

  document.getElementById("btn-day")?.addEventListener("click", () => applyTimeOfDay("day"));
  document.getElementById("btn-night")?.addEventListener("click", () => applyTimeOfDay("night"));

  for (const key of Object.keys(LIGHT_DEFAULTS)) {
    bindRangeSlider(lightSliders[key], lightSliderLabels[key], {
      onChange: (v) => {
        lightIntensity[key] = v;
        applyLightState();
      },
      format: (v) => v.toFixed(INTENSITY_DECIMALS[key] ?? 1),
    });
  }

  bindRangeSlider(fogSliders.density, fogLabels.density, {
    onChange: (v) => {
      fogSettings.density = v;
      applyFogState();
    },
    format: (v) => v.toFixed(3),
  });

  bindRangeSlider(fogSliders.strength, fogLabels.strength, {
    onChange: (v) => {
      fogSettings.strength = v;
      applyFogState();
    },
    format: (v) => v.toFixed(2),
  });

  function setupCameraSpotlight(spotLight) {
    cameraSpot = spotLight;
    terrainUniforms.uSpotCosOuter.value = Math.cos(spotAngle);
    terrainUniforms.uSpotCosInner.value = Math.cos(spotAngle * (1 - spotPenumbra));
  }

  function updateCameraSpotlight(camera, spotPos, spotDir, spotTarget) {
    if (!cameraSpot) return;
    camera.updateMatrixWorld();
    camera.getWorldPosition(spotPos);
    camera.getWorldDirection(spotDir);
    spotTarget.copy(spotPos).addScaledVector(spotDir, 10);
    cameraSpot.position.copy(spotPos);
    cameraSpot.target.position.copy(spotTarget);
    cameraSpot.target.updateMatrixWorld();
    terrainUniforms.uSpotPos.value.copy(spotPos);
    terrainUniforms.uSpotDir.value.copy(spotDir);
  }

  function updateFireLight(fireLight, fireWorldPos, flicker) {
    if (!lightState.fire || lightIntensity.fire <= 0) return;
    fireLight.intensity = lightIntensity.fire * flicker;
    fireLight.color.setHSL(0.08, 1, 0.45 + flicker * 0.08);
    fireLight.position.copy(fireWorldPos);
    terrainUniforms.uFirePos.value.copy(fireWorldPos);
  }

  function updateTerrainLightDirs(sunDir, moonDir) {
    terrainUniforms.uMoonDir.value.copy(moonDir);
    terrainUniforms.uSunDir.value.copy(sunDir);
  }

  function updateFogAnimation(elapsed) {
    terrainUniforms.uFogTime.value = elapsed;
    updateMountainFog(mountainFog, elapsed, scene.fog.color, fogSettings.strength);
  }

  applyTimeOfDay("night");

  return {
    applyTimeOfDay,
    applyLightState,
    setupCameraSpotlight,
    updateCameraSpotlight,
    updateFireLight,
    updateTerrainLightDirs,
    updateFogAnimation,
    lightIntensity,
    lightState,
    get timeOfDay() {
      return timeOfDay;
    },
  };
}
