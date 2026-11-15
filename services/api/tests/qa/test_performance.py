"""Cold and cached climate-outlook times against the section 9 gates."""

import time

from app.services.climate_outlook import climate_outlook
from app.services.features import base

# PRD section 9. Cold includes reading the POWER seed. Cached is the in-process hit.
COLD_S = 1.0
CACHED_S = 0.150


def test_climate_outlook_meets_the_time_gates():
    base.cache_clear()
    climate_outlook.cache_clear()
    started = time.perf_counter()
    climate_outlook("site_ubc_farm", "baseline")
    cold = time.perf_counter() - started
    started = time.perf_counter()
    climate_outlook("site_ubc_farm", "baseline")
    cached = time.perf_counter() - started
    assert cold < COLD_S, f"cold climate outlook took {cold:.3f}s (gate {COLD_S}s)"
    assert cached < CACHED_S, f"cached climate outlook took {cached:.3f}s (gate {CACHED_S}s)"
