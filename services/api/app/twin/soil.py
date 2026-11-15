"""Two-pool soil carbon, infiltration index, and RUSLE-style soil loss (PRD §5.4, D1).

The carbon pools follow ICBM (Andrén & Kätterer 1997, Table 1). The index is
100 at the steady state of a medium residue input with r = 1. It is not %SOC.
Soil loss is R * K * LS * C * P with the factors in `twin/config.py`.
"""

from __future__ import annotations

import math

import numpy as np

from app.twin import config as C
from app.twin.types import PlanYear, SoilProps, State, WaterYearResult, WeatherYear


def steady_carbon_total() -> float:
    """Young + old pool at the ICBM steady state used as year 0, t C/ha."""
    annual = C.CARBON_INPUT_T_HA["medium"]
    young = annual / C.ICBM_KY
    old = C.ICBM_H * annual / C.ICBM_KO
    return young + old


def initial_state() -> State:
    """Year-0 state. Organic index 100, infiltration index 100, empty N and pest pools."""
    annual = C.CARBON_INPUT_T_HA["medium"]
    young = annual / C.ICBM_KY
    old = C.ICBM_H * annual / C.ICBM_KO
    return State(soc_fast=young, soc_slow=old, infiltration_idx=100.0, n_pool=0.0, pest={})


def organic_index(state: State) -> float:
    total = steady_carbon_total()
    return 100.0 * (state.soc_fast + state.soc_slow) / total


def carbon_input_t_ha(plan_year: PlanYear, catalog) -> tuple[float, tuple[str, ...]]:
    """Sum of class inputs for the year's crops. Fallow is zero. Null classes are skipped and noted."""
    crops = C.index_crops(catalog)
    total = 0.0
    notes: list[str] = []
    seen: set[str] = set()
    for slot in plan_year.slots:
        if slot.crop_id == "fallow" or slot.crop_id in seen:
            continue
        seen.add(slot.crop_id)
        crop = crops.get(slot.crop_id)
        if crop is None:
            notes.append(f"{slot.crop_id}: not in the catalog; carbon input counted as 0")
            continue
        kind = crop.get("carbon_input_class")
        if kind is None and crop.get("residue_class"):
            kind = crop.get("residue_class")
            notes.append(f"{slot.crop_id}: carbon_input_class is null; residue_class {kind} was used")
        if kind is None:
            notes.append(f"{slot.crop_id}: carbon input is not verified and was counted as 0")
            continue
        if kind not in C.CARBON_INPUT_T_HA:
            notes.append(f"{slot.crop_id}: carbon class {kind!r} is not in config; counted as 0")
            continue
        total += C.CARBON_INPUT_T_HA[kind]
    return total, tuple(notes)


def _climate_r(water: WaterYearResult, w: WeatherYear, soil: SoilProps) -> float:
    tmean = float(np.mean(0.5 * (np.asarray(w.tmax) + np.asarray(w.tmin))))
    wet = float(np.mean(water.storage_end_mm)) / max(soil.taw_mm_per_m, 1.0)
    wet = float(np.clip(wet, 0.2, 1.0))
    raw = (2.0 ** ((tmean - C.ICBM_T_REF_C) / 10.0)) * wet
    return float(np.clip(raw, C.ICBM_R_MIN, C.ICBM_R_MAX))


def update_soc(
    state: State,
    plan_year: PlanYear,
    water: WaterYearResult,
    w: WeatherYear,
    *,
    catalog,
    soil: SoilProps,
    no_till: bool = False,
) -> State:
    """Annual ICBM step. Also refreshes `infiltration_idx` from the new carbon index and cover."""
    annual, _notes = carbon_input_t_ha(plan_year, catalog)
    factor = _climate_r(water, w, soil)
    k_young = C.ICBM_KY * factor * (1.0 if no_till else C.TILLAGE_DECAY_MULT)
    k_young *= 1.0 + C.BARE_DECAY_YEAR * (water.bare_weeks / 52.0)
    k_old = C.ICBM_KO * factor
    decay = min(state.soc_fast, max(0.0, k_young * state.soc_fast))
    young = max(0.0, state.soc_fast + annual - decay)
    old = max(0.0, state.soc_slow + C.ICBM_H * decay - k_old * state.soc_slow)
    updated = State(young, old, state.infiltration_idx, state.n_pool, dict(state.pest))
    cover = float(np.clip(np.mean(water.cover), 0.0, 1.0))
    cover_factor = (1.0 - C.INFIL_COVER_WEIGHT) + C.INFIL_COVER_WEIGHT * (cover / C.INFIL_COVER_REFERENCE)
    till_factor = (C.INFIL_NO_TILL_MULT / C.INFIL_TILL_MULT) if no_till else 1.0
    index = organic_index(updated) * cover_factor * till_factor
    updated.infiltration_idx = float(np.clip(index, C.INFIL_INDEX_MIN, C.INFIL_INDEX_MAX))
    return updated


def soil_loss_t_ha(
    water: WaterYearResult,
    w: WeatherYear,
    soil: SoilProps,
    slope_class: str,
    no_till: bool,
) -> float:
    """RUSLE-style annual soil loss, t/ha/yr. Factors are documented in config. Confidence is low."""
    row = C.texture_row(soil.sand, soil.silt, soil.clay)
    erodibility = C.RUSLE_K[row]
    percent = C.SLOPE_PERCENT[slope_class]
    theta = math.atan(percent / 100.0)
    # Slope factor used by RUSLE for a unit plot length, so L = 1. TODO(verify) the coefficients
    # against USDA Agriculture Handbook 703. Flat and gentle use the <9% branch.
    steepness = (10.8 * math.sin(theta) + 0.03) if percent < 9.0 else (16.8 * math.sin(theta) - 0.50)
    cover = float(np.clip(np.mean(water.cover), 0.0, 1.0))
    cover_factor = float(np.clip(1.0 - C.RUSLE_C_COVER_SLOPE * cover, C.RUSLE_C_MIN, 1.0))
    practice = C.RUSLE_P_NO_TILL if no_till else C.RUSLE_P_TILL
    erosivity = float(np.sum(np.maximum(w.rain, 0.0))) * C.RUSLE_R_PER_MM
    return max(0.0, erosivity * erodibility * max(steepness, 0.0) * cover_factor * practice)
