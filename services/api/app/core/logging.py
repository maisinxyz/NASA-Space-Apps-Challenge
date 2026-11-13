"""Logging setup and per-request timing."""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request

log = logging.getLogger("fieldtwin.request")


def configure_logging(level: str) -> None:
    logging.basicConfig(level=level, format="%(asctime)s %(levelname)s %(name)s %(message)s")


def install_request_logging(app: FastAPI) -> None:
    @app.middleware("http")
    async def _timing(request: Request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        ms = (time.perf_counter() - start) * 1000
        log.info("%s %s -> %d in %.1f ms", request.method, request.url.path, response.status_code, ms)
        return response
