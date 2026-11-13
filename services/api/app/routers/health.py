from fastapi import APIRouter, Request

from app.services import health as svc

router = APIRouter(tags=["system"])


@router.get("/health")
def get_health(request: Request):
    return svc.health(request.app.state.settings)
