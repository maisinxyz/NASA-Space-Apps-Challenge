import json
import httpx

import pytest
from fixtures_lib import contract
from app.services import copilot


@pytest.fixture(autouse=True)
def reset(monkeypatch):
    copilot._requests.clear()
    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    yield
    copilot._requests.clear()


def request():
    return {"message": "Explain this field", "snapshot": {"farm_id": "ubc-farm", "site_id": "site_ubc_farm", "field_id": "d3-brassicas", "horizon": "years", "time_index": 1, "scenario": {"preset": "baseline"}, "strategy_id": "rot_existing", "selected": None}, "history": []}


def test_grounded_request_and_response(client, monkeypatch):
    calls = []
    def fake(payload, key):
        calls.append((payload, key))
        return {"reply": "A reconstructed demo estimate.", "referenced_layers": ["water_demand_mm"], "local_validation_tips": ["Check local soil."]}
    monkeypatch.setattr(copilot, "_provider", fake)
    result = client.post('/api/v1/copilot/chat', json=request())
    assert result.status_code == 200, result.text
    contract.validate_response(result.json(), "/copilot/chat", "post", "200")
    payload, key = calls[0]
    assert key == "test-key" and payload["model"] == "openai/gpt-oss-120b"
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert "tools" not in payload
    assert "planting orders" in payload["messages"][0]["content"]
    context = json.loads(payload["messages"][1]["content"].removeprefix("Server-supplied context: "))
    assert context["metrics"]["water_demand_mm"]["unit"] == "mm/yr"
    assert "reconstructed" in context["description"].lower()
    assert context["glossary"] and "50 km" in context["weather_resolution"]
    assert "test-key" not in result.text


def test_validation_limits_and_server_only_values(client, monkeypatch):
    monkeypatch.setattr(copilot, "_provider", lambda *a: pytest.fail("provider called"))
    for edit in (lambda b: b.update(message="x" * 1001), lambda b: b.update(history=[{"role":"user", "content":"x"}] * 7), lambda b: b["snapshot"].update(forecast_value=100), lambda b: b["snapshot"].update(farm_id="wrong")):
        body = request(); edit(body)
        result = client.post('/api/v1/copilot/chat', json=body)
        assert result.status_code == 422
        assert result.json()["error"]["code"] == "INVALID_INPUT"


def test_rate_and_missing_key(client, monkeypatch):
    monkeypatch.setattr(copilot, "_provider", lambda *a: {"reply": "ok", "referenced_layers": [], "local_validation_tips": []})
    for _ in range(copilot.LIMIT):
        assert client.post('/api/v1/copilot/chat', json=request()).status_code == 200
    result = client.post('/api/v1/copilot/chat', json=request())
    assert result.status_code == 429 and result.json()["error"]["retryable"] is True
    copilot._requests.clear()
    monkeypatch.delenv("GROQ_API_KEY")
    monkeypatch.setattr(copilot, "dotenv_values", lambda *a, **kw: {})
    result = client.post('/api/v1/copilot/chat', json=request())
    assert result.status_code == 503 and result.json()["error"]["code"] == "DATA_SOURCE_UNAVAILABLE"


def test_provider_failure_is_sanitized(client, monkeypatch):
    class FailedClient:
        def __init__(self, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def post(self, *args, **kwargs):
            raise httpx.ConnectError("secret provider detail")
    monkeypatch.setattr(copilot.httpx, "Client", FailedClient)
    result = client.post('/api/v1/copilot/chat', json=request())
    assert result.status_code == 503
    assert "secret" not in result.text and "test-key" not in result.text


def test_unavailable_context_is_honest(client, monkeypatch):
    calls = []
    monkeypatch.setattr(copilot, "_provider", lambda payload, key: calls.append(payload) or {"reply": "Not in the data.", "referenced_layers": [], "local_validation_tips": []})
    body = request(); body["snapshot"]["horizon"] = "months"; body["snapshot"]["time_index"] = 0
    assert client.post('/api/v1/copilot/chat', json=body).status_code == 200
    context = json.loads(calls[-1]["messages"][1]["content"].removeprefix("Server-supplied context: "))
    assert context["kind"] == "climatology"
    assert context["metrics"]["water_balance_mm"]["unit"] == "mm"
    body = request(); body["snapshot"]["strategy_id"] = "rot_custom_1"
    assert client.post('/api/v1/copilot/chat', json=body).status_code == 200
    assert "not in the reconstructed demo data" in calls[-1]["messages"][1]["content"]


def test_offline_never_calls_provider(client, monkeypatch):
    monkeypatch.setenv("OFFLINE", "1")
    monkeypatch.setattr(copilot, "_provider", lambda *args: pytest.fail("provider called while offline"))
    result = client.post('/api/v1/copilot/chat', json=request())
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "DATA_SOURCE_UNAVAILABLE"


def test_sunflower_question_runs_the_forecast_without_a_provider(client, monkeypatch):
    monkeypatch.setenv("OFFLINE", "1")
    monkeypatch.setattr(copilot, "_provider", lambda *args: pytest.fail("planting comparison called the provider"))
    body = request()
    body["message"] = "What outcome would planting sunflower have in the future?"
    response = client.post("/api/v1/copilot/chat", json=body)
    assert response.status_code == 200, response.text
    result = response.json()
    contract.validate_response(result, "/copilot/chat", "post", "200")
    assert "Spring barley with Sunflower once in year 1" in result["reply"]
    assert "Historical weather" in result["reply"]
    assert "Drier summers" in result["reply"]
    assert set(result["referenced_layers"]) == {"irrigation_need_mm", "soil_organic_index"}
    assert "36%" not in result["reply"]


def test_year_zero_snapshot_supplies_baseline_numbers(client, monkeypatch):
    calls = []
    monkeypatch.setattr(copilot, "_provider", lambda payload, key: calls.append(payload) or {
        "reply": "The soil index starts at 100.",
        "referenced_layers": ["soil_organic_index"],
        "local_validation_tips": ["Check the baseline with a local soil test."],
    })
    data = request()
    data["snapshot"]["time_index"] = 0
    response = client.post("/api/v1/copilot/chat", json=data)
    assert response.status_code == 200
    context = json.loads(calls[0]["messages"][1]["content"].removeprefix("Server-supplied context: "))
    assert context["metrics"]["soil_organic_index"]["p50"] == 100


def test_openrouter_fallback_when_groq_fails_or_missing(client, monkeypatch):
    calls = []
    def fake(payload, key, url=copilot.URL):
        calls.append((key, url))
        if url == copilot.URL:
            raise copilot.ApiError("DATA_SOURCE_UNAVAILABLE", "down", retryable=True)
        return {"reply": "ok", "referenced_layers": [], "local_validation_tips": []}
    monkeypatch.setattr(copilot, "_provider", fake)
    monkeypatch.setenv("OPENROUTER_API_KEY", "or-key")
    assert client.post('/api/v1/copilot/chat', json=request()).status_code == 200
    assert calls == [("test-key", copilot.URL), ("or-key", copilot.OPENROUTER_URL)]
    calls.clear()
    monkeypatch.delenv("GROQ_API_KEY")
    monkeypatch.setattr(copilot, "dotenv_values", lambda *a, **kw: {})
    assert client.post('/api/v1/copilot/chat', json=request()).status_code == 200
    assert calls == [("or-key", copilot.OPENROUTER_URL)]
