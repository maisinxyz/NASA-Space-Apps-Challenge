// Client-side checks mirroring ScanCreateForm in openapi.yaml (lat/lon ranges, 0-6 JPEG/PNG/WEBP, name <= 120).
// The contract sets no file-size limit; the API answers FILE_TOO_LARGE (413) and we show that error.
import type { StartScanInput } from "./api/client";

export const SCAN_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const SCAN_MAX_IMAGES = 6;
export const SCAN_MAX_NAME = 120;

export interface ScanFormValues {
  lat: string;
  lon: string;
  name: string;
  images: { name: string; type: string }[];
}

export type ScanFormErrors = Partial<Record<"lat" | "lon" | "name" | "images", string>>;

function coord(raw: string, min: number, max: number, what: string): [number | null, string | undefined] {
  if (raw.trim() === "") return [null, `Enter a ${what}.`];
  const n = Number(raw);
  if (!Number.isFinite(n)) return [null, `${what[0].toUpperCase()}${what.slice(1)} must be a number in decimal degrees.`];
  if (n < min || n > max) return [null, `${what[0].toUpperCase()}${what.slice(1)} must be between ${min} and ${max}.`];
  return [n, undefined];
}

export function validateScanForm(v: ScanFormValues): { errors: ScanFormErrors; input?: Omit<StartScanInput, "images"> } {
  const errors: ScanFormErrors = {};
  const [lat, latErr] = coord(v.lat, -90, 90, "latitude");
  const [lon, lonErr] = coord(v.lon, -180, 180, "longitude");
  if (latErr) errors.lat = latErr;
  if (lonErr) errors.lon = lonErr;
  const name = v.name.trim();
  if (name.length > SCAN_MAX_NAME) errors.name = `Keep the name to ${SCAN_MAX_NAME} characters or fewer.`;
  if (v.images.length > SCAN_MAX_IMAGES) errors.images = `Choose at most ${SCAN_MAX_IMAGES} photos.`;
  const bad = v.images.find((f) => !SCAN_IMAGE_TYPES.includes(f.type));
  if (bad) errors.images = `"${bad.name}" is not a JPG, PNG or WEBP image.`;
  if (Object.keys(errors).length || lat === null || lon === null) return { errors };
  return { errors, input: { lat, lon, ...(name ? { name } : {}) } };
}
