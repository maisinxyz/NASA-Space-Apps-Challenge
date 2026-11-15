"""Shared forecast types (backend forecast PRD v3 §6.4).

Session A owns this module. Sessions B and C import these names and do not
redefine them. A field another session needs is requested in
`docs/progress/forecast-requests.md` instead of being added here ad hoc.

Array layout matches the weekly feature pipeline: 52 weeks, index 0 is the
7-day block starting 1 January (PRD §5.1, existing `WeekValues`).
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field

import numpy as np

# Specified counts and thresholds (PRD §5.1, §5.3, §6.2, group 2/3). Not tunable here.
WEEK_COUNT = 52
ENSEMBLE_MEMBERS = 30
HORIZON_YEARS_MIN = 5
HORIZON_YEARS_MAX = 10
HORIZON_YEARS_DEFAULT = 10
STRATEGY_COUNT_MIN = 2
STRATEGY_COUNT_MAX = 4
STRATEGY_COUNT_DEFAULT = 3
SELECTION_MIN = 2
SELECTION_MAX = 30
FIELD_COUNT_MAX = 20
# Weeks with cover below this fraction are bare (group 2 and group 3 `bare_weeks`).
BARE_COVER_MAX = 0.25

SEASONS = ("spring", "summer", "fall", "winter")
SLOPE_CLASSES = ("flat", "gentle", "moderate", "steep")
LABOUR_LEVELS = ("low", "medium", "high")
CLIMATE_SOURCES = ("cmip6_delta", "history_resample")
BASIS_VALUES = ("measured", "derived", "modeled", "assumed", "relative")
CONFIDENCE_VALUES = ("high", "medium", "low")
STRATEGY_ROLES = ("existing", "alternative", "custom")
# Quota status strings from group 4 `water_vs_quota`.
QUOTA_STATUSES = ("within", "tight", "exceeds", "no_quota_given")

# The sentence every forecast response carries (PRD §1). `disclaimer` text is the
# same until `app/twin/config.py` (Session B) publishes a distinct fixed string.
SUPPORT_SENTENCE = "This tool supports, and does not replace, local agronomic expertise."


def _f64(name: str, value: np.ndarray, shape: tuple[int, ...]) -> np.ndarray:
    arr = np.asarray(value, dtype=np.float64)
    if arr.shape != shape:
        raise ValueError(f"{name} must have shape {shape}, got {arr.shape}")
    return arr


@dataclass(frozen=True)
class Slot:
    """One plan cell. `season` is spring | summer | fall | winter. `crop_id` may be `fallow`."""

    year_index: int
    season: str
    crop_id: str

    def __post_init__(self) -> None:
        if self.season not in SEASONS:
            raise ValueError(f"season must be one of {SEASONS}, got {self.season!r}")
        if self.year_index < 1:
            raise ValueError("year_index starts at 1; year 0 is the baseline state")


@dataclass(frozen=True)
class WeatherYear:
    """One year of weekly weather. Arrays are shape (52,): degC for temperature, mm for rain and ET0."""

    year: int  # historical year label that was sampled (PRD §5.3)
    tmax: np.ndarray
    tmin: np.ndarray
    rain: np.ndarray
    et0: np.ndarray

    def __post_init__(self) -> None:
        shape = (WEEK_COUNT,)
        object.__setattr__(self, "tmax", _f64("tmax", self.tmax, shape))
        object.__setattr__(self, "tmin", _f64("tmin", self.tmin, shape))
        object.__setattr__(self, "rain", _f64("rain", self.rain, shape))
        object.__setattr__(self, "et0", _f64("et0", self.et0, shape))


@dataclass(frozen=True)
class Weather:
    """Historical or ensemble weather.

    `years` shape (n_years,) holds historical year labels.
    `tmax`, `tmin`, `rain`, `et0` shape (n_years, 52), degC or mm.
    An ensemble member uses n_years = horizon (PRD §6.4 `build_members`).
    """

    years: np.ndarray
    tmax: np.ndarray
    tmin: np.ndarray
    rain: np.ndarray
    et0: np.ndarray

    def __post_init__(self) -> None:
        years = np.asarray(self.years)
        if years.ndim != 1:
            raise ValueError(f"years must have shape (n_years,), got {years.shape}")
        n = int(years.shape[0])
        object.__setattr__(self, "years", years.astype(np.int64, copy=False))
        grid = (n, WEEK_COUNT)
        object.__setattr__(self, "tmax", _f64("tmax", self.tmax, grid))
        object.__setattr__(self, "tmin", _f64("tmin", self.tmin, grid))
        object.__setattr__(self, "rain", _f64("rain", self.rain, grid))
        object.__setattr__(self, "et0", _f64("et0", self.et0, grid))

    def year_slice(self, index: int) -> WeatherYear:
        return WeatherYear(
            year=int(self.years[index]),
            tmax=self.tmax[index],
            tmin=self.tmin[index],
            rain=self.rain[index],
            et0=self.et0[index],
        )


@dataclass(frozen=True)
class SoilProps:
    """Root-zone water holding and texture used by the weekly bucket (PRD §5.2, §6.4).

    `taw_mm_per_m` is total available water, mm per metre of root depth.
    `sand`, `silt`, `clay`, `soc_pct` are percent (0–100). `soc_pct` is organic
    carbon percent; SoilGrids `soc` in g/kg converts by dividing by 10 (1 % = 10 g/kg).
    Water-retention estimates that are not yet verified stay in the catalog or
    `twin/config.py` with a source or TODO(verify). This type does not pick them.
    """

    taw_mm_per_m: float
    sand: float
    silt: float
    clay: float
    soc_pct: float


@dataclass(frozen=True)
class SoilOverride:
    """Optional farmer soil test on a field (PRD §6.2). Percents."""

    sand_pct: float
    silt_pct: float
    clay_pct: float
    organic_carbon_pct: float


@dataclass(frozen=True)
class IrrigationCfg:
    """Field irrigation. `quota_mm_per_season` is omitted when the farmer did not enter one."""

    available: bool
    quota_mm_per_season: float | None = None


@dataclass(frozen=True)
class Selection:
    crops: tuple[str, ...]
    pinned: tuple[str, ...] = ()
    excluded: tuple[str, ...] = ()


@dataclass(frozen=True)
class SelectionOverride:
    crops: tuple[str, ...]
    pinned: tuple[str, ...] = ()
    excluded: tuple[str, ...] = ()


@dataclass(frozen=True)
class Plan:
    """A strategy expanded to a horizon of slots (PRD §5.1, §6.4)."""

    strategy_id: str
    slots: tuple[Slot, ...]
    cycle_years: int


@dataclass(frozen=True)
class PlanYear:
    """The slots for one simulated year. `year_index` is 1..horizon (year 0 is the baseline state).

    Passed to `run_water_year` and the soil updates (PRD §6.4). Every slot's
    `year_index` matches `year_index`.
    """

    year_index: int
    slots: tuple[Slot, ...]

    def __post_init__(self) -> None:
        if self.year_index < 1:
            raise ValueError("PlanYear.year_index starts at 1")
        bad = [s for s in self.slots if s.year_index != self.year_index]
        if bad:
            raise ValueError("every PlanYear slot must use that year's year_index")


@dataclass
class State:
    """Annual soil and pest state carried between years (PRD §5.4, §6.4).

    Relative indices start at 100 in year 0 (`infiltration_idx`). `soc_fast` and
    `soc_slow` are the two carbon pools in the same relative units the soil
    module documents. `n_pool` is the nitrogen pool (kg N/ha, basis assumed when
    the coefficients are unverified). `pest` maps a crop family id to its
    pressure index (0–100). Within-year soil water is not stored here; it lives
    inside `run_water_year` and is returned on `WaterYearResult`.
    """

    soc_fast: float
    soc_slow: float
    infiltration_idx: float
    n_pool: float
    pest: dict[str, float] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.pest = {str(k): float(v) for k, v in self.pest.items()}


@dataclass(frozen=True)
class WaterYearResult:
    """Weekly FAO-56 bucket for one member-year (PRD §5.2). Arrays are shape (52,).

    Mass balance, each week i, within 1e-6 mm (the W6a test):

        rain_mm[i] + irrigation_mm[i]
            == etc_mm[i] + runoff_mm[i] + drainage_mm[i] + delta_storage_mm[i]

    `irrigation_mm` is water applied. `irrigation_need_mm` is unmet ETc before
    the quota cap (PRD: irrigation need = unmet ETc). They differ when the
    quota binds or irrigation is unavailable.

    `etc_mm` is ETc = Kc × ET0 × Ks (actual crop ET, called ETa in FAO Irrigation
    and Drainage Paper 33). `etm_mm` is Kc × ET0 (ETm in that paper), kept so the
    yield response `1 - Ya/Ym = Ky (1 - ETa/ETm)` can be applied without
    recomputing Kc. https://www.fao.org/4/x0490e/x0490e0b.htm is the FAO-56 Kc
    chapter; the Paper 33 relation is the one named in PRD group 4.

    `infiltration_factor` is the weekly multiplier in
    `infiltrated = rain × infiltration_factor` (dimensionless).
    `cover` is the cover fraction. `bare_weeks` counts weeks with cover < 0.25.
    `storage_end_mm[0] = storage_start_mm + delta_storage_mm[0]`, then each week
    follows the previous end. Storage must not go negative.

    `yield_t_ha` and `forage_yield_t_ha` are this member-year's point estimates
    (t/ha, modeled) keyed by crop id. p10/p90 are aggregated across members into
    `YearSeries`, not stored on one member.
    """

    rain_mm: np.ndarray
    irrigation_mm: np.ndarray
    irrigation_need_mm: np.ndarray
    infiltrated_mm: np.ndarray
    runoff_mm: np.ndarray
    etc_mm: np.ndarray
    etm_mm: np.ndarray
    drainage_mm: np.ndarray
    storage_end_mm: np.ndarray
    delta_storage_mm: np.ndarray
    infiltration_factor: np.ndarray
    ks: np.ndarray
    cover: np.ndarray
    bare_weeks: int
    storage_start_mm: float
    yield_t_ha: dict[str, float]
    forage_yield_t_ha: dict[str, float]

    def __post_init__(self) -> None:
        shape = (WEEK_COUNT,)
        for name in (
            "rain_mm", "irrigation_mm", "irrigation_need_mm", "infiltrated_mm", "runoff_mm",
            "etc_mm", "etm_mm", "drainage_mm", "storage_end_mm", "delta_storage_mm",
            "infiltration_factor", "ks", "cover",
        ):
            object.__setattr__(self, name, _f64(name, getattr(self, name), shape))
        if self.bare_weeks < 0 or self.bare_weeks > WEEK_COUNT:
            raise ValueError("bare_weeks must be between 0 and 52")
        object.__setattr__(self, "yield_t_ha", {str(k): float(v) for k, v in self.yield_t_ha.items()})
        object.__setattr__(self, "forage_yield_t_ha", {str(k): float(v) for k, v in self.forage_yield_t_ha.items()})


@dataclass(frozen=True)
class FieldCfg:
    """One field as the simulator sees it (PRD §6.2 fields[], §6.4 `simulate`).

    `no_till` is copied from the farm constraints onto each field because the
    water year does not receive the whole request. `existing_rotation` is the
    string `preset` or that field's slots.
    """

    field_id: str
    name: str
    area_ha: float
    slope_class: str
    irrigation: IrrigationCfg
    existing_rotation: str | tuple[Slot, ...]
    no_till: bool
    soil_override: SoilOverride | None = None
    polygon: dict | None = None
    selection_override: SelectionOverride | None = None

    def __post_init__(self) -> None:
        if self.slope_class not in SLOPE_CLASSES:
            raise ValueError(f"slope_class must be one of {SLOPE_CLASSES}")
        if self.area_ha <= 0:
            raise ValueError("area_ha must be > 0")
        if not (self.existing_rotation == "preset" or isinstance(self.existing_rotation, tuple)):
            raise ValueError("existing_rotation must be 'preset' or a tuple of Slots")


@dataclass(frozen=True)
class Constraints:
    equipment: tuple[str, ...]
    max_cycle_years: int
    no_till: bool
    labour_level: str
    livestock_on_farm: bool

    def __post_init__(self) -> None:
        if self.labour_level not in LABOUR_LEVELS:
            raise ValueError(f"labour_level must be one of {LABOUR_LEVELS}")
        if not 1 <= self.max_cycle_years <= 10:
            raise ValueError("max_cycle_years must be 1..10")


@dataclass(frozen=True)
class CropPrice:
    """Farmer-entered price. `unit` is the farmer's unit string, for example per tonne. Never invented."""

    value: float
    unit: str


@dataclass(frozen=True)
class InputCosts:
    fertilizer_per_kg_n: float | None = None
    seed_per_ha: dict[str, float] | None = None
    irrigation_per_mm_ha: float | None = None
    labour_per_hour: float | None = None


@dataclass(frozen=True)
class Economics:
    currency: str
    crop_prices: dict[str, CropPrice] = field(default_factory=dict)
    input_costs: InputCosts = field(default_factory=InputCosts)


@dataclass(frozen=True)
class Ramp:
    """Scenario values are reached at the end of the horizon (PRD §5.7). Shape is linear; basis is assumed."""

    shape: str = "linear"
    years: int = HORIZON_YEARS_DEFAULT
    basis: str = "assumed"

    def __post_init__(self) -> None:
        if self.shape != "linear":
            raise ValueError("only ramp shape 'linear' is specified")
        if self.basis != "assumed":
            raise ValueError("ramp basis is assumed")
        if not HORIZON_YEARS_MIN <= self.years <= HORIZON_YEARS_MAX:
            raise ValueError("ramp years must be 5..10")


@dataclass(frozen=True)
class ScenarioApplied:
    """Existing scenario echo plus the year-0→horizon ramp (PRD §6.3).

    `preset`, scales, `label` and `note` match `features.pipeline.resolve_scenario`.
    `label` is `modeled scenario, not a forecast`. `note` is `built from observed years`
    unless a verified climate dataset replaces it (decision D2, Session C).
    """

    preset: str
    rain_scale_pct: float
    temp_offset_c: float
    rain_scale_by_season: dict[str, float]
    label: str
    note: str
    ramp: Ramp = field(default_factory=Ramp)


@dataclass(frozen=True)
class Number:
    """A reported quantity (PRD §6.3). Absolute estimates also set p10, p50 and p90."""

    value: float
    unit: str
    basis: str
    confidence: str
    p10: float | None = None
    p50: float | None = None
    p90: float | None = None

    def __post_init__(self) -> None:
        if self.basis not in BASIS_VALUES:
            raise ValueError(f"basis must be one of {BASIS_VALUES}")
        if self.confidence not in CONFIDENCE_VALUES:
            raise ValueError(f"confidence must be one of {CONFIDENCE_VALUES}")
        if not self.unit:
            raise ValueError("unit is required")


@dataclass(frozen=True)
class YearPoint:
    """One year of a trajectory. Year 0 is the baseline. p10 and p90 are the ensemble range."""

    year: int
    p50: float
    p10: float | None = None
    p90: float | None = None

    def __post_init__(self) -> None:
        if not 0 <= self.year <= HORIZON_YEARS_MAX:
            raise ValueError("year must be 0..10")


@dataclass(frozen=True)
class YearSeries:
    metric: str
    unit: str
    basis: str
    confidence: str
    needs_local_review: bool
    points: tuple[YearPoint, ...]

    def __post_init__(self) -> None:
        if self.basis not in BASIS_VALUES:
            raise ValueError(f"basis must be one of {BASIS_VALUES}")
        if self.confidence not in CONFIDENCE_VALUES:
            raise ValueError(f"confidence must be one of {CONFIDENCE_VALUES}")
        if not self.unit:
            raise ValueError("unit is required")


@dataclass(frozen=True)
class ForecastRequest:
    """Farmer request (PRD §6.2). `priorities` is the existing FarmerPriorities object.

    `scenario` is a preset name (`Scenario`) or a `ScenarioInput` dict.
    `fields` is omitted when the whole farm is one field taken from the site record.
    Prices and costs are never defaulted: leave `economics` as None when the farmer
    entered none (income is then null).
    """

    selection: Selection
    constraints: Constraints
    horizon_years: int
    climate_source: str
    strategy_count: int = STRATEGY_COUNT_DEFAULT
    priorities: dict = field(default_factory=dict)
    scenario: str | dict = "baseline"
    fields: tuple[FieldCfg, ...] | None = None
    farm_water_quota_mm_per_season: float | None = None
    custom_strategies: tuple[tuple[Slot, ...], ...] | None = None
    market_ratings: dict[str, int] | None = None
    economics: Economics | None = None

    def __post_init__(self) -> None:
        if self.climate_source not in CLIMATE_SOURCES:
            raise ValueError(f"climate_source must be one of {CLIMATE_SOURCES}")
        if not HORIZON_YEARS_MIN <= self.horizon_years <= HORIZON_YEARS_MAX:
            raise ValueError("horizon_years must be 5..10")
        if not STRATEGY_COUNT_MIN <= self.strategy_count <= STRATEGY_COUNT_MAX:
            raise ValueError("strategy_count must be 2..4")
        n = len(self.selection.crops)
        if not SELECTION_MIN <= n <= SELECTION_MAX:
            raise ValueError("selection.crops must hold 2..30 crop ids")
        if self.fields is not None and not 1 <= len(self.fields) <= FIELD_COUNT_MAX:
            raise ValueError("fields must hold 1..20 entries")


def request_hash(req: dict) -> str:
    """sha256 hex of canonical JSON (PRD §6.4).

    Keys are sorted at every object. Encoding is UTF-8 with `ensure_ascii=False`
    and compact separators, so the same dict always yields the same 64-character
    hex digest on every machine. Non-finite numbers are rejected. The digest is
    not truncated (the v1.1 rotation hash is a different function and stays 16 chars).
    """

    if not isinstance(req, dict):
        raise TypeError("request_hash expects a dict of JSON values")
    blob = json.dumps(req, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def member_seed(req_hash: str, member: int) -> int:
    """Ensemble seed for one member (PRD §5.3).

    `seed = int(sha256(request_hash + member_index)[:8], 16)`.

    The hash input is the UTF-8 text of `req_hash` immediately followed by the
    decimal member index (0-based). `[:8]` is the first eight hex characters of
    the digest. Pass the result to `numpy.random.default_rng`.
    """

    if not isinstance(member, int) or isinstance(member, bool) or member < 0:
        raise ValueError("member index must be an integer >= 0")
    digest = hashlib.sha256(f"{req_hash}{member}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16)
