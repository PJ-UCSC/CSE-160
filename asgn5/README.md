# CSE 160 — Assignment 5 (Three.js campfire scene)
AI was used in this assignment. The GLSL and the shaders file especially.

## Run

```bash
cd web
python -m http.server 8080
```

Open http://localhost:8080/asg5.html (needs a local server, not `file://`).

## Controls

- Drag — look around
- W / S — forward / back (both mouse buttons = forward)
- A / D — turn, Q / E — strafe
- Space / Shift — eye height (matches slider)
- Scroll — FOV
- Right panel — lights, fog, particles

## Files

- `asg5.html` — page + UI
- `js/script.js` — main loop
- `js/terrain.js`, `js/heightmap.js` — ground + stream
- `js/shaders.js` — GLSL
- `js/campfire.js`, `js/particleLayer.js` — fire and smoke
- `js/scatterModels.js` — random `assets/grass/` and `assets/tree/` models on terrain
- `js/cameraController.js` — FPS camera
- `js/skybox.js` — HDR sky list + on/off (add `.hdr` files under `images/textures/skybox/` and entries in `SKY_LIST`)
