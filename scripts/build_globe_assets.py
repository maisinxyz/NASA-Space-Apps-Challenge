"""Build the hero globe's static assets from Natural Earth (public domain, https://www.naturalearthdata.com/about/terms-of-use/).

Outputs (committed, so the hero works offline):
  apps/web/public/hero/earth/land-mask-4096.png  equirectangular land (255) / sea (0) mask, u=0 at -180 deg, v=0 at +90 deg
  apps/web/public/hero/places.json               major cities and countries for globe labels and search

Source GeoJSON: github.com/nvkelso/natural-earth-vector (geojson/), cached in data/cache/natural-earth/.
Run: uv run --project services/api python scripts/build_globe_assets.py
Deterministic: same inputs give byte-identical outputs.
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache" / "natural-earth"
WEB = ROOT / "apps" / "web" / "public" / "hero"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson"
W, H = 4096, 2048
SS = 2  # supersampling for smooth coastlines


def load(name: str) -> dict:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.geojson"
    if not path.exists():
        urllib.request.urlretrieve(f"{BASE}/{name}.geojson", path)
    return json.loads(path.read_text(encoding="utf-8"))


def polygons(geom: dict):
    if geom["type"] == "Polygon":
        yield geom["coordinates"]
    elif geom["type"] == "MultiPolygon":
        yield from geom["coordinates"]


def land_mask() -> None:
    w, h = W * SS, H * SS
    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    px = lambda lon, lat: ((lon + 180) / 360 * w, (90 - lat) / 180 * h)  # noqa: E731
    for f in load("ne_50m_land")["features"]:
        for rings in polygons(f["geometry"]):
            draw.polygon([px(x, y) for x, y in rings[0]], fill=255)
            for hole in rings[1:]:
                draw.polygon([px(x, y) for x, y in hole], fill=0)
    out = WEB / "earth" / "land-mask-4096.png"
    img.resize((W, H), Image.Resampling.BOX).save(out, optimize=True)
    print(out, out.stat().st_size)


def places() -> None:
    cities = []
    for f in load("ne_110m_populated_places_simple")["features"]:
        p = f["properties"]
        cities.append({"kind": "city", "name": p["name"], "country": p["adm0name"], "lat": round(p["latitude"], 3), "lon": round(p["longitude"], 3), "pop": int(p["pop_max"])})
    countries = []
    for f in load("ne_110m_admin_0_countries")["features"]:
        p = f["properties"]
        countries.append({"kind": "country", "name": p["NAME"], "country": p["NAME"], "lat": round(p["LABEL_Y"], 3), "lon": round(p["LABEL_X"], 3), "pop": int(p["POP_EST"])})
    rows = sorted(cities, key=lambda r: (-r["pop"], r["name"])) + sorted(countries, key=lambda r: r["name"])
    out = WEB / "places.json"
    doc = {"source": "Natural Earth 1:110m populated places (simple) and admin-0 countries, public domain", "places": rows}
    out.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(out, len(rows))


if __name__ == "__main__":
    land_mask()
    places()
