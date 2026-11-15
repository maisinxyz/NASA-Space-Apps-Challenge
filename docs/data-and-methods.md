# Data and methods

Scenario forecast for a stated climate path. It is not a prediction of harvest, income, or soil loss. Every number in an API response carries a unit, a basis (`measured`, `derived`, `modeled`, `assumed`, or `relative`), and a confidence. Absolute estimates also carry a p10–p90 range. The response includes: "This tool supports, and does not replace, local agronomic expertise."

The climate path in this build is `history_resample`: the seeded NASA POWER years, shifted by the scenario preset, with a linear ramp from year 0 to year 10. `cmip6_delta` is not applied. See the NEX-GDDP-CMIP6 note below and `docs/progress/FT-W3.md`.

Curated sites are `site_usda_barc`, `site_cornell_ruminant`, `site_ucdavis_oakville`, and `site_ubc_farm`. `OFFLINE=1` reads `data/seed/` and does not call the network.

## Datasets that are stored

Rows below are copied from the seed sidecars and from `docs/progress/FT-W1.md`. The same POWER licence and attribution are on `app/features/config.py` `POWER_SOURCE`.

| Dataset | Source | Licence | Attribution | Resolution | Record | Limit |
| --- | --- | --- | --- | --- | --- | --- |
| NASA POWER daily point, community AG | https://power.larc.nasa.gov/docs/services/api/ | No restrictions on use; citation requested. Exact acknowledgement wording is still **TODO(verify)** against https://power.larc.nasa.gov/docs/referencing/ | NASA Langley Research Center POWER Project | 0.5° × 0.625° (MERRA-2). `POWER_SOURCE` stores 55000 m. The note in config says about 50 km. | 1991-01-01 to 2024-12-31. Product version in the UBC sidecar: POWER Daily API v2.10.3. Parameters: `PRECTOTCORR`, `T2M`, `T2M_MAX`, `T2M_MIN`, `GWETROOT`, `GWETTOP`. | Regional, not a field gauge. Not bias-corrected. At UBC Farm the cell includes ocean and mountains. The downloaded point is 49.252, −123.238. |
| SoilGrids 2.0 | https://rest.isric.org/soilgrids/v2.0/properties/query and https://www.isric.org/explore/soilgrids | CC BY 4.0 (https://docs.isric.org/globaldata/soilgrids/SoilGrids_faqs_02.html) | SoilGrids 2.0, ISRIC (Poggio et al. 2021, SOIL 7, 217–240) | 250 m, 0–30 cm depth-weighted mean | Static model | Not a soil sample. The texture-to-infiltration class map is assumed (**TODO(verify)**). |
| UBC Farm address point | https://ubcfarm.ubc.ca/ does not publish coordinates. The point used is the BC address geocoder access point: https://geocoder.api.gov.bc.ca/addresses.json?addressString=3461%20Ross%20Drive%20Vancouver | Open Government Licence – British Columbia v2.0, https://www2.gov.bc.ca/gov/content?id=A519A56BC2BF44E4A008B33FCF527F61 . That page says the licence applies to B.C. Data Catalogue records that specify it. | Contains information licensed under the Open Government Licence – British Columbia. | Address access point, match precision BLOCK, positional accuracy low | Geocoder base data date 2026-07-07 | Not a surveyed field centroid. **TODO(verify)** a UBC-published centroid. |
| Crop catalog v2 | `data/seed/crops/catalog_v2.json`. FAO-56 chapter used where a coefficient was copied: https://www.fao.org/4/x0490e/x0490e0b.htm | Team-authored catalog. The FAO licence for the copied sentences is **TODO(verify)** (sidecar, read 2026-11-15). | Allen et al. 1998, FAO Irrigation and Drainage Paper 56, for the coefficients the sidecar says were copied. Other traits are hand-curated. | Not spatial | Static | Null numbers are unverified. They are not filled with a default. |

The three older curated sites use the same POWER window and the same SoilGrids loader. Their coordinates are in `app/features/config.py`.

## Datasets that were not retrieved

No weekly values were written. `data_mode` is `limited_data` while these are missing. Licences were not copied. **TODO(verify)** each collection licence before a download. Titles are the CMR titles stored in the UBC sidecars on 2026-11-15 (`docs/progress/FT-W2.md`).

| Layer | What the sidecar names | Source URL in the sidecar | Resolution | Record in this repo |
| --- | --- | --- | --- | --- |
| Vegetation indices | HLS Operational Land Imager Vegetation Indices Daily Global 30 m V2.0 (`HLSL30_VI` v2.0) | https://cmr.earthdata.nasa.gov/search/collections.json?short_name=HLSL30_VI | Not retrieved. The NDVI band name was not in the summary that was read. | None |
| SMAP | SMAP L4 Global 3-hourly 9 km EASE-Grid Surface and Root Zone Soil Moisture Geophysical Data V008 (`SPL4SMGP` v008) | https://cmr.earthdata.nasa.gov/search/collections.json?short_name=SPL4SMGP | Not retrieved. The title says 9 km. That number is not stored as `native_resolution_m`. | None |
| ECOSTRESS | ECOSTRESS Tiled Evapotranspiration PT-JPL Instantaneous and Daytime L3 Global 70 m v003 (`ECO_L3T_JET` v003) | https://cmr.earthdata.nasa.gov/search/collections.json?short_name=ECO_L3T_JET | Not retrieved. The title says 70 m. | None |
| GRACE / GRACE-FO | JPL GRACE and GRACE-FO Mascon CRI Filtered Release 06.3 Version 04 | https://cmr.earthdata.nasa.gov/search/collections.json?short_name=TELLUS_GRAC-GRFO_MASCON_CRI_GRID_RL06.3_V4 | Not retrieved. Grid spacing was not in the title. | None. Not scored. |
| DEM | NASADEM Merged DEM Global 1 arc second V001 (`NASADEM_HGT` v001) | https://cmr.earthdata.nasa.gov/search/collections.json?short_name=NASADEM_HGT | Not retrieved. The user guide was not opened. Not known to be bare earth. | None |

Earthdata credentials were not in the environment, so nothing was downloaded.

## Local station

Candidate only: Environment and Climate Change Canada station VANCOUVER UBC, climate id 1108487, 49.25 N, 123.25 W, elevation 76 m. Normals page: https://climat.meteo.gc.ca/climate_normals/results_e.html?climate_id=1108487 (1971–2000 on that page). Daily observations are not in the seed. https://climate.meteo.gc.ca/prods_servs/attachment1_e.html allows redistribution only if no fee is charged and each further recipient agrees to the same restrictions. **TODO(verify)** whether the FAQ citation text (https://climate.weather.gc.ca/FAQ_e.html) is a separate licence. Until then `uncertainty.station_bias` is null.

## Future climate (decision D2)

NASA NEX-GDDP-CMIP6 publishes daily `pr`, `tasmax`, and `tasmin` on a 0.25° grid from 60° S to 90° N, which includes UBC Farm. Sources: the June 2025 tech note https://www.nccs.nasa.gov/wp-content/uploads/2025/06/NEX-GDDP-CMIP6-v2-Tech_Note.pdf and https://www.nccs.nasa.gov/data-collections/nex-gddp-cmip6/ . It is not used. The AWS registry says CC0 as of September 2022 (https://registry.opendata.aws/nex-gddp-cmip6/). The tech note says each file's `cmip6_license` may restrict use. No delta table is stored. The response stays on `history_resample`.

## What the engine does with the stored data

- Weeks are 7-day blocks from 1 January. Days 358–366 fold into week 51 (`app/features/pipeline.py`).
- Reference evapotranspiration is Hargreaves–Samani from POWER temperature. The formula and the FAO-56 radiation equations are cited in that file. Basis `modeled`.
- Seasonal temperature drift is a Theil–Sen slope and a Mann–Kendall p-value on the seasonal mean of `T2M`. The 0.05 significance level is assumed (**TODO(verify)**). Trends are not extended into the 10 years.
- Frost dates use `T2M_MIN` at or below `frost_c` (0 °C, assumed, the same threshold as the feature pipeline). Last spring frost is the last such day before 1 July. First fall frost is the first such day on or after 1 July. The July split is **TODO(verify)**. 32 °F is the freeze described at https://www.ncei.noaa.gov/news/last-spring-freeze .
- Heat-stress days count `T2M_MAX` at or above the catalog `heat_limit_c`. A null limit is skipped. The catalog limits that are present are still marked **TODO(verify)** in `trait_sources`.
- The 10-year weather ensemble samples historical years with `numpy.random.default_rng(member_seed(request_hash, member))`. Central value is the median. N = 30 on `/forecast`. The sensitivity grid uses 4 members so it can finish within the time budget. That count is a speed choice (**TODO(verify)** as a sample size), recorded in `app/twin/explain/grid.py`.
- Weekly soil water, soil carbon, nitrogen, pests, soil loss, and scores are `app/twin/`. Coefficients are in `app/twin/config.py`, each with a source comment or **TODO(verify)**. A null catalog yield or Ky omits `yield_t_ha` for that crop. Income is null when the farmer did not enter a per-tonne price. No price is invented.
