# Farm scouting: results (2026-11-14)

**11 farms PASSED the 3D check and are pins on the home globe** (9 in round 1, 2 in the gap-fill round below) (`apps/web/lib/farms/pinned.ts`): Wageningen Unifarm, UBC Farm, Hokkaido University farm, University of Tokyo ISAS, Agroscope Reckenholz, UIUC South Farms, Waite Campus Adelaide, Helsinki Viikki, INTA Castelar, NTU Farm Taipei, Pirque vineyards. With Cornell, Beltsville and Napa the globe has 14 pins, all at least 500 km apart (tested).
1 WEAK (UP Hatfield, no pin), 4 FAIL (IARI, CIMMYT, CIP, ESALQ). The other 13 candidates were not checked: the user capped this run at 15 sites (Cornell plus 14 candidates) for speed. Fewer than the 15 PASS target; more can be added later with `/dev/farms-check`.
Unvalidated, weak and failed farms are not bundled into the app: the candidate list (`lib/farms/candidates/index.ts`) is imported only by the dev page.

## Gap-fill round (2026-11-14, evening): Africa, South America, mainland Asia

Asked to fill the empty parts of the globe. Same stage-1 numbers (fast mode or the `probe(lon, lat)` hook, which reproduced UBC exactly: 90 %, 10.1 m, relief 43 %), then one oblique for survivors.

| site | country | source of location | stage 1 (bldgs; share >= 3 m; median; relief share / p90) | verdict |
|---|---|---|---|---|
| `pirque-vineyards` | Chile | candidate file | 60; 83 %; 5.8 m; 24 % / 7.1 m | **PASS**: winery buildings and trees 3D, vine rows sharp (`pirque-vineyards-oblique.png`) |
| `ntu-farm` (new file) | Taiwan | OSM node 3012324209 | 60; 72 %; 4.8 m; 50 % / 14.9 m | **PASS**: plots beside 3D campus, greenhouses, sharp (`ntu-farm-oblique.png`) |
| `kadoorie-farm` (new file) | Hong Kong | OSM node 4959391427 | 16; 63 %; 3.3 m; 76 % / 11.3 m | **FAIL**: the app's farm view lands the camera at -7215 m (underground) on this hillside, so "Fly in" is broken there. Camera bug, see progress note |
| `su-welgevallen` | South Africa | candidate file | 60; 8 %; 0.4 m; 11 % / 3.5 m | FAIL: flat |
| `ilri-nairobi` | Kenya | candidate file | 60; 20 %; 1.6 m; 21 % / 3.6 m | FAIL: mostly flat |
| `ilri-addis` | Ethiopia | candidate file | 60; 0 %; 0.6 m; 0 % / 1.0 m | FAIL: flat |
| `iita-ibadan` | Nigeria | candidate file | 60; 13 %; 1.6 m; 1 % / 2.0 m | FAIL: flat |
| `ciat-palmira` | Colombia | candidate file | 6; 0 %; 0.9 m; 0 % / 0.7 m | FAIL: flat |
| `icrisat-patancheru` | India | candidate file | 60; 3 %; 1.0 m; 0 % / 1.2 m | FAIL: flat |
| `irri-los-banos` | Philippines | candidate file | 60; 2 %; 0.7 m; 1 % / 1.7 m | FAIL: flat |
| probe only (no file) | | OSM via Nominatim | | all FAIL, flat: UPM Serdang MY (25 %, 1.4 m), GKVK Bengaluru IN (0 %), Ankara Univ. agriculture TR (5 %), IAC Campinas BR (10 %), Univ. Nairobi Kabete KE (20 %), IAV Hassan II Rabat MA (0 %), Elsenburg ZA (0 %), Cairo Univ. agriculture EG (0 %), VNUA Hanoi VN (0 %), IPB Bogor ID (12 %), Kasetsart Bangkok TH (2 %), UFU Água Limpa BR (no OSM bldgs, relief 0 %), Rehovot IL (memory coords, 0 %) |

**Africa stays empty.** All 9 African sites checked read flat: Google Photorealistic 3D Tiles had no real 3D mesh at those farms, and UP Hatfield (WEAK) was the only one with partial 3D. Under the "good 3D only" rule none gets a pin.

## Method (what actually ran)

- The app's own Cesium viewer in a Playwright-driven Chromium on a team laptop (real GPU), dev server with the team Cesium ion token. Tier A, surface google. Tiles are only streamed into the viewer; nothing was cached or exported except summary numbers and the screenshots below. The Google Map Tiles policy page was not read in this session (user's decision); the open question from the earlier session about sampling heights as "derived" content remains.
- **Stage 1 (numbers, `/dev/farms-check`):** OSM building footprints from the OSM API 0.6 `map` call (public Overpass returned 504 or took 30-210 s), up to 60 nearest within 600 m. `scene.sampleHeightMostDetailed` on the Google tileset at each centroid vs the lowest point on a ring 8 m outside the footprint: share >= 3 m and median. Plus a **relief grid** (13 x 13 points, 40 m apart, each vs a 15 m ring), which works where OSM has no buildings; it counts buildings and trees alike.
- **Method check:** Cornell has only 1 OSM building near its pin, so the building metric could not be checked there. Relief: Cornell 25 % of points >= 3 m (p90 11.8 m); Cayuga Lake water (flat control) 0 % (p90 0.0 m, max 0.1 m). Every farm with a high building share (53-95 %) then looked 3D in its screenshot, so the numbers held up in that direction. The 0-22 % farms (CIP, CIMMYT, IARI, ESALQ) were rejected on numbers alone, with no screenshot, per the funnel rule. Their flatness is measured, not seen.
- Detail proxy (smallest visible tile geometric error) was 2.0 m at most sites but was not reliable (4109 m at Reckenholz, which looked sharp); not used for verdicts. Not measured in the faster "numbers only" mode.
- **Stage 2:** one oblique screenshot per stage-1 survivor (pitch -30 deg, range 350 m), viewed and judged. **No top-down shots:** at pitch -89 deg the farm-view orbit put the camera underground (blank frame, 2 unusable shots), and setting the camera directly was reset to -30 deg by the orbit code. Fixing that is app camera work, out of scope here. 12 screenshots taken in total: 10 used, 2 blank.
- Coordinates of most candidates were cross-checked against OSM Nominatim (all within about 1 km); every pin stays `coordsVerified: false` (Approximate location).

## Ranked candidates (27 data files; 14 checked)

Ranking puts expected Google 3D first (dense city or campus setting), then open-data quality, then spread. "Expected" is an estimate from public sources and was not measured.

All 27 are spread out: every candidate is at least 500 km from every other candidate and from Cornell, Beltsville and Napa. The closest pair is Wageningen and Reckenholz, about 547 km apart. NASA POWER daily data is global, so it is listed as available for every site. It was not fetched (the POWER host is blocked here).

| rank | id | name | country | approx lat, lon | why chosen | stage-1 numbers | 3D verdict | screenshots | data potential (elevation; POWER; field boundaries) | risks | privacy | recommended tier |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `wur-unifarm` | Unifarm, Wageningen University & Research | Netherlands | 51.99, 5.66 TODO(verify) (memory) | University research farm next to campus; best open data (0.5 m lidar, crop parcels) | 60 bldgs; 53 % >= 3 m; median 3.3 m; min tile err 2.0 m; relief 5 % / p90 0.9 m | PASS: polytunnels, barns and tree rows in 3D, sharp | docs/farm-scouting/wur-unifarm-oblique.png | AHN4 0.5 m lidar, CC0; POWER yes; BRP Gewaspercelen (CC0) | About 410 km from Rothamsted (reserve), coordinates from memory | public institution | explore-only |
| 2 | `agroscope-reckenholz` | Agroscope Reckenholz research station | Switzerland | 47.43, 8.52 TODO(verify) (memory) | Federal arable research station inside the city of Zurich | 60; 82 %; 4.6 m; err 4109 m (misleading, view was sharp); relief 8 % / 1.7 m | PASS: farm buildings and trees in 3D, sharp | docs/farm-scouting/agroscope-reckenholz-oblique.png | swissALTI3D, Swiss OGD (cite swisstopo), https://opendata.swiss/fr/dataset/swissalti3d; POWER yes; OSM landuse (ODbL), Overpass not checked | Fenced protected trial site is part of the station: frame away from it | public institution | explore-only |
| 3 | `helsinki-viikki` | Viikki Research Farm, University of Helsinki | Finland | 60.23, 25.02 TODO(verify) (memory) | 155 ha of fields inside a capital city; boreal climate | 60; 83 %; 8.6 m; err 2.0 m; relief 36 % / 12.0 m | PASS: very sharp 3D; pin is on the campus, move it onto the fields | docs/farm-scouting/helsinki-viikki-oblique.png | NLS Finland 2 m, CC BY 4.0 TODO(verify); POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates from memory | public institution | explore-only |
| 4 | `ubc-farm` | UBC Farm, University of British Columbia | Canada | 49.251, -123.238 TODO(verify) (memory) | 20 to 24 ha teaching farm inside a major city; dense Google 3D expected | 60; 90 %; 10.1 m; err 2.0 m; relief 43 % / 18.2 m | PASS: sheds, hoop houses, forest in 3D, sharp | docs/farm-scouting/ubc-farm-oblique.png | CanElevation HRDEM, OGL-Canada, https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995; POWER yes; OSM landuse (ODbL), Overpass not checked | Small fields; mixed vegetables rather than field crops | public institution | explore-only |
| 5 | `utokyo-isas` | Institute for Sustainable Agro-ecosystem Services (ISAS), University of Tokyo | Japan | 35.74, 139.54 TODO(verify) (memory) | 30 ha of fields and paddy inside the Tokyo urban area | 60; 83 %; 6.8 m; err 2.0 m; relief 40 % / 12.3 m | PASS: fields and paddy among 3D city blocks, sharp | docs/farm-scouting/utokyo-isas-oblique.png | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; MAFF fude polygons (terms TODO(verify)) | Small fields; GSI 5 m DEM terms not yet verified, so global DEM listed | public institution | explore-only |
| 6 | `hokudai-farm` | Experiment Farm, Hokkaido University | Japan | 43.075, 141.335 TODO(verify) (memory) | 58 ha city-campus farm dating from 1876; cold humid climate | 60; 90 %; 7.1 m; err not measured (fast mode); relief 12 % / 6.4 m | PASS: farm buildings, poplar rows in 3D, sharp | docs/farm-scouting/hokudai-farm-oblique.png | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; MAFF fude polygons (terms TODO(verify)) | GSI 5 m DEM terms not yet verified, so global DEM listed | public institution | explore-only |
| 7 | `waite-adelaide` | Waite Campus, University of Adelaide | Australia | -34.97, 138.63 TODO(verify) (memory) | 184 ha research campus with vineyards in Adelaide's suburbs; Mediterranean climate | 60; 95 %; 5.4 m; relief 37 % / 11.9 m | PASS: sharp 3D houses and trees; pin is on woodland, trial plots ~400-500 m NE | docs/farm-scouting/waite-adelaide-oblique.png | GA ELVIS lidar, CC BY 4.0 (per dataset); POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates from memory | public institution | explore-only |
| 8 | `uiuc-south-farms` | South Farms, University of Illinois Urbana-Champaign | United States | 40.08, -88.225 TODO(verify) (memory) | Research farms on the edge of a large campus, many barns; Corn Belt maize-soybean | 2; 100 %; 7.7 m; relief 3 % / 0.9 m | PASS: plots sharp, tree lines and distant barns/silo 3D; pin could move to the barns | docs/farm-scouting/uiuc-south-farms-oblique.png | USGS 3DEP 1 m, public domain, https://catalog.data.gov/dataset/usgs-1-meter-digital-elevation-model; POWER yes; OSM landuse (ODbL), Overpass not checked | Point is the South Farms area, not a specific building | public institution | explore-only |
| 9 | `iari-pusa` | ICAR-IARI Pusa campus fields | India | 28.64, 77.16 TODO(verify) (memory) | About 500 ha of research fields in central Delhi; monsoon climate, rice-wheat | 54; 20 %; 1.4 m; relief 2 % / 2.3 m | FAIL (stage 1): buildings mostly flat | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Source is a government compendium, not the institute's own page | public institution | explore-only |
| 10 | `cimmyt-el-batan` | CIMMYT headquarters and El Batán experimental station | Mexico | 19.52957, -98.8532 (src: https://www.cgiar.org/locations/mexico-cimmyt-texcoco-la-redonda-experimental-station) | Clear HQ building cluster with trial plots in the Mexico City metro; highland maize and wheat | 0 OSM bldgs; relief 0 % / 0.6 m | FAIL (stage 1): flat mesh | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | CGIAR lists a second La Redonda point 15 km east | public institution | explore-only |
| 11 | `cip-la-molina` | International Potato Center (CIP) headquarters fields | Peru | -12.07694, -76.94611 (src: Wikipedia (International Potato Center article)) | Fields inside the Lima metro; coastal desert, irrigated | 60; 0 %; 0.5 m; relief 0 % / 0.7 m | FAIL (stage 1): flat mesh | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | NASA POWER grid cell is coarse for the coastal desert; small plots | public institution | explore-only |
| 12 | `inta-castelar` | INTA Castelar research centre (CNIA) | Argentina | -34.607, -58.668 TODO(verify) (memory) | Pampas research station inside the Buenos Aires metro | 7; 57 %; 4.9 m; relief 27 % / 7.8 m | PASS: station buildings and trees 3D, slightly softer texture | docs/farm-scouting/inta-castelar-oblique.png | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Press reports (2025-26) of land sales and transfers at the site | public institution | explore-only |
| 13 | `up-hatfield` | Hatfield Experimental Farm (Innovation Africa@UP), University of Pretoria | South Africa | -25.75, 28.258 TODO(verify) (memory) | Urban experimental farm next to campus (dairy, field trials) in a large city | 60; 77 %; 3.9 m; relief 24 % / 8.3 m | WEAK: a large blurred patch with spike artefacts over the trial fields | docs/farm-scouting/up-hatfield-oblique.png | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Part of the farm is being built on (Future Africa campus) | public institution | explore-only |
| 14 | `esalq-piracicaba` | ESALQ/USP Luiz de Queiroz campus farms | Brazil | -22.711, -47.631 TODO(verify) (memory) | Historic agricultural campus inside a city; sugarcane, soybean, maize | 60; 22 %; 1.6 m; relief 1 % / 1.6 m | FAIL (stage 1): buildings mostly flat | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Point is the campus; Fazenda Areao location unverified | public institution | explore-only |
| 15 | `imidra-encin` | Finca El Encin, IMIDRA | Spain | 40.52, -3.29 TODO(verify) (memory) | Regional research farm with vineyard and field crops near Madrid; semi-arid Mediterranean | not run (15-site cap) | NOT VALIDATED | none | CNIG MDT05 (PNOA-LiDAR), CC BY 4.0; POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates need care | public institution | explore-only |
| 16 | `sggw-skierniewice` | Experimental Station in Skierniewice, Warsaw University of Life Sciences (SGGW) | Poland | 51.96, 20.16 TODO(verify) (memory) | Long-term fertilisation trials since 1921 in a mid-size town; continental climate | not run (15-site cap) | NOT VALIDATED | none | GUGiK NMT 1 m, free use TODO(verify); POWER yes; OSM landuse (ODbL), Overpass not checked | Mid-size town: Google 3D may be thinner | public institution | explore-only |
| 17 | `massey-dairy1` | Dairy Farm 1, Massey University | New Zealand | -40.38, 175.62 TODO(verify) (memory) | 142 ha farm inside the city boundary on the Manawatu River (flood relevance) | not run (15-site cap) | NOT VALIDATED | none | LINZ lidar DEM, CC BY 4.0; POWER yes; OSM landuse (ODbL), Overpass not checked | Pasture (dairy), not arable rotations | public institution | explore-only |
| 18 | `tamu-research-farm` | Texas A&M AgriLife Research Farm, Brazos River bottom | United States | 30.545, -96.43 TODO(verify) (memory) | Large irrigated research farm SW of College Station; hot humid climate | not run (15-site cap) | NOT VALIDATED | none | USGS 3DEP 1 m, public domain, https://catalog.data.gov/dataset/usgs-1-meter-digital-elevation-model; POWER yes; OSM landuse (ODbL), Overpass not checked | HQ point uncertain; farm is outside the city | public institution | explore-only |
| 19 | `aafc-saskatoon` | Saskatoon Research Farm, Agriculture and Agri-Food Canada | Canada | 52.158512, -106.580521 (src: https://www.tbs-sct.gc.ca/fcsi-rscf/fsi-isf/00001375-eng.aspx) | Prairie grain research farm on the city edge; cold semi-arid climate | not run (15-site cap) | NOT VALIDATED | none | CanElevation HRDEM, OGL-Canada, https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995; POWER yes; OSM landuse (ODbL), Overpass not checked | Point is the federal property record, not a confirmed building | public institution | explore-only |
| 20 | `su-welgevallen` | Welgevallen Experimental Farm, Stellenbosch University | South Africa | -33.942, 18.867 TODO(verify) (memory) | Experimental farm with vineyards next to campus in a town; Mediterranean climate | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Small plots; coordinates from memory | public institution | explore-only |
| 21 | `pirque-vineyards` | Vineyard estates near Pirque, Santiago Metropolitan Region | Chile | -33.637, -70.575 TODO(verify) (memory) | Large vineyard estates with clear winery buildings on the edge of Santiago, Andes foothills | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Private company land: area only, no owner named; source page is the estate's own visitor blog | private, area only | explore-only |
| 22 | `ilri-nairobi` | ILRI Nairobi campus | Kenya | -1.2699, 36.7258 (src: https://www.cgiar.org/node/986) | Large campus with paddocks inside Nairobi; equatorial highland, two rainy seasons | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Mostly livestock and pasture, few crop rotations | public institution | explore-only |
| 23 | `ilri-addis` | ILRI Addis Ababa campus | Ethiopia | 9.0163, 38.8143 (src: https://www.cgiar.org/locations/ethiopia-ilri-addis-ababa-campus) | 34 ha urban research campus; Ethiopian highland climate | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Few fields on campus | public institution | explore-only |
| 24 | `iita-ibadan` | IITA headquarters research farm | Nigeria | 7.4962, 3.9076 (src: https://www.cgiar.org/locations/nigeria-iita-ibadan-campus) | About 1,000 ha research farm at a major city edge; humid tropics | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Google 3D in Nigeria uncertain | public institution | explore-only |
| 25 | `ciat-palmira` | Alliance Bioversity-CIAT Palmira campus | Colombia | 3.503, -76.356 TODO(verify) (memory) | Large research campus between Cali and Palmira; tropical valley fields | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates unverified; Google 3D in Colombia unknown | public institution | explore-only |
| 26 | `icrisat-patancheru` | ICRISAT headquarters farm | India | 17.51, 78.27 TODO(verify) (memory) | 1,390 ha semi-arid research farm on the Hyderabad edge | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates from memory | public institution | explore-only |
| 27 | `irri-los-banos` | IRRI experimental farm | Philippines | 14.17, 121.25 TODO(verify) (memory) | 252 ha of rice paddies with a research campus; humid tropics | not run (15-site cap) | NOT VALIDATED | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | No official landing page found; source is the IRRI news blog | public institution | explore-only |

### Stage-1 results

Numbers are in the table above (buildings sampled; share >= 3 m above local ground; median; detail proxy; relief share / p90). Controls: Cornell relief 25 % / 11.8 m; Cayuga Lake 0 % / 0.0 m.

### Full twins first (ranked)

1. `wur-unifarm`: best open data (AHN 0.5 m lidar CC0, BRP crop parcels CC0), sharp 3D.
2. `ubc-farm`: dense 3D, CanElevation HRDEM lidar, small mixed fields.
3. `agroscope-reckenholz`: arable trial fields next to clear 3D farm buildings, swissALTI3D.
4. `hokudai-farm`: large rectangular fields, sharp 3D, cold-climate contrast.
5. `uiuc-south-farms`: Corn Belt plots, USGS 3DEP 1 m; move the pin to the barns first.

## Reserves (researched, no data file yet)

Use one of these to replace a candidate that fails.

| id | name | country | approx lat, lon | why held back |
|---|---|---|---|---|
| rothamsted-harpenden | Rothamsted Farm, Rothamsted Research | England | 51.80917, -0.35528 (Wikipedia mirror; DEIMS centroid 51.804, -0.372) | About 410 km from Wageningen. EA LIDAR Composite DTM (OGL) at https://environment.data.gov.uk/dataset/ce8fe7e7-bed0-4889-8825-19b042e128d2. Strong swap if Wageningen fails. Source: https://www.rothamsted.ac.uk/facilities-and-resources/our-farms |
| inrae-versailles | INRAE UE Versailles-Saclay | France | 48.81, 2.09 TODO(verify) | About 340 km from Rothamsted and 490 km from Zürich. IGN LiDAR HD (Etalab 2.0) and RPG parcels. Source: https://www.inrae.fr/en/centres/ile-france-versailles-saclay |
| teagasc-oak-park | Teagasc Oak Park | Ireland | 52.86, -6.91 TODO(verify) | Expected 3D only medium. Irish lidar coverage of the site is patchy. |
| isu-aea-farm | Iowa State Agronomy/Ag Engineering farm | USA | 42.011, -93.770 TODO(verify) | About 470 km from Urbana |
| wsu-cook-farm | WSU R.J. Cook Agronomy Farm | USA | 46.781, -117.082 TODO(verify) | About 480 km from UBC. Small town. Palouse hills are good for erosion. |
| cimmyt-obregon | CIMMYT CENEB, Cd. Obregón | Mexico | 27.4283, -109.8481 (cgiar.org) | Spare Mexico site, mid-size city |
| tum-duernast | TUM Versuchsstation Dürnast | Germany | 48.41, 11.69 TODO(verify) | About 250 km from Reckenholz |
| uq-gatton / csu-wagga | UQ Gatton, CSU Wagga Wagga | Australia | -27.55, 152.34 / -35.06, 147.35 TODO(verify) | Rural. Spare Australian sites. |
| lincoln-ashley-dene | Lincoln University Ashley Dene | New Zealand | -43.65, 172.33 TODO(verify) | Rural. Lincoln main campus would have better 3D. |
| ama-chianti | Tuscany vineyard estate (private, area only) | Italy | 43.43, 11.38 TODO(verify) | Private, hilly and rural. Expected 3D low to medium. |
| mate-godollo | MATE Gödöllő campus farm | Hungary | 47.59, 19.37 TODO(verify) | Thin official page. Demo farm is under construction. |
| uf-psreu-citra | UF/IFAS Plant Science Unit, Citra | USA | 29.41, -82.17 TODO(verify) | Rural. UF campus farms in Gainesville would be better. |

## Rejected before the 3D check

| candidate | reason |
|---|---|
| Lancaster County / Intercourse PA | Removed from the app by request (2026-11-14) |
| AAFC Central Experimental Farm, Ottawa; Guelph | Within about 370 km of Cornell |
| CSIRO Ginninderra, Canberra | Agricultural research ended in 2021 and the land is being rezoned (https://ginninderraproject.csiro.au/?p=3964) |
| China Agricultural University, Shangzhuang | Google tiles and basemaps in China are poor, with GCJ-02 offsets. No official station page found. |
| RDA Jeonju, Korea | Korean map-data export limits make Google 3D likely limited |
| ARO Volcani Center, Israel | No official source URL found |
| Kasetsart Kamphaeng Saen, Thailand; Haymana, Turkey; INRA Marchouch, Morocco; FOHCREC Kade, Ghana | Rural, so Google 3D expected to be low |
| IAV Hassan II Rabat; Cairo University Giza | No on-campus farm confirmed, or the farm location could not be placed |
| Embrapa Cerrados; CATIE Turrialba; Uruguay INIA | Rural or too close to another pick, so Google 3D expected low |
| SLU Lövsta, Uppsala | About 400 km from Helsinki. DEM licence is unclear. |
| Hutton Balruddery, Scotland | Rural, and close to the other north-west Europe sites |

## Datasets (as stated in search results; check each licence on its page)

The machine list is `CANDIDATE_DATASETS` in `apps/web/lib/farms/candidates/index.ts`. The Methods page shows the datasets of pinned candidates only.

| dataset | URL | licence |
|---|---|---|
| USGS 3DEP 1 m DEM | https://catalog.data.gov/dataset/usgs-1-meter-digital-elevation-model | Public domain (USGS) |
| CanElevation HRDEM | https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995 | Open Government Licence - Canada (version TODO(verify)) |
| Copernicus DEM GLO-30 | https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf | Free, source notice required |
| AHN4 | https://developers.google.com/earth-engine/datasets/catalog/AHN_AHN4 (secondary; ahn.nl TODO(verify)) | CC0 |
| BRP Gewaspercelen | https://api.pdok.nl/rvo/gewaspercelen/ogc/v1/collections/brpgewas | CC0 |
| swissALTI3D | https://opendata.swiss/fr/dataset/swissalti3d | Swiss OGD, cite swisstopo |
| NLS Finland 2 m | https://maanmittauslaitos.fi/en/node/10715 | CC BY 4.0 TODO(verify) |
| GUGiK NMT | https://www.geoportal.gov.pl/en/dane/numeryczny-model-terenu | Free, any use TODO(verify) |
| CNIG MDT05 / PNOA-LiDAR | https://inspire-geoportal.ec.europa.eu/srv/api/records/spaignMDT05 | CC BY 4.0 |
| MAFF fude polygons | https://www.maff.go.jp/j/tokei/porigon/index.html | MAFF terms TODO(verify) |
| Geoscience Australia ELVIS | https://www.ga.gov.au/scientific-topics/national-location-information/digital-elevation-data | CC BY 4.0, per dataset |
| LINZ lidar DEMs | https://www.linz.govt.nz/products-services/data/licensing-and-using-data/attributing-elevation-or-aerial-imagery-data | CC BY 4.0, licensor per layer |
| OpenStreetMap | https://www.openstreetmap.org/copyright | ODbL 1.0 |
| NASA POWER | https://power.larc.nasa.gov/docs/services/api/ | Already on the Methods page (citation wording TODO(verify)) |
