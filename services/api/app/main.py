"""FieldTwin API. Run: make dev"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import API_PREFIX, API_VERSION, Settings
from app.core.errors import install_error_handlers
from app.core.logging import configure_logging, install_request_logging
from app.routers import crops, health, notes, rotations, scans, simulations, sites, terrain, weather

ROUTERS = (health, sites, scans, terrain, weather, crops, rotations, simulations, notes)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    configure_logging(settings.log_level)
    app = FastAPI(
        title="FieldTwin API",
        version=API_VERSION,
        description="Serves mock fixtures until real services land. Contract: packages/contracts/openapi.yaml.",
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
    )
    app.state.settings = settings
    install_error_handlers(app)
    install_request_logging(app)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    for module in ROUTERS:
        app.include_router(module.router, prefix=API_PREFIX)
    return app


app = create_app()
