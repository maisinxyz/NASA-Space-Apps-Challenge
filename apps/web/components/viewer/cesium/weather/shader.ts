// The weather post-process pass (one full-screen pass per side). Depth-aware: every pixel is lifted to a local
// east/north/up frame anchored on the farm (z = 0 at the ground), so clouds, their shadows, fog, haze and frost sit
// in the world while rain is screen space. Uniforms are set in index.ts; tier settings become #defines.
import type { TierSettings } from "./logic";

export function weatherShader(t: TierSettings): string {
  return /* glsl */ `
precision highp float;
#define CLOUD_STEPS ${t.cloudSteps}
#define FBM_OCT ${t.fbmOctaves}
#define RAIN_LAYERS ${t.rainLayers}
#define SHIMMER ${t.shimmer ? 1 : 0}
#define SPARKLE ${t.sparkle ? 1 : 0}

uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
in vec2 v_textureCoordinates;

uniform mat4 u_eyeToLocal;
uniform float u_time;
uniform vec2 u_gate;     // x: -1 left of split only, 1 right only, 0 whole screen; y: split 0..1
uniform vec4 u_cloud;    // cover, darkness, drift east m, drift north m
uniform vec4 u_rain;     // density, speed, drizzle, slant (rad)
uniform vec4 u_air;      // fog, haze, shimmer, frost sparkle
uniform vec4 u_tint;     // rgb, strength
uniform vec4 u_sun;      // dir east/north/up, exposure
uniform vec3 u_sunColor;
uniform vec3 u_misc;     // lightning flash 0..1, parallax x, parallax y

const float CLOUD_BASE = 170.0;
const float CLOUD_TOP = 330.0;
const float FAR = 4000.0;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  float n = 0.0;
  for (int i = 0; i < FBM_OCT; i++) {
    s += a * vnoise(p);
    n += a;
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return s / n;
}
// Cloud field at a local xy (m): one puff scale ~220 m, drifting with the wind.
float cloudField(vec2 xy) { return fbm((xy + u_cloud.zw) / 220.0); }
float cloudThreshold() { return mix(0.86, 0.42, u_cloud.x); }

// Rain streaks in screen space (aspect-corrected uv). One layer = a grid of columns with sparse falling drops.
float rainLayer(vec2 uv, float scale, float speed, float len, float density, float seed) {
  vec2 p = uv * vec2(scale, scale * 0.25);
  p.y += u_time * speed;
  float col = floor(p.x);
  float r = hash12(vec2(col, seed));
  p.y += r * 13.0;
  float cell = floor(p.y);
  float present = step(hash12(vec2(col * 1.7 + seed, cell)), density);
  float fy = fract(p.y);
  float fx = fract(p.x) - 0.5 - (r - 0.5) * 0.5;
  float w = smoothstep(0.07, 0.0, abs(fx));
  float l = smoothstep(0.0, 0.05, fy) * smoothstep(len, len * 0.3, fy);
  return present * w * l;
}

void main(void) {
  vec2 uv0 = v_textureCoordinates;
  if (u_gate.x != 0.0) {
    float x = gl_FragCoord.x / czm_viewport.z;
    if ((u_gate.x < 0.0 && x >= u_gate.y) || (u_gate.x > 0.0 && x < u_gate.y)) {
      out_FragColor = texture(colorTexture, uv0);
      return;
    }
  }

  float rawDepth = texture(depthTexture, uv0).r;
  bool sky = czm_readDepth(depthTexture, uv0) >= 1.0;
  vec4 posEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, rawDepth);
  vec3 ro = (u_eyeToLocal * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 dirEC = normalize(posEC.xyz / max(posEC.w, 1e-6));
  vec3 rd = normalize(mat3(u_eyeToLocal) * dirEC);
  float dist = sky ? FAR : min(length(posEC.xyz / posEC.w), FAR);
  vec3 P = ro + rd * dist; // surface point, local metres

  // Heat shimmer: wavy UV offset over the ground in the middle distance.
  vec2 uv = uv0;
#if SHIMMER
  if (u_air.z > 0.0 && !sky) {
    float a = u_air.z * smoothstep(40.0, 350.0, dist);
    float w = sin(uv0.y * 260.0 + u_time * 6.0 + sin(uv0.x * 45.0 + u_time * 1.7) * 1.6);
    uv += vec2(w * 0.0011, w * 0.0005) * a;
  }
#endif
  vec3 col = texture(colorTexture, uv).rgb;

  vec3 L = u_sun.xyz;
  float cover = u_cloud.x;
  float dark = u_cloud.y;
  float thr = cloudThreshold();

  // Overcast dims the ground; cloud shadows (same field as the clouds, projected along the sun) drift over it.
  col *= mix(1.0, 0.7, cover * dark);
  if (!sky && cover > 0.0) {
    float lz = max(L.z, 0.2);
    vec3 ps = P + L * ((CLOUD_BASE + CLOUD_TOP) * 0.5 - P.z) / lz;
    float cov = smoothstep(thr - 0.03, thr + 0.1, cloudField(ps.xy));
    col *= 1.0 - cov * 0.45 * (1.0 - 0.6 * dark) * smoothstep(0.0, 0.3, L.z);
  }

  // Sun / time of day.
  col *= u_sun.w * u_sunColor;

  // Frost sparkle: sparse glints stuck to the ground (cell size grows with distance so density stays even on screen).
#if SPARKLE
  if (u_air.w > 0.0 && !sky) {
    float s = 0.35 + dist * 0.004;
    vec2 g = P.xy / s;
    float h = hash12(floor(g));
    float tw = 0.5 + 0.5 * sin(u_time * 3.0 + h * 40.0);
    float spot = smoothstep(0.22, 0.0, length(fract(g) - 0.5));
    float sp = step(0.975, h) * spot * tw * tw * tw * smoothstep(1400.0, 150.0, dist) * u_air.w;
    col += sp * vec3(0.85, 0.93, 1.0) * 1.4;
  }
#endif

  // Ground fog: thick near the ground, thin above ~40 m, wispy; then dust/heat haze with distance.
  if (u_air.x > 0.0) {
    float hz = sky ? 60.0 : max(P.z, 0.0);
    float wisps = 0.55 + 0.9 * vnoise(P.xy / 70.0 + vec2(u_time * 0.03, 0.0));
    float f = u_air.x * (1.0 - exp(-dist / 380.0)) * exp(-hz / 40.0) * wisps;
    vec3 fogC = vec3(0.78, 0.81, 0.84) * u_sun.w * u_sunColor;
    col = mix(col, fogC, clamp(f, 0.0, 0.85));
  }
  if (u_air.y > 0.0) {
    float f = u_air.y * (sky ? 0.55 : (1.0 - exp(-dist / 900.0)) * 0.85);
    vec3 hazeC = vec3(0.86, 0.78, 0.64) * u_sun.w * u_sunColor;
    col = mix(col, hazeC, clamp(f, 0.0, 0.8));
  }

  // Low broken cloud layer: march the slab between the camera and the surface.
  if (cover > 0.0 && abs(rd.z) > 1e-4) {
    float ta = (CLOUD_BASE - ro.z) / rd.z;
    float tb = (CLOUD_TOP - ro.z) / rd.z;
    float t0 = max(min(ta, tb), 0.0);
    float t1 = min(min(max(ta, tb), dist), t0 + 2500.0);
    if (t1 > t0) {
      float dt = (t1 - t0) / float(CLOUD_STEPS);
      float jitter = hash12(gl_FragCoord.xy) - 0.5;
      float T = 1.0;
      vec3 acc = vec3(0.0);
      vec3 lit = mix(vec3(0.97, 0.97, 0.98), vec3(0.34, 0.36, 0.40), dark);
      for (int i = 0; i < CLOUD_STEPS; i++) {
        float t = t0 + (float(i) + 0.5 + jitter * 0.8) * dt;
        vec3 p = ro + rd * t;
        float h = clamp((p.z - CLOUD_BASE) / (CLOUD_TOP - CLOUD_BASE), 0.0, 1.0);
        float d = clamp((cloudField(p.xy) - thr - abs(h - 0.45) * 0.22) * 5.0, 0.0, 1.0);
        if (d > 0.0) {
          float a = (1.0 - exp(-d * dt * 0.03)) * smoothstep(30.0, 180.0, t); // fade puffs right at the lens
          vec3 c = lit * mix(0.72, 1.06, h) * mix(vec3(1.0), u_sunColor, 0.6) * max(u_sun.w, 0.45) + u_misc.x * 0.5;
          acc += T * a * c;
          T *= 1.0 - a;
        }
      }
      col = col * T + acc;
    }
  }

  // Rain (data-driven density) and drizzle, in screen space; each layer hides behind closer geometry.
  if (u_rain.x > 0.0 || u_rain.z > 0.0) {
    vec2 suv = vec2(uv0.x * czm_viewport.z / czm_viewport.w, uv0.y);
    float cs = cos(u_rain.w);
    float sn = sin(u_rain.w);
    suv = mat2(cs, -sn, sn, cs) * suv;
    float r = 0.0;
    for (int i = 0; i < RAIN_LAYERS; i++) {
      float fi = float(i);
      float layerDist = 12.0 + fi * fi * 45.0; // ~12, 57, 192 m
      if (dist > layerDist) {
        vec2 q = suv + u_misc.yz * (1.0 / (1.0 + fi));
        r += rainLayer(q, 70.0 + fi * 55.0, (2.2 - fi * 0.45) * u_rain.y, 0.55 - fi * 0.12, u_rain.x, fi * 7.3) * (1.0 - fi * 0.25);
      }
    }
    float dz = rainLayer(suv + u_misc.yz * 0.4, 220.0, 0.35, 0.18, u_rain.z * 0.7, 91.0) * 0.6;
    vec3 rainC = vec3(0.8, 0.84, 0.9) * max(u_sun.w, 0.5);
    col = mix(col, rainC, clamp(r * 0.32 + dz * 0.25, 0.0, 0.6));
    col = mix(col, col * vec3(0.9, 0.93, 0.97), clamp(u_rain.x, 0.0, 1.0) * 0.3); // wet, flat light
  }

  // Colour grade, then the soft lightning pulse (never close to white).
  float luma = max(dot(u_tint.rgb, vec3(0.299, 0.587, 0.114)), 0.2);
  col = mix(col, col * u_tint.rgb / luma, u_tint.a);
  col += u_misc.x * 0.16 * vec3(0.85, 0.9, 1.0);

  out_FragColor = vec4(col, 1.0);
}
`;
}
