// One uber Fabric Material for every procedural ground kind (one draw call). Only uniforms change per frame.
// UV: a GroundPrimitive PolygonGeometry with stRotation 0 reports textureCoordinateRotationPoints [0,0, 0,1, 1,0]
// (@cesium/core PolygonGeometry.js `textureCoordinateRotationPoints`), so ShadowVolumeAppearanceFS gives
// materialInput.st = (0..1 west->east, 0..1 south->north) over the polygon's bounding rectangle. Verified in
// Cesium 1.147 source (ShadowVolumeAppearanceFS.glsl, USES_ST block). The primitive's outer ring IS the baked bbox.
import { Cartesian4, Material } from "cesium";

import type { CropLook } from "@/components/globe/types";

import { CROP_COLORS } from "../twin";
import { CROP_ORDER, FIELD_KINDS, PROCEDURAL_KINDS } from "./uniforms";

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3));
};
const CROP_GLSL = CROP_ORDER.map((c: CropLook) => `vec3(${hex(CROP_COLORS[c]).join(",")})`).join(",");

const SOURCE = /* glsl */ `
const vec3 CROP[7] = vec3[7](${CROP_GLSL});
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
vec2 hash2(vec2 p){ return vec2(hash(p), hash(p + 19.19)); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
// low = 1 octave, medium = 2, high = 3
float fbm(vec2 p){
  float a = vnoise(p);
  if (uDetail > 0.5) a = a*0.65 + 0.35*vnoise(p*2.13 + 7.0);
  if (uDetail > 1.5) a = a*0.8 + 0.2*vnoise(p*4.7 + 3.0);
  return a;
}
void over(inout vec3 rgb, inout float a, vec3 c, float ca){
  ca = clamp(ca, 0.0, 1.0);
  float na = ca + a*(1.0-ca);
  rgb = (c*ca + rgb*a*(1.0-ca)) / max(na, 1e-4);
  a = na;
}
float slotOf(vec4 a, vec4 b, int i){ return i < 4 ? a[i] : b[i-4]; }
// stripes with distance fade (avoid aliasing)
float stripes(float x, float period, float aa){
  float s = smoothstep(0.35, 0.65, abs(fract(x/period) - 0.5) * 2.0);
  return mix(s, 0.5, smoothstep(period*0.2, period*0.5, aa));
}
// voronoi edge distance (F2-F1), 3x3
float cracks(vec2 p){
  vec2 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  for (int j=-1;j<=1;j++) for (int i=-1;i<=1;i++){
    vec2 g = vec2(float(i), float(j));
    float d = length(g + hash2(ip+g) - fp);
    if (d < d1){ d2 = d1; d1 = d; } else if (d < d2){ d2 = d; }
  }
  return d2 - d1;
}

czm_material czm_getMaterial(czm_materialInput materialInput){
  czm_material m = czm_getDefaultMaterial(materialInput);
  vec2 uv = materialInput.st;
  // The primitive is padded 1% beyond the sim square so mask holes never touch its edge: cut the pad off.
  if (uv.x < 0.01 || uv.x > 0.99 || uv.y < 0.01 || uv.y > 0.99){ m.alpha = 0.0; return m; }
  uv = (uv - 0.01) / 0.98;

  vec2 pm = uv * uSize.xy;                   // metres from the south-west corner
  vec2 pmF = pm;                             // fwidth source for aliasing fades
  float aa = length(vec2(dFdx(pmF.x), dFdy(pmF.x)));
  vec4 hg = texture(uHeight, uv);
  float h = hg.r;
  vec2 grad = hg.gb * 2.0 - 1.0;
  float t = uTime * uMotion;

  // field coverage: slot i in plane i/3 channel i%3; dominant slot wins (blends cleanly at shared edges)
  vec3 c0 = texture(uCov0, uv).rgb, c1 = texture(uCov1, uv).rgb, c2 = texture(uCov2, uv).rgb;
  float cov[8] = float[8](c0.r, c0.g, c0.b, c1.r, c1.g, c1.b, c2.r, c2.g);
  float inField = 0.0; float dcov = 0.0; int ds = 0;
  for (int i=0;i<8;i++){ inField += cov[i]; if (cov[i] > dcov){ dcov = cov[i]; ds = i; } }
  inField = clamp(inField, 0.0, 1.0);
  float soilW = mix(1.0, mix(0.35, 1.0, inField), uSize.z);   // soil kinds: weaker outside the fields

  vec3 rgb = vec3(0.0); float a = 0.0;

  // 1 cropCover: crop rows per field (byField=1) or bare brown soil (0)
  if (uK0.y > 0.0 && dcov > 0.0){
    float s = slotOf(uFc0, uFc1, ds);
    int ci = int(slotOf(uCi0, uCi1, ds) + 0.5);
    vec3 tint = CROP[6];
    for (int i=0;i<7;i++) if (i == ci) tint = CROP[i];
    float ca = 0.0; vec3 col = tint;
    if (uK0.z > 0.5){
      float rows = stripes(pm.x, 3.0, aa);
      col = mix(tint*0.78, tint, rows);
      ca = 0.55 * s;
      if (ci == 6){ ca = 0.30 * s; if (uK0.w > 0.5){ col = vec3(0.96,0.78,0.35); ca = 0.45 * s; } }
    } else { col = CROP[6]; ca = 0.5 * s; }
    over(rgb, a, col, ca * uK0.y * dcov);
  }
  // 2 vegetation: greenness per field, 1 green -> 0 yellow/brown
  if (uK1.y > 0.0 && dcov > 0.0){
    float v = slotOf(uFv0, uFv1, ds);
    vec3 col = mix(vec3(0.62,0.50,0.20), vec3(0.18,0.56,0.20), v);
    over(rgb, a, col, 0.5 * uK1.y * dcov * (0.75 + 0.25*fbm(pm/6.0)));
  }
  // 3 organicMatter: gentle darkening; markers (dots) on legume/cover fields
  if (uK2.y > 0.0 && dcov > 0.0){
    float o = slotOf(uFo0, uFo1, ds);
    over(rgb, a, vec3(0.14,0.10,0.07), 0.38 * o * uK2.y * dcov);
    int ci = int(slotOf(uCi0, uCi1, ds) + 0.5);
    if (uK2.z > 0.5 && (ci == 3 || ci == 4)){
      vec2 cell = floor(pm/9.0);
      vec2 ctr = (cell + 0.2 + 0.6*hash2(cell)) * 9.0;
      float r = max(0.9, aa*1.5);
      float dot_ = 1.0 - smoothstep(r*0.7, r, length(pm - ctr));
      over(rgb, a, vec3(0.80,0.95,0.55), 0.85 * dot_ * uK2.y * dcov * o);
    }
  }
  // 4 dryness: tan soil, voronoi cracks fade in with params.cracks
  if (uK3.y > 0.0){
    float s = uK3.x;
    over(rgb, a, vec3(0.76,0.64,0.42), 0.5 * s * uK3.y * soilW);
    if (uDetail > 0.5 && uK3.z > 0.0){
      float cr = 1.0 - smoothstep(0.0, 0.07, cracks(pm/2.5));
      cr *= 1.0 - smoothstep(0.5, 1.2, aa);
      over(rgb, a, vec3(0.22,0.15,0.09), 0.65 * cr * uK3.z * s * uK3.y * soilW);
    }
  }
  // 5 wetness: darker soil + moving sheen
  if (uK4.y > 0.0){
    float s = uK4.x;
    over(rgb, a, vec3(0.10,0.08,0.06), 0.42 * s * uK4.y * soilW);
    float sheen = pow(vnoise(pm/5.0 + vec2(t*0.08, t*0.05)), 3.0);
    over(rgb, a, vec3(0.80,0.88,0.95), 0.30 * sheen * s * uK4.y * soilW);
  }
  // 6 runoff: muddy streaks along the downhill gradient, scrolling with params.flow
  if (uK5.y > 0.0){
    float s = uK5.x;
    float slope = length(grad);
    vec2 dir = slope > 0.02 ? grad/slope : vec2(0.0,-1.0);   // flat/unknown terrain: stream south
    float sw = slope > 0.02 ? smoothstep(0.05, 0.4, slope) : 0.6;
    vec2 perp = vec2(-dir.y, dir.x);
    float along = dot(pm, dir), across = dot(pm, perp);
    float n = fbm(vec2(across*0.5, along*0.06 - t*uK5.z*1.5));
    float streak = smoothstep(0.45, 0.75, n);
    over(rgb, a, vec3(0.42,0.30,0.17), 0.65 * streak * sw * s * uK5.y * soilW);
  }
  // 7 water: standing water in low spots (lowSpotOnly) or splashes per field; rings with params.ripples
  if (uK6.y > 0.0){
    float mask;
    if (uK6.z > 0.5){
      float thr = mix(0.04, 0.6, uK6.x);
      mask = smoothstep(thr, thr - 0.08, h) * step(0.001, uK6.x);
    } else {
      float s = slotOf(uFw0, uFw1, ds);
      float blot = vnoise(pm/4.0 + 3.0);
      mask = smoothstep(1.0 - s*0.8, 1.0 - s*0.8 + 0.1, blot) * dcov * step(0.001, s);
    }
    if (mask > 0.0){
      vec3 col = vec3(0.17,0.38,0.52) + 0.06*vnoise(pm*0.7 + t*0.3);
      float ring = 0.0;
      if (uK6.w > 0.0 && uMotion > 0.5){
        int cells = uDetail > 1.5 ? 9 : 4;
        float cs = 10.0;
        vec2 base = floor(pm/cs);
        for (int k=0;k<9;k++){
          if (k >= cells) break;
          vec2 cell = base + vec2(float(k - (k/3)*3 - 1), float(k/3 - 1));
          vec2 ctr = (cell + hash2(cell)) * cs;
          float ph = fract(t*0.35 + hash(cell*1.7));
          float d = length(pm - ctr);
          float x = (d - ph*cs*0.45)/0.35;
          ring += exp(-x*x) * (1.0 - ph);
        }
      }
      col += vec3(0.5) * ring * uK6.w;
      over(rgb, a, col, 0.6 * mask * uK6.y);
    }
  }
  // 8 floodZones: shallow shimmering blue rising from low points, level = params.levelM (0..2 m)
  if (uK7.y > 0.0 && uK7.z > 0.0){
    float thr = uK7.z * 0.5;
    float mask = smoothstep(thr, thr - 0.06, h);
    float sh = vnoise(pm*0.8 + vec2(t*0.6, -t*0.4));
    over(rgb, a, vec3(0.16,0.40,0.64) + 0.12*sh, 0.52 * mask * uK7.y * (0.85 + 0.15*sh));
  }
  // 9 frost: white creeping over low spots (params.lowSpotBias)
  if (uK8.y > 0.0){
    float c = uK8.x + uK8.z * (0.5 - h) * 1.2 + 0.25*(fbm(pm/3.0) - 0.5);
    float fr = smoothstep(0.35, 0.6, c) * step(0.001, uK8.x);
    over(rgb, a, vec3(0.93,0.97,1.0), 0.62 * fr * uK8.y);
  }
  // 10 heatGlow: warm stress glow on fields (static, no pulse)
  if (uK9.y > 0.0 && dcov > 0.0){
    float s = slotOf(uFh0, uFh1, ds);
    over(rgb, a, mix(vec3(1.0,0.5,0.1), vec3(0.85,0.1,0.08), s), 0.42 * s * uK9.y * dcov);
  }

  m.diffuse = rgb;
  m.alpha = a;
  return m;
}
`;

const v4 = () => new Cartesian4();
const FIELD_UNIFORM = { cropCover: "uFc", vegetation: "uFv", organicMatter: "uFo", water: "uFw", heatGlow: "uFh" } as const;

/** Create the uber material. `textures` are canvases (cov planes + height), assigned once per bake. */
export function createGroundMaterial(textures: { cov: HTMLCanvasElement[]; height: HTMLCanvasElement }): Material {
  const uniforms: Record<string, unknown> = {
    uTime: 0,
    uMotion: 1,
    uDetail: 1,
    uSize: new Cartesian4(1, 1, 0, 0),
    uCi0: v4(),
    uCi1: v4(),
    uCov0: textures.cov[0],
    uCov1: textures.cov[1],
    uCov2: textures.cov[2],
    uHeight: textures.height,
  };
  PROCEDURAL_KINDS.forEach((_, i) => (uniforms[`uK${i}`] = v4()));
  for (const k of FIELD_KINDS) {
    uniforms[`${FIELD_UNIFORM[k]}0`] = v4();
    uniforms[`${FIELD_UNIFORM[k]}1`] = v4();
  }
  return new Material({ translucent: true, fabric: { uniforms, source: SOURCE } });
}

export const FIELD_UNIFORM_NAMES = FIELD_UNIFORM;
