/**
 * @file Lighting data only — default intensities and day/night preset colors.
 * Runtime wiring lives in `lightingController.js`.
 */

/** Default slider values (night = scene default) */
export const LIGHT_DEFAULTS = {
  sun: 1.4,
  moon: 0.55,
  fire: 2.4,
  fill: 0.5,
  spot: 4.5,
};

export const TIME_PRESETS = {
  day: {
    background: 0x7eb8e8,
    fogColor: 0xa8cce8,
    fogShader: 0x90b8d8,
    fogDensity: 0.008,
    fogStrength: 0.8,
    fogNear: 14,
    fogFar: 72,
    exposure: 1.28,
    overlayTitle: "Campfire — Day",
    sun: { on: true, intensity: 1.4 },
    moon: { on: false, intensity: 0 },
    fire: { on: true, intensity: 0.35 },
    fill: { on: true, intensity: 0.9 },
    camera: { on: false, intensity: 0 },
  },
  night: {
    background: 0x1a2540,
    fogColor: 0x3d4f6e,
    fogShader: 0x2e3d58,
    fogDensity: 0.022,
    fogStrength: 0.92,
    fogNear: 8,
    fogFar: 50,
    exposure: 1.15,
    overlayTitle: "Campfire at Dusk",
    sun: { on: false, intensity: 0 },
    moon: { on: true, intensity: 0.55 },
    fire: { on: true, intensity: 2.4 },
    fill: { on: true, intensity: 0.5 },
    camera: { on: true, intensity: 4.5 },
  },
};
