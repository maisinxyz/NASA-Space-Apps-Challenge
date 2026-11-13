"""Field notes (P2). In-memory only: notes are lost when the API restarts."""

from __future__ import annotations

from datetime import UTC, datetime
from threading import Lock

from app.services.terrain import require_terrain

_notes: list[dict] = []
_lock = Lock()


def list_notes(terrain_id: str) -> list[dict]:
    return [n for n in _notes if n["terrain_id"] == terrain_id]


def create_note(note: dict) -> dict:
    require_terrain(note["terrain_id"])
    with _lock:
        created = {
            **{k: v for k, v in note.items() if v is not None},
            "id": f"note_{len(_notes) + 1:03d}",
            "created_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        _notes.append(created)
    return created


def reset() -> None:
    with _lock:
        _notes.clear()
