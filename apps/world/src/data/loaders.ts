import {
  parseGeoJsonTrails,
  parseGpxTrack,
  type HeightmapContract,
  type GeoPolyline,
} from '@dissonance/geo';
import type { SavedView } from '../ui/ViewToolsRow';
import { parseRouteDocument, type ReplayRoute } from '../ui/RouteReplay';
import { WorldFeatureRegistry } from '../world/WorldFeatureRegistry';
import type { LocationEntry } from '../world/LocationProps';

export async function loadHeightmap(): Promise<{ contract: HeightmapContract; pngBytes: Uint8Array }> {
  const [contract, pngResponse] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/smr-heightmap.json`).then((r) => r.json()),
    fetch(`${import.meta.env.BASE_URL}data/smr-heightmap.png`),
  ]);
  const pngBytes = new Uint8Array(await pngResponse.arrayBuffer());
  return { contract, pngBytes };
}

export async function loadTrails(): Promise<GeoPolyline[]> {
  const geojson = await fetch(`${import.meta.env.BASE_URL}data/smr-trails.geojson`).then((r) => r.json());
  return parseGeoJsonTrails(geojson);
}

export async function loadGpxTrack(): Promise<GeoPolyline[]> {
  const gpxXml = await fetch(`${import.meta.env.BASE_URL}data/my-track.gpx`).then((r) => r.text());
  return parseGpxTrack(gpxXml);
}

// Curated, committed alternative to pasting Copy View's clipboard output by
// hand — see ViewToolsRow's own comment. Same shape Copy View produces,
// plus a human-readable "name". Edited directly by Dan; not written by the
// app. Lives in public/data/ (fetched at runtime) rather than a static
// import from docs/ — consistent with every other data file this app loads
// (heightmap, trails, gpx track), and means editing it doesn't require a
// rebuild to see reflected, just a page reload.
export async function loadSavedViews(): Promise<SavedView[]> {
  return fetch(`${import.meta.env.BASE_URL}data/views.json`).then((r) => r.json());
}

// Landmark manifest (T21's proposed landmarks.geojson, in JSON-array form
// for now) — named real-world points, optionally tagged with which
// LocationProps prop types to thin-instance there. Grows by hand for now,
// same as views.json.
export async function loadLocations(): Promise<WorldFeatureRegistry> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/locations.json`);
  if (!response.ok) throw new Error(`Could not load world features (${response.status}).`);
  const raw = await response.json() as unknown;
  if (!Array.isArray(raw)) throw new Error('World feature data must be a JSON array.');
  const entries = raw as LocationEntry[];
  return new WorldFeatureRegistry(entries);
}

type RouteManifestEntry = { name: string; file: string };

export async function loadReplayRoutes(): Promise<ReplayRoute[]> {
  const manifestResponse = await fetch(`${import.meta.env.BASE_URL}data/routes/index.json`);
  if (!manifestResponse.ok) throw new Error(`Could not load route index (${manifestResponse.status}).`);
  const manifest = await manifestResponse.json() as RouteManifestEntry[];
  return Promise.all(manifest.map(async ({ name, file }) => {
    const response = await fetch(`${import.meta.env.BASE_URL}data/routes/${encodeURIComponent(file)}`);
    if (!response.ok) throw new Error(`Could not load route "${file}" (${response.status}).`);
    const route = parseRouteDocument(await response.json(), file);
    return { ...route, id: file, name };
  }));
}
