# FieldTwin 2D Farm Map PRD

## Goal

Give UBC Farm and KPU Langley a north-up overview that shows surrounding streets and land alongside the farm. Keep the photorealistic Cesium arrival and provide a quick way back to the same 3D viewpoint.

## Renderer decision

The existing Cesium bird’s-eye camera is sufficient for a wider shot of the 3D scene. A dedicated MapLibre view is justified when the team wants a flat, north-up map for spatial orientation and future field and data overlays. Keep the farm ID and analysis state in the existing app store so either renderer can consume the same selection.

## First release

- Keep 3D Explore as the default. Add a **2D Map** button to the farm controls at UBC and Langley. Offer **3D Explore**, **Reset map**, and **Globe** from the flat view.
- Fit a roughly 3 km by 3 km area around the configured farm point on first open. Mark that approximate point and show a scale bar, zoom controls, and imagery credit. Support keyboard and pointer navigation.
- Use the published 2022 municipal aerial imagery. Use Vancouver's Web Mercator tile cache at UBC and the Township of Langley's export endpoint for imagery reprojected to Web Mercator at KPU. Show the source and imagery year. Keep a route back to 3D if the map or imagery fails.
- Load MapLibre on demand, pause Cesium's render loop while 2D is active, and remove the 2D viewer when leaving the map. Keep each farm's 2D camera for the current app session. Preserve the existing 3D camera and farm workspace state.
- The initial release uses the existing desktop farm workspace and two presentation sites. The app's narrow-screen fallback remains available. Plot boundaries and NASA data integration are follow-up work.

## Follow-up

Add field selection when usable geometry is available. Use the same farm, field, layer and month identifiers across both renderers. Connect the planned calendar to one regional climate summary per selected farm and label the imagery date independently from the climate period.

## Acceptance

1. Enter UBC or KPU from a farm link. 3D is available before loading MapLibre.
2. Open 2D by keyboard or pointer. Aerial imagery and attribution appear and the farm point is visible with neighborhood context.
3. Pan or zoom, return to 3D, and reopen 2D. Each renderer resumes its previous camera. Reset map returns to the neighborhood framing.
4. If imagery requests fail, the 3D return control stays available. The source at each farm is credited while its imagery is visible.
5. On the presentation laptop, record first tile time and return-to-3D time for both farms. Switch ten times and check for WebGL context loss or steadily rising memory.

## References

- [MapLibre raster tiles](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-raster-tile-source/)
- [MapLibre camera and fitBounds](https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/)
- [City of Vancouver 2022 orthophotos](https://opendata.vancouver.ca/explore/dataset/orthophoto-imagery-2022/information/)
- [City of Vancouver tile service](https://tiles.arcgis.com/tiles/qrcTTRTwUoS8N47o/arcgis/rest/services/Orthophotos_2022/MapServer)
- [Township of Langley 2022 orthophoto service](https://mapsvr.tol.ca/arcgisext02/rest/services/CachedServices/Ortho_2022/MapServer)
