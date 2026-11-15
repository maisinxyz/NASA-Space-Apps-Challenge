.PHONY: dev test seed fixtures types

dev:
	cd services/api && uv run uvicorn app.main:app --reload --port 8000

test:
	uv run --project packages/contracts pytest packages/contracts -q
	cd services/api && uv run pytest -q
	cd apps/web && pnpm test

seed:
	uv run --project services/api python scripts/build_seed.py
	uv run --project services/api python scripts/build_rotation_fixtures.py

fixtures:
	uv run --project packages/contracts python scripts/make_fixtures_terrain.py
	uv run --project packages/contracts python scripts/make_fixtures_json.py

types:
	cd apps/web && pnpm types
