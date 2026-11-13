.PHONY: dev test seed fixtures types

dev:
	cd services/api && uv run uvicorn app.main:app --reload --port 8000

test:
	uv run --project packages/contracts pytest packages/contracts -q
	cd services/api && uv run pytest -q
	cd apps/web && pnpm test

seed:
	@echo "seed: not yet implemented"

fixtures:
	uv run --project packages/contracts python scripts/make_fixtures_terrain.py
	uv run --project packages/contracts python scripts/make_fixtures_json.py

types:
	cd apps/web && pnpm types
