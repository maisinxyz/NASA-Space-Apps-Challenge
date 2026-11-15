"""Build curated-site seed data and the v1.1 feature fixtures (Backend A). Deterministic. `make seed`.

1. data/seed/<site>/power_daily.json.gz  : NASA POWER daily payload (from data/cache/weather, else fetched)
2. data/seed/<site>/soil.json            : SoilGrids 2.0 point query + 0-30 cm summary (cache: data/cache/soil)
   Each gets a <name>.meta.json sidecar.
3. packages/contracts/fixtures/{features,hazard_calendar,hazards,zones}/*.json from the real pipeline
4. packages/contracts/schemas/feature_table.schema.json (bundled from openapi.yaml)

With OFFLINE=1 it only rebuilds 3 and 4 from existing seeds.
"""

from __future__ import annotations

import gzip
import json
import os
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

import yaml  # noqa: E402

from app.features import config as C  # noqa: E402
from app.features import pipeline as P  # noqa: E402
from app.features import seeds  # noqa: E402
from app.services import features as F  # noqa: E402
from app.weather import power  # noqa: E402

FIX = ROOT / "packages" / "contracts" / "fixtures"
CACHE = ROOT / "data" / "cache"
TODAY = date.today().isoformat()
LIMITED_EXAMPLE = ("site_explore_pirque", -33.637, -70.575)  # apps/web/lib/farms/candidates/pirque-vineyards.ts


def dump(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def power_payload(lat: float, lon: float) -> dict:
    start, end = C.PERIOD
    cached = CACHE / "weather" / f"{lat:.3f}_{lon:.3f}_{start:%Y%m%d}_{end:%Y%m%d}.json"
    if not cached.is_file():
        power.get_daily(lat, lon, start, end)  # writes the cache file
    return json.loads(cached.read_text(encoding="utf-8"))


def seed_power(site: str, lat: float, lon: float, coord_note: str = "") -> None:
    payload = power_payload(lat, lon)
    out = seeds.SEED_DIR / site / seeds.POWER_FILE
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as raw, gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as gz:  # mtime=0: byte-stable
        gz.write(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode())
    api = payload["header"].get("api", {})
    note = f" {coord_note}" if coord_note else ""
    dump(seeds.sidecar_path(out), {
        "source_name": "NASA POWER daily point API, community AG",
        "source_url": C.POWER_SOURCE["url"],
        "product_version": f"{api.get('name', 'POWER API')} {api.get('version', '')}".strip(),
        "retrieved_on": TODAY,
        "license": C.POWER_SOURCE["license"],
        "attribution": C.POWER_SOURCE["attribution"],
        "resolution_spatial": "0.5 x 0.625 degree (MERRA-2 meteorology)",
        "resolution_temporal": "daily",
        "processing_notes": (
            f"Unmodified API response for {lat:.3f}, {lon:.3f}, {C.PERIOD[0]} to {C.PERIOD[1]}; "
            f"parameters {', '.join(power.PARAMETERS)}. Fill value -999 becomes missing.{note}"
        ),
    })


def seed_soil(site: str, lat: float, lon: float) -> None:
    cached = CACHE / "soil" / f"soil_{site}.json"
    params = [("lon", lon), ("lat", lat), *(("property", p) for p in ("clay", "sand", "silt", "soc", "phh2o")),
              *(("depth", d) for d in seeds.SOIL_DEPTHS), ("value", "mean")]
    if not cached.is_file():
        with urlopen(f"{C.SOILGRIDS_QUERY_URL}?{urlencode(params)}", timeout=240) as r:
            cached.parent.mkdir(parents=True, exist_ok=True)
            cached.write_bytes(r.read())
    raw = json.loads(cached.read_text(encoding="utf-8"))
    raw.pop("query_time_s", None)  # varies per call
    out = seeds.SEED_DIR / site / seeds.SOIL_FILE
    try:
        summary = seeds.soil_summary(raw)
        summary_note = ""
    except KeyError:
        # A point query can return null means (no prediction in that cell). Do not invent a texture.
        summary = None
        summary_note = " Point query returned null means for the requested properties and depths; summary is null and no texture class was assigned."
    dump(out, {"query": dict(params[:2]), "summary": summary, "soilgrids": raw})
    dump(seeds.sidecar_path(out), {
        "source_name": "SoilGrids 2.0 REST point query (ISRIC)",
        "source_url": C.SOILGRIDS_QUERY_URL,
        "product_version": "SoilGrids 2.0",
        "retrieved_on": TODAY,
        "license": C.SOILGRIDS_SOURCE["license"],
        "attribution": C.SOILGRIDS_SOURCE["attribution"],
        "resolution_spatial": "250 m",
        "resolution_temporal": "static",
        "processing_notes": "Mean of clay, sand, silt, soc, phh2o at 0-5, 5-15, 15-30 cm; depth-weighted to 0-30 cm and divided by the response d_factor. USDA texture class; infiltration class mapping assumed (TODO(verify))." + summary_note,
    })


def bundled_schema(name: str) -> dict:
    spec = yaml.safe_load((ROOT / "packages" / "contracts" / "openapi.yaml").read_text(encoding="utf-8"))
    text = json.dumps(spec["components"]["schemas"]).replace("#/components/schemas/", "#/$defs/")
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "$id": f"urn:stardew-earth:{name}",
            "title": name, "description": "Generated from packages/contracts/openapi.yaml by scripts/build_seed.py. Do not edit.",
            "$ref": f"#/$defs/{name}", "$defs": json.loads(text)}


def selected_sites() -> dict[str, dict]:
    """SEED_SITES=site_ubc_farm limits the fetch. Default remains every curated site."""
    raw = os.getenv("SEED_SITES", "").strip()
    if not raw:
        return C.CURATED_SITES
    wanted = [part.strip() for part in raw.split(",") if part.strip()]
    missing = [site for site in wanted if site not in C.CURATED_SITES]
    if missing:
        raise SystemExit(f"unknown SEED_SITES: {', '.join(missing)}")
    return {site: C.CURATED_SITES[site] for site in wanted}


def main() -> None:
    offline = os.getenv("OFFLINE") == "1"
    sites = selected_sites()
    if not offline:
        for site, s in sites.items():
            seed_power(site, s["lat"], s["lon"], s.get("coord_note", ""))
            seed_soil(site, s["lat"], s["lon"])
    F.base.cache_clear()
    problems = seeds.sidecar_problems()
    assert not problems, problems

    filtered = bool(os.getenv("SEED_SITES", "").strip())
    full = "site_usda_barc"
    if not filtered or full in sites:
        dump(FIX / "features" / f"{full}.json", F.feature_table(full))
        dump(FIX / "hazard_calendar" / f"{full}.json", F.hazard_calendar(full))
        dump(FIX / "hazard_calendar" / f"{full}_drier_summers.json", F.hazard_calendar(full, "drier_summers"))
        dump(FIX / "hazards" / f"{full}.json", F.hazard_catalog(full))
        dump(FIX / "zones" / "site_kpu_langley.json", F.zones("site_kpu_langley"))

    # Feature-table fixture for every selected site that already has one, and for
    # any site named in SEED_SITES. A full rebuild does not invent a new fixture
    # for a site that never had one. Beltsville is written in the block above.
    for site in sites:
        if site == full:
            continue
        fixture = FIX / "features" / f"{site}.json"
        if not filtered and not fixture.is_file():
            continue
        if seeds.load_power(site):
            dump(fixture, F.feature_table(site))

    if not filtered:
        sid, lat, lon = LIMITED_EXAMPLE
        if offline:
            os.environ["OFFLINE"] = "1"
        res = power._validate(power_payload(lat, lon)) if not offline else power.get_daily(lat, lon, *C.PERIOD)
        b = (P.daily_from_power(res, lat), "cached", None, {"lat": lat, "lon": lon})
        dump(FIX / "features" / f"{sid}.json", F.build_table(sid, b, P.compute(b[0], P.resolve_scenario())))
        dump(ROOT / "packages" / "contracts" / "schemas" / "feature_table.schema.json", bundled_schema("FeatureTable"))
    print("seed + v1.1 fixtures written")


if __name__ == "__main__":
    main()
