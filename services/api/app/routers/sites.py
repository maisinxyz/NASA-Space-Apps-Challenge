from fastapi import APIRouter

from app.core.types import SiteIdPath
from app.services import sites as svc

router = APIRouter(tags=["sites"])


@router.get("/sites")
def list_sites():
    return svc.list_sites()


@router.get("/sites/{site_id}")
def get_site(site_id: SiteIdPath):
    return svc.get_site(site_id)
