"""Evidence cards from scorecard numbers and review notes. Templates only. No LLM."""

from __future__ import annotations

from app.twin.types import SUPPORT_SENTENCE

_LABELS = {
    "nutrient_cycling": "nitrogen balance",
    "erosion_risk": "erosion",
    "organic_matter": "soil organic matter",
    "pest_disruption": "pest break",
    "water_use": "irrigation need",
    "forage_potential": "forage share",
    "market_suitability": "buyer rating",
}


def evidence_card(strategy_id: str, *, role: str, rank: int, n_strategies: int, scorecard: list[dict], gaps: list[str], risks: list[str]) -> dict:
    best = [row["criterion"] for row in scorecard if row["score"] >= 99.999]
    if role == "existing":
        why = f"This is the current rotation, ranked {rank} of {n_strategies} on the priority weights. The other plans are compared with it."
    elif best:
        names = ", ".join(_LABELS.get(item, item) for item in best)
        why = f"Ranked {rank} of {n_strategies}. It is at the top of this set on {names}."
    else:
        why = f"Ranked {rank} of {n_strategies} on the priority weights."
    items = []
    lines = []
    for row in scorecard:
        label = _LABELS.get(row["criterion"], row["criterion"])
        items.append({
            "label": f"Year 10 {label}",
            "value": row["year10_value"],
            "unit": row["inputs"][0]["unit"] if row.get("inputs") else row["unit"],
            "basis": row["basis"],
            "source": "ensemble year-10 median from the forecast run",
        })
        lines.append(f"{label}: score {row['score']} (year 10 {row['year10_value']}).")
    benefits = [f"Highest of this set on {_LABELS.get(item, item)}." for item in best]
    if not benefits:
        benefits.append("No criterion in this set is uniquely highest.")
    gap_lines = list(dict.fromkeys(gaps)) or ["No extra data gap was recorded for this strategy."]
    risk_lines = list(dict.fromkeys(risks)) or ["Review the assumptions list before treating a number as a field measurement."]
    return {
        "rotation_id": strategy_id,
        "why_suggested": why,
        "evidence": lines,
        "evidence_items": items,
        "benefits": benefits,
        "information_gaps": gap_lines,
        "risks_for_local_review": risk_lines,
        "support_not_replace": SUPPORT_SENTENCE,
    }
