// FTW1 water-depth frame file parser (PRD §6.4). Little-endian.
//   0-3 magic "FTW1" | 4-5 u16 width | 6-7 u16 height | 8-9 u16 frame_count
//   10 u8 dtype (1 = uint8) | 11 u8 reserved | 12-15 f32 max_depth_mm | 16.. frames
//   depth_mm = byte * max_depth_mm / 255

export const FTW1_HEADER_BYTES = 16;

export interface Ftw1 {
  width: number;
  height: number;
  frameCount: number;
  maxDepthMm: number;
  /** frameCount * width * height bytes, frames in time order, each row-major (row 0 = north). */
  frames: Uint8Array;
}

export function parseFtw1(buffer: ArrayBuffer | Uint8Array): Ftw1 {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < FTW1_HEADER_BYTES) throw new Error("FTW1: file shorter than header");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== "FTW1") throw new Error(`FTW1: bad magic "${magic}"`);
  const width = view.getUint16(4, true);
  const height = view.getUint16(6, true);
  const frameCount = view.getUint16(8, true);
  const dtype = view.getUint8(10);
  if (dtype !== 1) throw new Error(`FTW1: unsupported dtype ${dtype}`);
  const maxDepthMm = view.getFloat32(12, true);
  const expected = FTW1_HEADER_BYTES + frameCount * width * height;
  if (bytes.byteLength !== expected) throw new Error(`FTW1: expected ${expected} bytes, got ${bytes.byteLength}`);
  return { width, height, frameCount, maxDepthMm, frames: bytes.subarray(FTW1_HEADER_BYTES) };
}

/** Bytes of one frame (a view, not a copy). */
export function frameAt(f: Ftw1, index: number): Uint8Array {
  const size = f.width * f.height;
  return f.frames.subarray(index * size, (index + 1) * size);
}

/** Water depth in millimeters for one encoded byte. */
export function byteToDepthMm(f: Ftw1, byte: number): number {
  return (byte * f.maxDepthMm) / 255;
}
