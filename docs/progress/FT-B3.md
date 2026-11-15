# FT-B3 — ECCC station cross-check

Status: implemented and verified locally (2026-11-15). Daily seeds are from Environment and Climate Change Canada’s MSC GeoMet OGC API and are stored with the API's Data Server End-use Licence v2.1.1 (August 2026). The licence permits copying and distribution with attribution; the sidecars include `Data Source: Environment and Climate Change Canada` and the licence URL. The collection metadata itself exposes no collection-specific licence or exception. Source: https://eccc-msc.github.io/open-data/licence/readme_en/ .

## Stations and coverage

Distances use the station feature’s GeoJSON point and the configured site point, with great-circle distance. The integer station `LATITUDE`/`LONGITUDE` properties disagree with the GeoJSON geometry in the records checked, so those integer fields were not used for distance.

| Site | ECCC station | Climate ID | Type | Distance | Catalog daily period | Valid paired temp and rain days vs POWER |
| --- | --- | --- | --- | ---: | --- | ---: |
| UBC Farm | Vancouver Intl A | 1108395 | Aviation-Staffed | 7.23 km | 2013-06-13–2026-11-13 | 4,132 (2013–2024) |
| KPU Langley | Cloverdale East | 1101708 | Climate-Staffed | 3.80 km | 1964-01-01–2026-11-13 | 9,855 rain-paired days; 1991–2024 |

The nearest active KPU station, Langley Regional (1104570; 1.42 km), was excluded because its current API records contain temperature but no usable rain or total precipitation. The nearest active station with usable rain is Cloverdale East. The nearest listed active UBC station with both daily fields was farther than the historical Vancouver UBC station; the latter ends in 1995. Current status was checked in `climate-stations` (`DLY_LAST_DATE` through 2026-11-13), and actual recent temp/rain coverage was separately checked in `climate-daily` through 2026-11-15 (994 paired UBC days and 1,031 paired KPU days in the 2024-01-01–2026-11-30 query). The committed comparison seeds stop at 2024-12-31 to match POWER.

Official API field names: `MEAN_TEMPERATURE` (°C), `TOTAL_RAIN` (mm), `TOTAL_PRECIPITATION` (mm), `LOCAL_DATE`, `CLIMATE_IDENTIFIER`, `STATION_NAME`, `STATION_TYPE`, `DLY_FIRST_DATE`, `DLY_LAST_DATE`, `LATITUDE`, `LONGITUDE`. Schema: https://api.weather.gc.ca/collections/climate-daily/schema?f=html . Station collection/queryables: https://api.weather.gc.ca/collections/climate-stations/queryables?f=html . Example collections: https://api.weather.gc.ca/collections/climate-stations/items and https://api.weather.gc.ca/collections/climate-daily/items .

## Bias basis and results

The monthly sidecar groups paired daily differences by calendar month, using the same local date (the API's `LOCAL_DATE` is a calendar date without a UTC offset; the date substring is preserved, not shifted). Comparisons use only dates where both POWER and station values are present. The headline response uses mean temperature because the API contract currently represents a single `StationBias` object: `POWER T2M − ECCC MEAN_TEMPERATURE`, `°C`, `basis: derived`, low confidence, and `n_years` equal to years containing at least one valid paired temperature day.

| Site | Headline temp bias, POWER minus station | Paired temp days | Years compared |
| --- | ---: | ---: | --- |
| UBC Farm | −3.34 °C | 4,164 | 2013–2024 (12 years) |
| KPU Langley | −1.60 °C | 9,692 | 1992–2024 (33 years) |

Each `station_bias.json` contains 12 monthly mean daily-difference comparisons, sample-day counts, and paired year spans per metric: temperature 2013–2024 (UBC), 1992–2024 (KPU); like-for-like total precipitation 2013–2024 (UBC), 1991–2024 (KPU); rain 2013–2024 (UBC), 1991–2024 (KPU). The comparisons are POWER minus ECCC. They include like-for-like total precipitation (`POWER PRECTOTCORR − ECCC TOTAL_PRECIPITATION`) and a separate rain comparison (`POWER PRECTOTCORR − ECCC TOTAL_RAIN`). The rain comparison is explicitly marked non-equivalent because POWER `PRECTOTCORR` is total corrected precipitation and can include frozen precipitation; it is not labelled a direct rain bias. Month values and station identity/location are retained in the seed rather than expanding the existing contract shape.

The large negative UBC temperature difference is a material discrepancy, not a correction. It is reported with low confidence and requires review of POWER grid/site elevation representativeness and station comparability before anyone applies a bias adjustment. This work only cross-checks the datasets; it does not alter forecasts.

## Files and verification

- `scripts/seed_station_check.py` recreates the seeds via paginated GeoMet OGC API queries over the POWER interval (1991-01-01–2024-12-31).
- `data/seed/site_{ubc_farm,kpu_langley}/station_daily.json.gz` stores local-date station rows and `station_daily.meta.json` records source/licence/attribution, point distance, and processing.
- `data/seed/site_{ubc_farm,kpu_langley}/station_bias.json` contains monthly paired comparisons; `station_bias.meta.json` records both source attributions, licence, spatial/temporal basis, and non-equivalent rainfall caveat.
- `services/api/app/twin/station_bias.py` computes deterministic monthly paired comparisons; `app/twin/explain/uncertainty.py` uses the stored temperature bias; the forecast assumptions identify station, climate ID, distance, overlap span, sign convention, and the rainfall comparison limitation.
- Removed stale station gap records for these sites.
- Updated offline tests cover missing values, paired dates, source/licence metadata, station coverage, and contract validation.

Verification: `uv run --project services/api pytest -q services/api/tests/test_station_bias.py services/api/tests/test_twin_explain.py services/api/tests/qa/test_hindcast.py`.

The offline station, hindcast, and contract-response checks passed all 13 tests.
