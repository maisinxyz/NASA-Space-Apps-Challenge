"use client";
// Everything inside the canvas. One render loop owns the frame: animate, pick, then draw each view
// (one in single mode, two in split mode) with the SAME camera object and the SAME timeMin.
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { type ComponentRef, type RefObject, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { layerValue, NODATA } from "@/lib/decode/layer";
import { BASE_DEPTH_M, type RotationAssets, type TerrainAssets } from "./assets";
import { cellIndex, cropRowPoints, FIELD_EDGE_RANGE_M, fieldAt, localToLonLat, lonLatToLocal, pickHeightfield, rasterizeFields, sampleHeight, toLocalFields } from "./geo";
import { RISK_HATCH_FROM } from "./legends";
import { LAYER_ORDER } from "./luts";
import { createTerrainMaterial } from "./material";
import { splitPlan, terraformAt, TERRAFORM_SECONDS } from "./timing";
import type { CameraPreset, TwinViewerHandle, TwinViewerProps } from "./types";

const HORIZON = "#d5e0e6";
const ZENITH = "#5d8fc4";
const FIELD_RES = 512;
const CROP_CAP = { low: 1500, high: 8000 } as const;
const CROP_COLORS = ["#5f8f3a", "#8aa63c", "#3f7d4e", "#b5a642", "#6b9a5b", "#9c8b3a"];
const VIEW_DIR = new THREE.Vector3(-0.42, 0.5, 0.9).normalize();
const FLY_SECONDS = 1;
export const BASE_FOV = 38;
const TAN_HALF_FOV = Math.tan((BASE_FOV / 2) * THREE.MathUtils.DEG2RAD);
const REF_ASPECT = 1.25;

export function overviewPose(assets: TerrainAssets, exaggeration: number): { position: THREE.Vector3; target: THREE.Vector3 } {
  const span = Math.max(assets.frame.sizeX, assets.frame.sizeZ);
  const target = new THREE.Vector3(0, assets.relief * exaggeration * 0.35, 0);
  return { position: target.clone().addScaledVector(VIEW_DIR, span * 1.9), target };
}

function cropColor(crop: string): string {
  let h = 0;
  for (let i = 0; i < crop.length; i++) h = (h * 31 + crop.charCodeAt(i)) >>> 0;
  return CROP_COLORS[h % CROP_COLORS.length];
}

export interface SceneProps {
  p: TwinViewerProps;
  assets: TerrainAssets;
  /** Loaded rotation assets per side (index matches rotationIds). */
  sides: (RotationAssets | undefined)[];
  diff: THREE.Texture | undefined;
  tier: "low" | "high";
  exaggeration: number;
  api: RefObject<TwinViewerHandle | null>;
  pinEls: RefObject<Map<string, HTMLElement>>;
  onAutoLow(): void;
  onContextLost(): void;
}

export default function Scene({ p, assets, sides, diff, tier, exaggeration, api, pinEls, onAutoLow, onContextLost }: SceneProps) {
  const { gl, camera, scene, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const { frame, heightmap } = assets;
  const span = Math.max(frame.sizeX, frame.sizeZ);

  const { material, uniforms, empty } = useMemo(createTerrainMaterial, []);
  const group = useRef<THREE.Group>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const crops = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState(-1);

  // Latest props for the render loop and DOM listeners (they must never see stale values).
  const live = useRef({ p, sides, tier, exaggeration, onAutoLow });
  live.current = { p, sides, tier, exaggeration, onAutoLow };

  const fields = useMemo(() => toLocalFields(frame, p.fields ?? []), [frame, p.fields]);
  const selected = fields.findIndex((f) => f.id === p.selectedFieldId);
  const fieldsRef = useRef({ fields, selected, hovered });
  fieldsRef.current = { fields, selected, hovered };

  const anim = useRef({
    elapsed: 0,
    running: true,
    readySent: false,
    fly: null as null | { t: number; fromPos: THREE.Vector3; fromTarget: THREE.Vector3; toPos: THREE.Vector3; toTarget: THREE.Vector3 },
    pointer: null as null | { x: number; y: number; click: boolean },
    down: null as null | { x: number; y: number },
    frames: 0,
    seconds: 0,
    autoSeconds: 0,
    autoFrames: 0,
    autoDecided: false,
  });
  const tmp = useMemo(() => ({ ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), v: new THREE.Vector3() }), []);

  // ---- static bindings -------------------------------------------------------------------------
  useEffect(() => {
    uniforms.uImagery.value = assets.imagery;
    uniforms.uNormalTex.value = assets.normal;
    uniforms.uLayers.value = assets.layers;
    uniforms.uLut.value = assets.lut;
    uniforms.uCoarse.value = assets.coarse ? 1 : 0;
    uniforms.uSize.value.set(frame.sizeX, frame.sizeZ);
    uniforms.uRiskHatchFrom.value = RISK_HATCH_FROM;
  }, [assets, frame, uniforms]);

  useEffect(() => {
    const raster = rasterizeFields(frame, fields, FIELD_RES);
    const ids = new THREE.DataTexture(raster.ids, FIELD_RES, FIELD_RES, THREE.RGFormat);
    const dist = new THREE.DataTexture(raster.distance, FIELD_RES, FIELD_RES, THREE.RedFormat);
    dist.minFilter = dist.magFilter = THREE.LinearFilter;
    for (const t of [ids, dist]) {
      t.unpackAlignment = 1;
      t.needsUpdate = true;
    }
    uniforms.uFieldIds.value = ids;
    uniforms.uFieldDist.value = dist;
    uniforms.uFieldRange.value = FIELD_EDGE_RANGE_M;
    return () => {
      uniforms.uFieldIds.value = empty.rgba;
      uniforms.uFieldDist.value = empty.far;
      ids.dispose();
      dist.dispose();
    };
  }, [frame, fields, uniforms, empty]);

  // Layer toggles, selection, diff: uniform writes only.
  useEffect(() => {
    uniforms.uLayerOn.value.set(...(LAYER_ORDER.map((n) => (p.layers.includes(n) ? 1 : 0)) as [number, number, number, number]));
    uniforms.uRiskOn.value = p.layers.includes("risk") ? 1 : 0;
  }, [p.layers, uniforms]);
  useEffect(() => {
    uniforms.uSelected.value = selected + 1;
    uniforms.uHovered.value = hovered === selected ? 0 : hovered + 1;
  }, [selected, hovered, uniforms]);
  useEffect(() => {
    uniforms.uDiff.value = diff ?? empty.noDiff;
    uniforms.uDiffOn.value = p.showDiff && diff ? 1 : 0;
  }, [diff, p.showDiff, uniforms, empty]);

  useEffect(() => {
    scene.fog = new THREE.Fog(HORIZON, span * 1.5, span * 7);
    gl.shadowMap.autoUpdate = false; // one shadow pass per frame, shared by both split views
    gl.info.autoReset = false;
    return () => {
      scene.fog = null;
      gl.setScissorTest(false);
      material.dispose();
      Object.values(empty).forEach((t) => t.dispose());
    };
  }, [scene, gl, span, material, empty]);

  // ---- terraform ---------------------------------------------------------------------------------
  const finishTerraform = () => {
    const a = anim.current;
    if (!a.running) return;
    a.running = false;
    a.elapsed = TERRAFORM_SECONDS;
    live.current.p.onTerraformDone();
  };
  const startTerraform = () => {
    anim.current.elapsed = 0;
    anim.current.running = true;
    if (live.current.p.reducedMotion) finishTerraform();
  };
  useEffect(startTerraform, [assets]);

  // ---- camera ------------------------------------------------------------------------------------
  const poseFor = (preset: CameraPreset) => {
    const { fields: fl, selected: sel } = fieldsRef.current;
    const k = live.current.exaggeration;
    if (preset === "field" && sel >= 0) {
      const f = fl[sel];
      const target = new THREE.Vector3(f.centroid[0], sampleHeight(frame, heightmap, f.centroid[0], f.centroid[1]) * k, f.centroid[1]);
      return { position: target.clone().addScaledVector(VIEW_DIR, Math.max(f.radius * 3.2, 120)), target };
    }
    return overviewPose(assets, k);
  };
  const flyTo = (preset: CameraPreset) => {
    const c = controls.current;
    if (!c) return;
    const to = poseFor(preset);
    if (live.current.p.reducedMotion) {
      cam.position.copy(to.position);
      c.target.copy(to.target);
      c.update();
      return;
    }
    anim.current.fly = { t: 0, fromPos: cam.position.clone(), fromTarget: c.target.clone(), toPos: to.position, toTarget: to.target };
  };
  useEffect(() => {
    if (selected >= 0) flyTo("field");
  }, [p.selectedFieldId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.target.copy(overviewPose(assets, live.current.exaggeration).target);
    c.update();
  }, [assets]);

  useImperativeHandle(api, () => ({ replay: startTerraform, skipTerraform: finishTerraform, setCameraPreset: flyTo }));

  // ---- input -------------------------------------------------------------------------------------
  useEffect(() => {
    const el = gl.domElement;
    const at = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const move = (e: PointerEvent) => (anim.current.pointer = { ...at(e), click: false });
    const down = (e: PointerEvent) => (anim.current.down = at(e));
    const upEv = (e: PointerEvent) => {
      const d = anim.current.down;
      const q = at(e);
      if (d && Math.hypot(q.x - d.x, q.y - d.y) < 5) anim.current.pointer = { ...q, click: true }; // a drag is an orbit, not a click
    };
    const leave = () => {
      anim.current.pointer = null;
      setHovered(-1);
      live.current.p.onProbe(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (anim.current.running) finishTerraform();
      else if (live.current.p.selectedFieldId) live.current.p.onFieldSelect(null);
    };
    const lost = (e: Event) => {
      e.preventDefault();
      onContextLost();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointerup", upEv);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("webglcontextlost", lost);
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointerup", upEv);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("webglcontextlost", lost);
      window.removeEventListener("keydown", key);
    };
  }, [gl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- crop rows (illustrative) in the selected and hovered fields ---------------------------------
  useEffect(() => {
    const mesh = crops.current;
    if (!mesh) return;
    const shown = [...new Set([selected, hovered])].filter((i) => i >= 0);
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    let n = 0;
    for (const i of shown) {
      const { points, step } = cropRowPoints(fields[i].ring, 5, 4, Math.floor(CROP_CAP[tier] / 2));
      color.set(cropColor(fields[i].crop));
      for (let k = 0; k < points.length; k += 2, n++) {
        m.makeScale(step * 0.9, 1, 1).setPosition(points[k], sampleHeight(frame, heightmap, points[k], points[k + 1]) + 0.25, points[k + 1]);
        mesh.setMatrixAt(n, m);
        mesh.setColorAt(n, color);
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [fields, selected, hovered, tier, frame, heightmap]);

  // ---- the frame ---------------------------------------------------------------------------------
  useFrame((_, dtRaw) => {
    const a = anim.current;
    const { p: lp, sides: ls } = live.current;
    const dt = Math.min(dtRaw, 0.1);
    const g = group.current;
    if (!g) return;

    if (a.running) {
      a.elapsed += dt;
      if (terraformAt(a.elapsed).done) finishTerraform();
    }
    const tf = terraformAt(a.elapsed);
    const yScale = Math.max(1e-3, live.current.exaggeration * tf.rise);
    g.scale.y = yScale;
    uniforms.uImageryFade.value = tf.imagery;
    uniforms.uTimeMin.value = lp.timeMin;
    if (sun.current) sun.current.intensity = 1.2 + 1.9 * tf.settle;
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = span * (0.4 + 1.1 * tf.settle);
      fog.far = span * (3 + 4 * tf.settle);
    }

    if (a.fly && controls.current) {
      a.fly.t = Math.min(1, a.fly.t + dt / FLY_SECONDS);
      const s = a.fly.t * a.fly.t * (3 - 2 * a.fly.t);
      cam.position.lerpVectors(a.fly.fromPos, a.fly.toPos, s);
      controls.current.target.lerpVectors(a.fly.fromTarget, a.fly.toTarget, s);
      controls.current.update();
      if (a.fly.t >= 1) a.fly = null;
    }

    const plan = splitPlan(size.width, lp.mode, lp.divider ?? 0.5, lp.timeMin, ls.map((s) => s?.frameTimes));
    const setView = (r: (typeof plan)[number]) => {
      cam.aspect = r.width / size.height;
      // Narrow views (split halves, portrait) widen the vertical FOV so the whole site still fits.
      cam.fov = 2 * Math.atan(TAN_HALF_FOV * Math.max(1, REF_ASPECT / cam.aspect)) * THREE.MathUtils.RAD2DEG;
      cam.updateProjectionMatrix();
    };

    // Pick under the pointer, at most once per frame, in whichever view the pointer is over.
    if (a.pointer) {
      const ptr = a.pointer;
      a.pointer = ptr.click ? { ...ptr, click: false } : null;
      const r = plan.find((v) => ptr.x >= v.x && ptr.x < v.x + v.width) ?? plan[0];
      setView(r);
      cam.updateMatrixWorld();
      tmp.ndc.set(((ptr.x - r.x) / r.width) * 2 - 1, -(ptr.y / size.height) * 2 + 1);
      tmp.ray.setFromCamera(tmp.ndc, cam);
      const { origin: o, direction: d } = tmp.ray.ray;
      const hit = pickHeightfield(frame, heightmap, yScale, o.x, o.y, o.z, d.x, d.y, d.z);
      const { fields: fl, selected: sel } = fieldsRef.current;
      const over = hit ? fieldAt(fl, hit.x, hit.z) : -1;
      if (ptr.click) {
        if (a.running) finishTerraform(); // a click during the rise skips it
        else if ((over >= 0 ? fl[over].id : null) !== (sel >= 0 ? fl[sel].id : null)) lp.onFieldSelect(over >= 0 ? fl[over].id : null);
      } else {
        setHovered(over);
        if (!hit) lp.onProbe(null);
        else {
          const [lon, lat] = localToLonLat(frame, hit.x, hit.z);
          const cell = cellIndex(frame, hit.x, hit.z);
          const layer: Record<string, number> = {};
          if (cell >= 0) {
            LAYER_ORDER.forEach((name, k) => {
              const legend = assets.catalog.layers.find((l) => l.name === name);
              const byte = assets.layerBytes[cell * 4 + k];
              if (!legend || byte === NODATA) return;
              layer[name] = legend.kind === "categorical" ? byte : layerValue(byte, legend.value_range)!;
            });
            const risk = ls[r.side]?.riskBytes[cell];
            if (risk !== undefined && risk !== NODATA) layer.risk = risk;
          }
          lp.onProbe({ lon, lat, elevation_m: hit.height + heightmap.minM, layer });
        }
      }
    }

    gl.info.reset();
    gl.shadowMap.needsUpdate = true;
    gl.setScissorTest(plan.length > 1);
    for (const r of plan) {
      const side = ls[r.side];
      setView(r);
      gl.setViewport(r.x, 0, r.width, size.height);
      gl.setScissor(r.x, 0, r.width, size.height);
      uniforms.uWater.value = side?.water ?? empty.water;
      uniforms.uWaterW.value = side ? (r.frame + 0.5) / side.frameCount : 0;
      uniforms.uWaterOn.value = side ? 1 : 0;
      uniforms.uRisk.value = side?.risk ?? empty.masked;
      gl.render(scene, cam);

      if (r.side === 0) {
        // Pins are DOM buttons; move them here so they track the camera without React renders.
        for (const pin of lp.pins ?? []) {
          const el = pinEls.current.get(pin.id);
          if (!el) continue;
          const [x, z] = lonLatToLocal(frame, pin.lon, pin.lat);
          tmp.v.set(x, sampleHeight(frame, heightmap, x, z) * yScale, z).project(cam);
          const visible = tmp.v.z < 1 && Math.abs(tmp.v.x) <= 1 && Math.abs(tmp.v.y) <= 1;
          el.style.display = visible ? "" : "none";
          if (visible) el.style.transform = `translate(${r.x + (tmp.v.x * 0.5 + 0.5) * r.width}px, ${(0.5 - tmp.v.y * 0.5) * size.height}px) translate(-50%, -100%)`;
        }
      }
    }

    if (!a.readySent) {
      a.readySent = true;
      lp.onReady();
    }

    // FPS monitor; "auto" drops to the low tier once if the first 2 steady seconds are too slow.
    a.frames++;
    a.seconds += dtRaw;
    if (a.seconds >= 1) {
      lp.onStats?.({ fps: Math.round(a.frames / a.seconds), drawCalls: gl.info.render.calls, memory: { ...gl.info.memory, programs: gl.info.programs?.length ?? 0 }, tier: live.current.tier });
      a.frames = 0;
      a.seconds = 0;
    }
    if (lp.quality === "auto" && !a.autoDecided && !a.running && live.current.tier === "high") {
      a.autoFrames++;
      a.autoSeconds += dtRaw;
      if (a.autoSeconds >= 2) {
        a.autoDecided = true;
        if (a.autoFrames / a.autoSeconds < (lp.mode === "split" ? 20 : 40)) live.current.onAutoLow();
      }
    }
  }, 1);

  const sky = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { uHorizon: { value: new THREE.Color(HORIZON) }, uZenith: { value: new THREE.Color(ZENITH) } },
        vertexShader: "varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader:
          "uniform vec3 uHorizon; uniform vec3 uZenith; varying vec3 vDir; void main() { float t = pow(clamp(vDir.y, 0.0, 1.0), 0.55); gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0); \n#include <colorspace_fragment>\n }",
      }),
    [],
  );
  useEffect(() => () => sky.dispose(), [sky]);

  const shadowRange = span * 0.8;
  return (
    <>
      <mesh material={sky} frustumCulled={false}>
        <sphereGeometry args={[span * 18, 24, 12]} />
      </mesh>
      <hemisphereLight args={["#dfeaf5", "#6b5f4a", 0.9]} />
      <directionalLight ref={sun} position={[-span * 0.45, span * 0.8, span * 0.55]} castShadow={tier === "high"} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0006} shadow-normalBias={1.2}>
        <orthographicCamera attach="shadow-camera" args={[-shadowRange, shadowRange, shadowRange, -shadowRange, 1, span * 3]} />
      </directionalLight>

      <group ref={group}>
        <mesh geometry={assets.geometry} material={material} castShadow receiveShadow />
        <mesh geometry={assets.skirt}>
          <meshStandardMaterial color="#5b4a37" roughness={1} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={-BASE_DEPTH_M} receiveShadow>
          <circleGeometry args={[span * 12, 48]} />
          <meshStandardMaterial color="#8a8069" roughness={1} />
        </mesh>
        <instancedMesh ref={crops} args={[undefined, undefined, CROP_CAP.high]} castShadow frustumCulled={false}>
          <boxGeometry args={[1, 0.7, 0.9]} />
          <meshStandardMaterial roughness={0.9} />
        </instancedMesh>
      </group>

      <OrbitControls ref={controls} makeDefault enableDamping={!p.reducedMotion} dampingFactor={0.08} maxPolarAngle={Math.PI * 0.47} minDistance={30} maxDistance={span * 3.5} />
    </>
  );
}
