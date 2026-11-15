"""POST /sites/{site_id}/forecast and /forecast/sensitivity."""

from fastapi import APIRouter, Body

from app.services.forecast import forecast
from app.services.sensitivity import sensitivity

router = APIRouter(tags=["forecast"])


@router.post("/sites/{site_id}/forecast")
def post_forecast(site_id: str, body: dict = Body(...)):
    return forecast(site_id, body)


@router.post("/sites/{site_id}/forecast/sensitivity")
def post_forecast_sensitivity(site_id: str, body: dict = Body(...)):
    return sensitivity(site_id, body)
