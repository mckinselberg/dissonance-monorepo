# Data Pipeline — Sourcing and Processing Real-World Terrain Data

This is the manual, human-driven part of the pipeline (QGIS, USGS/OpenTopography,
MapMyRun) — none of it can be automated by an AI agent, since it requires
external accounts, GUI tools, and your own recorded GPS tracks. Follow this if
you're repeating the process for a different park or trail.

The end goal is four files in `apps/trail-viewer/public/data/`:

| File | What it is |
|---|---|
| `smr-heightmap.png` | 16-bit grayscale DEM, EPSG:26918 (UTM), meters |
| `smr-heightmap.json` | The "projection contract" — bbox (UTM meters), pixel dimensions, elevation min/max |
| `smr-trails.geojson` | OSM trail ways, WGS84 lat/lon |
| `my-track.gpx` | A recorded GPX track, WGS84 lat/lon |

## 1. Trail data (OpenStreetMap via Overpass Turbo)

1. Go to **overpass-turbo.eu**, zoom to your area of interest.
2. Run:
   ```
   [out:json];
   (
     way["highway"~"path|footway|track"]({{bbox}});
   );
   out geom;
   ```
3. Export → Download/Export data → GeoJSON. Save as `smr-trails.geojson`.

You can filter to a specific trail loop in QGIS afterward if the full network
is too large — but the full network is fine, filtering can happen in code
later.

**Tip:** you can compute the exact bounding box of your exported trails
directly from the GeoJSON (min/max lat/lon across all coordinates) — this is
more reliable than eyeballing a map view, and guarantees your DEM download
will actually cover all your trail data. A ~300–400m margin on top of that
extent is enough.

## 2. Elevation data (USGS DEM)

### Getting the raw GeoTIFF

Two options — try OpenTopography first, fall back to USGS National Map if you
hit friction:

**Option A — OpenTopography (portal.opentopography.org)**

1. Data → find "USGS 1/3 arc-second DEM" (or similar 10m USGS dataset) → open
   its request form.
2. Under "Select area of data to process" there are text fields for the
   bounding box. **Watch the field order carefully** — on this form it's
   **Xmin, Ymin, Xmax, Ymax** (X = longitude, Y = latitude), *not* the more
   intuitive Xmin/Xmax/Ymin/Ymax. Getting this wrong silently creates a
   bounding box spanning huge, wrong regions (e.g. down near Antarctica) —
   if you see an error like "current selection area is 131,650,243 km²",
   this is almost certainly why. Click "Validate coordinates and estimate
   area" and confirm it reports a sane number (low double-digit km² for a
   single park) before proceeding.
3. Output format: GeoTIFF. Skip any "Raster Visualization" section
   (hillshade/slope/etc. are optional derived products, not what you want).
4. Submitting can 403 if the session isn't logged in (even for non-restricted
   datasets) — creating a free account and logging in first can resolve it,
   but switching to Option B is often faster.

**Option B — USGS National Map Downloader (apps.nationalmap.gov/downloader)**

1. Search/pan to your bounding box.
2. Check **Elevation Products (3DEP) → 1/3 arc-second DEM**, click Search
   Products.
3. Download the one matching tile (USGS 1/3 arc-second tiles are a full 1°×1°
   block, named like `USGS_13_n41w075` — comfortably covers a whole park).
   No account/login required.

### Processing in QGIS

Install QGIS (qgis.org/download, "Long Term Version") if you don't have it.

1. **Load both layers**: the raw DEM GeoTIFF and `smr-trails.geojson`. Visually
   confirm the trails sit on the terrain where expected. QGIS may prompt for a
   datum transformation (e.g. NAD83 ↔ WGS84) if your layers use different
   geographic datums — this is normal (not an error) and the default
   transform (a few meters of accuracy) is fine; check "Make default" to stop
   it asking every time.
2. **Reproject both layers to EPSG:26918** (NAD83 / UTM zone 18N — adjust the
   zone number for your longitude if outside the NY/NJ area). Right-click each
   layer → Export → Save As... (raster) / Save Features As... (vector), set
   CRS to EPSG:26918.
3. **Crop the DEM** to your bbox with margin. Use the Processing Toolbox
   (search "clip raster by extent") rather than hunting through menus — more
   reliable across QGIS versions. Use "Calculate from Layer" to auto-fill the
   full raster extent, then manually nudge each bound inward ~20–30m — this
   trims the ragged NoData slivers that reprojection (a geographic-to-UTM
   rotation) leaves at the corners.
4. **Rescale to 0–65535 and export as a 16-bit PNG.** This is the fiddliest
   step — see the callout below.
5. **Record the projection contract** in `smr-heightmap.json`: the final UTM
   bbox (minX, minZ, maxX, maxZ in meters), pixel width/height, and the
   elevation min/max (meters) that map to 0 and 65535.

```json
{
  "crs": "EPSG:26918",
  "bbox": { "minX": 557054.68, "minZ": 4507812.46, "maxX": 562726.64, "maxZ": 4512144.02 },
  "pixelWidth": 733,
  "pixelHeight": 419,
  "elevation": { "min": 24.74, "max": 176.90 }
}
```

> **Why "minZ/maxZ" and not "minY/maxY"?** The bbox is recorded in the *world*
> axis convention `packages/geo` uses (Y = elevation, Z = the horizontal axis
> UTM northing maps to) — see [architecture.md](architecture.md) for the full
> axis-handedness explanation.

#### Callout: the PNG export step is genuinely annoying in QGIS

QGIS's raster **Save As...** dialog and the **Translate (Convert Format)**
Processing tool both restrict output formats to whatever GDAL drivers support
`Create()` — and PNG only supports `CreateCopy()`, so **PNG doesn't appear as
an option in either dialog**, even though GDAL can absolutely write PNG. Two
ways around this:

- **Easiest, if you have terminal access**: QGIS bundles its own GDAL binaries
  (e.g. `C:\Program Files\QGIS <version>\bin\gdal_translate.exe`). Run the
  rescale-and-convert in one command:
  ```
  gdal_translate -ot UInt16 -a_nodata 0 -scale <realMin> <realMax> 0 65535 -of PNG input.tif output.png
  ```
  This does the linear 0–65535 rescale, the UInt16 cast, and the PNG
  conversion all at once — no intermediate files, no resampling surprises.
- **All inside QGIS, if you don't have terminal access**: use **Raster
  Calculator** to rescale to 0–65535 (`(layer - min) / (max - min) * 65535`,
  output type UInt16) into a new GeoTIFF, then use the raster **Save As...**
  dialog (not Translate) to convert *that* GeoTIFF to PNG — the classic Save
  As dialog does list PNG, unlike Translate.
  - **Watch out**: Raster Calculator's "Output cell size" defaults to
    unset, which silently resamples onto *square* pixels rather than
    preserving the input's true (usually non-square, e.g. ~7.7m × ~10.3m for
    a geographic-to-UTM reprojected DEM) pixel spacing — this changes your
    pixel dimensions and desyncs them from what you recorded in step 3.
    Either explicitly set the output cell size to match the input, or just
    use the `gdal_translate` one-liner above, which doesn't resample at all.

## 3. Ground-truth track (MapMyRun or similar)

Export a GPX of a run/hike you actually recorded in the area — ideally one
that covers part of the trail network you pulled from OSM, so you can
visually cross-check alignment later.

- On the workout's detail page, look for a **"⋯"** menu → **"Download as
  TCX"** (the downloaded file is a proper GPX despite the label on some
  MapMyRun UI versions), or **"Export this Route (GPX, KML)"** if you're on a
  route rather than a logged activity.
- Save as `my-track.gpx`.

## Sanity-checking your files before handing off

A few cheap checks that catch most mistakes before they cost you a debugging
session later:

- **Bbox consistency**: reverse-geocode a couple of corner points (or just
  eyeball them against a map) to confirm they're actually in the right
  place, not on the other side of the world from a sign/field-order mistake.
- **GeoTIFF sanity**: you can inspect a GeoTIFF's dimensions, pixel size, and
  CRS without GDAL installed by parsing the TIFF header directly (a plain
  IFD/tag reader in ~80 lines of Node is enough) — useful for verifying a
  downloaded raw DEM before spending time in QGIS on it.
- **GPX/GeoJSON bbox overlap**: parse the GPX/GeoJSON yourself (a few lines of
  Node) and check the lat/lon bounding box of your trail/track data falls
  well inside your DEM's bbox, with margin to spare.
