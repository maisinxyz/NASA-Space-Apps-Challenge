"""GET /sites/{site_id}/exposure. W9 registers this router in app/main.py."""

from fastapi import APIRouter, Query

from app.twin.exposure import exposure_report

router = APIRouter(tags=["forecast"])


@router.get("/sites/{site_id}/exposure")
def get_exposure(site_id: str, crops: str | None = Query(default=None)):
    return exposure_report(site_id, crops)
