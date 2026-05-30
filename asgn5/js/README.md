# JavaScript modules (`web/js`)

Developer guide for the Three.js campfire scene. User-facing run instructions are in [`../README.md`](../README.md).

## Module map

| Module | Responsibility |
|--------|----------------|
| **main.js** | Entry point: renderer, scene graph, render loop, keyboard input |
| **cameraController.js** | First-person camera, terrain height, mouse look, both-buttons forward |
| **terrain.js** | Terrain mesh, stream water, height sampling, shader uniforms |
| **heightmap.js** | 256×256 procedural heights, stream mask, camp placement |
| **shaders.js** | All GLSL (terrain, water, fog, fire/smoke particles) |
| **proceduralTextures.js** | Canvas textures: terrain layers, bark, granite, water flow |
| **noise.js** | Shared `fbm` / `valueNoise` for heightmap + textures |
| **Campfire** (`campfire.js`) | Log mesh + particle layer assembly |
| **particleLayer.js** | Point-sprite fire/smoke simulation + slider API |
| **campfireControls.js** | UI bindings for particle layers |
| **sceneProps.js** | Trees, granite rocks, tent, seating |
| **sceneLights.js** | Sun, moon, fire point light, fill, camera spotlight |
| **lighting.js** | Default intensities and day/night presets (data only) |
| **lightingController.js** | Light/fog UI + syncing Three.js lights to terrain shader |
| **mountainFog.js** | Animated fog billboards at mountain end |
| **uiBindings.js** | Generic range/checkbox → callback helpers |
| **panelUI.js** | Collapsible scene controls panel |

## Data flow (one frame)

```
main.animate()
  ├─ campfire.update(dt)
  ├─ lighting.updateFireLight(fire, flicker)
  ├─ lighting.updateTerrainLightDirs(sun, moon)
  ├─ cameraCtrl.update(dt, keys)
  ├─ lighting.updateCameraSpotlight(camera)
  ├─ lighting.updateFogAnimation(time)
  ├─ updateStreamWater(water, time, sun, moon)
  └─ renderer.render(scene, camera)
```

## Coordinate conventions

- **World size:** terrain spans `TERRAIN_WORLD_SIZE` (80 units), centered at origin.
- **Heightmap UV:** normalized `(nx, nz)` in `[0,1]`. After `PlaneGeometry.rotateX(-π/2)`:
  - `worldX = (nx - 0.5) * TERRAIN_WORLD_SIZE`
  - `worldZ = (0.5 - nz) * TERRAIN_WORLD_SIZE` (Z is flipped vs. row index)
- **Stream:** defined in `heightmap.js` (`streamCenterX`, `streamHalfWidth`); water mesh follows the same path in `terrain.js`.

## Where to change common things

| Goal | Start here |
|------|------------|
| Initial camera pose | `main.js` → `cameraCtrl.setSpawnView(...)` |
| Camp / stream layout | `heightmap.js` |
| Terrain materials | `proceduralTextures.js` + `shaders.js` (terrain fragment) |
| Water look | `shaders.js` (water fragment) + `terrain.js` colors |
| Particle look / count | `campfire.js` (`FIRE_LAYER_DEFAULTS`) + `particleLayer.js` + `shaders.js` |
| Default particle density | `particleLayer.js` — `DEFAULT_DENSITY` (30%) |
| Particle UI sliders | `index.html` + `campfireControls.js` |
| Day / night | `lighting.js` presets + `lightingController.js` |
| Scatter rocks / trees | `sceneProps.js` |

## Render order (transparent objects)

Lower numbers draw first:

1. Terrain / water (`0`)
2. Mountain fog (`3`)
3. Fire embers (`100`) → fire core (`101`) → smoke (`102`)

Particles use `depthTest: false` so they stay visible over the stream.

## Adding a new shader

1. Add `export const myVertexShader` / `myFragmentShader` in **shaders.js**
2. Create `ShaderMaterial` in the owning module (e.g. `terrain.js`)
3. Pass uniforms from `main.js` or a dedicated controller in the animation loop
