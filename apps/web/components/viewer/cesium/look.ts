// Illustrative look filters for the farm view (FarmTwinProps.look) as Cesium post-process stages.
// Our own small GLSL, not sensor data: the UI captions them "illustrative styling".
import "./base";
import { PostProcessStage, type Scene } from "cesium";

import type { LookFilter } from "@/components/globe/types";

const HEAD = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;
`;

/** Fragment shader per look ("none" = no stage). Each is one texture read plus a few ALU ops. */
export const LOOK_SHADERS: Record<Exclude<LookFilter, "none">, string> = {
  // Luminance -> false-colour ramp (black, indigo, magenta, orange, pale yellow). Brightness, not temperature.
  thermal: `${HEAD}
void main(void) {
  float l = czm_luminance(texture(colorTexture, v_textureCoordinates).rgb);
  vec3 c0 = vec3(0.02, 0.0, 0.08), c1 = vec3(0.25, 0.05, 0.55), c2 = vec3(0.85, 0.15, 0.45), c3 = vec3(1.0, 0.55, 0.1), c4 = vec3(1.0, 0.97, 0.75);
  float t = clamp(l, 0.0, 1.0) * 4.0;
  vec3 c = t < 1.0 ? mix(c0, c1, t) : t < 2.0 ? mix(c1, c2, t - 1.0) : t < 3.0 ? mix(c2, c3, t - 2.0) : mix(c3, c4, t - 3.0);
  out_FragColor = vec4(c, 1.0);
}`,
  // Excess-green (2g - r - b on chromatic coordinates): green-looking pixels bright green, the rest dim grey.
  vegetation: `${HEAD}
void main(void) {
  vec3 rgb = texture(colorTexture, v_textureCoordinates).rgb;
  vec3 n = rgb / max(rgb.r + rgb.g + rgb.b, 1e-3);
  float exg = 2.0 * n.g - n.r - n.b;
  float v = smoothstep(0.03, 0.2, exg);
  vec3 grey = vec3(czm_luminance(rgb) * 0.55);
  out_FragColor = vec4(mix(grey, vec3(0.15, 0.95, 0.3) * (0.4 + 0.6 * rgb.g), v), 1.0);
}`,
  // Night-vision style: desaturated, brightened, green tint, soft vignette.
  night: `${HEAD}
void main(void) {
  float l = pow(czm_luminance(texture(colorTexture, v_textureCoordinates).rgb), 0.7);
  vec2 d = v_textureCoordinates - 0.5;
  float vig = 1.0 - 0.6 * dot(d, d) * 2.0;
  out_FragColor = vec4(vec3(0.12, 1.0, 0.35) * l * vig, 1.0);
}`,
};

/** Pure: which look stage is active. Farm view only; "none"/undefined = none. */
export function activeLook(look: LookFilter | undefined, farmView: boolean): Exclude<LookFilter, "none"> | null {
  return farmView && look && look !== "none" ? look : null;
}

export type LookLayer = { set(look: Exclude<LookFilter, "none"> | null): void };

/** One stage per look, created on first use and toggled with `enabled`. */
export function createLookLayer(scene: Scene): LookLayer {
  const stages = new Map<string, PostProcessStage>();
  return {
    set(look) {
      if (look && !stages.has(look)) {
        const stage = new PostProcessStage({ name: `ft-look-${look}`, fragmentShader: LOOK_SHADERS[look] });
        scene.postProcessStages.add(stage);
        stages.set(look, stage);
      }
      for (const [k, s] of stages) s.enabled = k === look;
      scene.requestRender();
    },
  };
}
