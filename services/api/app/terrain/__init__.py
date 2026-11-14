"""Terrain source adapters (BE-01).

Public API consumed by scan orchestration (BE-03) and packaging (BE-10):

    from app.terrain import ElevationGrid, TerrainSource, get_terrain_source_chain
    from app.terrain.precomputed import PrecomputedSource
    from app.terrain.grid_utils import choose_grid_size, utm_epsg_for_bbox

The chain (Prompt 31) will live in app.terrain.chain once HRDEM + NASADEM are
implemented; Prompt 29 delivers the foundation.
"""
from app.terrain.types import ElevationGrid, TerrainSource

__all__ = ["ElevationGrid", "TerrainSource"]
