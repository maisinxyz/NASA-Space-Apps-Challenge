from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import StreamingResponse

from app.core.types import ScanIdPath
from app.services import scans as svc

router = APIRouter(tags=["scans"])


@router.post("/scans", status_code=202)
def create_scan(
    lat: Annotated[float, Form(ge=-90, le=90)],
    lon: Annotated[float, Form(ge=-180, le=180)],
    images: Annotated[list[UploadFile] | None, File()] = None,
    bbox: Annotated[str | None, Form()] = None,
    name: Annotated[str | None, Form(max_length=120)] = None,
):
    return svc.create_scan(lat, lon, bbox, [img.content_type for img in images or []])


@router.get("/scans/{scan_id}")
def get_scan(scan_id: ScanIdPath):
    return svc.get_scan(scan_id)


@router.get("/scans/{scan_id}/events")
async def scan_events(scan_id: ScanIdPath, request: Request):
    stream = await svc.scan_events(scan_id, request.app.state.settings.sse_delay_s)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
