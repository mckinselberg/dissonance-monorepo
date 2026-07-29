# Park Map Overlay (Planned — Not Yet Implemented)

Idea: drape the official/designed South Mountain Reservation trail map (an
illustrated park map, currently available as a PDF and PSD) onto the terrain
as a texture, so a player walking around sees it projected on the ground —
distinct from the programmatic OSM trail-line overlay (`smr-trails.geojson`
rendered as line meshes), which is a separate feature that already works.

**Status as of this writing: not implemented in code.** The steps below are
the agreed plan; the data-prep part (steps 1–3) is manual/human work, the
same way the original DEM sourcing was.

## Why this needs more than "just add a PNG"

Draping an image onto the terrain accurately requires the image to be
**georeferenced** — knowing what real-world UTM/lat-lon coordinates each
corner of the image corresponds to — the same kind of "projection contract"
`smr-heightmap.json` records for the DEM.

**Real risk to expect**: illustrated/designed park maps are almost always
stylized, not accurately to scale — trail widths, curves, and distances get
exaggerated for readability on a printed brochure. Draped onto the *actual*
precise DEM/terrain, visible misalignment against the real OSM trail lines
already on the terrain is likely, possibly significant. Worth deciding
upfront whether "roughly evocative" or "precisely aligned" is the actual bar
before investing much time.

## The planned process

1. **Flatten the PDF/PSD to PNG or JPEG.** From Photoshop: File → Export →
   Export As... From a PDF: export a page as an image at high resolution
   (300+ DPI), or open it in Photoshop and rasterize at that resolution.

2. **Georeference it in QGIS**, using **Raster → Georeferencer** (a
   different tool than the Save As/Translate workflow used for the DEM —
   see [data-pipeline.md](data-pipeline.md)):
   - Load `smr-trails.geojson` in the main QGIS window as a real-world
     reference layer.
   - In the Georeferencer window, open the flattened map image, then click
     recognizable points on it (trail junctions, the reservoir, distinctive
     bends) — for each, either type in the real coordinate or use "From Map
     Canvas" to click the matching spot on the reference layer.
   - At least 4–6 points, spread across the image, not clustered.
   - Transformation type: start with "Polynomial 1"; if the map is heavily
     hand-drawn/warped, a higher-order polynomial or Thin Plate Spline may
     fit better.
   - Output CRS: EPSG:26918 (matching everything else). Run the
     georeferencing to produce a georeferenced GeoTIFF.

3. **Crop/export to match the exact same bbox as `smr-heightmap.json`** —
   same "Save As..." pattern used for the DEM, so the map image lines up
   pixel-for-pixel with the terrain's own extent. PNG or JPEG output (or
   GeoTIFF if PNG isn't offered in that dialog — see the data-pipeline doc's
   callout about QGIS's PNG-export quirk).

## The planned implementation (once the georeferenced image exists)

Add texture support to `HeightmapTerrain` (`packages/world`):

- A UV-mapped `albedoTexture` (or a second material/mesh layer) tied to the
  same world-space bbox the heightmap already uses — the mesh already knows
  its own world-space extent (`worldMin`/`worldMax` computed via
  `utmToWorld` in `buildMesh`), so UV coordinates can be derived directly
  from each vertex's position within that bbox, the same way the current
  elevation-tint vertex colors are computed.
- Must stay consistent across all three [scale-tuning.md](scale-tuning.md)
  levels — i.e. respect whatever `horizontalScale` a given level uses, the
  same way trail/GPX draping already does (scale the real-world bbox by
  `horizontalScale` before mapping UVs, not the other way around).
- Likely a new `HeightmapTerrainOptions` field (e.g. `overlayTexture?: {
  url: string; bbox: HeightmapBoundingBox }`), decoupled from the DEM's own
  bbox in case the map image doesn't cover the exact same extent.

Bring the finished georeferenced PNG/JPEG (plus its bbox, mirroring
`smr-heightmap.json`'s shape) to implement this against.
