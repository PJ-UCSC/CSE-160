import * as THREE from "three";
import { fbm } from "./noise.js";

const TEX_SIZE = 256;

function makeCanvas(size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext("2d") };
}

function toTexture(canvas, colorSpace = THREE.SRGBColorSpace) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = colorSpace;
  return tex;
}

function setRepeat(surface, repeatX, repeatY) {
  surface.map.repeat.set(repeatX, repeatY);
  surface.normalMap.repeat.set(repeatX, repeatY);
}

function buildSurface(size, colorFn, normalStrength = 2.5) {
  const { canvas: cAlbedo, ctx: ctxA } = makeCanvas(size);
  const { canvas: cNormal, ctx: ctxN } = makeCanvas(size);
  const img = ctxA.createImageData(size, size);
  const normal = ctxN.createImageData(size, size);
  const heights = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      heights[y * size + x] = fbm((x / size) * 12, (y / size) * 12, 4);
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const hL = heights[i - 1] ?? heights[i];
      const hR = heights[i + 1] ?? heights[i];
      const hD = heights[i - size] ?? heights[i];
      const hU = heights[i + size] ?? heights[i];
      const nx = -((hR - hL) * normalStrength);
      const ny = -((hU - hD) * normalStrength);
      const len = Math.hypot(nx, ny, 1);
      const [r, g, b, roughVal] = colorFn(x / size, y / size, heights[i]);
      const pi = i * 4;
      img.data[pi] = r;
      img.data[pi + 1] = g;
      img.data[pi + 2] = b;
      img.data[pi + 3] = Math.floor(roughVal * 255);
      normal.data[pi] = ((nx / len) * 0.5 + 0.5) * 255;
      normal.data[pi + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      normal.data[pi + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      normal.data[pi + 3] = 255;
    }
  }

  ctxA.putImageData(img, 0, 0);
  ctxN.putImageData(normal, 0, 0);

  return {
    map: toTexture(cAlbedo),
    normalMap: toTexture(cNormal, THREE.NoColorSpace),
  };
}

export function createTerrainTextures() {
  const sand = buildSurface(TEX_SIZE, (u, v, h) => {
    const grain = fbm(u * 40, v * 40, 3);
    return [194 + grain * 35 + h * 20, 168 + grain * 28 + h * 15, 120 + grain * 20, 0.85 + grain * 0.1];
  }, 3);

  const grass = buildSurface(TEX_SIZE, (u, v, h) => {
    const blade = fbm(u * 55, v * 55, 2);
    const patch = fbm(u * 8, v * 8, 3);
    return [45 + patch * 40 + blade * 25, 95 + patch * 70 + blade * 35, 35 + patch * 20, 0.72 + blade * 0.18];
  }, 4);

  const rock = buildSurface(TEX_SIZE, graniteColorFn, 6.5);

  const snow = buildSurface(TEX_SIZE, (u, v) => {
    const sparkle = fbm(u * 30, v * 30, 2);
    const v2 = 235 + sparkle * 20;
    return [v2, v2 + 2, v2 + 8, 0.25 + sparkle * 0.15];
  }, 1.2);

  [sand, grass, rock, snow].forEach((set) => {
    set.map.repeat.set(1, 1);
    set.normalMap.repeat.set(1, 1);
  });

  return { sand, grass, rock, snow };
}

function graniteColorFn(u, v, h) {
  const grain = fbm(u * 32, v * 32, 4);
  const coarse = fbm(u * 11, v * 11, 3);
  const speckle = fbm(u * 72, v * 72, 2);
  const quartz = Math.pow(Math.max(0, speckle - 0.42), 2.4);
  const dark = Math.pow(1.0 - grain, 2.1) * 0.38;
  const feldspar = fbm(u * 16 + 2.1, v * 16, 3);
  const warm = Math.max(0, feldspar - 0.5) * 0.28;

  const r = 115 + coarse * 48 + quartz * 62 + warm * 42 - dark * 45 + h * 8;
  const g = 110 + coarse * 44 + quartz * 64 + warm * 22 - dark * 42 + h * 7;
  const b = 106 + coarse * 42 + quartz * 70 + warm * 14 - dark * 40 + h * 8;
  const clamp = (c) => Math.min(255, Math.max(0, c));
  return [clamp(r), clamp(g), clamp(b), 0.78 + grain * 0.18];
}

export function createGraniteTexture() {
  const granite = buildSurface(TEX_SIZE, graniteColorFn, 6.5);
  setRepeat(granite, 2.4, 2.4);
  return granite;
}

export function createBarkTexture() {
  const bark = buildSurface(
    TEX_SIZE,
    (u, v, h) => {
      const grain = fbm(u * 22, v * 10, 4);
      const ridges = fbm(u * 5, v * 48, 5);
      const groove =
        Math.pow(Math.abs(Math.sin((v + grain * 0.12) * Math.PI * 18)), 0.35) * 0.5 + 0.5;
      const tone = grain * 0.35 + ridges * 0.4 + groove * 0.25 + h * 0.08;
      return [52 + tone * 52, 34 + tone * 32, 20 + tone * 22, 0.9 + grain * 0.08];
    },
    5.5
  );
  setRepeat(bark, 1.8, 3.2);
  return bark;
}

export function createWaterTextures() {
  const water = buildSurface(
    TEX_SIZE,
    (u, v, h) => {
      const along = fbm(u * 4, v * 32, 5);
      const ripple = fbm(u * 28 + v * 6, v * 22, 4);
      const streak = Math.sin((v * 48 + along * 2.5) * Math.PI * 2) * 0.8 + 0.5;
      const tone = along * 0.45 + ripple * 0.35 + streak * 0.7 + h * 0.06;
      return [45 + tone * 38, 145 + tone * 55, 125 + tone * 40, 0.25 + ripple * 0.12];
    },
    2.2
  );
  setRepeat(water, 2.5, 14);
  return water;
}
