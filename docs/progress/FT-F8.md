# FT-F8 — Labels, Roadmap, Methods and data (Person B)

Date: 2026-11-15.

## What was built
- Methods and data page (`app/methods/page.tsx`): new section "Forecast data: UBC Farm and KPU Langley" from `lib/methods/v4Datasets.ts` — every dataset/service with what it is used for, source link, licence and attribution: NASA POWER, NASA NEX-GDDP-CMIP6 (four models, two SSPs, licence disagreement stated), SoilGrids 2.0, OpenStreetMap outlines, City of Vancouver 2022 and Township of Langley 2022 orthophotos, FAO-56 / Statistics Canada traits, Groq gpt-oss-120b; HLS/SMAP/ECOSTRESS/NASADEM and the Open-Meteo seasonal forecast tagged Roadmap. Climate source, scenario and plain-language modelling assumptions. New "Roadmap" section (30 m grid and hotspots, seasonal forecast, income and fertilizer, drone and video, custom fields in 3D). The lead text no longer says the app has no farm forecasts.
- Lens menu: on engine farms, "Water-stress hotspots", "Erosion & flow", "Uncertainty grid" and "Where to soil-test" are disabled with a "Roadmap" tag (need the 30 m grid / satellite data).
- Licence strings for POWER, SoilGrids and NEX-GDDP-CMIP6 are copied from the backend seed metadata. The two orthophoto licences and the Open-Meteo licence are stated as "not yet confirmed" — owner to confirm before the demo.

## Tests
`components/MethodsPage.test.tsx` checks the new rows and the Roadmap. Web suite 566 passed, typecheck and eslint clean.
