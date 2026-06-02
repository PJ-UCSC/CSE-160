import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { sampleHeightAt } from "./terrain.js";

const TERRAIN_HALF = 36;

const SCATTER_LIST = [
  {
    id: "grass",
    path: "assets/grass/",
    count: 35,
    size: 1.2,
    scaleRange: [0.6, 0.8],
    campClear: 7,
  },
  {
    id: "tree",
    path: "assets/tree/",
    count: 10,
    size: 5,
    scaleRange: [0.85, 1.15],
    campClear: 8,
  },
];

function placeOnGround(mesh, wx, wz, heights, mapSize) {
  mesh.position.set(wx, 0, wz);
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const ground = sampleHeightAt(wx, wz, heights, mapSize);
  mesh.position.y += ground - box.min.y;
}

function randomSpot(camp, campClear) {
  let wx;
  let wz;
  let tries = 0;
  do {
    wx = (Math.random() * 2 - 1) * TERRAIN_HALF;
    wz = (Math.random() * 2 - 1) * TERRAIN_HALF;
    tries++;
  } while (tries < 50 && Math.hypot(wx - camp.x, wz - camp.z) < campClear);
  return { wx, wz };
}

function prepModel(model) {
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  model.updateMatrixWorld(true);
  const dims = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  const maxDim = Math.max(dims.x, dims.y, dims.z, 0.001);
  return maxDim;
}

function scatterLoaded(scene, model, maxDim, heights, mapSize, camp, cfg) {
  const baseScale = cfg.size / maxDim;
  const group = new THREE.Group();
  const [sMin, sMax] = cfg.scaleRange;

  for (let i = 0; i < cfg.count; i++) {
    const { wx, wz } = randomSpot(camp, cfg.campClear);
    const inst = model.clone(true);
    inst.scale.setScalar(baseScale * (sMin + Math.random() * (sMax - sMin)));
    inst.rotation.y = Math.random() * Math.PI * 2;
    placeOnGround(inst, wx, wz, heights, mapSize);
    group.add(inst);
  }

  scene.add(group);
  return group;
}

function loadObjWithMtl(path) {
  return new Promise((resolve, reject) => {
    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(path);

    mtlLoader.load(
      "materials.mtl",
      (materials) => {
        materials.preload();
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.setPath(path);
        objLoader.load("model.obj", resolve, undefined, reject);
      },
      undefined,
      () => {
        const objLoader = new OBJLoader();
        objLoader.setPath(path);
        objLoader.load("model.obj", resolve, undefined, reject);
      }
    );
  });
}

function scatterOne(scene, heights, mapSize, camp, cfg) {
  return loadObjWithMtl(cfg.path).then((model) => {
    const maxDim = prepModel(model);
    return scatterLoaded(scene, model, maxDim, heights, mapSize, camp, cfg);
  });
}

export function scatterModels(scene, heights, mapSize, camp) {
  const layers = { grass: null, tree: null };

  return Promise.all(
    SCATTER_LIST.map((cfg) =>
      scatterOne(scene, heights, mapSize, camp, cfg)
        .then((group) => {
          layers[cfg.id] = group;
          return group;
        })
        .catch((err) => {
          console.warn("scatter failed:", cfg.path, err);
          return null;
        })
    )
  ).then(() => layers);
}

export function bindScatterControls(layers) {
  const grassToggle = document.getElementById("scatter-grass");
  const treeToggle = document.getElementById("scatter-trees");

  if (grassToggle && layers.grass) {
    grassToggle.addEventListener("change", () => {
      layers.grass.visible = grassToggle.checked;
    });
    layers.grass.visible = grassToggle.checked;
  }

  if (treeToggle && layers.tree) {
    treeToggle.addEventListener("change", () => {
      layers.tree.visible = treeToggle.checked;
    });
    layers.tree.visible = treeToggle.checked;
  }
}
