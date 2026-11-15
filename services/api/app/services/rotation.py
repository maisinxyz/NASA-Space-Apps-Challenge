"""Rotation analysis and exposure comparison (Backend B, backend rotation PRD §8-§10, §12.1, §13)."""

from __future__ import annotations

import hashlib
import json
from functools import lru_cache

import numpy as np

from app.core.errors import ApiError, not_found
from app.features import config as FC
from app.features import pipeline as P
from app.rotation import config as R
from app.rotation import engine as E
from app.rotation import evidence as EV
from app.rotation import traits as T
from app.services import features as F

IDS = ("rot_existing", "rot_alt_1", "rot_alt_2")
SEASON_ORDER = {"winter": 0, "spring": 1, "summer": 2, "fall": 3}


# ---------------------------------------------------------------- request (PRD §9)
def normalize(site_id: str, body: dict) -> tuple[dict, list[dict]]:
    lib = T.library()
    warnings: list[dict] = []

    def known(cid: str) -> None:
        if cid != "fallow" and cid not in lib:
            raise ApiError("UNKNOWN_CROP", f"Crop '{cid}' is not in the crop library.", "Choose crops from GET /crops.")

    allowed = body.get("allowed_crops") or sorted(lib)
    for cid in allowed:
        known(cid)
    existing = body.get("existing_rotation") or "preset"
    if existing != "preset":
        for s in existing:
            known(s["crop_id"])
        existing = sorted((dict(s) for s in existing), key=lambda s: (s["year_index"], SEASON_ORDER[s["season"]], s["crop_id"]))

    selected = [c for c in R.CRITERIA if c in (body.get("criteria_selected") or R.CRITERIA)]
    preset = body.get("weight_preset")
    if body.get("weights"):
        given = dict(body["weights"])
    elif preset:
        given = dict(R.WEIGHT_PRESETS[preset])
    else:
        given = {c: 1.0 for c in selected}
    ignored = sorted(set(given) - set(selected))
    if ignored and body.get("weights"):
        warnings.append({"code": "IGNORED_WEIGHT", "level": "warning", "message": f"Weights for {', '.join(ignored)} were ignored: those criteria are not selected."})
    weights = {c: float(given.get(c, 0.0)) for c in selected}
    if sum(weights.values()) <= 0:
        raise ApiError("INVALID_WEIGHTS", "Every selected criterion has weight zero.", "Give at least one selected criterion a weight above zero.")

    sc = body.get("scenario") or "baseline"
    sc = {"preset": sc} if isinstance(sc, str) else dict(sc)
    resolved = P.resolve_scenario(sc.get("preset", "baseline"), sc.get("rain_scale_pct"), sc.get("temp_offset_c"), sc.get("rain_scale_by_season"))
    req = {
        "existing_rotation": existing,
        "criteria_selected": selected,
        "weights": weights,
        "constraints": {k: bool((body.get("constraints") or {}).get(k, False)) for k in ("low_water", "no_specialty_equipment", "no_local_market")},
        "allowed_crops": sorted(set(allowed)),
        "scenario": {k: resolved[k] for k in ("preset", "rain_scale_pct", "temp_offset_c", "rain_scale_by_season")},
    }
    if preset:
        req["weight_preset"] = preset
    if body.get("location") and site_id not in FC.CURATED_SITES:
        req["location"] = [float(x) for x in body["location"]]
    return req, warnings


def request_hash(site_id: str, req: dict) -> str:
    blob = json.dumps({"site": site_id, "req": req, "engine": R.ENGINE_VERSION, "features": FC.PIPELINE_VERSION}, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def analyze(site_id: str, body: dict) -> dict:
    """Same request -> byte-identical response (cached in process by the normalized request)."""
    req, warnings = normalize(site_id, body)
    return _analyze(site_id, json.dumps({"req": req, "warnings": warnings}, sort_keys=True))


# ---------------------------------------------------------------- helpers
def _climate(features: dict, year: str | None = None) -> E.Climate:
    def arr(fid: str) -> np.ndarray:
        vals = features[fid]["mean"] if year is None else features[fid]["by_year"][year]
        return np.array([0.0 if v is None else v for v in vals])

    return E.Climate(arr("et0_mm"), arr("rain_mm"), arr("extreme_rain_prob"), arr("dry_spell_prob"))


def _confidence(q: dict) -> str:
    if q["limited_data"] or q["years_available"] < 20 or q["sources_agree"] is False:
        return "low"
    if q["sources_agree"] and max(q["missing_fraction"].values()) < 0.05:
        return "high"
    return "medium"


def _name(slots: list[dict]) -> str:
    lib = T.library()
    mains = [lib[s["crop_id"]]["name"] for s in slots if s["crop_id"] != "fallow" and not lib[s["crop_id"]]["cover_crop"]]
    covers = sorted({lib[s["crop_id"]]["name"] for s in slots if s["crop_id"] != "fallow" and lib[s["crop_id"]]["cover_crop"]})
    name = ", ".join(mains) or "Fallow"
    return name + (f" with {_join(covers)} as cover" if covers else "")


def _join(xs: list[str]) -> str:
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


def _crops(slots: list[dict]) -> tuple[str, ...]:
    return tuple(s["crop_id"] for s in slots)


def _r(x: float, nd: int = 1) -> float:
    return round(float(x), nd) + 0.0


def _weighted(scores: dict[str, list[float]], weights: dict[str, float]) -> list[float]:
    total = sum(weights.values())
    n = len(next(iter(scores.values())))
    return [sum(weights[c] / total * scores[c][i] for c in weights) for i in range(n)]


def _ranks(overall: list[float]) -> list[int]:
    order = sorted(range(len(overall)), key=lambda i: (-round(overall[i], 6), i))  # ties: existing first
    ranks = [0] * len(overall)
    for r, i in enumerate(order, 1):
        ranks[i] = r
    return ranks


# ---------------------------------------------------------------- analysis
@lru_cache(maxsize=128)
def _analyze(site_id: str, key: str) -> dict:
    payload = json.loads(key)
    req, warnings = payload["req"], list(payload["warnings"])
    loc = tuple(req["location"]) if req.get("location") else None
    scenario = P.resolve_scenario(**req["scenario"])
    table = F.feature_table(site_id, scenario, loc)
    lat = table["location"][1]
    shift = 182 if lat < 0 else 0  # day-of-year windows are northern-hemisphere calendars
    soil = table["soil"]["infiltration_class"] if table["soil"] else "medium"
    lib = T.library()

    if req["existing_rotation"] == "preset":
        preset = R.SITE_PRESETS.get(site_id, R.DEFAULT_PRESET)
        existing_slots = E._slots(tuple((m, o) for _, m, o in preset["slots"]))
        existing_name = preset["name"] + " (typical regional rotation, assumed)"
    else:
        existing_slots, existing_name = req["existing_rotation"], "Your current rotation"
    existing = E.build(existing_slots, shift)
    for issue in existing.issues:
        warnings.append({"code": "EXISTING_TIMING", "level": "warning", "message": f"Current rotation: {issue}"})
    ex_seq = E._as_seq(existing_slots)
    if ex_seq and not E.cyclic_family_ok([m for m, _ in ex_seq]):
        warnings.append({"code": "EXISTING_SAME_FAMILY", "level": "info", "message": "Current rotation has the same crop family in consecutive years."})

    # Generate and pick alternatives (PRD §8.3), scored on the mean climate of the (scenario) years.
    cl = _climate(table["features"])
    mains, covers, removed = E.candidate_pools(req["allowed_crops"], req["constraints"])
    seqs = E.generate(existing.years, mains, covers, E._canonical(ex_seq) if ex_seq else None, shift)
    plans = [existing] + [E.build(E._slots(s), shift) for s in seqs]
    no_market = req["constraints"]["no_local_market"]
    raws = [{**E.trait_raw(p, no_market), **E.climate_raw(p, cl, soil, 1.0, lat)} for p in plans]
    pool = {c: E.normalize([r[c] for r in raws], c in R.LOWER_IS_BETTER) for c in R.CRITERIA}
    fit = _weighted({c: pool[c] for c in req["weights"]}, req["weights"])
    order = sorted(range(1, len(plans)), key=lambda i: (-round(fit[i], 6), _crops(plans[i].slots)))
    chosen = [0]
    if order:
        chosen.append(order[0])
        first = set(_crops(plans[order[0]].slots))
        second = next((i for i in order[1:] if set(_crops(plans[i].slots)) != first), None)
        if second is not None:
            chosen.append(second)
    if len(chosen) < 3:
        why = [f"{k} removed {', '.join(v)}" for k, v in sorted(removed.items())]
        warnings.append({"code": "NO_FEASIBLE_ALTERNATIVES", "level": "error",
                         "message": f"Only {len(chosen) - 1} alternative(s) fit. Allowed crops: {len(req['allowed_crops'])}"
                                    + (f"; constraints: {'; '.join(why)}" if why else "") + ". Allow more crops or relax a constraint."})

    # Score the final set (normalized across these rotations only); rot_alt_1 is the better-ranked alternative.
    def final_scores(idx: list[int]) -> tuple[dict, list[float]]:
        sc = {c: E.normalize([raws[i][c] for i in idx], c in R.LOWER_IS_BETTER) for c in R.CRITERIA}
        return sc, _weighted({c: sc[c] for c in req["weights"]}, req["weights"])

    scores, overall = final_scores(chosen)
    if len(chosen) == 3 and round(overall[2], 6) > round(overall[1], 6):
        chosen = [chosen[0], chosen[2], chosen[1]]
        scores, overall = final_scores(chosen)
    final = [plans[i] for i in chosen]
    fr = [raws[i] for i in chosen]
    ranks = _ranks(overall)

    # Uncertainty (PRD §10): recompute climate criteria per historical year, no random numbers.
    years = sorted(table["features"]["rain_mm"]["by_year"])
    per_year = {c: [] for c in R.CLIMATE_DRIVEN}
    expo = {"winter": [], "summer": []}
    rank_hits = [0] * len(final)
    winter_better = [0] * len(final)
    for y in years:
        cy = _climate(table["features"], y)
        ry = [E.climate_raw(p, cy, soil, 1.0, lat) for p in final]
        sy = {c: (E.normalize([r[c] for r in ry], c in R.LOWER_IS_BETTER) if c in R.CLIMATE_DRIVEN else scores[c]) for c in R.CRITERIA}
        for c in R.CLIMATE_DRIVEN:
            per_year[c].append(sy[c])
        expo["winter"].append([r["_exposure_winter"] for r in ry])
        expo["summer"].append([r["_exposure_summer"] for r in ry])
        for i, rk in enumerate(_ranks(_weighted({c: sy[c] for c in req["weights"]}, req["weights"]))):
            rank_hits[i] += rk == ranks[i]
            winter_better[i] += ry[i]["_exposure_winter"] < ry[0]["_exposure_winter"]
    confidence = _confidence(table["quality"])
    pct = lambda a, q: float(np.percentile(np.array(a), q))  # noqa: E731

    rotations = []
    for i, p in enumerate(final):
        scorecard = []
        for c in R.CRITERIA:
            entry = {"criterion": c, "score": _r(scores[c][i]), "unit": R.UNIT, "basis": R.BASIS[c],
                     "confidence": confidence if c in R.CLIMATE_DRIVEN else "low",
                     "needs_local_review": c not in R.CLIMATE_DRIVEN or table["quality"]["limited_data"],
                     "inputs": _inputs(c, fr[i], p, soil)}
            if c in R.CLIMATE_DRIVEN:
                col = [row[i] for row in per_year[c]]
                entry["range"] = {"p10": _r(pct(col, 10)), "p90": _r(pct(col, 90))}
            notes = []
            if len({round(r[c], 9) for r in fr}) == 1:
                notes.append("No difference between these rotations on this criterion.")
            if c not in R.CLIMATE_DRIVEN:
                notes.append(EV.TRAIT_NOTE)
            if c == "erosion_risk":
                notes.append("No terrain package: terrain factor set to 1.")
            if notes:
                entry["note"] = " ".join(notes)
            scorecard.append(entry)
        n_years = len(years)
        place = EV.ORDINAL[ranks[i]]
        rotations.append({
            "rotation_id": IDS[i],
            "name": existing_name if i == 0 else _name(p.slots),
            "is_existing": i == 0,
            "sequence": p.slots,
            "cover_calendar": E.cover_calendar(p),
            "scorecard": scorecard,
            "overall": _r(overall[i]),
            "rank": ranks[i],
            "rank_stability": f"ranked {place} in {round(100 * rank_hits[i] / n_years)}% of {n_years} resampled years",
            "exposure": {s: {"value": _r(fr[i][f"_exposure_{s}"], 3),
                             "p10": _r(pct([row[i] for row in expo[s]], 10), 3),
                             "p90": _r(pct([row[i] for row in expo[s]], 90), 3), "basis": "relative"} for s in ("winter", "summer")},
            "vulnerable_seasons": P.vulnerable_weeks(table, np.flatnonzero((p.kc_w > 0).any(0)).tolist()),
            "_winter_better": None if i == 0 else f"lower winter exposure than rot_existing in {round(100 * winter_better[i] / n_years)}% of resampled years",
        })
    total = sum(req["weights"].values())
    weights_applied = {c: round(w / total, 4) for c, w in req["weights"].items()}
    for i, rot in enumerate(rotations):
        rot["evidence_card"] = EV.card(rot, rotations[0], fr[i], fr[0], weights_applied, req["constraints"], table, len(rotations))
    return {
        "site_id": site_id,
        "engine_version": R.ENGINE_VERSION,
        "request_hash": request_hash(site_id, req),
        "request_echo": req,
        "scenario": scenario,
        "data_mode": table["data_mode"],
        "limited_data": table["quality"]["limited_data"],
        "confidence": confidence,
        "rotations": rotations,
        "weights_applied": weights_applied,
        "warnings": warnings,
        "disclaimer": R.SUPPORT,
    }


def _inputs(c: str, raw: dict, p: E.Plan, soil: str) -> list[dict]:
    bare_days = float((p.cover < R.BARE_COVER).sum(1).mean())
    i = lambda name, v, unit, basis: {"name": name, "value": round(v, 3) if isinstance(v, float) else v, "unit": unit, "basis": basis}  # noqa: E731
    return {
        "nutrient_cycling": [i("legume_share", raw["_legume_share"], "fraction", "derived"), i("mean_residue", raw["_mean_residue"], "index 0-1", "assumed"), i("cover_share", raw["_cover_share"], "fraction", "derived")],
        "erosion_risk": [i("days_bare_per_year", bare_days, "days", "derived"), i("bare_weeks_weighted", raw["erosion_risk"], "relative index", "modeled"), i("infiltration_class", soil, "class", "modeled"), i("terrain_factor", 1.0, "relative", "assumed")],
        "organic_matter": [i("mean_residue", raw["_mean_residue"], "index 0-1", "assumed"), i("cover_share", raw["_cover_share"], "fraction", "derived"), i("perennial_share", raw["_perennial_share"], "fraction", "derived")],
        "pest_disruption": [i("distinct_families", raw["_distinct_families"], "count", "derived"), i("same_family_pairs_within_2_seasons", raw["_same_family_pairs"], "count", "derived")],
        "water_use": [i("seasonal_water_shortfall", raw["water_use"], "mm per year", "modeled"), i("rain_retained_share", R.RAIN_RETAINED[soil], "fraction", "assumed")],
        "forage_potential": [i("forage_index", raw["forage_potential"], "index", "derived")],
        "market_suitability": [i("mean_market_rating", raw["market_suitability"], "0-1", "assumed")],
    }[c]


def public(result: dict) -> dict:
    """Drop internal keys (leading underscore) before the response leaves the API."""
    out = dict(result)
    out["rotations"] = [{k: v for k, v in r.items() if not k.startswith("_")} for r in result["rotations"]]
    return out


# ---------------------------------------------------------------- compare (v1.1 RotationComparison)
def compare(site_id: str, rotation_ids: list[str], scenario: str = "baseline") -> dict:
    res = _analyze(site_id, json.dumps({"req": normalize(site_id, {"scenario": scenario})[0], "warnings": []}, sort_keys=True))
    by_id = {r["rotation_id"]: r for r in res["rotations"]}
    for rid in rotation_ids:
        if rid not in by_id:
            raise not_found("rotation", rid)
    return {
        "site_id": site_id,
        "scenario": scenario,
        "rotations": [{"rotation_id": rid, "winter": by_id[rid]["exposure"]["winter"], "summer": by_id[rid]["exposure"]["summer"],
                       "rank_stability": by_id[rid]["_winter_better"], "basis": "relative"} for rid in rotation_ids],
    }
