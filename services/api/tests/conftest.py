import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Reuse the contract validator from packages/contracts.
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "packages" / "contracts"))

from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.services import notes  # noqa: E402


@pytest.fixture()
def client():
    notes.reset()
    with TestClient(create_app(Settings(sse_delay_s=0))) as c:
        yield c
