import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export type ReplayPoint = {
  lat: number;
  lon: number;
  heightmap: number;
};

export type ReplayRoute = {
  id: string;
  name: string;
  points: ReplayPoint[];
};

export type RouteReplayProps = {
  routes: ReplayRoute[];
  onSeek: (point: ReplayPoint) => void;
};

const buttonStyle: JSX.CSSProperties = {
  font: 'inherit',
  cursor: 'pointer',
  marginRight: '4px',
  marginTop: '4px',
};

const summaryStyle: JSX.CSSProperties = { font: 'inherit', cursor: 'pointer', color: '#9cf' };

const EARTH_RADIUS_METERS = 6_371_000;

function segmentDistance(a: ReplayPoint, b: ReplayPoint) {
  const toRadians = Math.PI / 180;
  const lat1 = a.lat * toRadians;
  const lat2 = b.lat * toRadians;
  const dLat = (b.lat - a.lat) * toRadians;
  const dLon = (b.lon - a.lon) * toRadians;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function routeDistances(points: ReplayPoint[]) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + segmentDistance(points[i - 1], points[i]));
  }
  return cumulative;
}

function pointAtDistance(points: ReplayPoint[], cumulative: number[], distance: number) {
  if (points.length === 0) return null;
  if (points.length === 1 || distance <= 0) return points[0];
  const total = cumulative[cumulative.length - 1];
  if (distance >= total) return points[points.length - 1];

  let upper = 1;
  while (upper < cumulative.length && cumulative[upper] < distance) upper++;
  const lower = upper - 1;
  const segmentLength = cumulative[upper] - cumulative[lower];
  const amount = segmentLength > 0 ? (distance - cumulative[lower]) / segmentLength : 0;
  const a = points[lower];
  const b = points[upper];
  return {
    lat: a.lat + (b.lat - a.lat) * amount,
    lon: a.lon + (b.lon - a.lon) * amount,
    heightmap: a.heightmap + (b.heightmap - a.heightmap) * amount,
  };
}

function isReplayPoint(value: unknown): value is ReplayPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as ReplayPoint;
  return [point.lat, point.lon, point.heightmap].every(Number.isFinite);
}

export function parseRouteDocument(raw: unknown, fallbackName: string): ReplayRoute {
  if (!raw || typeof raw !== 'object') throw new Error('Route must be a JSON object.');
  const document = raw as {
    name?: unknown;
    points?: Array<{ latLongHeightmap?: unknown }>;
    type?: unknown;
    properties?: { name?: unknown };
    geometry?: { type?: unknown; coordinates?: unknown };
  };

  let points: ReplayPoint[] = [];
  if (Array.isArray(document.points)) {
    points = document.points.map((entry) => {
      const tuple = entry?.latLongHeightmap;
      if (!Array.isArray(tuple) || tuple.length < 3) {
        throw new Error('A route point is missing latLongHeightmap [lat, lon, height].');
      }
      return { lat: Number(tuple[0]), lon: Number(tuple[1]), heightmap: Number(tuple[2]) };
    });
  } else if (
    document.type === 'Feature' &&
    document.geometry?.type === 'LineString' &&
    Array.isArray(document.geometry.coordinates)
  ) {
    points = document.geometry.coordinates.map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 3) {
        throw new Error('A GeoJSON coordinate is missing [lon, lat, height].');
      }
      return { lon: Number(coordinate[0]), lat: Number(coordinate[1]), heightmap: Number(coordinate[2]) };
    });
  } else {
    throw new Error('Expected recorder JSON or a GeoJSON LineString.');
  }

  if (points.length === 0 || !points.every(isReplayPoint)) {
    throw new Error('The route has no valid finite points.');
  }

  const embeddedName =
    typeof document.name === 'string'
      ? document.name
      : typeof document.properties?.name === 'string'
        ? document.properties.name
        : fallbackName;
  return { id: fallbackName, name: embeddedName, points };
}

export function RouteReplay({ routes, onSeek }: RouteReplayProps) {
  const [localRoutes, setLocalRoutes] = useState<ReplayRoute[]>([]);
  const allRoutes = useMemo(() => [...routes, ...localRoutes], [routes, localRoutes]);
  const [routeId, setRouteId] = useState('');
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState('Choose a route');
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const route = allRoutes.find((candidate) => candidate.id === routeId) ?? null;
  const cumulative = useMemo(() => routeDistances(route?.points ?? []), [route]);
  const totalDistance = cumulative[cumulative.length - 1] ?? 0;

  const seek = (nextDistance: number) => {
    if (!route) return;
    const clamped = Math.max(0, Math.min(totalDistance, nextDistance));
    setDistance(clamped);
    const point = pointAtDistance(route.points, cumulative, clamped);
    if (point) onSeek(point);
  };

  useEffect(() => {
    if (!playing || !route) return;
    const tick = (now: number) => {
      const previous = lastTimeRef.current ?? now;
      lastTimeRef.current = now;
      const elapsedSeconds = Math.min(0.1, (now - previous) / 1000);
      setDistance((current) => {
        const next = Math.min(totalDistance, current + elapsedSeconds * speed);
        const point = pointAtDistance(route.points, cumulative, next);
        if (point) onSeek(point);
        if (next >= totalDistance) {
          setPlaying(false);
          setStatus('Replay complete');
        }
        return next;
      });
      if (playing) frameRef.current = requestAnimationFrame(tick);
    };
    lastTimeRef.current = null;
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [playing, route, cumulative, totalDistance, speed, onSeek]);

  const chooseRoute = (id: string) => {
    setPlaying(false);
    setRouteId(id);
    setDistance(0);
    const selected = allRoutes.find((candidate) => candidate.id === id);
    if (!selected) return;
    onSeek(selected.points[0]);
    setStatus(`${selected.points.length} points loaded`);
  };

  const loadFile = async (file: File) => {
    try {
      const parsed = parseRouteDocument(JSON.parse(await file.text()), file.name);
      const routeWithUniqueId = { ...parsed, id: `local:${file.name}:${Date.now()}` };
      setLocalRoutes((current) => [...current, routeWithUniqueId]);
      setPlaying(false);
      setRouteId(routeWithUniqueId.id);
      setDistance(0);
      onSeek(routeWithUniqueId.points[0]);
      setStatus(`${file.name} loaded`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load route');
    }
  };

  return (
    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px' }}>
      <div style={{ color: '#9cf', fontWeight: 700 }}>Route replay</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
        Route:{' '}
        <select
          style={{ flex: 1 }}
          value={routeId}
          onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => chooseRoute(e.currentTarget.value)}
        >
          <option value='' disabled>— choose a route —</option>
          {allRoutes.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
          ))}
        </select>
      </label>
      <input
        type='range'
        min='0'
        max={Math.max(totalDistance, 0.01)}
        step='0.1'
        value={distance}
        disabled={!route}
        style={{ width: '100%', boxSizing: 'border-box', marginTop: '6px' }}
        onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => seek(e.currentTarget.valueAsNumber)}
      />
      <div>
        <button type='button' style={buttonStyle} disabled={!route} onClick={() => seek(0)}>⏮</button>
        <button
          type='button'
          style={buttonStyle}
          disabled={!route}
          onClick={() => {
            if (distance >= totalDistance) seek(0);
            setPlaying((value) => !value);
            setStatus(playing ? 'Paused' : 'Playing');
          }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button type='button' style={buttonStyle} disabled={!route} onClick={() => { setPlaying(false); seek(totalDistance); }}>
          ⏭
        </button>
        <label style={{ display: 'inline' }}>
          Speed:{' '}
          <select
            value={speed}
            onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => setSpeed(Number(e.currentTarget.value))}
          >
            <option value={0.5}>0.5 m/s</option>
            <option value={1}>1 m/s</option>
            <option value={2}>2 m/s</option>
            <option value={5}>5 m/s</option>
            <option value={10}>10 m/s</option>
            <option value={25}>25 m/s</option>
          </select>
        </label>
      </div>
      <div style={{ marginTop: '4px', color: '#bbb' }}>
        {distance.toFixed(1)} / {totalDistance.toFixed(1)} m
      </div>
      <div style={{ color: '#999' }}>{status}</div>
      <details style={{ marginTop: '4px' }}>
        <summary style={summaryStyle}>Load route from file</summary>
        <input
          type='file'
          accept='.json,.geojson,application/json,application/geo+json'
          style={{ marginTop: '4px', maxWidth: '220px' }}
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const file = e.currentTarget.files?.[0];
            if (file) void loadFile(file);
            e.currentTarget.value = '';
          }}
        />
      </details>
    </div>
  );
}
