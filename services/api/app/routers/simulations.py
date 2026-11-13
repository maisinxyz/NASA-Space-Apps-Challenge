from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse

from app.core.types import RotationIdPath, RotationIdQuery, SimIdPath, SimulationRequest, asset
from app.services import simulations as svc

router = APIRouter(tags=["simulations"])


@router.post("/simulations")
def create_simulation(body: SimulationRequest):
    status, cached = svc.run_simulation(body.terrain_id, body.storm_id, body.rotation_ids)
    return JSONResponse(status, status_code=200 if cached and status["status"] == "done" else 202)


@router.get("/simulations/{sim_id}")
def get_simulation(sim_id: SimIdPath):
    return svc.get_simulation(sim_id)


@router.get("/simulations/{sim_id}/frames/{rotation_id}.bin")
def get_frames(sim_id: SimIdPath, rotation_id: RotationIdPath):
    return asset(svc.frames_path(sim_id, rotation_id), "application/octet-stream")


@router.get("/simulations/{sim_id}/risk/{rotation_id}.png")
def get_risk(sim_id: SimIdPath, rotation_id: RotationIdPath):
    return asset(svc.risk_path(sim_id, rotation_id), "image/png")


@router.get("/simulations/{sim_id}/evidence")
def get_evidence(sim_id: SimIdPath):
    return svc.get_evidence(sim_id)


@router.get("/simulations/{sim_id}/diff")
def get_diff(sim_id: SimIdPath, a: RotationIdQuery, b: RotationIdQuery, request: Request):
    """Content-negotiated: Accept image/png -> grid; otherwise DiffStats JSON."""
    accept = request.headers.get("accept", "")
    if "image/png" in accept and "application/json" not in accept:
        return FileResponse(svc.diff_png(sim_id, a, b), media_type="image/png", headers={"Vary": "Accept"})
    return JSONResponse(svc.diff_stats(sim_id, a, b), headers={"Vary": "Accept"})
