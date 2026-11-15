"""Nitrogen pool, fertilizer need, and the relative N index (PRD §5.4, D1).

Rates come from the catalog when they are numbers. Class names use the assumed
kg N/ha table in `twin/config.py` and always stay confidence low. A null demand
is not treated as zero silently: the crop is skipped and named in `notes`.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.twin import config as C
from app.twin.types import PlanYear, State, WaterYearResult


@dataclass(frozen=True)
class NitrogenFlux:
    net_kg_ha: float
    fertilizer_need_kg_ha: float
    fixed_kg_ha: float
    uptake_kg_ha: float
    residue_kg_ha: float
    loss_kg_ha: float
    fixed_share: float
    notes: tuple[str, ...]


def _finite(value) -> float | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool) and np.isfinite(value):
        return float(value)
    return None


def nitrogen_flux(state: State, plan_year: PlanYear, water: WaterYearResult, catalog) -> NitrogenFlux:
    crops = C.index_crops(catalog)
    fixed = 0.0
    uptake = 0.0
    residue = 0.0
    notes: list[str] = []
    seen: set[str] = set()
    for slot in plan_year.slots:
        if slot.crop_id == "fallow" or slot.crop_id in seen:
            continue
        seen.add(slot.crop_id)
        crop = crops.get(slot.crop_id)
        if crop is None:
            notes.append(f"{slot.crop_id}: not in the catalog; no nitrogen term")
            continue
        fix_class = crop.get("n_fix_class")
        if fix_class in C.N_FIX_KG_HA:
            fixed += C.N_FIX_KG_HA[fix_class]
        elif crop.get("n_fixing"):
            fixed += C.N_FIX_KG_HA[C.N_FIX_CLASS_WHEN_FLAG_ONLY]
            notes.append(
                f"{slot.crop_id}: n_fix_class is null and n_fixing is true; "
                f"used assumed class {C.N_FIX_CLASS_WHEN_FLAG_ONLY}"
            )
        rate = _finite(crop.get("typical_n_rate_kg_ha"))
        if rate is not None:
            uptake += rate
        elif crop.get("n_uptake_class") in C.N_UPTAKE_KG_HA:
            uptake += C.N_UPTAKE_KG_HA[crop["n_uptake_class"]]
        else:
            notes.append(f"{slot.crop_id}: nitrogen demand is not verified and was not subtracted")
        residue_class = crop.get("residue_class")
        if residue_class in C.N_RESIDUE_KG_HA:
            residue += C.N_RESIDUE_KG_HA[residue_class]
    loss = C.N_LOSS_PER_MM_DRAINAGE * float(np.sum(water.drainage_mm)) + C.N_LOSS_PER_BARE_WEEK * water.bare_weeks
    supply = max(state.n_pool, 0.0) * C.N_MINERALIZATION_FRACTION
    net = fixed + residue - uptake - loss
    need = max(0.0, uptake - fixed - residue - supply)
    inputs = fixed + residue
    share = (fixed / inputs) if inputs > 0 else 0.0
    return NitrogenFlux(net, need, fixed, uptake, residue, loss, share, tuple(notes))


def update_nitrogen(state: State, plan_year: PlanYear, water: WaterYearResult, *, catalog) -> State:
    """Add this year's net kg N/ha to `n_pool`. `catalog` is keyword-only."""
    flux = nitrogen_flux(state, plan_year, water, catalog)
    return State(
        state.soc_fast,
        state.soc_slow,
        state.infiltration_idx,
        state.n_pool + flux.net_kg_ha,
        dict(state.pest),
    )


def n_balance_index(state: State) -> float:
    """Year-0 pool of 0 kg N/ha is index 100. The scale is assumed (`N_INDEX_PER_KG`)."""
    return 100.0 + state.n_pool * C.N_INDEX_PER_KG
