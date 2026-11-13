# Databases: every dataset FieldTwin uses, what for, and who builds it (v0.2)

> Living document. This is the single place that says **which data we use, why, how we get it, and which team owns it**. Both section PRDs and both `Prompts.md` files point here. Change a row only together with a change-log entry (bottom).
>
> **Verification status.** The official 2026 challenge page could not be read when this was written (it only returned a third-party redirect notice). Dataset names and access URLs marked `catalog` come from the unofficial [Space Data Atlas](https://spacedata.swapniltamse.com/challenges/field-shift-adapting-farms/). Everything else is `TODO(verify)`: the team must confirm each row against the official Resources list and the provider's own page in S2-01 (see §5). Never code against an unverified parameter name.

---

## 1. Overview table: databases by scope of work

**How to read this section.** Table 1 is the quick index. Tables 2a to 2f give the detail for each scope of work. Table 3 says who owns what. Section 2 below has the full plan per dataset (DB-1 to DB-14).

- **Pri.:** P0 = must have, P1 = should have, P2 = stretch.
- **Status:** `catalog` = name and URL come from the unofficial challenge catalog; `TODO(verify)` = not yet confirmed against the provider.
- **NASA?** NASA data must do the core work; non-NASA sources are labeled and credited.

### Table 1. Index

| ID | Database | Scope of work | Provider | NASA? | Pri. | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DB-1 | LidarBC bare-earth DEM | Terrain | Province of BC | No | P0 (site 1) | TODO(verify) |
| DB-2 | NASADEM | Terrain | NASA LP DAAC | Yes | P0 | TODO(verify) |
| DB-3 | NASA POWER daily | Weather | NASA LaRC | Yes | P0 | catalog |
| DB-4 | GPM IMERG Final daily | Weather | NASA GES DISC | Yes | P0 | catalog |
| DB-5 | SMAP soil moisture | Soil moisture | NASA NSIDC DAAC | Yes | P0 | catalog (L3), TODO(verify) (L4) |
| DB-6 | HLS Landsat + Sentinel-2 | Land cover and crops | NASA LP DAAC | Yes | P0 | catalog |
| DB-7 | AAFC Annual Crop Inventory | Land cover and crops | AAFC (Canada) | No | P0 (site 1) | TODO(verify) |
| DB-8 | FAO-56 crop coefficients | Agronomy reference | FAO | No | P0 | TODO(verify) |
| DB-9 | ECOSTRESS evapotranspiration | Water stress (optional) | NASA LP DAAC | Yes | P2 | catalog |
| DB-10 | RADARSAT Constellation | Validation (stretch) | Canadian Space Agency | No | P2 | TODO(verify) |
| DB-11 | Soil texture / hydrologic group | Soil properties (optional) | TODO(verify) | No | P2 | TODO(verify) |
| DB-12 | Photo, location, crop per field | User inputs | The user | n/a | P0 | n/a |
| DB-13 | `provenance.json` | Data credits | Us | n/a | P0 | n/a |
| DB-14 | Globe and basemap sources (Cesium ion World Terrain, Google Photorealistic 3D Tiles, Natural Earth II, OpenStreetMap field outlines) | Globe, intro and visuals | Cesium / Google / Natural Earth / OSM | No | P0 | in use on `fe/S1-cesium-globe`; terms TODO(verify) |

### Table 2. Detail by scope of work

**2a. Geography and 3D terrain**

| ID | What it gives us | Resolution / coverage | Access |
| --- | --- | --- | --- |
| DB-1 | Elevation for the Fraser Valley farm: the 3D land, slope, flow, zones | ~1 m where available | Open download (portal TODO(verify)) |
| DB-2 | Global elevation: terrain for other sites and Lite mode | 1 arc-second (~30 m), global | Earthdata login |

**2b. Weather and climate**

| ID | What it gives us | Resolution / coverage | Access |
| --- | --- | --- | --- |
| DB-3 | The 45-year record: rain, temperature, root-zone wetness | ~0.5° grid, 1981 to present | No login. REST: `https://power.larc.nasa.gov/api/temporal/daily/point` |
| DB-4 | Sharper rain intensity; corrects POWER's smeared heavy rain | 0.1° (~10 km), daily, since 2000 | Earthdata login. [Dataset page](https://disc.gsfc.nasa.gov/datasets/GPM_3IMERGDF_07/summary) (`GPM_3IMERGDF` V07) |

**2c. Soil moisture and water**

| ID | What it gives us | Resolution / coverage | Access |
| --- | --- | --- | --- |
| DB-5 | Defines "wet ground"; corrects POWER wetness | 9 km, since 2015 | Earthdata login. [L3 page](https://nsidc.org/data/spl3smp_e/versions/6) (`SPL3SMP_E` V006); L4 root-zone page TODO(verify) |
| DB-9 | Plant water use; independent check on the summer-dry axis | ~70 m, patchy coverage | Earthdata login. CMR concept `C4057232489-LPCLOUD` (`ECO_L3T_JET` V003) |

**2d. Land cover and crops**

| ID | What it gives us | Resolution / coverage | Access |
| --- | --- | --- | --- |
| DB-6 | Greenness (NDVI) per field over time: when fields are bare, crop stages | 30 m, revisit every few days | Earthdata login. [Dataset page](https://www.earthdata.nasa.gov/data/catalog/lpcloud-hlsl30-2.0) (`HLSL30` v2.0; Sentinel-2 half `HLSS30`) |
| DB-7 | Which crop grew on which field, per year (Canada only) | 30 m, annual | Open download (portal TODO(verify)) |

**2e. Agronomy reference, soil properties, validation**

| ID | What it gives us | Resolution / coverage | Access |
| --- | --- | --- | --- |
| DB-8 | Published water-sensitivity curve per crop stage | Table values | FAO Irrigation and Drainage Paper 56 |
| DB-11 | Optional modifier of the terrain factor | TODO(verify) | TODO(verify) |
| DB-10 | Flood / saturation extent for the Nov 2021 backtest | TODO(verify) | TODO(verify) open access and license |

**2f. User inputs and data credits**

| ID | What it gives us | Where it comes from |
| --- | --- | --- |
| DB-12 | Texture on the 3D land, farm centre, crop assignment for non-curated sites | Upload and map pin in the web app |
| DB-13 | Every dataset with source, license, attribution | `GET /provenance`, built from this file |
| DB-14 | The spinning Earth, fly-in imagery, photoreal 3D context, field outlines. **Visual only: never feeds a number** | Cesium tiers A/B/C in the web app (Section 1) |

### Table 3. Ownership: who touches which database

Roles: **builds** = downloads and processes it; **uses** = reads the derived tables; **shows** = displays it in the UI; **textures** = uses it in the 3D scene.

| ID | S2-A Data | S2-B Algorithm | S1-A Rendering | S1-B Product UI |
| --- | --- | --- | --- | --- |
| DB-1, DB-2 | builds terrain package and zones | uses zones and terrain factor | uses terrain package | shows source and resolution |
| DB-3 | builds | uses | | |
| DB-4, DB-5 | builds | uses (fusion method) | | |
| DB-6, DB-7 | builds calendars and fields | uses calendars | | |
| DB-8 | | builds and checks values | | |
| DB-9, DB-10, DB-11 | builds (stretch) | scores backtest (DB-10) | | |
| DB-12 | validates and stores | uses crop per field | textures (photo) | collects (upload, pin, crop) |
| DB-13 | builds `provenance.json` | | | shows (Methods page, "why?" lines) |
| DB-14 | adds to provenance | | builds (globe, tiers) | shows credits |

**Considered and not used** (see §4): NASA GRACE/GRACE-FO (too coarse), any crop-yield dataset (none in scope; PRD forbids yield figures), any disaster-event catalog (hazard odds come from our own record instead).

### Table 4. Team roles (one line each)

| Team | Databases | Main job |
| --- | --- | --- |
| **S2-A Data** | DB-1 to DB-7, DB-9 to DB-13 | Download, cache, clean, derive the seed tables, write provenance |
| **S2-B Algorithm** | DB-3 to DB-8 (as derived tables) | Fusion hazard odds, exposure engine, bootstrap, optimizer, markers |
| **S1-A Rendering** | DB-1, DB-2, DB-12, DB-14 (terrain package, zones, photo, globe tiles) | 3D terrain, zone highlights, marker placement in the scene |
| **S1-B Product UI** | DB-12, DB-13 (via the API) | Upload and location flow, "why?" source lines, Data and Methods page, badges |
| Integrator | all | Accounts and secrets, license check, shape of S2 output for S1 |

---

## 2. Dataset-by-dataset plans

Every section answers the same questions: **why we need it, what exactly we take, how to get it, how to implement it, what it needs, what it outputs, what happens if it fails, who owns it.** Basis labels follow `CLAUDE.md`: `measured | derived | modeled | assumed | relative`.

### 2.1 Geography and 3D terrain

#### DB-1 LidarBC bare-earth DEM (Province of BC)

- **Why:** the 3D land must look and behave like the real farm. About 1 m terrain shows drainage ditches, field edges and small hollows; those decide where water pools. It is also the best input for terrain zones (PRD Section 2, D-14).
- **What we take:** bare-earth elevation tiles covering the chosen farm plus a buffer (about 500 m) so flow can enter from upslope. We do not take the point cloud.
- **How to get it:** open download of DEM tiles from the province's LiDAR portal. `TODO(verify)`: portal URL, tile naming, file format (GeoTIFF or LAZ), coverage of the chosen farm, and license (believed Open Government Licence - BC).
- **Implementation (S2-A, `terrain/`):**
  1. Download tiles for the farm bounding box, store raw in `data/cache/lidarbc/`.
  2. Mosaic and clip with `rasterio`, reproject to a metric CRS (BC Albers or the local UTM zone; `TODO(verify)`), resample to a 2 to 5 m working grid.
  3. Fill depressions (priority-flood), compute slope, D8 flow direction, flow accumulation, and topographic wetness index `TWI = ln(a / tan β)`.
  4. Delineate terrain zones (0.5 to 2 ha), clip to field boundaries, compute terrain factor `T(z)` and each zone's icon point (see Section 2 PRD §6.4).
  5. Produce the **terrain package for S1**: 16-bit heightmap PNG + normal map + `zones.geojson` + stats JSON (encoding below).
- **Needs:** the farm location and field polygons (open item 1 in Section 2 PRD); `rasterio`, `numpy`, `scipy`, `scikit-image`, `shapely`; about 0.5 to 2 GB disk for tiles. No login (verify).
- **Outputs:** `data/seed/<site>/terrain/heightmap.png`, `normals.png`, `zones.geojson`, `terrain_stats.json`, plus `terrain.json` metadata (grid size, cell size m, CRS, vertical range, `dsm_includes_vegetation: false`).
- **Heightmap encoding:** reuse the existing S1 decoder contract: 16-bit PNG, row-major, row 0 = north, with min/max elevation in metadata (see `apps/web/lib/decode/` in git history, commit `e83a93c`). Keep the grid at most 512 x 512 for the browser. `TODO(verify)` the final grid size with S1-A.
- **Fallback:** NASADEM (DB-2), flagged `source: "nasadem"`, shown as lower resolution.
- **Risks:** tile gaps or license restrictions on redistribution. We only commit derived products if the license allows (Section 2 PRD §5 rule).
- **Basis label:** `measured` (elevation), `relative` (terrain factor).
- **Owners:** S2-A builds; S1-A consumes the package.

#### DB-2 NASADEM (NASA LP DAAC)

- **Why:** NASA terrain for anywhere in the world. This is what makes Lite mode and non-Fraser-Valley sites possible, and it keeps a NASA dataset in the terrain role.
- **What we take:** the 1 arc-second (~30 m) elevation tile(s) covering the site. `TODO(verify)`: product short name, version, file format, vertical datum, and how NASADEM treats vegetation (it is closer to a surface model than bare earth; set `dsm_includes_vegetation: true`).
- **How to get it:** Earthdata login via LP DAAC; download with `earthaccess` or the CMR API. `TODO(verify)` the exact collection id and a working sample request URL.
- **Implementation (S2-A):** same pipeline as DB-1 from step 2 onward, but on a coarser grid. At 30 m, zones are larger (about 2 to 5 ha) and less reliable; the UI must say "lower-resolution terrain".
- **Needs:** Earthdata account (free); `.env` variable names listed in `.env.example` only; about 10 to 50 MB per tile.
- **Outputs:** the same terrain package as DB-1, with `resolution_m: 30` in `terrain.json`.
- **Fallback:** a flat plane with a "no terrain available" notice (the app must not crash).
- **Basis label:** `measured` (elevation, coarse), `relative` (terrain factor).
- **Owners:** S2-A builds; S1-A consumes (same package shape, so no UI change).

### 2.2 Weather and climate

#### DB-3 NASA POWER daily (backbone record)

- **Why:** the long record. 45 years tell us how often a given week of the year was stormy, wet or in a dry spell. This is the only dataset that works anywhere with no login, which is why Lite mode is built on it.
- **What we take:** daily precipitation, min and max temperature, and root-zone soil wetness at the farm's point. Believed parameter names: `PRECTOTCORR`, `GWETROOT`, `T2M_MAX`, `T2M_MIN`. `TODO(verify)` every name, the community setting, units and the start date.
- **How to get it:** REST endpoint `https://power.larc.nasa.gov/api/temporal/daily/point` (`catalog`). Believed query: `parameters`, `community`, `latitude`, `longitude`, `start`, `end`, `format=JSON`. `TODO(verify)` against the API docs at `https://power.larc.nasa.gov/docs/services/api/` and record a working sample URL.
- **Implementation (S2-A, `ingest/power.py`):**
  1. One request per site for 1981 to the latest full year. Retry with backoff; respect any rate limit `TODO(verify)`.
  2. Cache the raw JSON in `data/cache/power/<lat>_<lon>.json`. Cache-first: if the file exists, no network call. In `OFFLINE=1`, refuse any network call and read the cache or seed only.
  3. Replace fill values (believed `-999`, `TODO(verify)`) with missing, and report the share missing.
  4. Convert to a tidy table (date, rain mm, wetness 0 to 1, tmin, tmax).
  5. Hand to fusion (DB-4, DB-5) for full sites, or straight to the hazard step in Lite mode.
- **Needs:** `httpx`, `pandas` or `numpy`; internet only the first time; small files (below 5 MB per site).
- **Outputs:** `data/cache/power/…json` (not committed) and, per site, the fused series inside `hazard.json` (committed, derived, license-safe).
- **Fallback:** if POWER is down, use the committed seed for curated sites; for a user location, show "weather data unavailable".
- **Basis label:** `measured` (satellite and reanalysis derived; the UI says "reanalysis").
- **Owners:** S2-A ingests; S2-B uses it for hazard odds.

#### DB-4 GPM IMERG Final, daily (rain intensity)

- **Why:** POWER's coarse grid smears heavy rain into light rain. IMERG at 0.1° shows the real tail of storm intensity. We use the overlap years (2000 to present) to correct POWER's rain distribution, then apply that correction to all 45 years.
- **What we take:** daily precipitation, `GPM_3IMERGDF` V07 (`catalog`), the area covering the POWER cell around the farm, 2000 to present. `TODO(verify)`: variable name (believed `precipitation` or `precipitationCal`), units (mm/day), the Final-run lag (months) and whether ~49°N is fully covered.
- **How to get it:** Earthdata login via GES DISC. Prefer the `earthaccess` Python library or OPeNDAP subsetting so we download only the farm's box, not global files. `TODO(verify)` subset method and a sample request.
- **Implementation (S2-A `ingest/imerg.py`, S2-B `fusion/`):**
  1. Download or subset daily rasters for the POWER cell footprint. Cache in `data/cache/imerg/`.
  2. Aggregate to one daily value for the footprint (area mean).
  3. Fit **empirical quantile mapping** POWER to IMERG per season (DJF, MAM, JJA, SON) over the overlap years; apply it to every POWER year (Section 2 PRD §6.2).
  4. Store before/after diagnostics (error in the 90th, 95th and 99th percentiles).
  5. If the latest months are missing (Final lag), leave them out; do not mix in the Late run for the quantile fit.
- **Needs:** Earthdata account; about 8 GB of global daily files if downloaded naively, so subset. Pre-download before the event (decision D-03).
- **Outputs:** corrected daily rain series and fit diagnostics inside `hazard.json`.
- **Half-hourly shape for storm replay (D-35):** for each storm in the library from 2000 onward, also take IMERG **half-hourly** rain over the farm cell for the storm window. Use it as the storm's real hyetograph (`synthetic: false`). Older storms keep the assumed profile. `TODO(verify)` the half-hourly product short name, version and variable. Download only the storm windows, not the whole record.
- **Fallback:** if coverage or access fails, use POWER rain uncorrected and add the caveat "rain not bias-corrected" to every marker's "why?".
- **Basis label:** `measured`; corrected series: `derived`.
- **Owners:** S2-A downloads; S2-B owns the fusion method.

#### Soil moisture and water

#### DB-5 SMAP soil moisture (defines "wet ground")

- **Why:** a storm only erodes or floods when the ground is already wet. SMAP gives an independent, satellite-based wetness to correct POWER's wetness, which keeps the "heavy rain on wet soil" condition honest.
- **Which product (decision needed in S2-01):** our PRD assumes **SMAP L4 root-zone moisture** (modeled, 9 km, 3-hourly, since 2015). The catalog lists **L3 enhanced `SPL3SMP_E` V006** (surface moisture, 9 km, daily, since 2015). Surface and root-zone moisture behave differently: root zone is what matters for runoff and crop stress. Default: L4 if it is available and practical; otherwise L3 with the caveat "surface moisture used as a proxy". `TODO(verify)` L4 short name, version, variable name and access.
- **How to get it:** Earthdata login via NSIDC DAAC. L3 page (`catalog`): `https://nsidc.org/data/spl3smp_e/versions/6`. Use `earthaccess` with a bounding box.
- **Implementation (S2-A `ingest/smap.py`, S2-B `fusion/`):**
  1. Subset to the farm's 9 km cell(s) and 2015 to present; cache in `data/cache/smap/`.
  2. Aggregate sub-daily values to daily means; mask quality-flagged or frozen-ground values (`TODO(verify)` flag names).
  3. Convert POWER wetness to a percentile; fit quantile mapping to SMAP percentiles over 2015 to present (same method as DB-4); apply to all years.
  4. Define "wet ground" as the corrected wetness above the site's 80th percentile (default, sensitivity-tested).
- **Needs:** Earthdata account; `earthaccess`, `xarray`, `h5py` or `netCDF4` (`TODO(verify)` file format); modest disk if subset.
- **Outputs:** corrected wetness series and diagnostics in `hazard.json`.
- **Fallback:** POWER wetness uncorrected, caveat added.
- **Basis label:** `modeled` (L4) or `measured` (L3 surface); corrected series `derived`.
- **Owners:** S2-A downloads; S2-B owns the fusion method.

### 2.3 Land cover and crops

#### DB-6 HLS (Harmonized Landsat Sentinel-2): the measured bare-soil calendar

- **Why:** this turns "assumed bare weeks" into **measured** ones. It is the strongest originality point of the project: the overlap of bare soil and hazard, measured from space over real fields of each crop.
- **What we take:** surface reflectance red and near-infrared bands plus the quality mask, for HLSL30 v2.0 (`catalog`) and its Sentinel-2 sibling HLSS30, over sample fields (chosen by DB-7), 2015 to present. Believed bands: Landsat red `B04`, NIR `B05`; Sentinel-2 red `B04`, NIR `B8A`; quality layer `Fmask`. `TODO(verify)` band names, scaling, and the cloud-mask bit meanings.
- **How to get it:** Earthdata login via LP DAAC. Cloud-optimized GeoTIFFs searched through CMR-STAC (`TODO(verify)` endpoint) and read by window, so we never download full tiles. `earthaccess` or `pystac-client` + `rasterio`.
- **Implementation (S2-A `ingest/hls.py`, `calendar/`):**
  1. Pick N sample fields per crop class near the farm from DB-7.
  2. For each field and date, read the red and NIR window, mask cloud, shadow and snow with the quality layer, compute `NDVI = (NIR - Red) / (NIR + Red)`, take the field median.
  3. Composite by week of year across years (median), interpolate gaps linearly, and store the **number of valid observations per week** (winter in the Fraser Valley is very cloudy).
  4. `Bare_crop(w)` = share of field-years with NDVI below `τ_bare` in week `w`. `τ_bare` default from literature (`TODO(verify)`), sensitivity-tested.
  5. Derive stage dates (green-up, peak, senescence, harvest) from the median curve. They place the FAO-56 stages (DB-8).
  6. A crop with too few valid observations falls back to a textbook calendar, labeled `assumed`, and the marker's "why?" says so.
- **Needs:** Earthdata account; `rasterio`, `numpy`, `pystac-client` or `earthaccess`; the heaviest ingest job (hours of reads), so **run it before the event** (decision D-03). Estimate: about 10 to 40 GB of reads, only a few MB kept.
- **Outputs:** `data/seed/<site>/calendars.json` with `Bare_crop[52]`, `NDVI_median[52]`, `n_obs[52]`, stage dates, per crop. Imagery is not redistributed; only these derived tables are committed.
- **Fallback:** textbook calendar (`assumed`).
- **Basis label:** `measured` (NDVI), `derived` (bare fraction).
- **Owners:** S2-A builds; S2-B reads the calendars.

#### DB-7 AAFC Annual Crop Inventory (non-NASA, Canada)

- **Why:** HLS tells us the greenness of a field; this tells us which crop is on it. It picks the sample fields for the HLS calendars and sets the crop per patch on the curated Fraser Valley site (decision D-15).
- **What we take:** the crop-class raster for the farm region, several recent years. `TODO(verify)`: download portal, years available, class codes, and whether cover-crop or fallow classes exist (believed not, hence the `assumed` label for cover-crop rotations).
- **How to get it:** open download (believed Open Government Licence - Canada, `TODO(verify)`).
- **Implementation (S2-A, `ingest/aafc.py`):** clip the raster to the region; vectorize into field-like patches with `rasterio.features.shapes`; map class codes to our crop library (corn silage, grass, berries, etc.; list agreed with the owner); store the patches with their crop and year.
- **Needs:** the farm region; `rasterio`, `shapely`; small download.
- **Outputs:** `data/seed/<site>/fields.geojson` (field polygon + crop per year), reused by terrain zones and the HLS sampler.
- **Fallback / non-Canadian sites:** the user assigns a crop per field (decision D-15); label `assumed`.
- **Basis label:** `measured` (classified).
- **Owners:** S2-A. S1-B only collects a crop choice from the user for non-curated sites.

### 2.4 Agronomy reference

#### DB-8 FAO-56 crop coefficients (published tables)

- **Why:** to weight dry spells by how water-sensitive each crop is at that stage (decision D-10), with a citable source instead of invented numbers.
- **What we take:** Kc_ini, Kc_mid, Kc_end and stage lengths for each crop in our library. `TODO(verify)`: exact table and row for each crop, and the proxy crop for any crop not in FAO-56.
- **Implementation (S2-B, `calendar/`):** store the values in a data file `data/reference/fao56_kc.json` with a `source` field (table + row) per value; build `Sens_r(w)` by placing the stages on the measured crop dates (DB-6) and normalizing Kc by Kc_mid.
- **Needs:** the FAO-56 paper (free); a human to transcribe and double-check values.
- **Outputs:** `fao56_kc.json` (committed), `Sens_crop[52]` inside `calendars.json`.
- **Basis label:** `assumed (published)`.
- **Owners:** S2-B.

### 2.5 Optional and stretch databases

#### DB-9 ECOSTRESS evapotranspiration (P2)

- **Why:** an independent check on the summer-dry axis: where plants actually used less water than expected. Not required for the core algorithm.
- **What we take:** `ECO_L3T_JET` V003 (`catalog`, CMR concept `C4057232489-LPCLOUD`), about 70 m, over the sample fields in the growing season. The companion stress product `ECO_L4T_ESI` was mentioned by the catalog; `TODO(verify)`.
- **Implementation (S2-A):** same windowed reads as HLS; compute the weekly median per crop; compare to the `Sens_r(w)` calendar as a sanity plot in `algorithm.md`. Do not feed it into scores.
- **Needs:** Earthdata account; ECOSTRESS passes are irregular (ISS orbit), so expect gaps.
- **Decision rule:** build only if all P0 databases are done by Sunday morning.
- **Basis label:** `measured`.

#### DB-10 RADARSAT Constellation Mission (P2, backtest)

- **Why:** radar sees through winter cloud, so it is the best observation of the Nov 2021 flood extent for checking our `winter_wet` zones. The Canadian Space Agency is a Space Apps partner.
- **What we take:** SAR scenes or a flood-extent product around the Sumas Prairie event. `TODO(verify)`: open-access availability, license, format.
- **Implementation (S2-A):** if available, threshold backscatter to a flood mask and compare to flagged zones against an area-matched random baseline. If not available, the backtest uses HLS water index and SMAP change (cloud permitting).
- **Basis label:** `measured`.

#### DB-11 Soil texture / hydrologic group (P2)

- **Why:** an optional modifier for the terrain factor (sandy soils drain, clay soils pond).
- **What we take:** texture class for the farm. Candidates: BC Soil Information Finder, SoilGrids. `TODO(verify)` source, resolution, license.
- **Implementation:** a small lookup that scales `T(z)` within stated bounds; sensitivity-tested; omit if no clean source by Saturday noon.
- **Basis label:** `measured` or `assumed`.

### 2.6 User inputs and data credits

#### DB-12 User inputs: photo, location, crop per field

- **S2-A (backend):** validate upload type and size (reject over a stated limit), strip image metadata, store in `data/uploads/` (gitignored, never committed). Location decides: curated site match (within a stated radius) gives full mode; else Lite mode.
- **S2-B:** uses the user's crop per field in Lite mode, labeled `assumed`.
- **S1-B:** upload and map-pin flow, field drawing, crop picker.
- **S1-A:** uses the photo as the texture on the 3D land (Land Scan flow).
- **Honesty:** the photo never feeds any number (no crop detection from the photo; out of scope).

#### DB-13 Provenance and data credits

- **Why:** the Validity criterion and our own honesty rules require every dataset to be listed with source, license and attribution.
- **Implementation (S2-A):** one `provenance.json` per site, generated from this file's per-dataset facts (name, provider, URL, license, accessed date, basis). `GET /provenance` serves it. A test fails if any dataset used in `hazard.json` or `calendars.json` is missing from it.
- **S1-B:** the Data and Methods page and the "why?" source lines render from this endpoint. They must not hard-code dataset names.

---

#### DB-14 Globe and basemap sources (visual only, Section 1)

- **Why:** the space-to-farm intro (Section 2 PRD D-25, D-26) and the photoreal context around the farm. These sources are **visual only**; no number in FieldTwin is computed from them.
- **What is used:** these are Section 1's Cesium tiers on branch `fe/S1-cesium-globe`, per `docs/progress/s1-C1.md` there:

  | Tier | Source | Needs |
  | --- | --- | --- |
  | A | Google Photorealistic 3D Tiles via Cesium ion | Network + ion token |
  | B | Cesium World Terrain + ion imagery (fallback asset "Google Maps 2D Satellite") | Network + ion token |
  | C | Natural Earth II bundled with Cesium | Nothing (keyless, offline) |
  | Field outlines | OpenStreetMap, ODbL | — |

  The OSM query is recorded in `docs/progress/s1-C3-product.md`.
- **Needs:** `NEXT_PUBLIC_CESIUM_ION_TOKEN` in `apps/web/.env.local` (never committed). Tier C works with no token, so the demo must pass in tier C.
- **Licensing (TODO(verify)):** Google 3D Tiles and Cesium ion terms (attribution, caching, recording a video of tiles for the backup), Natural Earth (public domain, verify), OSM (ODbL attribution "© OpenStreetMap contributors").
- **Provenance:** S2-A adds each source to `provenance.json` with its license, so the Methods page (F34) lists it.
- **Not NASA:** these don't count toward "NASA data does the core work". The Methods page says the globe imagery is for context only.
- **Owners:** S1-A builds; S2-A records provenance.

## 3. Pipeline and storage

```
data/cache/   (gitignored, raw)               data/seed/<site>/   (committed, derived and license-safe)
  lidarbc/  ──► terrain ───────────────────────► terrain/ (heightmap, normals), zones.geojson, terrain.json
  nasadem/  ─┘
  power/    ─┐
  imerg/    ─┼─► fusion ──────────────────────► hazard.json
  smap/     ─┘
  hls/ + aafc/ ─► calendars ───────────────────► calendars.json, fields.geojson
  reference/fao56_kc.json ─────────────────────► (merged into calendars.json)
                                                  exposure.json, bootstrap.json, scenarios.json,
                                                  optimizer.json, provenance.json   (from engine)
```

Rules:
1. Cache-first, offline-safe: every ingest module checks `data/cache/` first; with `OFFLINE=1` it refuses network calls and a test enforces it.
2. Credentials only in `.env` (variable names in `.env.example`). Never commit `.env` or raw imagery.
3. Anything committed to `data/seed/` must be derived and license-safe. When in doubt, ship the table, not the raster.
4. Determinism: same inputs give byte-identical seed outputs (fixed seeds, sorted keys, stable float formatting).

## 4. Considered and not used

| Dataset / idea | Decision | Why |
| --- | --- | --- |
| NASA GRACE / GRACE-FO mascons (`catalog`: monthly, since 2002) | Not used | Hundreds of km resolution; says nothing about one farm. At most a one-line regional note, only if time allows |
| Crop-yield data | Not used | No NASA product in scope, and the PRD forbids yield figures. Relative exposure only |
| Disaster-event catalogs | Not used | Hazard odds come from our own fused record plus the Nov 2021 backtest. `TODO(verify)` any NASA catalog before adding |
| NASA climate projections (e.g. NEX-GDDP-CMIP6, mentioned by other teams, unverified) | Not used | Our Field Shift scenarios replay real observed years; projections would be forecasts (decision D-04) |

## 5. Verification checklist (S2-01 must complete)

For each P0 row, record in `data-sources.md`: exact product name and version; variable names and units; resolution and coverage; access method and a **working sample request URL**; license and attribution text; rate limits; and whether the farm location (~49°N) is covered. Also:

- [ ] Read the official 2026 challenge **Resources** list and add anything fitting a role above.
- [ ] Create Earthdata accounts for all of S2 and the integrator; test one download each.
- [ ] Decide SMAP L4 vs L3 (DB-5).
- [ ] Confirm LidarBC coverage and license for the chosen farm (DB-1).
- [ ] Confirm AAFC classes and years (DB-7).
- [ ] Confirm CSA RADARSAT access (DB-10).
- [ ] Transcribe FAO-56 Kc values with table references (DB-8).

## 6. Time plan (maps to Section 2 PRD §12)

| When | Data work |
| --- | --- |
| Day -2 | Verify all rows, accounts, pick farm, `data-sources.md` |
| Day -1 | Download POWER, IMERG, SMAP; HLS + AAFC calendars; LidarBC terrain and zones |
| Sat AM | Backtest observation data (Nov 2021), FAO-56 file final |
| Sat PM | Commit `data/seed/<site1>/`; OFFLINE test; S1 swaps terrain and zones to live |
| Sun AM | Lite mode: POWER live + NASADEM; ECOSTRESS only if P0 is done |
| Sun PM | Sites 2 and 3 if time; `provenance.json` complete; freeze by Sun 21:00 |

## 7. Change log

| Date | Who | Change |
| --- | --- | --- |
| 2026-11-13 | Claude + product owner | v0.1: created from the Section 2 PRD v0.2 data table and the unofficial challenge catalog; per-dataset plans; team split; GRACE, yield and disaster catalogs excluded |
| 2026-11-13 | Claude + product owner | v0.2: DB-14 globe and basemap sources (Cesium tiers, Google 3D Tiles, Natural Earth II, OSM), visual only; IMERG half-hourly storm shape in DB-4 (D-35); tables updated |
