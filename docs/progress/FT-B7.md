# FT-B7 — Monthly climatology

`GET /sites/{siteId}/outlook` returns the next 1–12 calendar months as a typical-year climatology starting the following UTC month. Each month's observations are drawn from the NASA POWER 1991–2024 historical record. Temperature is a monthly mean, rain and reference water balance are monthly totals, and frost and heat are counts of days crossing the engine's assumed thresholds (heat at 32 °C or above, frost at 0 °C or below). Reference water balance uses rain minus Hargreaves ET0, the same balance as the weekly features. Incomplete months are excluded from the corresponding statistic. Requested presets are applied with the existing seasonal rain and temperature rules.

The central value is the historical monthly mean. The range starts at the historical 10th and 90th percentiles and broadens toward the historical extrema with lead time, as a display range convention. The midpoint is the median. Responses are cached by site, scenario, length, and start month.

The default response uses `climatology` for every month. An optional seasonal overlay is described below.

- [NASA POWER daily API](https://power.larc.nasa.gov/docs/services/api/)
- [FAO Irrigation and Drainage Paper 56](https://www.fao.org/4/x0490e/x0490e00.htm)

The co-pilot month context uses this endpoint's site-level outlook. Month selection is zero-based (0–11). It supplies the chosen month's values, units, basis, glossary, and weather resolution to Groq. Monthly snapshots use the selected scenario preset. The contract contains no field rotation identity, so the context is site-level.

Verification: UBC and KPU responses pass the contract validator, cached HTTP responses meet the 300 ms target, month bounds reject invalid inputs, and year rollover/scenario tests pass.

The seasonal overlay is available when `OPEN_METEO_SEASONAL=1` is set in the API environment. It applies Open-Meteo ECMWF SEAS5 monthly ensemble-mean temperature and precipitation anomalies to the POWER record for matching months of the baseline. The API uses the shifted historical spread to describe uncertainty. The overlay leaves other months and what-if presets on climatology. When offline or upstream data is unavailable, the baseline also uses climatology. Seasonal results refresh hourly. [Open-Meteo seasonal API](https://open-meteo.com/en/docs/seasonal-forecast-api)
