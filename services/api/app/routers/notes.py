from fastapi import APIRouter

from app.core.types import NoteCreate, TerrainIdQuery
from app.services import notes as svc

router = APIRouter(tags=["notes"])


@router.get("/notes")
def list_notes(terrain_id: TerrainIdQuery):
    return svc.list_notes(terrain_id)


@router.post("/notes", status_code=201)
def create_note(body: NoteCreate):
    note = body.model_dump()
    note["anchor"] = list(note["anchor"])
    return svc.create_note(note)
