import proj4 from 'proj4';

// NAD83 / UTM zone 18N — matches the projection the DEM/trail data was
// exported in (see docs/plans/dissonance-trail-data-poc-prompt.md). WGS84
// vs NAD83 differ by ~1-2m in this region, negligible next to the ~5-15m
// GPS noise this pipeline already tolerates.
proj4.defs('EPSG:26918', '+proj=utm +zone=18 +datum=NAD83 +units=m +no_defs');

export type LatLon = { lat: number; lon: number };
export type UtmCoordinate = { x: number; y: number }; // meters; y = northing
export type WorldXZ = { x: number; z: number };

export function latLonToUtm({ lat, lon }: LatLon): UtmCoordinate {
  const [x, y] = proj4('WGS84', 'EPSG:26918', [lon, lat]);
  return { x, y };
}

export function utmToLatLon({ x, y }: UtmCoordinate): LatLon {
  const [lon, lat] = proj4('EPSG:26918', 'WGS84', [x, y]);
  return { lat, lon };
}

// World space convention (documented, not just implied by the code):
// - origin is the UTM point that maps to world (0, 0) — callers typically
//   pass the center of the heightmap's bounding box, so the terrain mesh
//   ends up centered at the world origin like the existing procedural
//   Terrain (packages/world/src/Terrain.ts) is.
// - +worldX = +UTM easting (east)
// - +worldZ = +UTM northing (north)
// No axis flip: Babylon is left-handed, but nothing in this codebase
// establishes "north = -Z" or any other real-world compass convention for
// the procedural terrain, so there is no existing convention to match.
// East=+X/North=+Z is the simplest consistent choice and is applied
// uniformly to terrain, OSM trails, and the GPX track alike.
export function utmToWorld(utm: UtmCoordinate, origin: UtmCoordinate): WorldXZ {
  return { x: utm.x - origin.x, z: utm.y - origin.y };
}

export function worldToUtm(world: WorldXZ, origin: UtmCoordinate): UtmCoordinate {
  return { x: world.x + origin.x, y: world.z + origin.y };
}

export function latLonToWorld(latLon: LatLon, origin: UtmCoordinate): WorldXZ {
  return utmToWorld(latLonToUtm(latLon), origin);
}

// Mirror of latLonToWorld — for displaying/copying the current position as
// lat/lon (e.g. for hand-building a landmark manifest) rather than only
// ever consuming pasted lat/lon to navigate somewhere.
export function worldToLatLon(world: WorldXZ, origin: UtmCoordinate): LatLon {
  return utmToLatLon(worldToUtm(world, origin));
}

export type UtmBoundingBox = { minX: number; minZ: number; maxX: number; maxZ: number };

// Center of a UTM bounding box, used as the shared world-space origin so
// the whole scene (terrain + trails + GPX track) is centered at (0,0,0).
export function originFromBoundingBox(bbox: UtmBoundingBox): UtmCoordinate {
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minZ + bbox.maxZ) / 2,
  };
}
