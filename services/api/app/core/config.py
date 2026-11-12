"""Settings from environment. Names match .env.example: OFFLINE, DATA_DIR, LOG_LEVEL."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
FIXTURES_DIR = REPO_ROOT / "packages" / "contracts" / "fixtures"
API_VERSION = "1.0.0"  # contract version, packages/contracts/openapi.yaml info.version
API_PREFIX = "/api/v1"


def _flag(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    offline: bool = field(default_factory=lambda: _flag(os.getenv("OFFLINE")))
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR") or REPO_ROOT / "data"))
    log_level: str = field(default_factory=lambda: (os.getenv("LOG_LEVEL") or "INFO").upper())
    fixtures_dir: Path = FIXTURES_DIR
    sse_delay_s: float = 0.4  # gap between replayed fixture SSE events
    cors_origins: tuple[str, ...] = ("http://localhost:3000",)
