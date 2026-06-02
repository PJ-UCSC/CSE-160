import { smoothstep, fbm } from "./noise.js";

const SIZE = 256;

export function streamCenterX(nz) {
  return 0.5 + Math.sin(nz * Math.PI * 2.3) * 0.12 + Math.sin(nz * Math.PI * 5.1) * 0.04;
}

export function streamHalfWidth(nz) {
  const streamWidth = 0.018 + nz * 0.008;
  return streamWidth * 0.85;
}

export function generateHeightMap(size = SIZE) {
  const heights = new Float32Array(size * size);
  const streamMask = new Float32Array(size * size);

  const campNX = 0.48;
  const campNZ = 0.42;
  const campRadius = 0.11;

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      const nx = x / (size - 1);
      const nz = z / (size - 1);
      const wx = nx * 6;
      const wz = nz * 6;

      let h = fbm(wx, wz, 4, 2.1) * 0.22;
      h += fbm(wx * 2.3 + 10, wz * 2.3, 3, 2.1) * 0.08;

      const mountainZone = smoothstep(0.58, 0.92, nz);
      h += mountainZone * (fbm(wx * 3.5, wz * 3.5 + 50, 6, 2.1) * 0.55 + fbm(wx * 7, wz * 7 + 20, 4, 2.1) * 0.35);

      const distCamp = Math.hypot(nx - campNX, nz - campNZ);
      const flatBlend = 1 - smoothstep(campRadius * 0.6, campRadius, distCamp);
      h = h * (1 - flatBlend * 0.85) + 0.14 * flatBlend;

      const sx = streamCenterX(nz);
      const streamDist = Math.abs(nx - sx);
      const streamWidth = 0.018 + nz * 0.008;
      const inStream = 1 - smoothstep(streamWidth * 0.4, streamWidth, streamDist);
      h -= inStream * (0.06 + smoothstep(0.2, 0.85, nz) * 0.04);
      streamMask[z * size + x] = inStream;

      const edgeFalloff = smoothstep(0, 0.06, nx) * smoothstep(0, 0.06, 1 - nx);
      h *= 0.3 + edgeFalloff * 0.7;

      heights[z * size + x] = Math.max(0, h);
    }
  }

  return { heights, streamMask, size, campPosition: { x: campNX, z: campNZ } };
}

export { SIZE as HEIGHT_MAP_SIZE };
