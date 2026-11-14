# S2 Step 0 (PRODUCT): scenario scaffolding for the 12 scenarios

Not committed (orchestrator commits). Did not touch Globe.tsx, components/viewer/cesium/**, types.ts or scenario.ts (contract unchanged).

## What exists
- `lib/twin/scenarios/registry.ts`: `SCENARIO_DEFS` (12), `scenarioById`, `FAMILY_LABEL/ORDER`, `composeFrame(run)` (calls ATMOSPHERE + GROUND, readouts echo the inputs, basis "assumed").
- `lib/twin/scenarios/atmosphere/index.ts` (Person 1): `ATMOSPHERE` all `CLEAR_SKY`. `ground/index.ts` (Person 2): `GROUND` all `[]`. Header comments state owner and rules.
- `lib/twin/scenarios/clock.ts`: input clamping/resolution, clock spec (unit and steps per scenario, derived from inputs), labels like "Hour 14 of 72", stepping.
- `lib/twin/scenarios/runSource.ts`: `RunSource = "none" | "fixture"`, `EMPTY_RUN_MESSAGE`.
- UI: `components/farm/ScenarioPanel.tsx` (cards by family, scenario panel, clock), `components/farm/useScenarioRun.ts` (ticker + frame; only runs when runSource != "none"), Detail selector in the TwinPanel left panel.
- `GlobeHome({ runSource = "none" })` passes `weather`, `groundLayers`, `detail` to Globe. Product always "none": no effect is rendered; Simulate shows cards, inputs, empty state, disabled clock ("No run yet").
- Store keys: scenarioId, scenarioInputs (per scenario id), scenarioProgress, scenarioPlaying, scenarioSpeed, scenarioRotation, detail. Reset key restores them; selecting another farm clears the open scenario (keeps inputs, speed, detail).
- Share link: `sc` (scenario id), `si` (`id:value,...`), `dt` (detail; omitted when medium). Decode validates ids, drops unknown inputs, clamps to min/max, ignores scenario for explore farms.
- `/dev/scenarios`: Cornell twin, same screen, bottom banner "DEV FIXTURE: synthetic inputs, not real data, never shown in the product." and the "Fixture run source" checkbox. Readouts show a "synthetic" chip when fixture.
- Mead removed (file, registry, framing, tests, Methods wording, dev tracer presets). 4 pins remain; no pin has verified coordinates (Methods says pins are approximate).

## How Person 1 / 2 plug in
1. Open `/dev/scenarios`, pick a scenario card, tick "Fixture run source", press Play (or scrub / step).
2. Person 1: write evaluators in `lib/twin/scenarios/atmosphere/`, register in `ATMOSPHERE`. Person 2: same in `ground/`, register in `GROUND`.
3. Read inputs by id from `registry.ts` (`run.inputs`), progress 0..1, `run.rotationId`, `run.timeS`. Updates arrive at ~30 Hz.
4. Need a new input or readout? Ask product; edit registry only via product.

## Decisions / notes
- `secondsAtOneX` is treated as wall seconds for the WHOLE scenario at 1x (contract comment says "progress units"; ambiguous, I documented the meaning in registry.ts).
- Clock unit/length is not in ScenarioDef, so `clockSpec` in clock.ts maps each id (e.g. heat wave counts days, trends counts years from the start year; compound = dry days + 3).
- Input defaults must sit on the step grid (tested).
- Reduced motion: no autoplay, Play disabled with an explanation, step/scrubber still work.

## Gaps
- Real run source (backend) does not exist; event picker is a disabled slot.
- Share link does not carry the clock position or rotation.
- Static scenario (flood zones) has no clock (disabled).
- `pnpm build` not run (as instructed). Known failing test: lib/api/client.test.ts (CRLF).
