# FT-B1 — CMIP6 weather deltas

The forecast now passes the selected climate source and site to the weather ensemble and embedded climate outlook. The existing preset mapping is confirmed: baseline has no stored delta, drier summers and wetter winters use SSP2-4.5, and both uses SSP5-8.5. Weather uses each seasonal median delta and a linear ramp to the forecast horizon. An unavailable table retains the preset slider. The outlook cites the dataset and reports the pathway, models, and baseline and future windows.

The committed seeds use NASA NEX-GDDP-CMIP6 downscaled daily data at 0.25° via NCCS THREDDS. Both seeds compare 2031–2040 with 1995–2014, using ACCESS-CM2, ACCESS-ESM1-5, BCC-CSM2-MR, and CMCC-ESM2. Verified the v2.0 file names and sampled DAP attributes. The sampled temperature inputs report CC BY-SA 4.0 and precipitation inputs CC BY 4.0. The combined deltas retain CC BY-SA 4.0, and the sidecars now use the repository's standard metadata field names.

- [NASA NCCS dataset and THREDDS access](https://www.nccs.nasa.gov/data-collections/nex-gddp-cmip6/)
- [NASA v2 technical note and per-file terms](https://www.nccs.nasa.gov/wp-content/uploads/2025/06/NEX-GDDP-CMIP6-v2-Tech_Note.pdf)

Verification: the API suite passed all 267 tests, including offline seed checks, real UBC and KPU delta loading, year-10 seasonal math, and forecast propagation and provenance. Running the entire suite with a global `OFFLINE=1` makes the existing live-health assertion fail by design. The suite's offline checks set offline mode in their own fixtures.
