import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';

export type RouteSample = {
  lat: number;
  lon: number;
  heightmap: number;
  worldX: number;
  worldZ: number;
};

type RecordedPoint = {
  latLongHeightmap: [number, number, number];
};

export type RouteRecorderProps = {
  getCurrentSample: () => RouteSample;
  storageKey: string;
};

const buttonStyle: JSX.CSSProperties = {
  font: 'inherit',
  cursor: 'pointer',
  marginRight: '4px',
  marginTop: '4px',
};

const inputStyle: JSX.CSSProperties = {
  width: '48px',
  font: 'inherit',
  background: '#111',
  color: '#eee',
  border: '1px solid #555',
  borderRadius: '3px',
  padding: '2px 4px',
};

function distanceMeters(a: RouteSample, b: RouteSample) {
  return Math.hypot(a.worldX - b.worldX, a.worldZ - b.worldZ);
}

function toRecordedPoint(sample: RouteSample): RecordedPoint {
  return {
    latLongHeightmap: [
      Number(sample.lat.toFixed(7)),
      Number(sample.lon.toFixed(7)),
      Number(sample.heightmap.toFixed(2)),
    ],
  };
}

function pointAsSample(point: RecordedPoint): RouteSample {
  const [lat, lon, heightmap] = point.latLongHeightmap;
  // Only lat/lon/height are persisted. worldX/worldZ are deliberately
  // unavailable after reload, so the first new automatic point establishes
  // a fresh distance baseline instead of comparing unlike coordinate forms.
  return { lat, lon, heightmap, worldX: Number.NaN, worldZ: Number.NaN };
}

function safeFileStem(name: string) {
  return name.trim().replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'route';
}

export function RouteRecorder({ getCurrentSample, storageKey }: RouteRecorderProps) {
  const [name, setName] = useState('new-route');
  const [points, setPoints] = useState<RecordedPoint[]>([]);
  const [recording, setRecording] = useState(false);
  const [spacing, setSpacing] = useState(5);
  const [status, setStatus] = useState('Ready');
  const lastSampleRef = useRef<RouteSample | null>(null);
  const getCurrentSampleRef = useRef(getCurrentSample);
  getCurrentSampleRef.current = getCurrentSample;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as
        | { name?: string; points?: RecordedPoint[]; spacing?: number }
        | null;
      if (!saved) return;
      if (saved.name) setName(saved.name);
      if (Array.isArray(saved.points)) setPoints(saved.points);
      if (typeof saved.spacing === 'number') setSpacing(saved.spacing);
    } catch {
      setStatus('Saved draft could not be read');
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify({ name, points, spacing }));
  }, [name, points, spacing, storageKey]);

  const addPoint = (sample = getCurrentSampleRef.current()) => {
    setPoints((current) => [...current, toRecordedPoint(sample)]);
    lastSampleRef.current = sample;
    setStatus(`Captured ${sample.lat.toFixed(6)}, ${sample.lon.toFixed(6)}`);
  };

  useEffect(() => {
    if (!recording) return;
    const firstSample = getCurrentSampleRef.current();
    setPoints((current) => [...current, toRecordedPoint(firstSample)]);
    lastSampleRef.current = firstSample;
    setStatus(`Captured ${firstSample.lat.toFixed(6)}, ${firstSample.lon.toFixed(6)}`);
    const timer = window.setInterval(() => {
      const sample = getCurrentSampleRef.current();
      const previous = lastSampleRef.current;
      if (!previous || !Number.isFinite(previous.worldX) || distanceMeters(previous, sample) >= spacing) {
        setPoints((current) => [...current, toRecordedPoint(sample)]);
        lastSampleRef.current = sample;
        setStatus(`Captured ${sample.lat.toFixed(6)}, ${sample.lon.toFixed(6)}`);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording, spacing]);

  const routeDocument = useMemo(() => ({
    name: name.trim() || 'route',
    coordinateSystem: 'WGS84',
    heightmapUnits: 'meters',
    points,
  }), [name, points]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(routeDocument, null, 2));
      setStatus(`Copied ${points.length} points`);
    } catch {
      setStatus('Clipboard blocked; use Download JSON');
    }
  };

  const download = (format: 'json' | 'geojson') => {
    const body = format === 'json'
      ? routeDocument
      : {
          type: 'Feature',
          properties: {
            name: routeDocument.name,
            heightSource: 'heightmap',
            heightUnits: 'meters',
          },
          geometry: {
            type: 'LineString',
            // GeoJSON coordinate order is longitude, latitude, elevation.
            coordinates: points.map(({ latLongHeightmap: [lat, lon, height] }) => [lon, lat, height]),
          },
        };
    const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeFileStem(name)}.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${points.length} points`);
  };

  const lastPoint = points[points.length - 1];

  return (
    <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px' }}>
      <div style={{ color: '#9cf', fontWeight: 700 }}>Route recorder</div>
      <label style={{ marginTop: '4px' }}>
        Name:{' '}
        <input
          style={{ ...inputStyle, width: '120px' }}
          value={name}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => setName(e.currentTarget.value)}
        />
      </label>
      <label style={{ marginTop: '4px' }}>
        Auto spacing:{' '}
        <input
          style={inputStyle}
          type='number'
          min='0.5'
          max='100'
          step='0.5'
          value={spacing}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const value = e.currentTarget.valueAsNumber;
            if (Number.isFinite(value)) setSpacing(Math.max(0.5, value));
          }}
        />{' '}
        m
      </label>
      <div>
        <button
          type='button'
          style={{ ...buttonStyle, color: recording ? '#f99' : undefined }}
          onClick={() => {
            setRecording((value) => !value);
            setStatus(recording ? 'Recording stopped' : 'Recording started');
          }}
        >
          {recording ? '■ Stop' : '● Record'}
        </button>
        <button type='button' style={buttonStyle} disabled={recording} onClick={() => addPoint()}>
          + Point
        </button>
        <button
          type='button'
          style={buttonStyle}
          disabled={recording || points.length === 0}
          onClick={() => {
            setPoints((current) => current.slice(0, -1));
            lastSampleRef.current = points.length > 1 ? pointAsSample(points[points.length - 2]) : null;
            setStatus('Removed last point');
          }}
        >
          Undo
        </button>
        <button
          type='button'
          style={buttonStyle}
          disabled={recording || points.length === 0}
          onClick={() => {
            if (!window.confirm(`Clear all ${points.length} recorded points?`)) return;
            setPoints([]);
            lastSampleRef.current = null;
            setStatus('Route cleared');
          }}
        >
          Clear
        </button>
      </div>
      <div>
        <button type='button' style={buttonStyle} disabled={points.length === 0} onClick={copyJson}>Copy JSON</button>
        <button type='button' style={buttonStyle} disabled={points.length === 0} onClick={() => download('json')}>
          Download JSON
        </button>
        <button type='button' style={buttonStyle} disabled={points.length < 2} onClick={() => download('geojson')}>
          GeoJSON
        </button>
      </div>
      <div style={{ marginTop: '4px', color: '#bbb' }}>
        {points.length} point{points.length === 1 ? '' : 's'}
        {lastPoint && ` · last [${lastPoint.latLongHeightmap.join(', ')}]`}
      </div>
      <div style={{ color: '#999' }}>{status} · draft autosaved locally</div>
    </div>
  );
}
