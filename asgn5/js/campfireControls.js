/**
 * @file Wires campfire particle UI (index.html) to particleLayer slider API.
 */
import { bindRangeSlider, bindCheckbox } from "./uiBindings.js";

function bindLayerControls(layer, ids) {
  const {
    toggle,
    speed,
    speedVal,
    size,
    sizeVal,
    opacity,
    opacityVal,
    radius,
    radiusVal,
    density,
    densityVal,
  } = ids;

  bindCheckbox(toggle, (on) => layer.setEnabled(on));

  bindRangeSlider(speed, speedVal, {
    onChange: (v) => {
      const prev = layer.setSpeedMul(v);
      if (prev > 0 && layer.rescaleVelocity) {
        layer.rescaleVelocity(v / prev);
      }
    },
    format: (v) => `${v.toFixed(2)}×`,
  });

  bindRangeSlider(size, sizeVal, {
    onChange: (v) => layer.setSizeMul(v),
    format: (v) => `${v.toFixed(2)}×`,
  });

  bindRangeSlider(opacity, opacityVal, {
    onChange: (v) => layer.setOpacityMul(v),
    format: (v) => `${v.toFixed(2)}×`,
  });

  bindRangeSlider(radius, radiusVal, {
    onChange: (v) => layer.setRadiusMul(v),
    format: (v) => `${v.toFixed(2)}×`,
  });

  bindRangeSlider(density, densityVal, {
    onChange: (v) => layer.setDensityMul(v),
    format: (v) => `${Math.round(v * 100)}%`,
  });
}

/** Wire campfire particle toggles and sliders in the lights panel. */
export function bindCampfireControls(campfire) {
  bindLayerControls(campfire.fire, {
    toggle: document.getElementById("particle-fire"),
    speed: document.getElementById("fire-speed"),
    speedVal: document.getElementById("fire-speed-val"),
    size: document.getElementById("fire-size"),
    sizeVal: document.getElementById("fire-size-val"),
    opacity: document.getElementById("fire-opacity"),
    opacityVal: document.getElementById("fire-opacity-val"),
    radius: document.getElementById("fire-radius"),
    radiusVal: document.getElementById("fire-radius-val"),
    density: document.getElementById("fire-density"),
    densityVal: document.getElementById("fire-density-val"),
  });

  bindLayerControls(campfire.fireEmbers, {
    toggle: document.getElementById("particle-embers"),
    speed: document.getElementById("embers-speed"),
    speedVal: document.getElementById("embers-speed-val"),
    size: document.getElementById("embers-size"),
    sizeVal: document.getElementById("embers-size-val"),
    opacity: document.getElementById("embers-opacity"),
    opacityVal: document.getElementById("embers-opacity-val"),
    radius: document.getElementById("embers-radius"),
    radiusVal: document.getElementById("embers-radius-val"),
    density: document.getElementById("embers-density"),
    densityVal: document.getElementById("embers-density-val"),
  });

  bindLayerControls(campfire.smoke, {
    toggle: document.getElementById("particle-smoke"),
    speed: document.getElementById("smoke-speed"),
    speedVal: document.getElementById("smoke-speed-val"),
    size: document.getElementById("smoke-size"),
    sizeVal: document.getElementById("smoke-size-val"),
    opacity: document.getElementById("smoke-opacity"),
    opacityVal: document.getElementById("smoke-opacity-val"),
    radius: document.getElementById("smoke-radius"),
    radiusVal: document.getElementById("smoke-radius-val"),
    density: document.getElementById("smoke-density"),
    densityVal: document.getElementById("smoke-density-val"),
  });
}
