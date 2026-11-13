// Farm twin layers on the Cesium scene: ground-clamped field polygons (illustrative crop looks, pickable)
// and generic ground overlays (any climate scenario renders into a canvas; re-uploaded only when its version changes).
import "./base";
import {
  ClassificationType,
  Color,
  ColorGeometryInstanceAttribute,
  EllipsoidSurfaceAppearance,
  GeometryInstance,
  GroundPolylineGeometry,
  GroundPolylinePrimitive,
  GroundPrimitive,
  Material,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineColorAppearance,
  PrimitiveCollection,
  Rectangle,
  RectangleGeometry,
  Cartesian3,
} from "cesium";

import type { CropLook, FarmField, GroundOverlay } from "@/components/globe/types";

// ---- Fields ----------------------------------------------------------------------------------------------

/**
 * Illustrative ground-cover colours (not a measured crop map). Natural hues, distinct from each other and
 * readable over aerial imagery. Product choice, tune freely.
 */
export const CROP_COLORS: Record<CropLook, string> = {
  grass: "#7cb85a", // pasture / hay
  corn: "#2f7a32", // tall dark green
  cereal: "#d9b44a", // ripening grain
  legume: "#a8d46a", // light green (beans, peas)
  cover: "#3f9a86", // teal-green cover crop
  berry: "#7a4a86", // berry rows, purple-ish
  bare: "#8a6446", // bare soil
};
const FILL_ALPHA = 0.42;
const FILL_ALPHA_SELECTED = 0.68;
const OUTLINE = "#f4ecd2";
const OUTLINE_ALPHA = 0.7;
const OUTLINE_SELECTED = "#ffd54a";
const OUTLINE_WIDTH_PX = 2;

/** Pure: fill and outline CSS colour + alpha for a field. */
export function fieldStyle(look: CropLook, selected: boolean): { fill: string; fillAlpha: number; outline: string; outlineAlpha: number } {
  return {
    fill: CROP_COLORS[look] ?? CROP_COLORS.bare,
    fillAlpha: selected ? FILL_ALPHA_SELECTED : FILL_ALPHA,
    outline: selected ? OUTLINE_SELECTED : OUTLINE,
    outlineAlpha: selected ? 1 : OUTLINE_ALPHA,
  };
}

const FIELD_PREFIX = "field:";
/** Field id from a scene.pick() result, or null. */
export function fieldIdFromPick(picked: unknown): string | null {
  const id = (picked as { id?: unknown } | undefined)?.id;
  return typeof id === "string" && id.startsWith(FIELD_PREFIX) ? id.slice(FIELD_PREFIX.length) : null;
}

const colorValue = (css: string, alpha: number) => ColorGeometryInstanceAttribute.toValue(Color.fromCssColorString(css).withAlpha(alpha));

export type FieldLayer = {
  /** Rebuild the primitives (fields or classification changed). Async in Cesium: colours apply once ready. */
  setFields(fields: readonly FarmField[], classification: ClassificationType): void;
  /** Recolour without rebuilding (crop override or selection changed). */
  paint(cropByField: Record<string, CropLook> | undefined, selectedId: string | null | undefined): void;
  /** Call every frame: applies a pending paint once the primitives are ready. Returns true if it painted. */
  flush(): boolean;
};

export function createFieldLayer(collection: PrimitiveCollection): FieldLayer {
  let fields: readonly FarmField[] = [];
  let fill: GroundPrimitive | undefined;
  let outline: GroundPolylinePrimitive | undefined;
  let look: { crop?: Record<string, CropLook>; selected?: string | null } = {};
  let dirty = false;

  const styleOf = (f: FarmField) => fieldStyle(look.crop?.[f.id] ?? f.crop, f.id === look.selected);

  return {
    setFields(next, classification) {
      collection.removeAll();
      fill = outline = undefined;
      fields = next.filter((f) => f.ring.length >= 3);
      if (!fields.length) return;
      fill = collection.add(
        new GroundPrimitive({
          geometryInstances: fields.map((f) => {
            const s = styleOf(f);
            return new GeometryInstance({
              id: FIELD_PREFIX + f.id,
              geometry: new PolygonGeometry({ polygonHierarchy: new PolygonHierarchy(Cartesian3.fromDegreesArray(f.ring.flat())) }),
              attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString(s.fill).withAlpha(s.fillAlpha)) },
            });
          }),
          appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }),
          classificationType: classification,
        }),
      ) as GroundPrimitive;
      outline = collection.add(
        new GroundPolylinePrimitive({
          geometryInstances: fields.map((f) => {
            const s = styleOf(f);
            const ring = [...f.ring, f.ring[0]];
            return new GeometryInstance({
              id: FIELD_PREFIX + f.id,
              geometry: new GroundPolylineGeometry({ positions: Cartesian3.fromDegreesArray(ring.flat()), width: OUTLINE_WIDTH_PX }),
              attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString(s.outline).withAlpha(s.outlineAlpha)) },
            });
          }),
          appearance: new PolylineColorAppearance(),
          classificationType: classification,
        }),
      ) as GroundPolylinePrimitive;
      dirty = false; // built with the current look
    },
    paint(crop, selected) {
      look = { crop, selected };
      dirty = true;
    },
    flush() {
      if (!dirty || !fill || !outline || !fill.ready || !outline.ready) return false;
      dirty = false;
      for (const f of fields) {
        const s = styleOf(f);
        fill.getGeometryInstanceAttributes(FIELD_PREFIX + f.id).color = colorValue(s.fill, s.fillAlpha);
        outline.getGeometryInstanceAttributes(FIELD_PREFIX + f.id).color = colorValue(s.outline, s.outlineAlpha);
      }
      return true;
    },
  };
}

// ---- Overlays --------------------------------------------------------------------------------------------

type OverlayKey = Pick<GroundOverlay, "id" | "version" | "bbox">;

/**
 * Pure: what to do when the overlay list changes. Any change of order, ids, bbox or classification rebuilds
 * every primitive (draw order = list order); otherwise only overlays whose version changed get a new texture.
 */
export function planOverlays(prev: readonly OverlayKey[], next: readonly OverlayKey[], classificationChanged: boolean): { rebuild: boolean; upload: string[] } {
  const same =
    !classificationChanged &&
    prev.length === next.length &&
    prev.every((p, i) => p.id === next[i].id && p.bbox.every((v, k) => v === next[i].bbox[k]));
  if (!same) return { rebuild: true, upload: next.map((o) => o.id) };
  return { rebuild: false, upload: next.filter((o, i) => o.version !== prev[i].version).map((o) => o.id) };
}

const OVERLAY_MATERIAL_SOURCE = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec4 c = texture(image, materialInput.st);
  material.diffuse = c.rgb;
  material.alpha = c.a * opacity;
  return material;
}`;

type OverlaySlot = { material: Material; canvases: [HTMLCanvasElement, HTMLCanvasElement]; flip: number };

export type OverlayLayer = {
  /** Cheap when nothing changed (safe to call every frame). Returns true if anything needs a re-render. */
  sync(overlays: readonly GroundOverlay[], classification: ClassificationType): boolean;
};

export function createOverlayLayer(collection: PrimitiveCollection): OverlayLayer {
  let keys: OverlayKey[] = [];
  let cls: ClassificationType | undefined;
  const slots = new Map<string, OverlaySlot>();

  // Material only re-uploads a texture when the uniform is a different object, so copy into two canvases
  // and alternate (same trick as drape.ts).
  const upload = (slot: OverlaySlot, src: HTMLCanvasElement) => {
    slot.flip ^= 1;
    const dst = slot.canvases[slot.flip];
    if (dst.width !== src.width || dst.height !== src.height) Object.assign(dst, { width: src.width, height: src.height });
    const g = dst.getContext("2d")!;
    g.clearRect(0, 0, dst.width, dst.height);
    g.drawImage(src, 0, 0);
    slot.material.uniforms.image = dst;
  };

  return {
    sync(overlays, classification) {
      const plan = planOverlays(keys, overlays, classification !== cls);
      keys = overlays.map(({ id, version, bbox }) => ({ id, version, bbox }));
      cls = classification;
      if (plan.rebuild) {
        collection.removeAll();
        slots.clear();
        for (const o of overlays) {
          const canvases: [HTMLCanvasElement, HTMLCanvasElement] = [document.createElement("canvas"), document.createElement("canvas")];
          const material = new Material({
            translucent: true,
            fabric: { uniforms: { image: canvases[0], opacity: o.opacity }, source: OVERLAY_MATERIAL_SOURCE },
          });
          slots.set(o.id, { material, canvases, flip: 1 });
          collection.add(
            new GroundPrimitive({
              geometryInstances: new GeometryInstance({
                geometry: new RectangleGeometry({ rectangle: Rectangle.fromDegrees(...o.bbox), vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT }),
              }),
              appearance: new EllipsoidSurfaceAppearance({ material, flat: true }),
              classificationType: classification,
            }),
          );
        }
      }
      const toUpload = new Set(plan.upload);
      let changed = plan.rebuild;
      for (const o of overlays) {
        const slot = slots.get(o.id)!;
        const opacity = Math.min(1, Math.max(0, o.opacity));
        if (slot.material.uniforms.opacity !== opacity) {
          slot.material.uniforms.opacity = opacity;
          changed = true;
        }
        if (toUpload.has(o.id)) {
          upload(slot, o.canvas);
          changed = true;
        }
      }
      return changed;
    },
  };
}
