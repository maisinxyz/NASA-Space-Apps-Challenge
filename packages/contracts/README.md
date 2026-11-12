# packages/contracts

The shared contract between `apps/web` and `services/api`.

- `openapi.yaml`: OpenAPI 3.1, version **1.0.0**. Encodes `prd.md` §6. Base path `/api/v1`.
- `fixtures/`: mock data (added by a later prompt, PRD §6.8).

Changing the contract after the freeze: message the team, bump `info.version`, update fixtures (see the root README).

Validate:

```sh
npx @redocly/cli@1.34.3 lint packages/contracts/openapi.yaml
```

## Grid orientation (all rasters)

Heightmap, normal map, layers, risk, diff, and frames are row-major: row 0 = north edge, column 0 = west edge.
They share the TerrainPackage grid (`grid.width` × `grid.height`). Frame files carry their own width/height in case a simulation was downsampled.

## Heightmap decoding (PRD §6.2)

`heightmap.png` is a 16-bit grayscale PNG. With `elevation.min_m` and `elevation.max_m` from the TerrainPackage:

```
elevation_m = min_m + (value / 65535) * (max_m - min_m)
```

## Layer PNGs (PRD §6.2)

8-bit grayscale unless noted. Legends (name, unit, value range, color ramp hint) come from `GET /terrain/{terrainId}/layers`.

`cover_class` uses indexed values:

| Value | Class |
| --- | --- |
| `0` | other |
| `1` | vegetation |
| `2` | bare soil |
| `3` | water |
| `255` | nodata |

Continuous layers (contract decision, not in the PRD): `255` = nodata, and bytes 0–254 map linearly onto the legend's `value_range`: `value = min + byte / 254 * (max - min)`.

## Frame file format "FTW1" (PRD §6.4)

`GET /simulations/{simId}/frames/{rotationId}.bin`. Water-depth animation. Binary, little-endian, one file per rotation per simulation.

```
bytes 0-3    magic "FTW1"
bytes 4-5    u16 width
bytes 6-7    u16 height
bytes 8-9    u16 frame_count
byte  10     u8  dtype (1 = uint8)
byte  11     u8  reserved
bytes 12-15  f32 max_depth_mm (value 255 maps to this depth)
bytes 16-... frame_count * width * height bytes, frames in time order
```

```
depth_mm = byte * max_depth_mm / 255
```

Frame timing (`step_minutes`, `frame_times_min`) is in the matching `RotationResult` inside `SimulationStatus.results`.
Target size is under about 5 MB (60 frames at 256×256 is about 4 MB before compression). Served with gzip.

## Other encodings (contract decisions)

- **Normal map** (`normal.png`): 8-bit RGB; `n = byte / 255 * 2 - 1`; R = east, G = north, B = up.
- **Risk** (`risk/{rotationId}.png`): 8-bit; byte = relative erosion-risk index 0–100; `255` = masked. Relative only.
- **Diff** (`diff?a&b`): `Accept: image/png` gives an 8-bit grid of peak water depth `b − a`, with `diff_mm = (byte − 128) / 127 * max_abs_diff_mm` (`128` = no change). `Accept: application/json` gives `DiffStats`, which includes `max_abs_diff_mm`.
- **SSE** (`/scans/{scanId}/events`): every message is `event: progress` with a JSON `ProgressEvent` in `data`. Stage order: `queued`, `reading_inputs`, `locating`, `fetching_elevation`, `building_mesh`, `classifying_cover`, `analyzing_drainage`, `fetching_weather`, `packaging`, `ready`, `failed`.
