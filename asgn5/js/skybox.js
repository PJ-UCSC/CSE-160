import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const SKY_FOLDER = "images/textures/skybox/";

export const SKY_LIST = [
  { id: "autumn", label: "Autumn field", file: "autumn_field_puresky_4k.hdr" },
  { id: "citrus", label: "Citrus orchard", file: "citrus_orchard_road_puresky_4k.hdr" },
  { id: "kloofendal", label: "Kloofendal (cloudy)", file: "kloofendal_48d_partly_cloudy_puresky_4k.hdr" },
  { id: "kloppenheim06", label: "Kloppenheim 06", file: "kloppenheim_06_puresky_4k.hdr" },
  { id: "kloppenheim07", label: "Kloppenheim 07", file: "kloppenheim_07_puresky_4k.hdr" },
  { id: "qwantani", label: "Qwantani night", file: "qwantani_night_puresky_4k.hdr" },
  { id: "table_mountain", label: "Table mountain", file: "table_mountain_2_puresky_4k.hdr" },
];

export function createSkyController(scene, renderer) {
  const loader = new RGBELoader();
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  let enabled = true;
  let currentId = SKY_LIST[0]?.id;
  let envTex = null;
  let fallback = new THREE.Color(0x1a2540);
  let loading = false;

  function disposeEnv() {
    if (envTex) {
      envTex.dispose();
      envTex = null;
    }
    scene.environment = null;
  }

  function applyToScene() {
    if (enabled && envTex) {
      scene.background = envTex;
      scene.environment = envTex;
    } else {
      scene.background = fallback.clone();
      scene.environment = null;
    }
  }

  function loadSky(id) {
    const opt = SKY_LIST.find((s) => s.id === id);
    if (!opt) return Promise.resolve();

    currentId = id;
    loading = true;

    return new Promise((resolve, reject) => {
      loader.load(
        SKY_FOLDER + opt.file,
        (hdr) => {
          hdr.mapping = THREE.EquirectangularReflectionMapping;
          const tex = pmrem.fromEquirectangular(hdr).texture;
          hdr.dispose();

          disposeEnv();
          envTex = tex;
          applyToScene();
          loading = false;
          resolve(tex);
        },
        undefined,
        (err) => {
          loading = false;
          reject(err);
        }
      );
    });
  }

  return {
    get enabled() {
      return enabled;
    },
    get loading() {
      return loading;
    },
    setFallback(hex) {
      fallback.setHex(hex);
      if (!enabled) applyToScene();
    },
    setEnabled(on) {
      enabled = on;
      applyToScene();
    },
    setSky(id) {
      if (id === currentId && envTex) {
        applyToScene();
        return Promise.resolve(envTex);
      }
      return loadSky(id);
    },
    loadFirst() {
      if (!SKY_LIST.length) return Promise.resolve();
      return loadSky(SKY_LIST[0].id);
    },
  };
}

export function bindSkyControls(sky, list = SKY_LIST) {
  const toggle = document.getElementById("sky-enabled");
  const select = document.getElementById("sky-select");
  if (!toggle || !select) return;

  list.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    select.appendChild(opt);
  });

  const syncSelectDisabled = () => {
    select.disabled = !sky.enabled || sky.loading;
  };

  toggle.addEventListener("change", () => {
    sky.setEnabled(toggle.checked);
    syncSelectDisabled();
  });

  select.addEventListener("change", () => {
    syncSelectDisabled();
    sky.setSky(select.value).finally(syncSelectDisabled);
  });

  sky.setEnabled(toggle.checked);
  sky.setSky(select.value).catch((err) => {
    console.warn("skybox load failed:", err);
  });
  syncSelectDisabled();
}
