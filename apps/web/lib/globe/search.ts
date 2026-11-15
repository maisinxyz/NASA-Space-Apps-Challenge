// Search for the globe's "Find a place" box: farms first, then bundled Natural Earth cities and countries
// (public/hero/places.json, built by scripts/build_globe_assets.py). No network geocoder, so it works offline.

export type Place = { kind: "city" | "country"; name: string; country: string; lat: number; lon: number; pop: number };
export type FarmLike = { id: string; name: string; country: string; locality?: string; lat: number; lon: number };
export type SearchHit =
  | { kind: "farm"; id: string; name: string; detail: string; lat: number; lon: number }
  | { kind: "city" | "country"; id: string; name: string; detail: string; lat: number; lon: number };

/** Lower case, accents removed, so "sao paulo" finds "São Paulo". */
export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** 0 = no match, higher is better: whole-name start beats word start beats anywhere. */
function score(name: string, q: string) {
  const n = normalize(name);
  if (n.startsWith(q)) return 3;
  if (n.split(/[\s,()-]+/).some((w) => w.startsWith(q))) return 2;
  return n.includes(q) ? 1 : 0;
}

export function searchPlaces(query: string, farms: FarmLike[], places: Place[], limit = 8): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const farmHits = farms
    .map((f) => ({ f, s: Math.max(score(f.name, q), score(f.locality ?? "", q), score(f.country, q) ? 1 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.f.name.localeCompare(b.f.name))
    .map(({ f }): SearchHit => ({ kind: "farm", id: f.id, name: f.name, detail: [f.locality, f.country].filter(Boolean).join(" · "), lat: f.lat, lon: f.lon }));
  const placeHits = places
    .map((p) => ({ p, s: score(p.name, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.p.pop - a.p.pop || a.p.name.localeCompare(b.p.name))
    .map(({ p }): SearchHit => ({ kind: p.kind, id: `${p.kind}:${p.name}:${p.country}`, name: p.name, detail: p.kind === "country" ? "Country" : p.country, lat: p.lat, lon: p.lon }));
  return [...farmHits, ...placeHits].slice(0, limit);
}
