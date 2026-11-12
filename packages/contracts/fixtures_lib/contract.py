"""Validate JSON instances against schemas in packages/contracts/openapi.yaml."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

OPENAPI_PATH = Path(__file__).resolve().parents[1] / "openapi.yaml"
_URI = "urn:fieldtwin:openapi"


@lru_cache(maxsize=1)
def openapi() -> dict:
    return yaml.safe_load(OPENAPI_PATH.read_text())


@lru_cache(maxsize=1)
def _registry() -> Registry:
    return Registry().with_resource(_URI, Resource.from_contents(openapi(), default_specification=DRAFT202012))


def _escape(token: str) -> str:
    return token.replace("~", "~0").replace("/", "~1")


def _validator(pointer: str) -> Draft202012Validator:
    return Draft202012Validator({"$ref": f"{_URI}#{pointer}"}, registry=_registry(), format_checker=FormatChecker())


def response_pointer(path: str, method: str, status: str = "200", content_type: str = "application/json") -> str:
    op = openapi()["paths"][path][method]
    if status not in op["responses"]:
        raise KeyError(f"{method.upper()} {path} has no {status} response")
    return "/" + "/".join(
        _escape(t) for t in ("paths", path, method, "responses", status, "content", content_type, "schema")
    )


def validate_response(instance, path: str, method: str = "get", status: str = "200") -> None:
    """Raise jsonschema.ValidationError if instance does not match the operation's response schema."""
    _validator(response_pointer(path, method, status)).validate(instance)


def validate_schema(instance, name: str) -> None:
    """Validate against #/components/schemas/<name>."""
    _validator(f"/components/schemas/{name}").validate(instance)
