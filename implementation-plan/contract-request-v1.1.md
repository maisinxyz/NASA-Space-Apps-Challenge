# Contract request: `openapi.yaml` v1.0.0 → v1.1.0 (additive)

> **Status:** requested 2026-11-13, not applied. Only the integrator edits `packages/contracts/openapi.yaml`, regenerates fixtures and types, and announces the change. This file says exactly what to add and why. Decisions are referenced by their IDs in the Section 2 PRD (v0.3, §3) and the feature IDs (F1–F44) in its §4.1.

## Compatibility rule

Every change below is **additive**. New fields are optional, new endpoints are new paths, and existing paths keep their responses. Two changes **widen an enum** (`Insight.kind`, `LayerName`). Section 1 code must render an unknown enum value as a neutral default instead of throwing; add that guard before the change lands.

## 1. `Site`: farm list moves into the API (D-31, D-32, D-33)

Today the globe farm list lives in `apps/web/lib/farms.ts` (branch `fe/S1-cesium-globe`), and `Site` has no location. Add these optional properties to `Site`. Names mirror the frontend `Farm` type in snake_case:

| Field | Type | Meaning |
| --- | --- | --- |
| `country` | string | e.g. `Canada` |
| `locality` | string | e.g. `Agassiz, British Columbia` (title card, D-25) |
| `owner` | string | Operating institution, e.g. `Agriculture and Agri-Food Canada` |
| `location` | `LonLat` | Globe pin and farm centre |
| `coords_verified` | boolean | False shows "Approximate location" |
| `source_url` | string (uri) | Page the farm facts come from |
| `tier` | enum `twin`, `explore` | `twin` = curated full data (Pre-built); `explore` = Lite mode |
| `sim_bbox` | `BBox` | Simulation square (Agassiz: ~1.4 km, `[-121.77543, 49.24461, -121.75617, 49.25719]`) |
| `radius_m` | number | Camera clamp radius |

`region` keeps its enum. Non-BC sites use `other` and fill `locality`.

## 2. `Storm`: rank and real storm shape (D-34, D-35)

Optional additions:
- `rank`: integer ≥ 1, the storm's rank among distinct storms by 1–3 day total, 1981 to present.
- `rank_of`: integer, the number of distinct storms ranked.
- `named_event`: string or null, e.g. `November 2021 atmospheric river`. TODO(verify) dates.

Behavior change, no schema change: for storms from 2000 onward, `hyetograph.synthetic` is `false` and `profile` names the IMERG half-hourly source. TODO(verify) the product short name.

## 3. `WeatherSummary`: climate fingerprint (F10, F16)

Add optional `climatology`:
- `weeks`: 52
- `rain_mm_median[52]` and `rain_mm_p90[52]`
- `tmin_c_median[52]` and `tmax_c_median[52]`
- `growing_season`: `{ last_frost_doy_median, first_frost_doy_median, frost_free_days_median, gdd_base_c, gdd_median }`. The GDD base temperature is assumed and stated.
- `basis`: `derived`
- `years`: `{ start, end }`

## 4. New endpoints

| Path | Response schema (new) | Feature |
| --- | --- | --- |
| `GET /sites/{siteId}/hazard-calendar?scenario=` | `HazardCalendar` | F12 |
| `GET /sites/{siteId}/hazards` | `HazardCatalog` | F13 |
| `GET /sites/{siteId}/zones` | `ZoneCollection` | F1, F25, F26, F30 |
| `GET /sites/{siteId}/compare?rotations=a,b,c&scenario=` | `RotationComparison` | F18, F31 |

New schemas:

```yaml
Scenario: { type: string, enum: [baseline, wetter_winters, drier_summers, both], default: baseline }

HazardCalendar:
  required: [site_id, scenario, years, j_wet, j_dry, thresholds, basis, sources]
  site_id: SiteId
  scenario: Scenario
  years: { start: date, end: date }
  j_wet: number[52]   # 0–1, share of years with heavy rain on wet ground in that week
  j_dry: number[52]   # 0–1, share of years in a dry spell in that week
  thresholds: { q_rain: number, q_wet: number, n_dry_days: integer, q_dry: number }
  basis: Basis        # derived
  sources: Source[]
  caveats: string[]   # e.g. "rain not bias-corrected"

HazardCatalog:
  required: [site_id, items]
  items: HazardType[]
HazardType:
  required: [id, kind, label, years_with_event, years_total, peak_weeks, basis, sources]
  kind: enum [heavy_rain_wet_ground, multi_day_heavy_rain, dry_spell, heat_spell, late_frost]
  label: string
  years_with_event: integer
  years_total: integer
  peak_weeks: integer[]     # 0–51
  worst_storm_id: StormId | null   # tap to replay (F11)
  basis: Basis
  sources: Source[]

ZoneCollection:
  required: [site_id, zones]
  zones: Zone[]
Zone:
  required: [id, outline, icon_point, area_ha, terrain_factor, basis]
  outline: GeoJSON Polygon (lon/lat)
  icon_point: LonLat        # pole of inaccessibility
  area_ha: number
  terrain_factor: number    # relative, field mean = 1
  field_id: string | null
  crop: string | null
  winter_exposure: number | null   # relative
  summer_exposure: number | null   # relative
  basis: BasisOrRelative

RotationComparison:
  required: [site_id, scenario, rotations]
  rotations:
    - rotation_id: RotationId
      winter: { value: number, p10: number, p90: number }
      summer: { value: number, p10: number, p90: number }
      rank_stability: string | null   # e.g. "lower winter exposure than rot_existing in 91% of resampled histories"; null in Lite
      basis: relative
```

## 5. `Insight`: pins for recommendations (F24, F25, F29)

- Widen `kind` with `opportunity`, `protected`, `winter_wet`, `summer_dry`.
- Optional additions:
  - `action`: string, one sentence.
  - `zone_ids`: string[].
  - `active_weeks`: integer[] (0–51, wraps), for the scrubber.
  - `scenario`: Scenario.
- For these kinds, `anchor.at_time_min` is `null`.

## 6. `LayerName`: new terrain layers (F1, F5, F17, F25, F26)

Widen the enum with:

| Value | Priority |
| --- | --- |
| `wetness_index` | P0 |
| `planting_suitability` | P0 |
| `soil_moisture_relative` | P1 |
| `irrigation_priority` | P1 |
| `water_received` | P1 |

Served by the existing `GET /terrain/{terrainId}/layers/{name}.png` with a `LayerLegend` entry each.

## 7. `SimulationRequest`: scenario (F19)

Add optional `scenario: Scenario` (default `baseline`). Scenario runs replay real years reweighted toward the observed trend. Responses must say "built from observed years, not a forecast" in the evidence.

## Fixtures to add

- `sites.json` with the Agassiz and 7 explore farms, using the new fields.
- One `hazard_calendar_agassiz.json`, `hazards_agassiz.json`, `zones_agassiz.json` and `compare_agassiz.json`.
- One of each new `Insight` kind.
- One storm with `synthetic: false` and `rank`.
- Legends for the new layers.
