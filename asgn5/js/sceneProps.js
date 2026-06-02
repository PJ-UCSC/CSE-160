import * as THREE from "three";
import { sampleHeightAt } from "./terrain.js";
import { createBarkTexture, createGraniteTexture } from "./proceduralTextures.js";

export function addSceneProps(scene, campWorld, heights, size) {
  const props = new THREE.Group();

  addTrees(props, campWorld, heights, size, 28);
  addRocks(props, campWorld, heights, size, 16);
  addTentsAndLogs(props, campWorld);

  scene.add(props);
  return props;
}

function placeOnTerrain(obj, wx, wz, heights, size, yOffset = 0) {
  const y = sampleHeightAt(wx, wz, heights, size);
  obj.position.set(wx, y + yOffset, wz);
}

function addTrees(group, camp, heights, size, count) {
  const bark = createBarkTexture();
  const trunkMat = new THREE.MeshStandardMaterial({
    map: bark.map,
    normalMap: bark.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.92,
  });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f5c28, roughness: 0.8 });

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 22;
    const wx = camp.x + Math.cos(angle) * dist;
    const wz = camp.z + Math.sin(angle) * dist;
    if (Math.hypot(wx - camp.x, wz - camp.z) < 5) continue;

    const tree = new THREE.Group();
    const scale = 0.7 + Math.random() * 1.1;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * scale, 0.18 * scale, 1.4 * scale, 6),
      trunkMat
    );
    trunk.position.y = 0.7 * scale;
    const foliage = new THREE.Mesh(
      new THREE.ConeGeometry(0.9 * scale, 2.2 * scale, 7),
      leafMat
    );
    foliage.position.y = 2.2 * scale;
    tree.add(trunk, foliage);
    placeOnTerrain(tree, wx, wz, heights, size);
    tree.rotation.y = Math.random() * Math.PI * 2;
    group.add(tree);
  }
}

function addRocks(group, camp, heights, size, count) {
  const granite = createGraniteTexture();
  const rockMat = new THREE.MeshStandardMaterial({
    map: granite.map,
    normalMap: granite.normalMap,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.88,
    metalness: 0.03,
  });

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 3 + Math.random() * 12;
    const wx = camp.x + Math.cos(angle) * dist;
    const wz = camp.z + Math.sin(angle) * dist;
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.45, 0),
      rockMat
    );
    placeOnTerrain(rock, wx, wz, heights, size, 0.15);
    rock.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    rock.scale.y = 0.5 + Math.random() * 0.5;
    group.add(rock);
  }
}

function addTentsAndLogs(group, camp) {
  const tentMat = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  const tent = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 4), tentMat);
  tent.position.set(camp.x - 2.5, camp.y, camp.z + 1.5);
  tent.rotation.y = Math.PI / 4;
  group.add(tent);

  const logSeat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.22, 0.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x5c3d22, roughness: 0.9 })
  );
  logSeat.position.set(camp.x + 1.8, camp.y + 0.25, camp.z - 1.2);
  logSeat.rotation.z = Math.PI / 2;
  group.add(logSeat);
}
