"""POST /forecast/sensitivity. Same body as /forecast. The grid uses fewer members."""

from __future__ import annotations

from copy import deepcopy

from app.twin.explain.grid import SENSITIVITY_MEMBERS, run_grid


def sensitivity(site_id: str, body: dict, *, members: int = SENSITIVITY_MEMBERS) -> dict:
    """15-cell rain by temperature grid. ``members`` defaults to 4, not the forecast's 30."""

    from app.services.forecast import _cache_key, _read_cache, _write_cache, prepare

    key = _cache_key("sensitivity", site_id, body, members)
    cached = _read_cache(key)
    if cached is not None:
        return cached
    prepared = prepare(site_id, body)
    doc = run_grid(prepared, members=members)
    _write_cache(key, doc)
    return deepcopy(doc)
