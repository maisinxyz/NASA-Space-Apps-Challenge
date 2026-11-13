from typing import Annotated

from fastapi import APIRouter, Query

from app.core.types import TerrainIdQuery
from app.services import weather as svc

router = APIRouter(tags=["weather"])


@router.get("/weather/summary")
def get_weather_summary(
    lat: Annotated[float, Query(ge=-90, le=90)],
    lon: Annotated[float, Query(ge=-180, le=180)],
):
    return svc.get_summary(lat, lon)


@router.get("/weather/storms")
def list_storms(terrain_id: TerrainIdQuery):
    return svc.list_storms(terrain_id)
