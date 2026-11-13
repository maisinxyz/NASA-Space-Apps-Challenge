"""Read mock fixtures from packages/contracts/fixtures/. Services call this until real logic lands."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from app.core.config import FIXTURES_DIR
from app.core.errors import ApiError

MOCK_SIM_ID = "sim_mock_001"
MOCK_SCAN_ID = "scan_mock_001"
MOCK_FAIL_SCAN_ID = "scan_mock_fail"
DEFAULT_TERRAIN = "terr_mock_hills"  # storms/rotations exist only for this terrain


class FixtureStore:
    def __init__(self, root: Path = FIXTURES_DIR):
        self.root = root

    def path(self, rel: str) -> Path:
        p = (self.root / rel).resolve()
        if self.root.resolve() not in p.parents or not p.is_file():
            raise FileNotFoundError(rel)
        return p

    def exists(self, rel: str) -> bool:
        try:
            self.path(rel)
            return True
        except FileNotFoundError:
            return False

    def json(self, rel: str):
        try:
            return json.loads(self.path(rel).read_text())
        except FileNotFoundError as e:
            raise ApiError("INTERNAL", f"Missing fixture {rel}. Run `make fixtures`.", retryable=False) from e

    def text(self, rel: str) -> str:
        return self.path(rel).read_text()

    def terrain_ids(self) -> list[str]:
        return sorted(p.parent.name for p in (self.root / "terrain").glob("*/terrain.json"))


@lru_cache(maxsize=1)
def store() -> FixtureStore:
    return FixtureStore()
