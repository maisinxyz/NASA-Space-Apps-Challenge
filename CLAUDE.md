# FieldTwin — rules for every Claude Code session

FieldTwin: a website that turns a farm photo + location into a 3D model, replays real NASA POWER storms on it, and compares 3 crop rotations (NASA Space Apps 2026, "Field Shift"). Full spec: `prd.md`. Task prompts: `Prompts.md`.

## Layout
- `apps/web/` — front-end (Next.js)
- `services/api/` — back-end (FastAPI)
- `packages/contracts/` — `openapi.yaml`, JSON schemas, fixtures (the shared contract)
- `data/seed/` — pre-built curated-site data · `data/cache/`, `data/uploads/` — gitignored
- `scripts/` — fixtures, seed, smoke, bench scripts
- `docs/progress/` — one note per finished prompt (`<prompt-number>.md`); read the ones your prompt names

## Stack
- **web:** Next.js App Router + TypeScript + Tailwind + react-three-fiber + MapLibre GL + Framer Motion + Zustand + Recharts. Package manager: pnpm.
- **api:** Python 3.11+, FastAPI, NumPy, SciPy, rasterio, scikit-image, Pillow, httpx, pytest. Use `uv` if installed, else venv + pip.

## Source of truth
- `prd.md` §6 and `packages/contracts/openapi.yaml` define every schema, endpoint, and file format.
- Never invent endpoints, fields, or enum values. If something is missing from the contract, STOP and ask the user instead of guessing.
- Contract changes need: a message to the team, a version bump, updated fixtures (see README).

## Anti-hallucination
- Never invent external API URLs, parameter names, dataset names, constants, or licenses.
- If the PRD marks a fact "verify", look it up (web) or ask. Record the source URL in a code comment or doc.
- Mark any unverified value with `TODO(verify)`.

## Scope
- Do only the task in the current prompt. Do not start the next task.
- Do not refactor unrelated code. Do not touch files owned by other tracks unless the prompt says so.

## Honesty (PRD §2.4, §6.7)
- Every simulation number shows units and a basis label: measured / derived / modeled / assumed / relative.
- Simulation outputs are relative comparisons, never predictions. No yield, profit, or absolute soil-loss figures.
- Curated sites show a "Pre-built" badge. Mock data shows a "mock" badge in dev and must never reach the demo.
- Drone/video capture appear only as Roadmap items; never shown working.
- Show "This tool supports, and does not replace, local agronomic expertise." where the PRD asks.
- Same inputs → same outputs (determinism). `OFFLINE=1` → serve seed data only, no external calls.
- Every dataset listed with source, license, attribution.

## Git
- Commit directly to `main`; `git pull --rebase` before work and before pushing. Include the prompt ID. This supersedes historical branch instructions (implementation-plan/README.md).
- Small commits. Keep `main` runnable.
- Never commit secrets (`.env`) or imagery whose license forbids redistribution.

## Start of every task
- Do the prompt's STEP 0 (coordination) first, using the "Track owners" table in `Prompts.md`.

## End-of-task checklist
a. Run the relevant tests / lint / build and show the results.
b. Tick the acceptance criteria from the PRD card: say which pass and which don't.
c. Write `docs/progress/<prompt-number>.md`: what was built, files touched, how to run it, known gaps, anything the next prompt must know.
d. Remind the user to merge their branch and to message the people under "WHEN DONE, TELL" in STEP 0.
e. Stop and wait for the user.

## Commands (fill in as they become real)
- `make dev` — start the API on :8000 (serves fixtures; docs at /api/v1/docs). `OFFLINE=1 make dev` for offline mode
- `make test` — pytest (packages/contracts, services/api) + Vitest (apps/web)
- `make seed` — build curated-site seed data (not yet implemented)
- `make fixtures` — regenerate mock fixtures (deterministic; terrain/frames then JSON/SSE)
- `make types` — regenerate `apps/web/lib/api/schema.d.ts` from openapi.yaml (commit the result)
- `pnpm dev` (in `apps/web`) — web app on :3000; syncs fixtures to `public/mock` first. `NEXT_PUBLIC_API_MODE=live` to use the API
- `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test` (in `apps/web`)
