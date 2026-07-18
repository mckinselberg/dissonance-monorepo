import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

const inputStyle = {
  width: '68px', font: 'inherit', background: '#111', color: '#eee',
  border: '1px solid #555', borderRadius: '3px', padding: '2px 4px',
};
const buttonStyle = { font: 'inherit', marginLeft: '4px', cursor: 'pointer' };
const readoutInputStyle = {
  ...inputStyle, width: '150px', cursor: 'text',
};

export type GotoRowProps = {
  // Orbit's version recenters the orbit pivot; player's version teleports
  // the active controller — see main.tsx's two mount sites.
  onGo: (lat: number, lon: number) => void;
  // Computed on demand (not tracked live every frame — nothing here needs
  // to update faster than "the user just clicked the button") — orbit
  // reads the camera position, player reads the active controller's.
  getCurrentLatLon: () => { lat: number; lon: number };
};

// Lat/lon values for the "go to" inputs aren't persisted or bound to any
// signal (matching today's behavior — they're read from the DOM only at
// click-time), so plain uncontrolled inputs via refs are enough here, no
// signal needed.
export function GotoRow({ onGo, getCurrentLatLon }: GotoRowProps) {
  const latRef = useRef<HTMLInputElement>(null);
  const lonRef = useRef<HTMLInputElement>(null);
  const [currentLatLon, setCurrentLatLon] = useState('');
  const [copyLabel, setCopyLabel] = useState('📍 Copy current');
  const currentRef = useRef<HTMLInputElement>(null);

  const handleCopyCurrent = () => {
    const { lat, lon } = getCurrentLatLon();
    const text = `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    setCurrentLatLon(text);
    navigator.clipboard.writeText(text);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('📍 Copy current'), 1200);
    // Also select the readout field's text so a manual re-copy (or just
    // eyeballing it) works even if the clipboard write was blocked (some
    // browsers require a user gesture directly on the clipboard call,
    // which this button click already satisfies, but belt-and-suspenders).
    requestAnimationFrame(() => currentRef.current?.select());
  };

  return (
    <>
      <div style={{ marginTop: '8px' }}>
        Go to:{' '}
        <input ref={latRef} type="text" placeholder="lat" style={inputStyle} />{' '}
        <input ref={lonRef} type="text" placeholder="lon" style={inputStyle} />
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            const lat = parseFloat(latRef.current?.value ?? '');
            const lon = parseFloat(lonRef.current?.value ?? '');
            if (Number.isNaN(lat) || Number.isNaN(lon)) return;
            onGo(lat, lon);
          }}
        >
          Go
        </button>
      </div>
      <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center' }}>
        <button type="button" style={{ font: 'inherit', cursor: 'pointer' }} onClick={handleCopyCurrent}>
          {copyLabel}
        </button>
        <input
          ref={currentRef}
          type="text"
          readOnly
          placeholder="lat, lon"
          value={currentLatLon}
          style={{ ...readoutInputStyle, marginLeft: '4px' }}
          onClick={(e: JSX.TargetedEvent<HTMLInputElement>) => e.currentTarget.select()}
        />
      </div>
    </>
  );
}
