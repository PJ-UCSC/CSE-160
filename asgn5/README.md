# Campfire Scene (Three.js) — CSE 160 Assignment 5

Interactive dusk campsite with procedural terrain, custom shaders, particle fire/smoke, and a stream.

## Features

- **Campfire** — log ring with fire, ember, and smoke particle layers (tunable in the UI)
- **Terrain** — 256×256 height map; flat campsite; mountains toward +Z; carved stream channel
- **Shader ground** — blends sand, grass, rock, and snow by height and slope; procedural albedo/normal/roughness
- **Lighting** — sun/moon directionals, flickering fire point light, hemisphere fill, camera “Flash light”
- **Atmosphere** — exponential fog, mountain fog billboards, day/night presets
- **Props** — trees (bark), rocks (granite), tent, seating log

## Run locally

ES modules require HTTP (not `file://`):

```bash
cd web
python -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080)

## Controls

**Camera**

- **Look** — left-drag on the canvas
- **Move forward** — W, or **both mouse buttons** held together
- **Move backward** — S
- **Turn** — A / D
- **Strafe** — Q / E
- **Up / down** — Space / Shift
- **Zoom** — scroll (FOV)

**Panels** (top-right, two columns)

- Movement sliders (speed, eye height, look-at Y, vertical speed)
- Lights, fog, time of day
- Campfire particle layers (enable, speed, size, opacity, emitter radius, density)

Camera position, look-at, and FOV are shown under the top-left legend.

## Project layout

```
web/
  index.html
  css/style.css
  js/
    main.js              — entry, render loop
    README.md            — module map & conventions (developers)
    cameraController.js  — first-person camera
    terrain.js           — mesh, water, height sampling
    heightmap.js         — procedural heights
    shaders.js           — all GLSL
    proceduralTextures.js
    noise.js
    campfire.js          — Campfire class + layer defaults
    particleLayer.js     — fire/smoke point sprites
    campfireControls.js  — particle UI
    sceneProps.js
    sceneLights.js
    lighting.js          — preset data
    lightingController.js
    mountainFog.js
    uiBindings.js
    panelUI.js
```

For coordinate conventions, render order, and “where to change X”, see [`js/README.md`](js/README.md).
