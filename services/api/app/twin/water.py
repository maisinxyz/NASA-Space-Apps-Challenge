"""Weekly FAO-56 soil-water bucket, infiltration, and yield (PRD §5.2, group 4).

Mass balance for every week, within 1e-6 mm:

    rain + irrigation == ETc + runoff + drainage + Δstorage

`irrigation_need_mm` is unmet ETc before the quota. `irrigation_mm` is what was
applied. Yield uses FAO Irrigation and Drainage Paper 33,
`1 - Ya/Ym = Ky (1 - ETa/ETm)`, and only when both Ym and Ky are known.
A null catalog `reference_yield` is omitted, not replaced.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.twin import config as C
from app.twin.types import (
    BARE_COVER_MAX,
    WEEK_COUNT,
    IrrigationCfg,
    PlanYear,
    SoilProps,
    State,
    WaterYearResult,
    WeatherYear,
)

_DAY = np.arange(C.YEAR_DAYS)
_WEEK_OF_DAY = np.minimum(_DAY // 7, WEEK_COUNT - 1)


@dataclass(frozen=True)
class YearProfile:
    """Weekly cover, Kc, and root depth for one plan year. Built once and reused across members."""

    cover: np.ndarray
    kc: np.ndarray
    root_m: np.ndarray
    crop_kc: dict[str, np.ndarray]
    missing: tuple[str, ...]


def _weekly_mean(daily: np.ndarray) -> np.ndarray:
    total = np.zeros(WEEK_COUNT, dtype=np.float64)
    count = np.zeros(WEEK_COUNT, dtype=np.float64)
    np.add.at(total, _WEEK_OF_DAY, daily)
    np.add.at(count, _WEEK_OF_DAY, 1.0)
    return total / np.maximum(count, 1.0)


def _stage_interp(age: np.ndarray, season_len: int, values: tuple[float, float, float]) -> np.ndarray:
    ini, mid, end = values
    anchors = [0.0]
    levels = [ini]
    for frac, level in zip(C.KC_STAGE_FRACTIONS, (ini, mid, mid), strict=True):
        x = float(round(frac * season_len))
        if x <= anchors[-1]:
            x = anchors[-1] + 1e-3
        anchors.append(x)
        levels.append(level)
    if season_len <= anchors[-1]:
        season_len = anchors[-1] + 1e-3
    anchors.append(float(season_len))
    levels.append(end)
    return np.interp(age, anchors, levels)


def _crop_daily(crop: dict, lat: float) -> tuple[np.ndarray, np.ndarray, np.ndarray, bool] | None:
    """Daily cover, Kc, and root depth. None when the season window is not a pair of days."""
    window = crop.get("season_window") or {}
    plant, terminate = window.get("plant_doy"), window.get("terminate_doy")
    if plant is None or terminate is None:
        return None
    plant_i = (int(plant) - 1) % C.YEAR_DAYS
    term_i = (int(terminate) - 1) % C.YEAR_DAYS
    if lat < 0:
        plant_i = (plant_i + C.SOUTH_SHIFT_DAYS) % C.YEAR_DAYS
        term_i = (term_i + C.SOUTH_SHIFT_DAYS) % C.YEAR_DAYS
    if term_i >= plant_i:
        mask = (_DAY >= plant_i) & (_DAY < term_i)
        season_len = int(term_i - plant_i)
        age = (_DAY - plant_i).astype(np.float64)
    else:
        mask = (_DAY >= plant_i) | (_DAY < term_i)
        season_len = int((term_i - plant_i) % C.YEAR_DAYS)
        age = ((_DAY - plant_i) % C.YEAR_DAYS).astype(np.float64)
    if season_len <= 0:
        return None
    cover = np.zeros(C.YEAR_DAYS, dtype=np.float64)
    points = np.asarray(crop.get("cover_curve") or [], dtype=np.float64)
    if points.ndim == 2 and points.shape[0] >= 2 and points.shape[1] == 2:
        order = np.argsort(points[:, 0])
        xs, ys = points[order, 0], points[order, 1]
        cover = np.interp(age, xs, ys, left=float(ys[0]), right=float(ys[-1]))
    cover = np.where(mask, cover, 0.0)

    stages = crop.get("kc_stages") or {}
    ini, mid, end = stages.get("ini"), stages.get("mid"), stages.get("end")
    kc = np.zeros(C.YEAR_DAYS, dtype=np.float64)
    kc_known = ini is not None and mid is not None and end is not None
    if kc_known:
        kc = np.where(mask, _stage_interp(age, season_len, (float(ini), float(mid), float(end))), 0.0)

    root = np.zeros(C.YEAR_DAYS, dtype=np.float64)
    by_stage = crop.get("root_depth_m") or {}
    if all(by_stage.get(name) is not None for name in ("ini", "mid", "end")):
        root = np.where(
            mask,
            _stage_interp(age, season_len, (float(by_stage["ini"]), float(by_stage["mid"]), float(by_stage["end"]))),
            0.0,
        )
    else:
        depth = C.ROOT_DEPTH_M_BY_CLASS.get(crop.get("root_depth_class") or "")
        if depth is not None:
            grown = np.interp(age, [0.0, float(season_len)], [0.5 * depth, depth])
            root = np.where(mask, grown, 0.0)
    return cover, kc, root, kc_known


def year_profile(plan_year: PlanYear, catalog, lat: float) -> YearProfile:
    """Max cover and Kc across the slots in this year. Fallow and missing windows add nothing."""
    crops = C.index_crops(catalog)
    cover = np.zeros(C.YEAR_DAYS, dtype=np.float64)
    kc = np.zeros(C.YEAR_DAYS, dtype=np.float64)
    root = np.zeros(C.YEAR_DAYS, dtype=np.float64)
    crop_kc: dict[str, np.ndarray] = {}
    missing: list[str] = []
    seen: set[str] = set()
    for slot in plan_year.slots:
        if slot.crop_id == "fallow" or slot.crop_id in seen:
            continue
        seen.add(slot.crop_id)
        crop = crops.get(slot.crop_id)
        if crop is None:
            missing.append(f"{slot.crop_id}: not in the catalog")
            continue
        daily = _crop_daily(crop, lat)
        if daily is None:
            missing.append(f"{slot.crop_id}: season window is not set, so it is not placed on the calendar")
            continue
        cover_d, kc_d, root_d, kc_known = daily
        if not kc_known:
            missing.append(f"{slot.crop_id}: Kc stages are null, so this crop adds no ET")
        if C.ROOT_DEPTH_M_BY_CLASS.get(crop.get("root_depth_class") or "") is None and not all(
            (crop.get("root_depth_m") or {}).get(name) is not None for name in ("ini", "mid", "end")
        ):
            missing.append(f"{slot.crop_id}: root depth is null")
        cover = np.maximum(cover, cover_d)
        kc = np.maximum(kc, kc_d)
        root = np.maximum(root, root_d)
        crop_kc[slot.crop_id] = _weekly_mean(kc_d)
    root = np.where(root > 0, root, C.BARE_ROOT_M)
    return YearProfile(
        cover=_weekly_mean(cover),
        kc=_weekly_mean(kc),
        root_m=_weekly_mean(root),
        crop_kc=crop_kc,
        missing=tuple(missing),
    )


def infiltration_factor(cover: np.ndarray, state: State, soil: SoilProps, no_till: bool) -> np.ndarray:
    """Share of rain that enters the root zone. Dimensionless, clipped to [0, 1]."""
    base = float(np.clip(
        C.INFIL_BASE_INTERCEPT + C.INFIL_BASE_CLAY_SLOPE * soil.clay,
        C.INFIL_BASE_MIN,
        C.INFIL_BASE_MAX,
    ))
    soc_mult = 1.0 + C.INFIL_SOC_SLOPE * (state.infiltration_idx / 100.0 - 1.0)
    cover_mult = C.INFIL_COVER_MIN + (1.0 - C.INFIL_COVER_MIN) * np.clip(cover, 0.0, 1.0)
    till = C.INFIL_NO_TILL_MULT if no_till else C.INFIL_TILL_MULT
    return np.clip(base * soc_mult * cover_mult * till, 0.0, 1.0)


def _ks(storage: float, taw: float) -> float:
    raw = C.DEPLETION_FRACTION_P * taw
    deficit = taw - storage
    if deficit <= raw:
        return 1.0
    return float(np.clip(storage / max(taw - raw, 1e-9), 0.0, 1.0))


def _number(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, dict):
        value = value.get("value")
    if isinstance(value, (int, float)) and not isinstance(value, bool) and np.isfinite(value):
        return float(value)
    return None


def _yields(
    profile: YearProfile,
    catalog,
    etc: np.ndarray,
    etm: np.ndarray,
    tmax: np.ndarray,
    tmin: np.ndarray,
) -> tuple[dict[str, float], dict[str, float], tuple[str, ...]]:
    """Point yields (t/ha) for crops with both a reference yield and a Ky. Forage is the subset."""
    crops = C.index_crops(catalog)
    grain: dict[str, float] = {}
    forage: dict[str, float] = {}
    notes: list[str] = []
    for crop_id, crop_kc in profile.crop_kc.items():
        crop = crops.get(crop_id)
        if crop is None:
            continue
        ym = _number(crop.get("reference_yield"))
        ky = _number(crop.get("yield_response_factor_ky"))
        if ky is None and crop_id in C.KY_FAO33:
            ky = C.KY_FAO33[crop_id]
        if ym is None or ky is None:
            if ym is None:
                notes.append(f"{crop_id}: reference_yield is null, so yield_t_ha is omitted")
            else:
                notes.append(f"{crop_id}: Ky is not in the catalog or the FAO-33 table, so yield_t_ha is omitted")
            continue
        grown = crop_kc > 0
        etm_sum = float(etm[grown].sum()) if grown.any() else 0.0
        if etm_sum <= 1e-9:
            ratio = 1.0
        else:
            share = np.divide(crop_kc, np.maximum(profile.kc, 1e-9))
            ratio = float(np.clip((etc * share)[grown].sum() / etm_sum, 0.0, 1.5))
        heat = crop.get("heat_limit_c")
        frost = crop.get("frost_tolerance_c")
        if heat is None:
            notes.append(f"{crop_id}: heat_limit_c is null, so no heat penalty was applied")
        if frost is None:
            notes.append(f"{crop_id}: frost_tolerance_c is null, so no frost penalty was applied")
        heat_n = int(np.count_nonzero(grown & (tmax > float(heat)))) if heat is not None else 0
        frost_n = int(np.count_nonzero(grown & (tmin < float(frost)))) if frost is not None else 0
        penalty = max(0.0, 1.0 - C.HEAT_YIELD_LOSS_PER_WEEK * heat_n - C.FROST_YIELD_LOSS_PER_WEEK * frost_n)
        ya = max(0.0, ym * (1.0 - ky * (1.0 - min(ratio, 1.0))) * penalty)
        grain[crop_id] = ya
        use = crop.get("forage_use")
        if crop.get("category") == "forage" or use in C.FORAGE_USES:
            forage[crop_id] = ya
    return grain, forage, tuple(notes)


def run_water_year(
    plan_year: PlanYear,
    w: WeatherYear,
    soil: SoilProps,
    state: State,
    irrigation: IrrigationCfg,
    *,
    catalog,
    lat: float,
    no_till: bool = False,
    storage_start_mm: float | None = None,
    profile: YearProfile | None = None,
) -> WaterYearResult:
    """One member-year. `catalog` and `lat` are keyword-only; the positional arguments match PRD §6.4."""
    profile = profile or year_profile(plan_year, catalog, lat)
    factor = infiltration_factor(profile.cover, state, soil, no_till)
    # Weekly taw is the rooted depth. The profile capacity is the deepest root this year,
    # so water below today's roots is still there when the roots grow into it.
    taw = np.maximum(soil.taw_mm_per_m * profile.root_m, 1e-6)
    capacity = float(np.max(taw))
    rain = np.maximum(np.asarray(w.rain, dtype=np.float64), 0.0)
    et0 = np.maximum(np.asarray(w.et0, dtype=np.float64), 0.0)
    storage = capacity if storage_start_mm is None else max(0.0, float(storage_start_mm))
    start = storage
    quota_left = None if irrigation.quota_mm_per_season is None else max(0.0, float(irrigation.quota_mm_per_season))

    irrigation_mm = np.zeros(WEEK_COUNT)
    irrigation_need = np.zeros(WEEK_COUNT)
    infiltrated = np.zeros(WEEK_COUNT)
    runoff = np.zeros(WEEK_COUNT)
    etc = np.zeros(WEEK_COUNT)
    etm = np.zeros(WEEK_COUNT)
    drainage = np.zeros(WEEK_COUNT)
    storage_end = np.zeros(WEEK_COUNT)
    delta = np.zeros(WEEK_COUNT)
    ks_out = np.zeros(WEEK_COUNT)

    for i in range(WEEK_COUNT):
        rooted_cap = float(taw[i])
        # A carried-in store deeper than this year's profile drains in the first week.
        shrink = max(0.0, storage - capacity) if i == 0 else 0.0
        storage -= shrink
        entered = float(rain[i] * factor[i])
        runoff[i] = float(rain[i] - entered)
        infiltrated[i] = entered
        drain_rain = max(0.0, storage + entered - capacity)
        storage = storage + entered - drain_rain
        rooted = min(storage, rooted_cap)
        potential = float(profile.kc[i] * et0[i])
        etm[i] = potential
        stressed = min(rooted, potential * _ks(rooted, rooted_cap))
        need = max(0.0, potential - stressed)
        irrigation_need[i] = need
        applied = 0.0
        if irrigation.available and need > 0.0:
            room = need if quota_left is None else min(need, quota_left)
            applied = max(0.0, room)
            if quota_left is not None:
                quota_left -= applied
        irrigation_mm[i] = applied
        drain_irr = max(0.0, storage + applied - capacity)
        storage = storage + applied - drain_irr
        rooted = min(storage, rooted_cap)
        ks = _ks(rooted, rooted_cap)
        ks_out[i] = ks
        actual = min(rooted, potential * ks)
        etc[i] = actual
        storage -= actual
        drainage[i] = shrink + drain_rain + drain_irr
        storage_end[i] = storage
        delta[i] = storage - (start if i == 0 else storage_end[i - 1])

    yields, forage, _notes = _yields(profile, catalog, etc, etm, np.asarray(w.tmax, dtype=np.float64), np.asarray(w.tmin, dtype=np.float64))
    bare = int(np.count_nonzero(profile.cover < BARE_COVER_MAX))
    return WaterYearResult(
        rain_mm=rain,
        irrigation_mm=irrigation_mm,
        irrigation_need_mm=irrigation_need,
        infiltrated_mm=infiltrated,
        runoff_mm=runoff,
        etc_mm=etc,
        etm_mm=etm,
        drainage_mm=drainage,
        storage_end_mm=storage_end,
        delta_storage_mm=delta,
        infiltration_factor=factor,
        ks=ks_out,
        cover=profile.cover,
        bare_weeks=bare,
        storage_start_mm=start,
        yield_t_ha=yields,
        forage_yield_t_ha=forage,
    )


def balance_residual(result: WaterYearResult) -> np.ndarray:
    """rain + irrigation - ETc - runoff - drainage - Δstorage, mm. Tests expect abs < 1e-6."""
    return (
        result.rain_mm
        + result.irrigation_mm
        - result.etc_mm
        - result.runoff_mm
        - result.drainage_mm
        - result.delta_storage_mm
    )
