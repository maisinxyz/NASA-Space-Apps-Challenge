# Farm scouting: candidates for new pins (2026-11-14)

> **NOT VALIDATED. Every candidate needs a 3D check and a visual check by a person before it gets a pin.**
> The scouting session could not render Google Photorealistic 3D Tiles. Its network policy refused the connections to `api.cesium.com` and `assets.ion.cesium.com`: the proxy answered `CONNECT` with 403. In headless Chromium, `/dev/farms-check` loaded with WebGL working, but fell back to tier C ("Tier C · surface base"), with `api.cesium.com net::ERR_TUNNEL_CONNECTION_FAILED`.
> Two access routes were tried, the direct proxy (curl) and the app viewer in headless Chromium with SwiftShader. Both failed.
> Overpass (`overpass-api.de`, `overpass.kumi.systems`), `openstreetmap.org`, `power.larc.nasa.gov`, `developers.google.com` and `en.wikipedia.org` were also blocked. As a result:
> - **No stage-1 numbers and no screenshots exist.** Nothing below is a measured 3D verdict.
> - **No candidate is on the public home globe.** They sit in `apps/web/lib/farms/candidates/` with `validation: "not-validated"`.
> - **Research came from web search result snippets only.** Coordinates from memory are marked TODO(verify). Licences are as stated in search results and still need checking on their pages.

## Google Map Tiles policy (read via search, not the page itself)

The policy page https://developers.google.com/maps/documentation/tile/policies could not be opened (DNS blocked). Search snippets of it and its translations say:
- No unauthorized caching, data extraction or offline use.
- Your own 3D objects may sit over the tiles if they are not "extracted, traced, or otherwise derived" from Photorealistic 3D Tiles.
- Attribution must be collected and shown.

What the check does under these rules:
- `/dev/farms-check` only streams tiles into the app's own Cesium viewer. It stores nothing and writes no files. Its only output is summary numbers that a person copies by hand.
- **Open question for the team (TODO(verify) on the full page):** the check samples tile heights to count 3D buildings. That is a transient measurement for QA and nothing is kept. It could still count as "derived" content. Read the full policy before publishing those numbers. If the policy forbids it, use screenshots only and drop the numeric columns.
- The existing `/dev/trace` (field outlines traced on Google tiles) raises the same "traced" question.

## How to validate (team, about 20 to 30 min)

1. Copy `apps/web/team-test.env` to `apps/web/.env.local`, then run `corepack pnpm dev` in `apps/web`.
2. Open http://localhost:3000/dev/farms-check and check that the status line says **Tier A · surface google**.
3. Press **Run all**. Cornell runs first as the known-3D control. For each site the viewer flies in, shows an oblique view (pitch -30°, 350 m) and a top-down view (pitch -89°, 1000 m) for 5 s each, and then prints these numbers:
   - **bldgs:** OSM building footprints within 600 m of the pin, nearest 60, fetched from the public Overpass API.
   - **3D (local):** share of buildings whose tileset height at the centroid is at least 3 m above the lowest tileset height on a ring 8 m outside the footprint.
   - **3D (terrain):** the same, measured against Cesium World Terrain.
   - **median:** median roof height above the local ground.
   - **min err:** smallest geometric error of a visible Google tile within 300 m of the centre. This is the detail proxy: smaller means sharper.
   - **open 3D:** flat control. It samples grid points at least 40 m from any building, so it should stay low. Trees raise it.
4. **Check the method first.** Cornell should show 3D (local) well above 50 % with a median of 4 m or more. Open-ground values should stay low. If they don't, the numbers can't be trusted: fall back to screenshots.
5. Apply the stage-2 rules from the routine prompt:
   - Drop any site where most buildings are flat (median near 0) or the min err is coarse compared with Cornell.
   - For each survivor, look at the oblique and top-down views. Mark PASS (3D buildings, no melted mesh, sharp texture), WEAK or FAIL.
   - Optional: save one oblique screenshot per farm as `docs/farm-scouting/<id>-oblique.png`, about 1280 px wide and under 400 KB.
6. Press **Copy markdown** and paste the table under "Stage-1 results" below. Then set `validation: "pass"` in each passing farm file in `apps/web/lib/farms/candidates/`.
   - A passing farm becomes a pin automatically (`FARMS` in `lib/farms/index.ts`).
   - Its datasets appear on the Methods page automatically.
   - The test `candidates.test.ts` keeps pins at least 500 km apart.
7. Before setting a farm to pass, also do these:
   - Move the pin onto the main building cluster in `/dev/trace` (Copy framing gives `Farm.framing`).
   - Correct `lat`/`lon` from OpenStreetMap or the source page.
   - Keep `coordsVerified: false` unless the source publishes coordinates.

## Ranked candidates (27 data files, all NOT VALIDATED)

Ranking puts expected Google 3D first (dense city or campus setting), then open-data quality, then spread. "Expected" is an estimate from public sources and was not measured.

All 27 are spread out: every candidate is at least 500 km from every other candidate and from Cornell, Beltsville and Napa. The closest pair is Wageningen and Reckenholz, about 547 km apart. NASA POWER daily data is global, so it is listed as available for every site. It was not fetched (the POWER host is blocked here).

| rank | id | name | country | approx lat, lon | why chosen | stage-1 numbers | 3D verdict | screenshots | data potential (elevation; POWER; field boundaries) | risks | privacy | recommended tier |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `wur-unifarm` | Unifarm, Wageningen University & Research | Netherlands | 51.99, 5.66 TODO(verify) (memory) | University research farm next to campus; best open data (0.5 m lidar, crop parcels) | not run | NOT VALIDATED (expected high) | none | AHN4 0.5 m lidar, CC0; POWER yes; BRP Gewaspercelen (CC0) | About 410 km from Rothamsted (reserve), coordinates from memory | public institution | explore-only |
| 2 | `agroscope-reckenholz` | Agroscope Reckenholz research station | Switzerland | 47.43, 8.52 TODO(verify) (memory) | Federal arable research station inside the city of Zurich | not run | NOT VALIDATED (expected high) | none | swissALTI3D, Swiss OGD (cite swisstopo), https://opendata.swiss/fr/dataset/swissalti3d; POWER yes; OSM landuse (ODbL), Overpass not checked | Fenced protected trial site is part of the station: frame away from it | public institution | explore-only |
| 3 | `helsinki-viikki` | Viikki Research Farm, University of Helsinki | Finland | 60.23, 25.02 TODO(verify) (memory) | 155 ha of fields inside a capital city; boreal climate | not run | NOT VALIDATED (expected high) | none | NLS Finland 2 m, CC BY 4.0 TODO(verify); POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates from memory | public institution | explore-only |
| 4 | `ubc-farm` | UBC Farm, University of British Columbia | Canada | 49.251, -123.238 TODO(verify) (memory) | 20 to 24 ha teaching farm inside a major city; dense Google 3D expected | not run | NOT VALIDATED (expected high) | none | CanElevation HRDEM, OGL-Canada, https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995; POWER yes; OSM landuse (ODbL), Overpass not checked | Small fields; mixed vegetables rather than field crops | public institution | explore-only |
| 5 | `utokyo-isas` | Institute for Sustainable Agro-ecosystem Services (ISAS), University of Tokyo | Japan | 35.74, 139.54 TODO(verify) (memory) | 30 ha of fields and paddy inside the Tokyo urban area | not run | NOT VALIDATED (expected high) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; MAFF fude polygons (terms TODO(verify)) | Small fields; GSI 5 m DEM terms not yet verified, so global DEM listed | public institution | explore-only |
| 6 | `hokudai-farm` | Experiment Farm, Hokkaido University | Japan | 43.075, 141.335 TODO(verify) (memory) | 58 ha city-campus farm dating from 1876; cold humid climate | not run | NOT VALIDATED (expected high) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; MAFF fude polygons (terms TODO(verify)) | GSI 5 m DEM terms not yet verified, so global DEM listed | public institution | explore-only |
| 7 | `waite-adelaide` | Waite Campus, University of Adelaide | Australia | -34.97, 138.63 TODO(verify) (memory) | 184 ha research campus with vineyards in Adelaide's suburbs; Mediterranean climate | not run | NOT VALIDATED (expected high) | none | GA ELVIS lidar, CC BY 4.0 (per dataset); POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates from memory | public institution | explore-only |
| 8 | `uiuc-south-farms` | South Farms, University of Illinois Urbana-Champaign | United States | 40.08, -88.225 TODO(verify) (memory) | Research farms on the edge of a large campus, many barns; Corn Belt maize-soybean | not run | NOT VALIDATED (expected high) | none | USGS 3DEP 1 m, public domain, https://catalog.data.gov/dataset/usgs-1-meter-digital-elevation-model; POWER yes; OSM landuse (ODbL), Overpass not checked | Point is the South Farms area, not a specific building | public institution | explore-only |
| 9 | `iari-pusa` | ICAR-IARI Pusa campus fields | India | 28.64, 77.16 TODO(verify) (memory) | About 500 ha of research fields in central Delhi; monsoon climate, rice-wheat | not run | NOT VALIDATED (expected high) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Source is a government compendium, not the institute's own page | public institution | explore-only |
| 10 | `cimmyt-el-batan` | CIMMYT headquarters and El Batán experimental station | Mexico | 19.52957, -98.8532 (src: https://www.cgiar.org/locations/mexico-cimmyt-texcoco-la-redonda-experimental-station) | Clear HQ building cluster with trial plots in the Mexico City metro; highland maize and wheat | not run | NOT VALIDATED (expected high) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | CGIAR lists a second La Redonda point 15 km east | public institution | explore-only |
| 11 | `cip-la-molina` | International Potato Center (CIP) headquarters fields | Peru | -12.07694, -76.94611 (src: Wikipedia (International Potato Center article)) | Fields inside the Lima metro; coastal desert, irrigated | not run | NOT VALIDATED (expected high) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | NASA POWER grid cell is coarse for the coastal desert; small plots | public institution | explore-only |
| 12 | `inta-castelar` | INTA Castelar research centre (CNIA) | Argentina | -34.607, -58.668 TODO(verify) (memory) | Pampas research station inside the Buenos Aires metro | not run | NOT VALIDATED (expected high) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Press reports (2025-26) of land sales and transfers at the site | public institution | explore-only |
| 13 | `up-hatfield` | Hatfield Experimental Farm (Innovation Africa@UP), University of Pretoria | South Africa | -25.75, 28.258 TODO(verify) (memory) | Urban experimental farm next to campus (dairy, field trials) in a large city | not run | NOT VALIDATED (expected high) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Part of the farm is being built on (Future Africa campus) | public institution | explore-only |
| 14 | `esalq-piracicaba` | ESALQ/USP Luiz de Queiroz campus farms | Brazil | -22.711, -47.631 TODO(verify) (memory) | Historic agricultural campus inside a city; sugarcane, soybean, maize | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Point is the campus; Fazenda Areao location unverified | public institution | explore-only |
| 15 | `imidra-encin` | Finca El Encin, IMIDRA | Spain | 40.52, -3.29 TODO(verify) (memory) | Regional research farm with vineyard and field crops near Madrid; semi-arid Mediterranean | not run | NOT VALIDATED (expected med) | none | CNIG MDT05 (PNOA-LiDAR), CC BY 4.0; POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates need care | public institution | explore-only |
| 16 | `sggw-skierniewice` | Experimental Station in Skierniewice, Warsaw University of Life Sciences (SGGW) | Poland | 51.96, 20.16 TODO(verify) (memory) | Long-term fertilisation trials since 1921 in a mid-size town; continental climate | not run | NOT VALIDATED (expected med) | none | GUGiK NMT 1 m, free use TODO(verify); POWER yes; OSM landuse (ODbL), Overpass not checked | Mid-size town: Google 3D may be thinner | public institution | explore-only |
| 17 | `massey-dairy1` | Dairy Farm 1, Massey University | New Zealand | -40.38, 175.62 TODO(verify) (memory) | 142 ha farm inside the city boundary on the Manawatu River (flood relevance) | not run | NOT VALIDATED (expected med) | none | LINZ lidar DEM, CC BY 4.0; POWER yes; OSM landuse (ODbL), Overpass not checked | Pasture (dairy), not arable rotations | public institution | explore-only |
| 18 | `tamu-research-farm` | Texas A&M AgriLife Research Farm, Brazos River bottom | United States | 30.545, -96.43 TODO(verify) (memory) | Large irrigated research farm SW of College Station; hot humid climate | not run | NOT VALIDATED (expected med) | none | USGS 3DEP 1 m, public domain, https://catalog.data.gov/dataset/usgs-1-meter-digital-elevation-model; POWER yes; OSM landuse (ODbL), Overpass not checked | HQ point uncertain; farm is outside the city | public institution | explore-only |
| 19 | `aafc-saskatoon` | Saskatoon Research Farm, Agriculture and Agri-Food Canada | Canada | 52.158512, -106.580521 (src: https://www.tbs-sct.gc.ca/fcsi-rscf/fsi-isf/00001375-eng.aspx) | Prairie grain research farm on the city edge; cold semi-arid climate | not run | NOT VALIDATED (expected med) | none | CanElevation HRDEM, OGL-Canada, https://open.canada.ca/data/en/dataset/957782bf-847c-4644-a757-e383c0057995; POWER yes; OSM landuse (ODbL), Overpass not checked | Point is the federal property record, not a confirmed building | public institution | explore-only |
| 20 | `su-welgevallen` | Welgevallen Experimental Farm, Stellenbosch University | South Africa | -33.942, 18.867 TODO(verify) (memory) | Experimental farm with vineyards next to campus in a town; Mediterranean climate | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Small plots; coordinates from memory | public institution | explore-only |
| 21 | `pirque-vineyards` | Vineyard estates near Pirque, Santiago Metropolitan Region | Chile | -33.637, -70.575 TODO(verify) (memory) | Large vineyard estates with clear winery buildings on the edge of Santiago, Andes foothills | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Private company land: area only, no owner named; source page is the estate's own visitor blog | private, area only | explore-only |
| 22 | `ilri-nairobi` | ILRI Nairobi campus | Kenya | -1.2699, 36.7258 (src: https://www.cgiar.org/node/986) | Large campus with paddocks inside Nairobi; equatorial highland, two rainy seasons | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Mostly livestock and pasture, few crop rotations | public institution | explore-only |
| 23 | `ilri-addis` | ILRI Addis Ababa campus | Ethiopia | 9.0163, 38.8143 (src: https://www.cgiar.org/locations/ethiopia-ilri-addis-ababa-campus) | 34 ha urban research campus; Ethiopian highland climate | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Few fields on campus | public institution | explore-only |
| 24 | `iita-ibadan` | IITA headquarters research farm | Nigeria | 7.4962, 3.9076 (src: https://www.cgiar.org/locations/nigeria-iita-ibadan-campus) | About 1,000 ha research farm at a major city edge; humid tropics | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Google 3D in Nigeria uncertain | public institution | explore-only |
| 25 | `ciat-palmira` | Alliance Bioversity-CIAT Palmira campus | Colombia | 3.503, -76.356 TODO(verify) (memory) | Large research campus between Cali and Palmira; tropical valley fields | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates unverified; Google 3D in Colombia unknown | public institution | explore-only |
| 26 | `icrisat-patancheru` | ICRISAT headquarters farm | India | 17.51, 78.27 TODO(verify) (memory) | 1,390 ha semi-arid research farm on the Hyderabad edge | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | Coordinates from memory | public institution | explore-only |
| 27 | `irri-los-banos` | IRRI experimental farm | Philippines | 14.17, 121.25 TODO(verify) (memory) | 252 ha of rice paddies with a research campus; humid tropics | not run | NOT VALIDATED (expected med) | none | Copernicus GLO-30 (global, 30 m), Copernicus DEM licence; POWER yes; OSM landuse (ODbL), Overpass not checked | No official landing page found; source is the IRRI news blog | public institution | explore-only |

### Stage-1 results

Not run: Cesium ion and Google tiles were unreachable from the scouting sandbox. Paste the `/dev/farms-check` markdown here.

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
