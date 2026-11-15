# FT-B8 — Rotation explanations

Forecasts return a rotation explanation for the current rotation, generated alternatives, and custom rotations. The rule text covers cyclic breaks between crop families and alternate hosts, known return intervals, legumes, and cover crops. A missing catalog return interval is reported as unknown. The generator continues using its existing crop-window, labour and equipment filters, and rejects cycles with known host-family or return-interval conflicts. Legumes and cover crops remain scoring preferences.

Field strategies explain the roles supported by their catalog entries and flag unsourced traits for local review. The farm rollup combines crop roles across fields and carries through a broken or uncertain rule where applicable. Custom rotations go through the same simulation and scoring path as the other strategies, including when the selected rotation breaks a rule.

Verification: full API suite passed 292 tests. Regression checks cover UBC vegetable alternatives, custom cereal-family violations, field and rollup explanations, known host/return conflicts, and all five curated-site offline forecasts with three strategies.
