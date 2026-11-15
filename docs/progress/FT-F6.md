# FT-F6 — Farm co-pilot (Person B)

Date: 2026-11-15.

## What was built
- `lib/copilot/copilot.ts`: snapshot builder (ids and slider values only, never forecast numbers), request builder (message ≤ 1000 chars, last 6 turns), zustand chat store, plain error text for 422 / 429 / 503, one-sentence term explanations (evapotranspiration, NDVI, soil-moisture anomaly, p10–p90).
- `components/copilot/CopilotPanel.tsx`: slide-over chat connected to the screen (farm, field, year or month, scenario sliders, strategy, selected item). States that answers come from this screen's numbers and need local checks; shows "Check locally" tips; slow-reply notice after 8 s; errors in plain words; Esc closes.
- `components/copilot/AskCopilot.tsx` buttons with prefilled questions: strategy bar, review flags (engine data only), rotation planner cards, 2D field popovers. Header "Ask co-pilot" button.
- Future store: `horizon` and `monthIndex` (used by F5 and the snapshot).

## Tests
`lib/copilot/copilot.test.ts` (snapshot shape, limits, errors, terms, ask/send against the contract fixture).

## Gaps
- `/copilot/chat` is not mounted yet (B9). Mock mode returns the contract placeholder reply.
