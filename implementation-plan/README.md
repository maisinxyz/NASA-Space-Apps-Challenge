# Implementation plan: how the 5 of us work

Project: FieldTwin (NASA Space Apps 2026, "Field Shift: Adapting Farms with NASA Data"). Root docs: `../prd.md` (full spec), `../CLAUDE.md` (rules for every Claude session), `../packages/contracts/openapi.yaml` (frozen API contract).

## Teams

| Folder | People | Job |
| --- | --- | --- |
| `section-1-web-experience-3d-ui/` | 2 | The web app: 3D land viewer, water replay, UI/UX, demo polish |
| `section-2-nasa-data-algorithm/` | 2 | NASA data use and our own algorithm: ingestion, simulation, scoring, suggestions |
| (this folder) | 1 integrator | Moves between teams, owns the contract, keeps both sides compatible, runs the demo path |

Each team folder has:
- `PRD.md`: what we are building and why. A **living document**. Draft v0.1 only; the team must flesh it out in the kickoff prompt (prompt 01) and keep it current.
- `Prompts.md`: numbered prompts for Claude Code, run in order. Each prompt is short and self-contained.
- `progress.md`: append-only log. Every prompt ends by adding a 5-10 line entry. The next prompt reads only this, not old chats.

## Rules for everyone

1. **Update the PRD** whenever a decision changes or a question is answered. Add a row to its "Change log". An out-of-date PRD is a bug.
2. **Contract first.** Anything that crosses between Section 1 and Section 2 (new fields, new endpoints) goes through the contract change process in `../README.md`: message the team, bump the `openapi.yaml` version, update fixtures. The integrator approves.
3. **Mock/live switch.** Section 1 builds against fixtures (`NEXT_PUBLIC_API_MODE=mock`). Section 2 ships real outputs in the same shapes. Swapping is one setting.
4. **Honesty rules** from `../CLAUDE.md` apply to both sections (basis labels, "relative, not prediction", pre-built badge).
5. **Token-saving habit:** start each Claude session with the prompt's "Read" list only. Do not ask Claude to read the whole repo or the whole root PRD.
6. Branches: `fe/S1-xx-slug` (Section 1), `be/S2-xx-slug` (Section 2), merge to `main` often, keep `main` runnable.

## Integrator checklist (per day)

- Morning: each team posts "doing / blocked / needs from other team" (3 lines).
- After each merged prompt: run `make test` and `pnpm dev` in mock mode; confirm nothing else broke.
- Keep an "Interfaces" table current (below). Walk each team through the other's PRD once.
- First real-data handoff: Section 2 serves one real curated site; Section 1 swaps mock to live on it; fix mismatches.

## Interfaces (what crosses the boundary)

| Section 2 gives | Section 1 uses it for |
| --- | --- |
| TerrainPackage (heightmap, normals, texture, layers) | 3D terrain and layer toggles |
| Storm list, weather summary, return periods | Storm picker, Trends |
| Simulation frames (FTW1), risk PNG, metrics per rotation | Water replay, HUD, difference overlay |
| Evidence cards, insights with anchors, zone actions | Pop-ups, Rotation Lab |
| (planned) scenario setting, resilience profile, uncertainty range | "Field Shift" slider, range bars |

Planned items in the last row are not in contract v1.0.0 yet. They need a contract change.

## Open team-level questions

- Data source wording: this plan says **NASA** data throughout (NASA POWER and other NASA Earth observations). If you meant NVIDIA, say so and fix this file.
- Omniverse: see Section 1 PRD, decision D1. Decide in S1 prompt 01.
- Who is who: fill names in each PRD's "Owners" table.
