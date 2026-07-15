export type GeoPoint = {
  lat: number;
  lon: number;
  elevation?: number;
};

// Shared shape for both OSM trail ways and the recorded GPX track, so
// downstream rendering code treats them identically.
export type GeoPolyline = {
  points: GeoPoint[];
  source: 'osm' | 'gpx';
  tags?: Record<string, string>;
};
