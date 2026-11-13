// Terrain surface: MeshStandardMaterial (keeps three's lights, shadows, fog, tone mapping) with every
// overlay injected into one shader, so toggling a layer is a uniform write and never a reload.
import * as THREE from "three";
import { LUT_ROWS } from "./luts";

function px(data: number[], format: THREE.PixelFormat = THREE.RGBAFormat): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array(data), 1, 1, format);
  t.needsUpdate = true;
  return t;
}

export function emptyWater(): THREE.Data3DTexture {
  const t = new THREE.Data3DTexture(new Uint8Array(1), 1, 1, 1);
  t.format = THREE.RedFormat;
  t.needsUpdate = true;
  return t;
}

export function createTerrainMaterial() {
  const empty = { rgba: px([0, 0, 0, 0]), gray: px([128, 128, 128, 255]), up: px([128, 128, 255, 255]), masked: px([255], THREE.RedFormat), noDiff: px([128], THREE.RedFormat), far: px([255], THREE.RedFormat), water: emptyWater() };
  const uniforms = {
    uImagery: { value: empty.gray as THREE.Texture },
    uNormalTex: { value: empty.up as THREE.Texture },
    uLayers: { value: empty.rgba as THREE.Texture }, // R slope, G flow_accumulation, B depressions, A cover_class
    uLut: { value: empty.rgba as THREE.Texture },
    uRisk: { value: empty.masked as THREE.Texture },
    uDiff: { value: empty.noDiff as THREE.Texture },
    uFieldIds: { value: empty.rgba as THREE.Texture }, // R = field under the pixel, G = field owning the nearest edge
    uFieldDist: { value: empty.far as THREE.Texture }, // distance to the nearest field edge
    uWater: { value: empty.water as THREE.Data3DTexture },
    uWaterW: { value: 0 }, // 3D texture depth coordinate = interpolated frame
    uWaterOn: { value: 0 },
    uTimeMin: { value: 0 },
    uLayerOn: { value: new THREE.Vector4(0, 0, 0, 0) },
    uRiskOn: { value: 0 },
    uDiffOn: { value: 0 },
    uImageryFade: { value: 0 },
    uCoarse: { value: 0 },
    uSize: { value: new THREE.Vector2(1, 1) }, // meters
    uFieldRange: { value: 8 }, // meters covered by uFieldDist
    uSelected: { value: 0 }, // field index + 1, 0 = none
    uHovered: { value: 0 },
    uRiskHatchFrom: { value: 60 },
  };

  const material = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTUv = uv;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEADER}`)
      .replace("#include <map_fragment>", FRAG_COLOR)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, ftWater);")
      // normal.png is the true terrain normal (R east, G north, B up); the object frame is X east, Y up, Z south.
      // normalMatrix carries the vertical exaggeration and the terraform rise, so lighting follows the animation.
      .replace("#include <normal_fragment_maps>", "vec3 ftN = texture2D(uNormalTex, vTUv).xyz * 2.0 - 1.0;\nnormal = normalize(normalMatrix * vec3(ftN.x, ftN.z, -ftN.y));")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += ftGlow;");
  };
  material.customProgramCacheKey = () => "fieldtwin-terrain-1";

  return { material, uniforms, empty };
}

export type TerrainUniforms = ReturnType<typeof createTerrainMaterial>["uniforms"];

const FRAG_HEADER = /* glsl */ `
precision highp sampler3D;
varying vec2 vTUv;
uniform mat3 normalMatrix;
uniform sampler2D uImagery, uNormalTex, uLayers, uLut, uRisk, uDiff, uFieldIds, uFieldDist;
uniform sampler3D uWater;
uniform float uWaterW, uWaterOn, uTimeMin, uRiskOn, uDiffOn, uImageryFade, uCoarse, uFieldRange, uSelected, uHovered, uRiskHatchFrom;
uniform vec4 uLayerOn;
uniform vec2 uSize;

vec4 ftLut(float byte, float row) { return texture2D(uLut, vec2((byte + 0.5) / 256.0, (row + 0.5) / ${LUT_ROWS}.0)); }
`;

const FRAG_COLOR = /* glsl */ `
vec2 ftM = vTUv * uSize; // meters from the north-west corner
float ftWater = 0.0;
vec3 ftGlow = vec3(0.0);
{
  // Before the imagery fades in: bare clay with a faint survey grid.
  vec2 g = abs(fract(ftM / 32.0) - 0.5);
  vec3 bare = mix(vec3(0.50, 0.46, 0.39), vec3(0.62, 0.58, 0.50), step(0.47, max(g.x, g.y)));
  vec3 img = texture2D(uImagery, vTUv).rgb;
  // Coarse imagery: mute it so the relief shading (hillshade) carries the picture instead of blurry pixels.
  img = mix(img, vec3(dot(img, vec3(0.2126, 0.7152, 0.0722))) * vec3(1.0, 0.97, 0.9), uCoarse * 0.75);
  vec3 base = mix(bare, img, uImageryFade);

  vec4 lb = texture2D(uLayers, vTUv) * 255.0;
  vec4 c;
  c = ftLut(lb.r, 0.0); base = mix(base, c.rgb, c.a * uLayerOn.x);
  c = ftLut(lb.g, 1.0); base = mix(base, c.rgb, c.a * uLayerOn.y);
  c = ftLut(lb.b, 2.0); base = mix(base, c.rgb, c.a * uLayerOn.z);
  c = ftLut(lb.a, 3.0); base = mix(base, c.rgb, c.a * uLayerOn.w);

  float risk = texture2D(uRisk, vTUv).r * 255.0;
  c = ftLut(risk, 4.0);
  float hatch = step(0.5, fract((ftM.x + ftM.y) / 5.0)) * step(uRiskHatchFrom, risk);
  base = mix(base, c.rgb * (1.0 - 0.55 * hatch), c.a * uRiskOn);

  // Water: depth relative to max_depth_mm; no water where the frame byte is 0.
  float wd = texture(uWater, vec3(vTUv, uWaterW)).r;
  ftWater = smoothstep(0.002, 0.05, wd) * uWaterOn;
  float flow = sin(dot(ftM, vec2(0.9, 0.6)) * 0.7 + uTimeMin * 0.05) * sin(dot(ftM, vec2(-0.5, 1.1)) * 0.5 - uTimeMin * 0.04);
  vec3 wcol = mix(vec3(0.33, 0.62, 0.78), vec3(0.02, 0.13, 0.36), pow(wd, 0.45)) + flow * 0.035;
  base = mix(base, wcol, ftWater * mix(0.6, 0.94, pow(wd, 0.5)));

  // Difference b - a: solid glow where b is wetter, striped where b is drier (pattern, not only hue).
  float db = texture2D(uDiff, vTUv).r * 255.0;
  c = ftLut(db, 5.0);
  float stripes = mix(0.2, 1.0, step(0.5, fract((ftM.x - ftM.y) / 7.0)));
  float da = c.a * uDiffOn * (db < 128.0 ? stripes : 1.0);
  base = mix(base, c.rgb, da * 0.75);
  ftGlow += c.rgb * da * 0.9;

  // Field polygons: outline where the id changes, tint for hover, glow for the selection.
  vec2 fids = floor(texture2D(uFieldIds, vTUv).rg * 255.0 + 0.5);
  float fdist = texture2D(uFieldDist, vTUv).r * uFieldRange; // meters
  float aa = fwidth(fdist) + 0.05;
  float edge = 1.0 - smoothstep(0.9 - aa, 0.9 + aa, fdist);
  float isSel = step(0.5, uSelected) * (1.0 - step(0.5, abs(fids.x - uSelected)));
  float isHov = step(0.5, uHovered) * (1.0 - step(0.5, abs(fids.x - uHovered)));
  float selNear = step(0.5, uSelected) * (1.0 - step(0.5, abs(fids.y - uSelected)));
  float selEdge = selNear * (1.0 - smoothstep(1.8 - aa, 1.8 + aa, fdist));
  float halo = selNear * exp(-fdist * 0.6) * 0.35;
  base = mix(base, vec3(1.0, 0.92, 0.6), 0.12 * isHov + 0.14 * isSel);
  base = mix(base, vec3(1.0), edge * 0.75);
  base = mix(base, vec3(1.0, 0.8, 0.25), max(selEdge, halo * 0.5));
  ftGlow += vec3(1.0, 0.68, 0.12) * (selEdge * 0.55 + halo);

  diffuseColor.rgb = base;
}
`;
