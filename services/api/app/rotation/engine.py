"""Rotation engine (Backend B, backend rotation PRD §8, §10). Deterministic: no random numbers, stable tie-breaks.

A rotation is a list of slots `{year_index, season, crop_id}`. Each crop occupies the ground from its planting day to its
termination day (FAO-style day-of-year windows). A cash crop that overwinters (winter wheat) is harvested in its slot's
year; an overwintering cover crop is sown in its slot's year and ended the next spring. The cycle repeats.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import numpy as np

from app.rotation import config as R
from app.rotation import traits as T

D = 365
_WEEK = np.minimum(np.arange(D) // 7, 51)
_WAVG = np.zeros((D, 52))
_WAVG[np.arange(D), _WEEK] = 1
_WAVG /= _WAVG.sum(0)
_MONTH_START = np.cumsum([0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30])
_MONTH = np.searchsorted(_MONTH_START, np.arange(D), side="right") - 1  # 0..11 per day
_MAVG = np.zeros((D, 12))
_MAVG[np.arange(D), _MONTH] = 1
_MAVG /= _MAVG.sum(0)
_WEEK_MONTH = _MONTH[np.minimum(np.arange(52) * 7 + 3, D - 1)] + 1  # calendar month of each week's middle day


def week_mask(season: str, lat: float) -> np.ndarray:
    from app.features.pipeline import season_months

    return np.isin(_WEEK_MONTH, season_months(season, lat))


# ---------------------------------------------------------------- timelines
@dataclass(frozen=True)
class Occupant:
    crop_id: str
    start: int  # absolute day on the cycle timeline (may be negative = previous cycle)
    end: int


def _shifted(c: dict, shift: int) -> tuple[int, int]:
    w = c["season_window"]
    return (w["plant_doy"] - 1 + shift) % D, (w["terminate_doy"] - 1 + shift) % D


def occupants(slots: list[dict], shift: int = 0) -> list[Occupant]:
    lib = T.library()
    out = []
    for s in slots:
        if s["crop_id"] == "fallow":
            continue
        c = lib[s["crop_id"]]
        p, t = _shifted(c, shift)
        y = s["year_index"] - 1
        if t < p:  # overwinters
            start, end = ((y * D + p, (y + 1) * D + t) if c["cover_crop"] else ((y - 1) * D + p, y * D + t))
        else:
            start, end = y * D + p, y * D + t
        out.append(Occupant(s["crop_id"], start, end))
    return sorted(out, key=lambda o: (o.start, o.crop_id))


def timing_issues(occ: list[Occupant], years: int, cyclic: bool = True) -> list[str]:
    lib = T.library()
    issues = []
    pairs = list(zip(occ, occ[1:]))
    if cyclic and occ:
        pairs.append((occ[-1], Occupant(occ[0].crop_id, occ[0].start + years * D, occ[0].end + years * D)))
    for a, b in pairs:
        if b.start < a.end - R.SLACK_DAYS:
            issues.append(f"{lib[b.crop_id]['name']} would be planted before {lib[a.crop_id]['name']} is harvested.")
    return issues


@lru_cache(maxsize=256)
def _profile(crop_id: str) -> tuple[np.ndarray, np.ndarray]:
    """Daily (cover fraction, crop coefficient) over one season of the crop."""
    c = T.library()[crop_id]
    n = T.season_length(c)
    days = np.arange(n)
    pts = np.array(c["cover_curve"], float)
    cover = np.interp(days, pts[:, 0], pts[:, 1])
    k = c["kc_stages"]
    a, b, e = (round(f * n) for f in R.KC_STAGES)
    kc = np.interp(days, [0, a, b, e, n], [k["ini"], k["ini"], k["mid"], k["mid"], k["end"]])
    return cover, kc


@dataclass(frozen=True)
class Plan:
    slots: list[dict]
    years: int
    occ: list[Occupant]
    cover: np.ndarray  # (years, 365) daily cover 0-1
    kc: np.ndarray  # (years, 365) daily crop coefficient, 0 when nothing grows
    perennial: np.ndarray  # (years, 365) bool
    issues: list[str]

    @property
    def cover_w(self) -> np.ndarray:
        return self.cover @ _WAVG

    @property
    def kc_w(self) -> np.ndarray:
        return self.kc @ _WAVG


def build(slots: list[dict], shift: int = 0) -> Plan:
    years = max(s["year_index"] for s in slots)
    occ = occupants(slots, shift)
    n = years * D
    cover, kc, per = np.zeros(n), np.zeros(n), np.zeros(n, bool)
    lib = T.library()
    for o in occ:
        cv, k = _profile(o.crop_id)
        idx = (o.start + np.arange(min(o.end - o.start, cv.size))) % n
        np.maximum.at(cover, idx, cv[: idx.size])
        np.maximum.at(kc, idx, k[: idx.size])
        if lib[o.crop_id]["perennial"]:
            per[idx] = True
    return Plan(slots, years, occ, cover.reshape(years, D), kc.reshape(years, D), per.reshape(years, D), timing_issues(occ, years))


def cover_calendar(p: Plan) -> dict:
    return {
        "days_bare_per_year": [int(x) for x in (p.cover < R.BARE_COVER).sum(1)],
        "monthly_cover": [[round(float(x), 2) for x in row] for row in p.cover @ _MAVG],
    }


# ---------------------------------------------------------------- the seven raw criteria (PRD §8.4)
def trait_raw(p: Plan, no_local_market: bool) -> dict[str, float]:
    lib = T.library()
    crops = [lib[o.crop_id] for o in p.occ]
    cash = [c for c in crops if not c["cover_crop"]]
    covers = [c for c in crops if c["cover_crop"]]
    mean = lambda xs: float(np.mean(xs)) if xs else 0.0  # noqa: E731
    legume = mean([c["n_fixing"] for c in crops])
    residue = mean([R.RESIDUE[c["residue_class"]] for c in crops])
    cover_share = min(1.0, len(covers) / p.years)
    perennial = float(p.perennial.mean())

    cash_occ = [o for o in p.occ if not lib[o.crop_id]["cover_crop"]]
    fams = [lib[o.crop_id]["family"] for o in cash_occ]
    pairs = set()
    for i in range(len(cash_occ)):
        for step in (1, 2):
            j = (i + step) % len(cash_occ)
            a, b = cash_occ[i].crop_id, cash_occ[j].crop_id
            if j != i and fams[i] == fams[j] and not (a == b and lib[a]["perennial"]):
                pairs.add(tuple(sorted((i, j))))
    pest = len(set(fams)) / p.years - R.PEST_PENALTY * len(pairs)

    market = mean([0.0 if (no_local_market and c["market_dependent"]) else R.MARKET[c["market_rating"]] for c in cash])
    forage = mean([c["forage_suitable"] for c in cash]) + 0.5 * min(1.0, sum(c["forage_suitable"] for c in covers) / p.years)
    return {
        "nutrient_cycling": 0.5 * legume + 0.3 * residue + 0.2 * cover_share,
        "organic_matter": 0.5 * residue + 0.3 * cover_share + 0.2 * perennial,
        "pest_disruption": pest,
        "forage_potential": forage,
        "market_suitability": market,
        "_legume_share": legume, "_mean_residue": residue, "_cover_share": cover_share, "_perennial_share": perennial,
        "_distinct_families": len(set(fams)), "_same_family_pairs": len(pairs),
    }


@dataclass(frozen=True)
class Climate:
    et0: np.ndarray  # (52,) mm
    rain: np.ndarray  # (52,) mm
    xr: np.ndarray  # (52,) share of years with an extreme-rain day (or 0/1 for one year)
    dry: np.ndarray  # (52,) dry-spell share (or 0/1)


def climate_raw(p: Plan, cl: Climate, infiltration: str, terrain_factor: float, lat: float) -> dict[str, float]:
    kc, bare = p.kc_w, (p.cover_w < R.BARE_COVER).astype(float)
    deficit = np.clip(kc * cl.et0 - R.RAIN_RETAINED[infiltration] * cl.rain * (kc > 0), 0, None)
    erosion = (bare * (1 + R.HEAVY_RAIN_WEIGHT_K * cl.xr)).sum() * terrain_factor * R.INFILTRATION_FACTOR[infiltration]
    win, summ = week_mask("winter", lat), week_mask("summer", lat)
    return {
        "water_use": float(deficit.sum() / p.years),
        "erosion_risk": float(erosion / p.years),
        "_exposure_winter": float((bare[:, win] * cl.xr[win]).mean()),
        "_exposure_summer": float((kc[:, summ] * cl.dry[summ]).mean()),
        "_bare_weeks": float(bare.sum() / p.years),
    }


def normalize(raw: list[float], lower_is_better: bool) -> list[float]:
    """Min-max to 0-100 across the rotations; higher is always better; all equal -> 50 each."""
    lo, hi = min(raw), max(raw)
    if hi - lo < 1e-9:
        return [50.0] * len(raw)
    return [100 * ((hi - x) if lower_is_better else (x - lo)) / (hi - lo) for x in raw]


# ---------------------------------------------------------------- generator (PRD §8.3)
def _slots(seq: tuple[tuple[str, str], ...]) -> list[dict]:
    lib = T.library()
    out = []
    for y, (m, o) in enumerate(seq, 1):
        out.append({"year_index": y, "season": T.plant_season(lib[m]["season_window"]["plant_doy"]) if m != "fallow" else "spring", "crop_id": m})
        out.append({"year_index": y, "season": T.plant_season(lib[o]["season_window"]["plant_doy"]) if o != "fallow" else "winter", "crop_id": o})
    return out


def _as_seq(slots: list[dict]) -> tuple | None:
    """Existing slots as (main, off) pairs per year when they have that shape, else None."""
    lib = T.library()
    years = max(s["year_index"] for s in slots)
    seq = []
    for y in range(1, years + 1):
        ys = [s["crop_id"] for s in slots if s["year_index"] == y]
        mains = [c for c in ys if c != "fallow" and not lib[c]["cover_crop"]]
        offs = [c for c in ys if c != "fallow" and lib[c]["cover_crop"]]
        if len(mains) > 1 or len(offs) > 1:
            return None
        seq.append((mains[0] if mains else "fallow", offs[0] if offs else "fallow"))
    return tuple(seq)


def _canonical(seq: tuple) -> tuple:
    return min(seq[k:] + seq[:k] for k in range(len(seq)))


def candidate_pools(allowed: list[str], constraints: dict) -> tuple[list[str], list[str], dict[str, list[str]]]:
    lib = T.library()
    removed: dict[str, list[str]] = {}
    keep = []
    for cid in sorted(allowed):
        c = lib[cid]
        why = [k for k, bad in (("low_water", c["water_need_class"] == "high"),
                               ("no_specialty_equipment", c["needs_specialty_equipment"]),
                               ("no_local_market", c["market_dependent"])) if constraints.get(k) and bad]
        if why:
            for k in why:
                removed.setdefault(k, []).append(cid)
        else:
            keep.append(cid)
    return [c for c in keep if not lib[c]["cover_crop"]], [c for c in keep if lib[c]["cover_crop"]], removed


def cyclic_family_ok(mains: list[str]) -> bool:
    """No same family in consecutive years around the cycle, except one perennial kept up to MAX_PERENNIAL_YEARS."""
    lib = T.library()
    n = len(mains)
    for i in range(n):
        a, b = mains[i], mains[(i + 1) % n]
        if a == "fallow" or b == "fallow" or lib[a]["family"] != lib[b]["family"]:
            continue
        if not (a == b and lib[a]["perennial"]):
            return False
    for m in set(mains):
        if m != "fallow" and lib[m]["perennial"]:
            run = best = 0
            for x in mains + mains:
                run = run + 1 if x == m else 0
                best = max(best, run)
            if min(best, n) > R.MAX_PERENNIAL_YEARS:
                return False
    return True


def generate(years: int, mains: list[str], covers: list[str], exclude: tuple | None, shift: int) -> list[tuple]:
    """Depth-first, crop id ascending, capped at CANDIDATE_CAP feasible cycles (one per cyclic shift)."""
    lib = T.library()
    offs = ["fallow"] + covers
    found: list[tuple] = []

    def ok_next(prev: str, m: str, seq: tuple) -> bool:
        if lib[prev]["family"] != lib[m]["family"]:
            return True
        if prev == m and lib[m]["perennial"]:
            run = 1
            for pm, _ in reversed(seq):
                if pm != m:
                    break
                run += 1
            return run <= R.MAX_PERENNIAL_YEARS
        return False

    def dfs(seq: tuple) -> None:
        if len(found) >= R.CANDIDATE_CAP:
            return
        if len(seq) == years:
            if years > 1 and not cyclic_family_ok([m for m, _ in seq]):
                return
            if seq != _canonical(seq) or seq == exclude:
                return
            if not timing_issues(occupants(_slots(seq), shift), years):
                found.append(seq)
            return
        for m in mains:
            if seq and not ok_next(seq[-1][0], m, seq):
                continue
            for o in offs:
                nxt = seq + ((m, o),)
                if not timing_issues(occupants(_slots(nxt), shift), years, cyclic=False):
                    dfs(nxt)
                if len(found) >= R.CANDIDATE_CAP:
                    return

    dfs(())
    return found
