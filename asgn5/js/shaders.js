export const terrainVertexShader = /* glsl */ `
uniform sampler2D uHeightMap;
uniform float uMaxHeight;
uniform vec2 uHeightTexel;
uniform float uTerrainSize;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vHeight;
varying float vSlope;

void main() {
  vUv = uv;
  float h = texture2D(uHeightMap, uv).r;
  vHeight = h;

  vec2 texel = uHeightTexel;
  float hL = texture2D(uHeightMap, uv + vec2(-texel.x, 0.0)).r;
  float hR = texture2D(uHeightMap, uv + vec2(texel.x, 0.0)).r;
  float hD = texture2D(uHeightMap, uv + vec2(0.0, -texel.y)).r;
  float hU = texture2D(uHeightMap, uv + vec2(0.0, texel.y)).r;

  float dx = texel.x * uTerrainSize;
  float dz = texel.y * uTerrainSize;
  float dhdx = (hL - hR) * uMaxHeight / (2.0 * dx);
  float dhdz = (hU - hD) * uMaxHeight / (2.0 * dz);

  vec3 pos = position;
  pos.y = h * uMaxHeight;

  vec3 n = normalize(vec3(dhdx, 1.0, dhdz));
  vWorldNormal = normalize(mat3(modelMatrix) * n);
  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
  vSlope = 1.0 - n.y;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

export const terrainFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uHeightMap;
uniform sampler2D uSandMap;
uniform sampler2D uSandNormal;
uniform sampler2D uGrassMap;
uniform sampler2D uGrassNormal;
uniform sampler2D uRockMap;
uniform sampler2D uRockNormal;
uniform sampler2D uSnowMap;
uniform float uTerrainSize;
uniform vec2 uHeightTexel;

uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uFirePos;
uniform vec3 uFireColor;
uniform vec3 uFillColor;
uniform vec3 uCameraPos;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uFogStrength;
uniform float uFogTime;
uniform vec3 uSpotPos;
uniform vec3 uSpotDir;
uniform vec3 uSpotColor;
uniform float uSpotIntensity;
uniform float uSpotCosOuter;
uniform float uSpotCosInner;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vHeight;
varying float vSlope;

const float TEX_SCALE = 0.065;
const float TEX_SCALE2 = 0.17;
const float TEX_SCALE3 = 0.31;

vec2 heightUvFromWorld(vec2 xz) {
  return vec2(xz.x / uTerrainSize + 0.5, 0.5 - xz.y / uTerrainSize);
}

float sampleHeightSmooth(vec2 xz) {
  vec2 uv = heightUvFromWorld(xz);
  float h = texture2D(uHeightMap, uv).r;
  float hBlur = (
    texture2D(uHeightMap, uv + vec2(uHeightTexel.x, 0.0)).r +
    texture2D(uHeightMap, uv + vec2(-uHeightTexel.x, 0.0)).r +
    texture2D(uHeightMap, uv + vec2(0.0, uHeightTexel.y)).r +
    texture2D(uHeightMap, uv + vec2(0.0, -uHeightTexel.y)).r
  ) * 0.25;
  return mix(h, hBlur, 0.4);
}

vec2 terrainWarp(vec2 worldXZ) {
  vec2 p = worldXZ * TEX_SCALE;
  return p + vec2(
    sin(p.x * 2.4 + p.y * 1.7) * 0.18 + sin(worldXZ.x * 0.41) * 0.05,
    sin(p.y * 2.1 + p.x * 2.3) * 0.18 + sin(worldXZ.y * 0.37) * 0.05
  );
}

vec2 terrainUvRot(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec4 sampleAlbedo(sampler2D map, vec2 worldXZ, vec2 warp) {
  vec2 uv1 = warp;
  vec2 uv2 = worldXZ * TEX_SCALE2 + vec2(41.3, 17.8);
  vec2 uv3 = terrainUvRot(worldXZ * TEX_SCALE3 + vec2(9.2, 31.5), 0.85) + warp * 0.25;
  vec4 a = texture2D(map, uv1);
  vec4 b = texture2D(map, uv2);
  vec4 c = texture2D(map, uv3);
  return (a + b + c) / 3.0;
}

vec3 sampleTangentNormal(sampler2D map, vec2 worldXZ, vec2 warp) {
  vec2 uv1 = warp;
  vec2 uv2 = worldXZ * TEX_SCALE2 + vec2(41.3, 17.8);
  vec2 uv3 = terrainUvRot(worldXZ * TEX_SCALE3 + vec2(9.2, 31.5), 0.85) + warp * 0.25;
  vec3 n1 = texture2D(map, uv1).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(map, uv2).xyz * 2.0 - 1.0;
  vec3 n3 = texture2D(map, uv3).xyz * 2.0 - 1.0;
  return normalize((n1 + n2 + n3) / 3.0);
}

float halfLambert(float ndl) {
  return ndl * 0.5 + 0.5;
}

void main() {
  vec2 worldXZ = vWorldPos.xz;
  vec2 warp = terrainWarp(worldXZ);

  vec4 sandS = sampleAlbedo(uSandMap, worldXZ, warp);
  vec4 grassS = sampleAlbedo(uGrassMap, worldXZ, warp);
  vec4 rockS = sampleAlbedo(uRockMap, worldXZ, warp);
  vec4 snowS = sampleAlbedo(uSnowMap, worldXZ, warp);

  vec3 sandN = sampleTangentNormal(uSandNormal, worldXZ, warp);
  vec3 grassN = sampleTangentNormal(uGrassNormal, worldXZ, warp);
  vec3 rockN = sampleTangentNormal(uRockNormal, worldXZ, warp);

  float h = sampleHeightSmooth(worldXZ);
  float wSand = 1.0 - smoothstep(0.08, 0.24, h);
  float wGrass = smoothstep(0.1, 0.3, h) * (1.0 - smoothstep(0.36, 0.6, h));
  float wRock = smoothstep(0.3, 0.54, h) * (1.0 - smoothstep(0.6, 0.84, h));
  wRock += vSlope * smoothstep(0.15, 0.45, vSlope) * 0.65;
  float wSnow = smoothstep(0.58, 0.78, h);

  float wSum = wSand + wGrass + wRock + wSnow + 0.0001;
  wSand /= wSum;
  wGrass /= wSum;
  wRock /= wSum;
  wSnow /= wSum;

  vec3 albedo = sandS.rgb * wSand + grassS.rgb * wGrass + rockS.rgb * wRock + snowS.rgb * wSnow;
  float roughness = sandS.a * wSand + grassS.a * wGrass + rockS.a * wRock + snowS.a * wSnow;

  vec3 tangentN = normalize(
    sandN * wSand + grassN * wGrass + rockN * wRock + vec3(0.0, 0.0, 1.0) * wSnow
  );

  vec3 N = normalize(vWorldNormal);
  vec3 up = abs(N.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 T = normalize(cross(up, N));
  vec3 B = cross(N, T);
  N = normalize(mat3(T, B, N) * tangentN);

  vec3 V = normalize(uCameraPos - vWorldPos);

  vec3 Lsun = normalize(-uSunDir);
  vec3 Lmoon = normalize(-uMoonDir);
  float ndlSun = max(dot(N, Lsun), 0.0);
  float ndlMoon = max(dot(N, Lmoon), 0.0);
  float diffSun = halfLambert(ndlSun);
  float diffMoon = halfLambert(ndlMoon);

  float sunStr = length(uSunColor);
  float moonStr = length(uMoonColor);

  vec3 ambient = albedo * uFillColor * 0.28;
  vec3 sunLit = albedo * uSunColor * diffSun * (1.15 + sunStr * 0.35);
  vec3 moonLit = albedo * uMoonColor * diffMoon * (0.95 + moonStr * 0.4);

  vec3 fireLit = vec3(0.0);
  vec3 toFire = uFirePos - vWorldPos;
  float fireDist = length(toFire);
  if (length(uFireColor) > 0.001) {
    vec3 Lf = normalize(toFire);
    float diffFire = halfLambert(max(dot(N, Lf), 0.0));
    diffFire /= 1.0 + fireDist * fireDist * 0.06;
    diffFire *= smoothstep(35.0, 3.0, fireDist);
    fireLit = albedo * uFireColor * diffFire * 2.2;
  }

  vec3 spotLit = vec3(0.0);
  if (uSpotIntensity > 0.001) {
    float spotDist = length(vWorldPos - uSpotPos);
    vec3 Ls = normalize(uSpotPos - vWorldPos);
    float cosTheta = dot(normalize(uSpotDir), normalize(vWorldPos - uSpotPos));
    float spotMask = smoothstep(uSpotCosOuter, uSpotCosInner, cosTheta);
    float spotAtten = 1.0 / (1.0 + spotDist * spotDist * 0.01);
    spotAtten *= smoothstep(60.0, 6.0, spotDist);
    float diffSpot = halfLambert(max(dot(N, Ls), 0.0)) * spotMask * spotAtten;
    spotLit = albedo * uSpotColor * diffSpot * 3.5 * uSpotIntensity;
  }

  vec3 Hsun = normalize(Lsun + V);
  vec3 Hmoon = normalize(Lmoon + V);
  float specSun = pow(max(dot(N, Hsun), 0.0), mix(18.0, 72.0, 1.0 - roughness));
  float specMoon = pow(max(dot(N, Hmoon), 0.0), mix(12.0, 56.0, 1.0 - roughness));
  vec3 specular =
    uSunColor * specSun * (1.0 - roughness) * 0.35 * sunStr +
    uMoonColor * specMoon * (1.0 - roughness) * 0.22 * moonStr;

  vec3 color = ambient + sunLit + moonLit + fireLit + spotLit + specular;

  float fogDist = length(vWorldPos - uCameraPos);
  float fogFactor = smoothstep(uFogNear, uFogFar, fogDist) * uFogStrength;

  float mountainMask = smoothstep(5.0, 26.0, -vWorldPos.z) * smoothstep(0.32, 0.72, vHeight);
  vec2 fogUv = vWorldPos.xz * 0.06 + vec2(uFogTime * 0.04, uFogTime * 0.025);
  float fogN =
    sin(fogUv.x * 2.1 + uFogTime * 0.5) * sin(fogUv.y * 1.7 - uFogTime * 0.35) * 0.5 +
    sin(fogUv.x * 4.3 - uFogTime * 0.3) * sin(fogUv.y * 3.1 + uFogTime * 0.2) * 0.35 +
    0.5;
  float mountainFog = mountainMask * (0.25 + 0.35 * fogN) * uFogStrength;

  color = mix(color, uFogColor, clamp(fogFactor + mountainFog, 0.0, 0.95));

  gl_FragColor = vec4(color, 1.0);
}
`;

export const fogVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fogFragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vWorldPos;

float fogHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float fogNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = fogHash(i);
  float b = fogHash(i + vec2(1.0, 0.0));
  float c = fogHash(i + vec2(0.0, 1.0));
  float d = fogHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fogFbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    v += amp * fogNoise(p);
    p *= 2.1;
    amp *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv + vec2(uTime * 0.03, uTime * 0.018);
  vec2 sampleUv = uv * vec2(3.5, 2.0) + vec2(uTime * 0.02, 0.0);
  float clouds = fogFbm(sampleUv);
  clouds = smoothstep(0.28, 0.72, clouds);

  float edgeY = smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
  float edgeX = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float alpha = clouds * edgeX * edgeY * uOpacity;

  gl_FragColor = vec4(uColor, alpha);
}
`;

export const waterVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const waterFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uFlowMap;
uniform float uTime;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform vec3 uGlowColor;
uniform vec3 uMoonDir;
uniform vec3 uSunDir;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormal;

void main() {
  vec2 uv = vUv + vec2(sin(uTime * 0.65) * 0.015, uTime * 0.085);
  vec3 flow = texture2D(uFlowMap, uv).rgb;
  float ripple = flow.g;

  vec3 base = mix(uDeepColor, uShallowColor, ripple * 0.55 + flow.r * 0.3);
  vec3 N = normalize(vNormal);
  vec3 L1 = normalize(-uSunDir);
  vec3 L2 = normalize(-uMoonDir);
  float diff = max(dot(N, L1), 0.0) * 0.45 + max(dot(N, L2), 0.0) * 0.15;
  vec3 col = base * (0.92 + diff);
  col += uGlowColor * (0.2 + 0.12 * sin(uTime * 1.1 + vUv.y * 12.0));

  gl_FragColor = vec4(col, 0.92);
}
`;

export const fireParticleVertexShader = /* glsl */ `
attribute float size;
uniform float uPointSize;
uniform float uSizeShrink;
uniform float uDepthBias;
varying float vLife;

void main() {
  vLife = size;
  float displaySize = mix(uSizeShrink, 1.0, size);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = (uPointSize * displaySize) / -mv.z;
  gl_Position = projectionMatrix * mv;
  gl_Position.z -= uDepthBias * gl_Position.w;
}
`;

export const fireParticleFragmentShader = /* glsl */ `
uniform float uAlphaScale;
uniform float uWarmth;
varying float vLife;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float core = 1.0 - smoothstep(0.0, 0.38, d);
  float edge = 1.0 - smoothstep(0.15, 0.5, d);
  vec3 hot = mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.85, 0.2), core);
  vec3 warm = mix(vec3(1.0, 0.42, 0.04), vec3(1.0, 0.55, 0.12), core);
  vec3 col = mix(hot, warm, uWarmth);
  float alpha = edge * vLife * uAlphaScale;
  gl_FragColor = vec4(col, alpha);
}
`;

export const smokeParticleVertexShader = /* glsl */ `
attribute float opacity;
uniform float uPointSize;
varying float vOpacity;

void main() {
  vOpacity = opacity;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float size = 0.35 + opacity * 0.65;
  gl_PointSize = (uPointSize * size) / -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const smokeParticleFragmentShader = /* glsl */ `
uniform float uAlphaScale;
varying float vOpacity;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float puff = 1.0 - smoothstep(0.08, 0.5, d);
  float a = puff * vOpacity * uAlphaScale;
  vec3 col = mix(vec3(0.52, 0.54, 0.58), vec3(0.68, 0.7, 0.74), puff * 0.6);
  gl_FragColor = vec4(col, a);
}
`;
