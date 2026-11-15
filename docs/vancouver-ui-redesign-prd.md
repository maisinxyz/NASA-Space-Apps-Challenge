# Stardew Earth Vancouver-area UI redesign

**Implementation handoff · November 14, 2026**  
**Review baseline:** [Stardew Earth at 9fdea4f](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/tree/9fdea4f6a14782226ed5351be7372684755d9d4a)

## Outcome

A judge or grower can open UBC Farm, identify the growing plots, and compare a baseline with two crop rotations. KPU Langley demonstrates a second local map with a clear horticulture point of interest. In the default view, the imagery is the dominant surface and the tools fit into a compact header and one shared inspector.

The [NASA challenge brief](https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/?tab=details) calls for rotation decision support informed by NASA data, soil information, crop traits, and farmer priorities. For Stardew Earth, the UBC workflow should make all four inputs traceable.

## Design references

| Reference | Study this | Apply it here |
| --- | --- | --- |
| [Felt Irrigation Upgrade Planning](https://felt.com/gallery/irrigation-upgrade-planning) and [Felt interface tour](https://help.felt.com/getting-started/tour-the-interface) | Open the interactive map from the gallery page. Notice how one legend and focused panels organize agricultural information around the map. | Use Felt as the main reference for the compact header and shared inspector. Keep utilities grouped and the field report easy to find. |
| [Windy](https://www.windy.com/) | Select **Rain, thunder** or **Radar**, then look at the active layer and bottom time controls. | Use Windy as the second main reference. Give playback and time one place along the bottom edge in time-enabled views. Keep one visible layer label at a time and put layer choices behind **Map tools**. |
| [Google Earth Web 3D views and placemarks](https://www.google.com/earth/outreach/learn/create-a-map-or-story-in-google-earth-web/#adding-3d-views) | Save a camera view around a specific place and expose details from its placemark. | Frame the growing plots at UBC and a verified horticulture facility at KPU. |
| [NASA Worldview interactive tour](https://worldview.earthdata.nasa.gov/?tr=worldview_intro) | Inspect the layer source labels and time controls. | Put NASA product, period, and resolution beside the relevant view. Keep imagery attribution visible. |

## Current behavior

Reproduce at [home](http://localhost:3000/), [UBC Farm](http://localhost:3000/#farm=ubc-farm), and [KPU Langley](http://localhost:3000/#farm=kpu-langley). On desktop, both local sites currently advertise explore-only status while offering **Compare strategies**. The shared comparison shows the same fixture scores under **Leaderboard · live**. Controls and help panels can stack over the map. The backend already serves seeded rotation analysis for UBC.

## P0 · Default farm workspace

1. On the homepage, make **UBC Farm** and **KPU Langley** reachable directly from a visible **Vancouver-area demos** group. Use action labels **Compare rotations** and **Explore campus** when those actions are available.
2. Use one compact desktop header, with **← Globe**, **UBC Farm** or **KPU Langley Horticulture**, and **Vancouver, BC** or **Langley, BC** as secondary text. Place the site action and **Map tools** at the trailing edge. At narrow widths, let actions wrap onto a second row. The name and navigation are available while the map loads.
3. Retain the fly-in and respect reduced motion. Center the UBC camera on growing plots. At KPU, confirm the location of the teaching greenhouse or horticulture field lab before placing an exact pin. [UBC Farm](https://ubcfarm.ubc.ca/) · [KPU campus highlights](https://www.kpu.ca/langley/campus-highlights)
4. Start with the inspector closed on both sites. Keep the compass and map attribution visible. Use one opaque desktop inspector, about 320–360 px wide, with a mobile bottom-sheet equivalent. Opening another tool section switches the contents of that inspector.
5. Use **Data & layers**, **Field report**, **Camera & shortcuts**, and **Illustrative previews** inside **Map tools**. Move camera reset, sound, and keyboard help into **Camera & shortcuts**. Put **Reset investigation** in the analysis view. Move **Ask Twin** into the inspector if it is included in the demo.
6. When Satellite is the only available base layer, show it as text in **Data & layers**. Do not render disabled layer pills on the map. Put the status once beside the data, using copy such as **Satellite imagery available · No field observations connected.** List rainfall, soil moisture, crop vigor, and heat and frost under **Illustrative previews**, with the synthetic label visible before opening them.
7. Use concise text labels and one high-emphasis action per view. Keep map controls on solid surfaces. Reserve pill styling for selections or compact status labels.

## P0 · UBC rotation comparison

- **Entry.** The primary UBC action is **Compare rotations**. It opens a readable results workspace using the existing API route `POST /api/v1/sites/site_ubc_farm/rotation-analysis`. Translate the display slug `ubc-farm` at the API boundary. Use the seeded backend for the demo. Loading and retry states remain usable if Cesium or imagery fails.
- **Structure.** Show a single comparison panel with the **Example baseline** first and two alternatives beside it on desktop. Stack on phones and repeat metric labels on each card. Use crop sequences as names. Include bare-soil days per year, modeled seasonal water shortfall in mm, and the relative erosion indicator when returned. Label missing values **Unavailable** and include a short explanation when the backend supplies one.
- **Interaction.** Put **Limited irrigation water** above the results. The seeded UBC service was tested with `{}` and `{"constraints":{"low_water":true}}`. In the first run the alternatives were maize–soybean with rye and alfalfa–winter wheat with rye. With the constraint applied they changed to spring canola–grain sorghum with rye and red clover, and grain sorghum–soybean with rye. Use this as the smoke-test fixture for the default settings. Summarize the change in a short status message. If a configuration leaves fewer than two alternatives, show the remaining results and explain the limiting input.
- **Evidence.** Each strategy has a **Why this option** disclosure for the rationale, benefit, trade-off, and local check. Use the backend evidence fields. Distinguish the assumed baseline from farmer-entered history. Keep the comparison beside a single contextual map and remove the decorative split lines.
- **Provenance.** Label the seeded view **Modeled rotation comparison**. Show NASA POWER daily weather for **1991–2024** at **0.5° × 0.625°** and SoilGrids soil estimates at **250 m** with the relevant limitations. Distinguish regional inputs from observations collected on the farm. Retain the local agronomic expertise statement. [Repository data and methods](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/blob/9fdea4f6a14782226ed5351be7372684755d9d4a/docs/data-and-methods.md#datasets-that-are-stored)
- **Fallback.** If the UBC API is unavailable, show an error and retry control. A synthetic demonstration can be offered as an explicitly selected **Illustrative rotation comparison**. Its label stays visible beside the scores.

## P0 · KPU campus exploration

Open on the horticulture campus with a short site summary and the same compact map controls. The field report describes the facility and links to KPU. Keep the **Explore campus** action tied to the verified area or point of interest. Place any shared synthetic scenario behind **Illustrative previews**. KPU does not inherit UBC analysis or data labels.

## P1 · Timeline and follow-on refinements

- Show the timeline only when the active view has time-indexed content. Combine date, scrubber, play/pause, and the scenario or data label in one bottom bar. Keep it above the attribution area, and ensure the focused control remains visible when the inspector opens.
- If time permits, let growers replace the example baseline with a user-entered crop history. Include editable inputs in the request and make it clear when results update.
- New satellite ingestion, new 3D assets, additional farms, and calibration of the agronomic model are outside this redesign.

## Code entry points

| Area | Current code |
| --- | --- |
| Farm entry and transition | [GlobeHome.tsx](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/blob/9fdea4f6a14782226ed5351be7372684755d9d4a/apps/web/components/globe/GlobeHome.tsx#L750) · [Arrival.tsx](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/blob/9fdea4f6a14782226ed5351be7372684755d9d4a/apps/web/components/hero/Arrival.tsx#L37) |
| Map controls and observations | [FarmView.tsx](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/blob/9fdea4f6a14782226ed5351be7372684755d9d4a/apps/web/components/farm-view/FarmView.tsx#L254) |
| Shared fixture comparison | [Compare.tsx](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/blob/9fdea4f6a14782226ed5351be7372684755d9d4a/apps/web/components/farm-future/Compare.tsx#L20) |
| Existing analysis UI and request | [FE1 comparison components](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/tree/9fdea4f6a14782226ed5351be7372684755d9d4a/apps/web/components/rotation/fe1) · [Frontend API](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/blob/9fdea4f6a14782226ed5351be7372684755d9d4a/apps/web/lib/rotation/api.ts#L14) · [Backend route](https://github.com/maisinxyz/NASA-Space-Apps-Challenge/blob/9fdea4f6a14782226ed5351be7372684755d9d4a/services/api/app/routers/rotation_analysis.py#L10) |

## Acceptance and handoff

- **Home and deep links.** The two local farms open directly. Reloading either farm URL restores the right site. Back to globe works. The site title and controls remain usable during imagery load.
- **Default view.** No open inspector or timeline on arrival. **Map tools** opens one inspector and the tools remain reachable by keyboard. Opening a report or tool replaces the inspector contents instead of stacking overlays.
- **UBC.** From a fresh browser session, open UBC and choose **Compare rotations**. Verify the actual request uses `site_ubc_farm` and the response comes from the seeded analysis. Show the baseline and two alternatives. Record the specific priority change and the result it changes. Simulate an API error and verify retry. Check that the comparison still works with imagery unavailable.
- **KPU.** The camera and label identify the selected horticulture location. The field report opens. Any example is clearly labeled before entry and throughout its results.
- **Responsive and keyboard.** Check at **320, 390, and 1280 CSS px**. No page-level horizontal scrolling or overlap with credits. Tab through the header, inspector, and results, verify focus is visible and unobscured, and return focus to the opener when dismissing the inspector. Check normal text contrast against the control surface. [WCAG reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) · [Focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) · [Minimum contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- **Deliverables.** Provide a branch or PR, repro steps for the UBC priority change, and desktop and mobile screenshots of UBC default, UBC comparison, and KPU default. Identify any remaining fixture-backed UI in the handoff.

If time is short, ship the compact shared workspace and a working UBC comparison first. Keep KPU focused on map exploration and defer the timeline and baseline editor.
