from fastapi import APIRouter

from app.services import crops as svc

router = APIRouter(tags=["crops"])


@router.get("/crops")
def list_crops():
    return svc.list_crops()
