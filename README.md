# Stardew Earth

Stardew Earth helps growers compare crop rotations under changing weather and water constraints. The UBC Farm and KPU Langley forecast uses NASA POWER historical weather, mapped soil, and crop traits to simulate how each rotation affects soil organic matter, infiltration, erosion, and irrigation need over five to ten years. Supported climate scenarios can incorporate changes from NASA NEX-GDDP-CMIP6.

Built for NASA Space Apps Challenge 2026 (Vancouver), challenge "Field Shift: Adapting Farms with NASA Data".

- Spec: [`prd.md`](prd.md)
- Build prompts (one per Claude Code session): [`Prompts.md`](Prompts.md)
- Rules for Claude sessions: [`CLAUDE.md`](CLAUDE.md)

## Layout

| Path | What |
| --- | --- |
| `apps/web/` | Front-end website (Next.js) |
| `services/api/` | Back-end API (FastAPI) |
| `packages/contracts/` | Shared contract: OpenAPI, JSON schemas, mock fixtures |
| `data/seed/` | Pre-built data for curated demo sites |
| `scripts/` | Fixture, seed, smoke, and benchmark scripts |
| `docs/progress/` | One note per finished prompt |

The live API uses bundled source datasets for the curated forecasts. The default web configuration can serve a prebuilt UBC forecast and synthetic fixtures for other demo features. Run the web app and API in live mode to recompute a forecast when the scenario changes. See [web setup](apps/web/README.md) and the [first-year planting comparison](docs/first-year-planting.md).

## Contract change process

The contract (`prd.md` §6 and `packages/contracts/openapi.yaml`) is frozen around hour 3. After the freeze, any change must:

1. **Message the whole team** before merging, saying what changed and why.
2. **Bump the version** in `openapi.yaml` (for example `1.0.0` → `1.1.0`).
3. **Update the fixtures** in `packages/contracts/fixtures/` so mock mode still matches.

## Working agreements (PRD §9.1)

- Contract first; front-end builds against mocks, back-end against the API.
- Commit directly to `main`, pull with `git pull --rebase`, and include the prompt ID. Keep commits small and `main` runnable.
- Mode switches: front-end `NEXT_PUBLIC_API_MODE=mock|live`; back-end `OFFLINE=1`.
- One owner per task. Blocked for more than about 30 minutes? Post the blocker.
