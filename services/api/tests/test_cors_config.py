from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app


def test_cors_origins_from_env(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example.com/, http://localhost:3000")
    monkeypatch.setenv("CORS_ORIGIN_REGEX", r"https://.*\.vercel\.app")
    s = Settings()
    assert s.cors_origins == ("https://a.example.com", "http://localhost:3000")
    client = TestClient(create_app(s))
    pre = {"Access-Control-Request-Method": "POST"}
    ok = client.options("/api/v1/health", headers={"Origin": "https://pr-1.vercel.app", **pre})
    assert ok.headers.get("access-control-allow-origin") == "https://pr-1.vercel.app"
    bad = client.options("/api/v1/health", headers={"Origin": "https://evil.example.com", **pre})
    assert "access-control-allow-origin" not in bad.headers


def test_cors_default_localhost(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.delenv("CORS_ORIGIN_REGEX", raising=False)
    assert Settings().cors_origins == ("http://localhost:3000",)
    assert Settings().cors_origin_regex is None
