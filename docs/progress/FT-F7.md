# FT-F7 — Crop rotation planner (Person B)

Date: 2026-11-15.

## What was built
- "Plan rotations" button in the farm controls (UBC, KPU) opens `components/rotation-planner/RotationPlanner.tsx`; pure logic in `lib/rotation-planner/planner.ts`.
1. Crop pool picker from `GET /crop-catalog?site_id=…` grouped by category (vegetables, grains, forage, cover, fruit; unknown categories under their own name), search, add, Pin, Exclude. Each crop's trait sources in a details row (a "TODO(verify)" in the source text is shown as "not yet verified").
2. Constraints: catalog equipment, labour level, no-till, livestock, longest cycle, farm water quota (mm/season), number of options (2–4, including the current rotation). Plain-language validation.
3. Year-by-season grid (years 1–10 × spring/summer/fall/winter) per rotation with stable crop colours, and the 12-month calendar of the selected year (meteorological seasons).
4. Custom rotation editor: "Edit the current rotation" copies its cycle into the editor (or start empty), pick a crop per season cell, cycle 1–10 years; "Score beside the others" sends `custom_strategies`.
5. Per rotation: `rotation_explanation` rules (met / broken / unknown, unknown values neutral) and crop-role badges when the API sends them (B8), crop badges, year-10 soil organic index, bare weeks, irrigation need, pest pressure with p10–p90, "why suggested", local checks, review flags, Ask co-pilot.
- Per-field / whole-farm toggle. No income or fertilizer.
- Live mode (`NEXT_PUBLIC_API_MODE=live`) runs `POST /forecast` for every change. Mock mode shows the pre-built UBC run and says changes are scored against the live API.

## Tests
`lib/rotation-planner/planner.test.ts` (request building incl. pins/exclusions/quota/custom, validation, calendar, neutral enums, TODO hiding).

## Gaps
- Vegetables can be picked, but the engine returns no alternatives for vegetable pools until B4 fills the planting windows.
- `rotation_explanation` appears only once B8 ships it.
- KPU has no pre-built run, so in mock mode its planner shows the error.
