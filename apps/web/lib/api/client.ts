// Typed API client with a mock/live switch (PRD §6.8).
//   NEXT_PUBLIC_API_MODE=mock (default): static fixtures under /mock (copied by `pnpm sync-mocks`).
//   NEXT_PUBLIC_API_MODE=live: NEXT_PUBLIC_API_BASE (default http://localhost:8000/api/v1).
import type {
  CropTemplate,
  DiffStats,
  ErrorBody,
  ErrorCode,
  EvidenceBundle,
  Insight,
  LayerCatalog,
  Note,
  NoteCreate,
  ProgressEvent,
  Provenance,
  Rotation,
  ScanCreated,
  ScanStatus,
  SimulationRequest,
  SimulationStatus,
  Site,
  Storm,
  TerrainPackage,
  ValidateRequest,
  ValidateResult,
  WeatherSummary,
} from "./types";

export const apiMode: "mock" | "live" = process.env.NEXT_PUBLIC_API_MODE === "live" ? "live" : "mock";
/** True when the UI is showing fixture data; show a "mock" badge. */
export const isMock = apiMode === "mock";
export const apiBase = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1").replace(/\/$/, "");

const MOCK_ROOT = "/mock";
const MOCK_TERRAIN_WITH_LISTS = "terr_mock_hills"; // storms/rotations fixtures exist only for this terrain
const MOCK_SIM = "sim_mock_001";
const MOCK_FAIL_SCAN = "scan_mock_fail";

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly retryable: boolean;
  readonly status: number;

  constructor(body: ErrorBody, status: number) {
    super(body.message);
    this.name = "ApiError";
    this.code = body.code;
    this.hint = body.hint;
    this.retryable = body.retryable;
    this.status = status;
  }
}

function notFound(what: string): ApiError {
  return new ApiError({ code: "NOT_FOUND", message: `No ${what}.`, retryable: false }, 404);
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as { error?: ErrorBody };
    if (body?.error?.code) return new ApiError(body.error, res.status);
  } catch {
    // fall through
  }
  return new ApiError({ code: "INTERNAL", message: `Request failed (${res.status}).`, retryable: true }, res.status);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(
      { code: "DATA_SOURCE_UNAVAILABLE", message: "Cannot reach the FieldTwin API.", hint: "Is the API running?", retryable: true },
      0,
    );
  }
  if (!res.ok) {
    if (isMock && res.status === 404) throw notFound(`mock fixture at ${url}`);
    throw await parseError(res);
  }
  return (await res.json()) as T;
}

const live = <T>(path: string, init?: RequestInit) => request<T>(`${apiBase}${path}`, init);
const mock = <T>(rel: string) => request<T>(`${MOCK_ROOT}/${rel}`);
const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const q = (params: Record<string, string | number>) => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

/** Resolve an asset path from the API (e.g. "/api/v1/terrain/<id>/heightmap.png") to a fetchable URL. */
export function assetUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (isMock) return path.replace(/^\/api\/v1\//, `${MOCK_ROOT}/`);
  return new URL(path, apiBase).toString();
}

/** Fetch a binary asset (frames, heightmap) as an ArrayBuffer. */
export async function fetchAsset(path: string): Promise<ArrayBuffer> {
  const res = await fetch(assetUrl(path));
  if (!res.ok) throw isMock ? notFound(`mock asset ${path}`) : await parseError(res);
  return res.arrayBuffer();
}

// ---------------------------------------------------------------- sites
export const getSites = (): Promise<Site[]> => (isMock ? mock("sites.json") : live("/sites"));

export async function getSite(siteId: string): Promise<Site> {
  if (!isMock) return live(`/sites/${encodeURIComponent(siteId)}`);
  const site = (await getSites()).find((s) => s.id === siteId);
  if (!site) throw notFound(`site with id '${siteId}'`);
  return site;
}

// ---------------------------------------------------------------- scans
export interface StartScanInput {
  lat: number;
  lon: number;
  images?: File[];
  /** [minLon, minLat, maxLon, maxLat] */
  bbox?: [number, number, number, number];
  name?: string;
}

export async function startScan(input: StartScanInput): Promise<ScanCreated> {
  if (isMock) return mock("scans/scan_created.json");
  const form = new FormData();
  form.set("lat", String(input.lat));
  form.set("lon", String(input.lon));
  if (input.bbox) form.set("bbox", input.bbox.join(","));
  if (input.name) form.set("name", input.name);
  for (const img of input.images ?? []) form.append("images", img);
  return live("/scans", { method: "POST", body: form });
}

export function getScan(scanId: string): Promise<ScanStatus> {
  if (!isMock) return live(`/scans/${encodeURIComponent(scanId)}`);
  return mock(scanId === MOCK_FAIL_SCAN ? "scans/scan_status_failed.json" : "scans/scan_status.json");
}

export interface ScanEventHandlers {
  onEvent: (e: ProgressEvent) => void;
  /** Transport problem (not a `failed` stage, which arrives through onEvent). */
  onError?: (err: ApiError) => void;
}

export interface ScanEventOptions {
  /** Mock only: replay the failure stream (fails at fetching_elevation). */
  mockScenario?: "success" | "fail";
  /** Mock only: ms between replayed events. */
  intervalMs?: number;
}

export function parseSse(text: string): ProgressEvent[] {
  return text
    .split("\n\n")
    .map((block) => block.split("\n").find((l) => l.startsWith("data: ")))
    .filter((l): l is string => Boolean(l))
    .map((l) => JSON.parse(l.slice(6)) as ProgressEvent);
}

/** Subscribe to scan progress. Returns an unsubscribe function. Closes after `ready` or `failed`. */
export function subscribeScanEvents(scanId: string, handlers: ScanEventHandlers, opts: ScanEventOptions = {}): () => void {
  const isFinal = (e: ProgressEvent) => e.stage === "ready" || e.stage === "failed";

  if (!isMock) {
    const es = new EventSource(`${apiBase}/scans/${encodeURIComponent(scanId)}/events`);
    es.addEventListener("progress", (msg) => {
      const e = JSON.parse((msg as MessageEvent<string>).data) as ProgressEvent;
      handlers.onEvent(e);
      if (isFinal(e)) es.close();
    });
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) return;
      es.close();
      handlers.onError?.(new ApiError({ code: "DATA_SOURCE_UNAVAILABLE", message: "Lost connection to scan progress.", retryable: true }, 0));
    };
    return () => es.close();
  }

  const fail = opts.mockScenario === "fail" || scanId === MOCK_FAIL_SCAN;
  const interval = opts.intervalMs ?? 400;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;
  fetch(`${MOCK_ROOT}/scans/${fail ? "sse_fail_coverage.txt" : "sse_success.txt"}`)
    .then((r) => {
      if (!r.ok) throw notFound("mock SSE fixture");
      return r.text();
    })
    .then((text) => {
      parseSse(text).forEach((e, i) => {
        timers.push(setTimeout(() => !cancelled && handlers.onEvent(e), i * interval));
      });
    })
    .catch((err) => !cancelled && handlers.onError?.(err instanceof ApiError ? err : notFound("mock SSE fixture")));
  return () => {
    cancelled = true;
    timers.forEach(clearTimeout);
  };
}

// ---------------------------------------------------------------- terrain
const tid = (id: string) => encodeURIComponent(id);

export const getTerrain = (terrainId: string): Promise<TerrainPackage> =>
  isMock ? mock(`terrain/${terrainId}/terrain.json`) : live(`/terrain/${tid(terrainId)}`);

export const getLayers = (terrainId: string): Promise<LayerCatalog> =>
  isMock ? mock(`terrain/${terrainId}/layers.json`) : live(`/terrain/${tid(terrainId)}/layers`);

export const getInsights = (terrainId: string): Promise<Insight[]> =>
  isMock ? mock(`terrain/${terrainId}/insights.json`) : live(`/terrain/${tid(terrainId)}/insights`);

export const getProvenance = (terrainId: string): Promise<Provenance> =>
  isMock ? mock(`terrain/${terrainId}/provenance.json`) : live(`/terrain/${tid(terrainId)}/provenance`);

// ---------------------------------------------------------------- weather
export const getWeatherSummary = (lat: number, lon: number): Promise<WeatherSummary> =>
  isMock ? mock("weather/summary.json") : live(`/weather/summary?${q({ lat, lon })}`);

export async function getStorms(terrainId: string): Promise<Storm[]> {
  if (!isMock) return live(`/weather/storms?${q({ terrain_id: terrainId })}`);
  await getTerrain(terrainId); // 404 for unknown terrains, like the API
  return mock(`storms/${MOCK_TERRAIN_WITH_LISTS}.json`);
}

// ---------------------------------------------------------------- crops & rotations
export const getCrops = (): Promise<CropTemplate[]> => (isMock ? mock("crops.json") : live("/crops"));

export async function getRotationPresets(terrainId: string): Promise<Rotation[]> {
  if (!isMock) return live(`/rotations/presets?${q({ terrain_id: terrainId })}`);
  await getTerrain(terrainId);
  return mock(`rotations/${MOCK_TERRAIN_WITH_LISTS}.json`);
}

export const validateRotation = (body: ValidateRequest): Promise<ValidateResult> =>
  isMock ? mock("rotations/validate_result.json") : live("/rotations/validate", postJson(body));

// ---------------------------------------------------------------- simulations
export async function runSimulation(body: SimulationRequest): Promise<SimulationStatus> {
  if (!isMock) return live("/simulations", postJson(body));
  const status = await mock<SimulationStatus>(`simulations/${MOCK_SIM}/status.json`);
  const results = Object.fromEntries(Object.entries(status.results).filter(([rid]) => body.rotation_ids.includes(rid)));
  return { ...status, results };
}

export const getSimulation = (simId: string): Promise<SimulationStatus> =>
  isMock ? mock(`simulations/${simId}/status.json`) : live(`/simulations/${encodeURIComponent(simId)}`);

export const getEvidence = (simId: string): Promise<EvidenceBundle> =>
  isMock ? mock(`simulations/${simId}/evidence.json`) : live(`/simulations/${encodeURIComponent(simId)}/evidence`);

/** Diff stats (JSON). Use diffImageUrl() for the PNG grid. */
export const getDiff = (simId: string, a: string, b: string): Promise<DiffStats> =>
  isMock
    ? mock(`simulations/${simId}/diff/${a}__${b}.json`)
    : live(`/simulations/${encodeURIComponent(simId)}/diff?${q({ a, b })}`, { headers: { Accept: "application/json" } });

/**
 * URL of the diff PNG. In live mode the API picks PNG from the Accept header; <img> and
 * three.js TextureLoader send `image/*` Accept headers, so this URL works for them directly.
 * For fetch(), pass `headers: { Accept: "image/png" }`.
 */
export function diffImageUrl(simId: string, a: string, b: string): string {
  if (isMock) return `${MOCK_ROOT}/simulations/${simId}/diff/${a}__${b}.png`;
  return `${apiBase}/simulations/${encodeURIComponent(simId)}/diff?${q({ a, b })}`;
}

// ---------------------------------------------------------------- notes (P2)
const mockNotes: Note[] = [];

export async function listNotes(terrainId: string): Promise<Note[]> {
  if (!isMock) return live(`/notes?${q({ terrain_id: terrainId })}`);
  return mockNotes.filter((n) => n.terrain_id === terrainId);
}

export async function createNote(body: NoteCreate): Promise<Note> {
  if (!isMock) return live("/notes", postJson(body));
  const note: Note = { ...body, id: `note_${String(mockNotes.length + 1).padStart(3, "0")}`, created_at: new Date().toISOString() };
  mockNotes.push(note);
  return note;
}
