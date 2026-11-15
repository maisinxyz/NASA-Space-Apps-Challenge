"""GET /crop-catalog. W9 registers this router in app/main.py."""

from fastapi import APIRouter, Query

from app.twin.catalog import list_catalog

router = APIRouter(tags=["crops"])


@router.get("/crop-catalog")
def get_crop_catalog(
    category: str | None = Query(default=None),
    site_id: str | None = Query(default=None),
):
    return list_catalog(category=category, site_id=site_id)
