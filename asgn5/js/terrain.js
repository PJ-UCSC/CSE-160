/**
 * @file Terrain mesh, height sampling, stream water, and terrain shader uniforms.
 *
 * World Z is flipped relative to heightmap row index after `rotateX(-π/2)`;
 * use `normZToWorldZ` / `sampleHeightAt` rather than raw UV when placing objects.
 */
import * as THREE from "three";
import { generateHeightMap, streamCenterX, streamHalfWidth } from "./heightmap.js";
import { createTerrainTextures, createWaterTextures } from "./proceduralTextures.js";
import {
  terrainVertexShader,
  terrainFragmentShader,
  waterVertexShader,
  waterFragmentShader,
} from "./shaders.js";

const TERRAIN_WORLD_SIZE = 80;
const MAX_HEIGHT = 14;
/** Must match height texture encoding in createTerrain */
const HEIGHT_NORMALIZE = 1.1;
/** Clearance above stream bed — avoids z-fight with terrain mesh */
const WATER_LIFT = 0.14;

/** World Z is flipped vs heightmap nz after PlaneGeometry.rotateX(-π/2). */
function normZToWorldZ(nz) {
  return (0.5 - nz) * TERRAIN_WORLD_SIZE;
}

function normToWorld(nx, nz) {
  return {
    wx: (nx - 0.5) * TERRAIN_WORLD_SIZE,
    wz: normZToWorldZ(nz),
  };
}

export function terrainSurfaceY(heights, size, nx, nz) {
  const fx = nx * (size - 1);
  const fz = nz * (size - 1);
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, size - 1);
  const z1 = Math.min(z0 + 1, size - 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const h00 = heights[z0 * size + x0];
  const h10 = heights[z0 * size + x1];
  const h01 = heights[z1 * size + x0];
  const h11 = heights[z1 * size + x1];
  const h =
    (1 - tx) * (1 - tz) * h00 +
    tx * (1 - tz) * h10 +
    (1 - tx) * tz * h01 +
    tx * tz * h11;
  return (h / HEIGHT_NORMALIZE) * MAX_HEIGHT;
}

export function createTerrain() {
  const { heights, streamMask, size, campPosition } = generateHeightMap();
  const textures = createTerrainTextures();

  const heightData = new Uint8Array(size * size * 4);
  for (let i = 0; i < heights.length; i++) {
    const v = Math.min(255, Math.floor((heights[i] / 1.1) * 255));
    const o = i * 4;
    heightData[o] = v;
    heightData[o + 1] = v;
    heightData[o + 2] = v;
    heightData[o + 3] = 255;
  }

  const heightTexture = new THREE.DataTexture(
    heightData,
    size,
    size,
    THREE.RGBAFormat,
    THREE.UnsignedByteType
  );
  heightTexture.needsUpdate = true;
  heightTexture.wrapS = heightTexture.wrapT = THREE.ClampToEdgeWrapping;
  heightTexture.minFilter = THREE.LinearFilter;
  heightTexture.magFilter = THREE.LinearFilter;

  const segments = size - 1;
  const geometry = new THREE.PlaneGeometry(
    TERRAIN_WORLD_SIZE,
    TERRAIN_WORLD_SIZE,
    segments,
    segments
  );
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    uniforms: createTerrainUniforms(heightTexture, textures, size),
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  const water = createStreamWater(heights, size);
  const campWorld = heightToWorld(
    campPosition.x,
    campPosition.z,
    heights,
    size
  );

  return {
    mesh,
    water,
    material,
    heights,
    streamMask,
    size,
    campWorld,
    maxHeight: MAX_HEIGHT,
    worldSize: TERRAIN_WORLD_SIZE,
  };
}

/** Shader uniforms for terrain lighting, fog, textures, and height sampling. */
function createTerrainUniforms(heightTexture, textures, size) {
  const spotAngle = Math.PI / 5;
  return {
    uHeightMap: { value: heightTexture },
    uMaxHeight: { value: MAX_HEIGHT },
    uHeightTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
    uTerrainSize: { value: TERRAIN_WORLD_SIZE },
    uSandMap: { value: textures.sand.map },
    uSandNormal: { value: textures.sand.normalMap },
    uGrassMap: { value: textures.grass.map },
    uGrassNormal: { value: textures.grass.normalMap },
    uRockMap: { value: textures.rock.map },
    uRockNormal: { value: textures.rock.normalMap },
    uSnowMap: { value: textures.snow.map },
    uMoonDir: { value: new THREE.Vector3(0.4, 0.85, 0.25).normalize() },
    uMoonColor: { value: new THREE.Color(0.75, 0.82, 1.0) },
    uSunDir: { value: new THREE.Vector3(-0.5, 0.85, 0.35).normalize() },
    uSunColor: { value: new THREE.Color(1.0, 0.97, 0.88) },
    uFirePos: { value: new THREE.Vector3() },
    uFireColor: { value: new THREE.Color(1.0, 0.55, 0.2) },
    uFillColor: { value: new THREE.Color(0.25, 0.3, 0.45) },
    uFogColor: { value: new THREE.Color(0.06, 0.09, 0.16) },
    uFogNear: { value: 8 },
    uFogFar: { value: 50 },
    uFogStrength: { value: 0.92 },
    uFogTime: { value: 0 },
    uCameraPos: { value: new THREE.Vector3() },
    uSpotPos: { value: new THREE.Vector3() },
    uSpotDir: { value: new THREE.Vector3(0, 0, -1) },
    uSpotColor: { value: new THREE.Color(1.0, 0.95, 0.88) },
    uSpotIntensity: { value: 0 },
    uSpotCosOuter: { value: Math.cos(spotAngle) },
    uSpotCosInner: { value: Math.cos(spotAngle * 0.55) },
  };
}

function heightToWorld(nx, nz, heights, size) {
  const x = (nx - 0.5) * TERRAIN_WORLD_SIZE;
  const z = normZToWorldZ(nz);
  const y = terrainSurfaceY(heights, size, nx, nz);
  return new THREE.Vector3(x, y, z);
}

function streamBedY(heights, size, nx, nz) {
  return terrainSurfaceY(heights, size, nx, nz) + WATER_LIFT;
}

function createStreamWater(heights, size) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const steps = size - 1;
  const crossSegs = 10;
  const vertsPerRow = crossSegs + 1;
  const nzMin = 0.02;
  const nzMax = 0.98;

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const nz = nzMin + t * (nzMax - nzMin);
    const nx = streamCenterX(nz);
    const halfN = streamHalfWidth(nz) * 0.95;
    const nxL = nx - halfN;
    const nxR = nx + halfN;

    for (let w = 0; w <= crossSegs; w++) {
      const u = w / crossSegs;
      const nxW = nxL + (nxR - nxL) * u;
      const { wx, wz } = normToWorld(nxW, nz);
      positions.push(wx, streamBedY(heights, size, nxW, nz), wz);
      uvs.push(u, t);
    }
  }

  for (let s = 0; s < steps; s++) {
    const row0 = s * vertsPerRow;
    const row1 = (s + 1) * vertsPerRow;
    for (let w = 0; w < crossSegs; w++) {
      const a = row0 + w;
      const b = row1 + w;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  // Ribbon winding yields downward normals; flip so the surface faces up.
  const normals = geo.attributes.normal;
  for (let i = 0; i < normals.count; i++) {
    normals.setY(i, Math.abs(normals.getY(i)));
  }
  normals.needsUpdate = true;

  const waterTex = createWaterTextures();

  const waterMaterial = new THREE.ShaderMaterial({
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    uniforms: {
      uFlowMap: { value: waterTex.map },
      uTime: { value: 0 },
      uDeepColor: { value: new THREE.Color(0x329882) },
      uShallowColor: { value: new THREE.Color(0x55c8a0) },
      uGlowColor: { value: new THREE.Color(0x38a890) },
      uSunDir: { value: new THREE.Vector3(-0.5, 0.85, 0.35).normalize() },
      uMoonDir: { value: new THREE.Vector3(0.4, 0.85, 0.25).normalize() },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
  });

  const surface = new THREE.Mesh(geo, waterMaterial);
  surface.renderOrder = 0;

  const stream = new THREE.Group();
  stream.add(surface);
  stream.frustumCulled = false;
  stream.userData.waterMaterial = waterMaterial;
  return stream;
}

/** Animate water flow and sync light directions. */
export function updateStreamWater(stream, time, sunDir, moonDir) {
  const mat = stream.userData.waterMaterial;
  if (!mat) return;
  mat.uniforms.uTime.value = time;
  if (sunDir) mat.uniforms.uSunDir.value.copy(sunDir);
  if (moonDir) mat.uniforms.uMoonDir.value.copy(moonDir);
}

export function sampleHeightAt(worldX, worldZ, heights, size, worldSize = TERRAIN_WORLD_SIZE) {
  const nx = worldX / worldSize + 0.5;
  const nz = 0.5 - worldZ / worldSize;
  if (nx < 0 || nx > 1 || nz < 0 || nz > 1) return 0;
  return terrainSurfaceY(heights, size, nx, nz);
}
