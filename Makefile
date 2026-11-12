.PHONY: dev test seed fixtures types

dev:
	@echo "dev: not yet implemented"

test:
	@echo "test: not yet implemented"

seed:
	@echo "seed: not yet implemented"

fixtures:
	uv run --project packages/contracts python scripts/make_fixtures_terrain.py

types:
	@echo "types: not yet implemented"
