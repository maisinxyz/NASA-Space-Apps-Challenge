"""One error format everywhere (PRD §6.6, contract decision #4 for status codes)."""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

ErrorCode = Literal[
    "INVALID_INPUT",
    "UNSUPPORTED_FILE",
    "FILE_TOO_LARGE",
    "TERRAIN_COVERAGE_MISSING",
    "DATA_SOURCE_UNAVAILABLE",
    "WEATHER_UNAVAILABLE",
    "SIMULATION_TIMEOUT",
    "NOT_FOUND",
    "INTERNAL",
]

STATUS: dict[str, int] = {
    "INVALID_INPUT": 422,
    "UNSUPPORTED_FILE": 415,
    "FILE_TOO_LARGE": 413,
    "TERRAIN_COVERAGE_MISSING": 422,
    "DATA_SOURCE_UNAVAILABLE": 503,
    "WEATHER_UNAVAILABLE": 503,
    "SIMULATION_TIMEOUT": 504,
    "NOT_FOUND": 404,
    "INTERNAL": 500,
}

log = logging.getLogger("fieldtwin.errors")


class ApiError(Exception):
    def __init__(self, code: ErrorCode, message: str, hint: str | None = None, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.hint = hint
        self.retryable = retryable

    @property
    def status_code(self) -> int:
        return STATUS[self.code]

    def body(self) -> dict:
        err: dict = {"code": self.code, "message": self.message, "retryable": self.retryable}
        if self.hint:
            err["hint"] = self.hint
        return {"error": err}


def not_found(kind: str, item_id: str) -> ApiError:
    return ApiError("NOT_FOUND", f"No {kind} with id '{item_id}'.", "Check the link or go back to the site list.")


def _response(err: ApiError) -> JSONResponse:
    return JSONResponse(err.body(), status_code=err.status_code)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError):
        return _response(exc)

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", ()))
        msg = f"{where}: {first.get('msg', 'invalid input')}" if where else "Invalid input."
        return _response(ApiError("INVALID_INPUT", msg, "Check the request and try again."))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        if exc.status_code == 404:
            return _response(ApiError("NOT_FOUND", "No such endpoint.", "Check the URL."))
        if exc.status_code == 405:
            return JSONResponse(ApiError("INVALID_INPUT", "Method not allowed.").body(), status_code=405)
        return _response(ApiError("INTERNAL", str(exc.detail), retryable=True))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("unhandled error", exc_info=exc)
        return _response(ApiError("INTERNAL", "Something went wrong on our side.", "Try again.", retryable=True))
