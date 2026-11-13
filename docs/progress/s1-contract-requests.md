# Section 1 contract requests R1/R2 | 2026-11-12

Status: prepared locally, not sent; not additions to frozen v1.0.0. Data/integration owners must agree on the wire format and route. This note proposes no new endpoint.

## R1 — Field polygons

Needed for field picking, draping and the field panel. Request the fields already described in Section 1 PRD §4.4: id, name, WGS84 GeoJSON polygon, area_ha, illustrative_crop, and data_status (synthetic/derived). Agree availability per terrain/site, polygon validity and source attribution. Existing local mock: `apps/web/public/mock-extras/fields.json`, enabled only by `NEXT_PUBLIC_MOCK_EXTRAS=1`, labelled Illustrative (synthetic).

## R2 — Per-field summary

Needed for area, mean slope, dominant cover and simulation metrics per rotation, each with units and contract basis labels. Agree missing-data behavior and how a summary identifies its field, terrain, simulation and rotation. Until approved, the UI uses mock polygon area and client-derived approximate mean slope; it does not fabricate simulation summaries.

Before implementation: notify the team, obtain integrator approval, bump the contract version, update fixtures and regenerate client types, following README.md. Suggested coordination from Prompts.md: Hansini (terrain/cover) and Vince (simulation/integration decision), with Max for integration. No message has been sent by this work.
