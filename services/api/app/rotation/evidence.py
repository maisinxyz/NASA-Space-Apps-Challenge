"""Evidence cards (backend rotation PRD §8.7). Plain language; never predicts harvests, money or soil loss."""

from __future__ import annotations

from app.rotation import config as R
from app.rotation import traits as T

ORDINAL = {1: "first", 2: "second", 3: "third"}
TRAIT_NOTE = "Based on typical crop traits, not measured on your field."
CONSTRAINT_TEXT = {"low_water": "low water use", "no_specialty_equipment": "no specialty equipment", "no_local_market": "no reliance on a specialty buyer"}


def _join(xs: list[str]) -> str:
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


def gaps(table: dict) -> list[str]:
    q = table["quality"]
    out = []
    if q["sources_agree"] is None:
        out.append("No satellite cross-check (NDVI or SMAP) for this site; soil moisture is a regional model estimate.")
    if table.get("soil"):
        out.append("No soil sample: the soil class comes from a 250 m soil map (SoilGrids).")
    else:
        out.append("No soil data for this location: infiltration is assumed medium.")
    out.append("No terrain package: the terrain factor is set to 1 (field average).")
    out.append("Market ratings are placeholders (assumed), not local prices.")
    out.append("Crop traits are typical values awaiting review (TODO(verify)).")
    return out


def risks(rot: dict, table: dict) -> list[str]:
    lib = T.library()
    out = list(R.REVIEW_ALWAYS)
    coldest = min((x for x in table["features"]["tmin_c"]["p10"] if x is not None), default=None)
    for cid in sorted({s["crop_id"] for s in rot["sequence"] if s["crop_id"] != "fallow"}):
        c = lib[cid]
        overwinters = c["season_window"]["terminate_doy"] < c["season_window"]["plant_doy"]
        if overwinters and coldest is not None and coldest < c["frost_tolerance_c"]:
            out.append(f"{c['name']} overwinters, and in 1 year in 10 the coldest week here drops to {coldest} degC, below its typical limit of {c['frost_tolerance_c']} degC.")
    return out


def card(rot: dict, existing: dict, raw: dict, raw_existing: dict, weights: dict, constraints: dict, table: dict, n: int) -> dict:
    scores = {s["criterion"]: s["score"] for s in rot["scorecard"]}
    ex_scores = {s["criterion"]: s["score"] for s in existing["scorecard"]}
    best = max(weights.values())
    top = [c for c in R.CRITERIA if weights.get(c) == best]
    top_txt = (f"you weighted {_join([R.LABELS[c].lower() for c in top])} highest" if len(top) <= 2
               else f"you weighted {len(top)} criteria equally")

    if rot["is_existing"]:
        why = f"This is your current rotation, ranked {ORDINAL[rot['rank']]} of {n} for your priorities. The others are compared with it."
    else:
        adds = []
        if raw["_legume_share"] > raw_existing["_legume_share"]:
            adds.append("adds a nitrogen-fixing legume")
        if raw["_cover_share"] > raw_existing["_cover_share"]:
            adds.append("adds a cover crop between cash crops")
        fewer = round(sum(existing["cover_calendar"]["days_bare_per_year"]) / len(existing["cover_calendar"]["days_bare_per_year"])
                      - sum(rot["cover_calendar"]["days_bare_per_year"]) / len(rot["cover_calendar"]["days_bare_per_year"]))
        if fewer > 0:
            adds.append(f"has about {fewer} fewer bare days per year")
        why = f"Ranked {ORDINAL[rot['rank']]} of {n} because {top_txt}"
        why += f", and it {_join(adds)}." if adds else "."
        used = [CONSTRAINT_TEXT[k] for k in sorted(constraints) if constraints[k]]
        if used:
            why += f" It respects your constraints: {_join(used)}."

    bare = sum(rot["cover_calendar"]["days_bare_per_year"]) / len(rot["cover_calendar"]["days_bare_per_year"])
    years = f"NASA POWER {table['years']['start'][:4]}-{table['years']['end'][:4]}"
    items = [
        {"label": "Bare soil (cover below 30%)", "value": round(bare), "unit": "days per year", "basis": "derived", "source": "crop cover curves (typical traits)"},
        {"label": "Seasonal water shortfall of the crops", "value": round(raw["water_use"]), "unit": "mm per year", "basis": "modeled", "source": f"{years}, Hargreaves ET0 x crop coefficient"},
        {"label": "Bare weeks weighted by heavy-rain weeks", "value": round(raw["erosion_risk"], 1), "unit": "relative index", "basis": "relative", "source": f"{years} extreme-rain shares"},
        {"label": "Share of crops that fix nitrogen", "value": round(raw["_legume_share"], 2), "unit": "fraction", "basis": "derived", "source": "crop-trait table (typical traits)"},
        {"label": "Mean market rating", "value": round(raw["market_suitability"], 2), "unit": "0-1 (assumed)", "basis": "assumed", "source": "placeholder ratings"},
    ]
    if rot["is_existing"]:
        benefits = [f"Strongest of the {n} on {R.LABELS[c].lower()}." for c in R.CRITERIA if scores[c] == 100 and len(set(ex_scores.values())) > 1]
    else:
        benefits = [f"Better {R.LABELS[c].lower()} than your current rotation (score {scores[c]:g} vs {ex_scores[c]:g})."
                    for c in R.CRITERIA if scores[c] >= ex_scores[c] + 10]
    if not benefits:
        benefits = ["No clear advantage over the other rotations on these criteria."]
    return {
        "rotation_id": rot["rotation_id"],
        "why_suggested": why,
        "evidence": [f"{i['label']}: {i['value']} {i['unit']} ({i['basis']})." for i in items],
        "evidence_items": items,
        "benefits": benefits,
        "information_gaps": gaps(table),
        "risks_for_local_review": risks(rot, table),
        "support_not_replace": R.SUPPORT,
    }
