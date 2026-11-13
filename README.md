# FieldTwin

Give FieldTwin a photo and a location of a farm, and it rebuilds the land as an interactive 3D model, then replays real historical storms (NASA POWER) on it so farmers can see where water pools and soil erodes under different crop rotations.

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

Setup instructions will be added as the apps are scaffolded (Prompts 05 and 06).

## Contract change process

The contract (`prd.md` §6 and `packages/contracts/openapi.yaml`) is frozen around hour 3. After the freeze, any change must:

1. **Message the whole team** before merging, saying what changed and why.
2. **Bump the version** in `openapi.yaml` (for example `1.0.0` → `1.1.0`).
3. **Update the fixtures** in `packages/contracts/fixtures/` so mock mode still matches.

## Working agreements (PRD §9.1)

- Contract first; front-end builds against mocks, back-end against the API.
- Short-lived branches named `fe/FE-xx-slug` or `be/BE-xx-slug`; merge to `main` every few hours; keep `main` runnable.
- Mode switches: front-end `NEXT_PUBLIC_API_MODE=mock|live`; back-end `OFFLINE=1`.
- One owner per task. Blocked for more than about 30 minutes? Post the blocker.
