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
const groupStyle: JSX.CSSProperties = { marginTop: '8px' };

export type GotoRowProps = {
  // Orbit's version recenters the orbit pivot; player's version teleports
  // the active controller — see main.tsx's two mount sites.
  onGo: (lat: number, lon: number) => void;
  // Computed on demand (not tracked live every frame — nothing here needs
  // to update faster than "the user just clicked the button") — orbit
  // reads the camera position, player reads the active controller's.
  getCurrentLatLon: () => { lat: number; lon: number };
  // Absent in orbit mode — no meaningful position is ever saved there (see
  // SavedSettings' comment in main.tsx) — rather than render a button
  // whose handler would reach into player-mode-only state. Grouped here
  // (moved from ViewToolsRow) since it's a position tool, not a view-
  // snapshot one.
  onResetPosition?: () => void;
  // locations.json's named landmarks (mountain crater, dissonance boulevard,
  // ...) — a narrower shape than the full LocationEntry (name + latLong
  // only) so this ui/ module doesn't need to import world/LocationProps.
  // Optional/omittable the same way savedViews is in ViewToolsRow (empty
  // array just hides the dropdown, matching that component's own pattern).
  locations?: Array<{ name: string; latLong: [number, number] }>;
};

// Lat/lon values for the "go to" inputs aren't persisted or bound to any
// signal (matching today's behavior — they're read from the DOM only at
// click-time), so plain uncontrolled inputs via refs are enough here, no
// signal needed.
export function GotoRow({ onGo, getCurrentLatLon, onResetPosition, locations = [] }: GotoRowProps) {
  const latLonRef = useRef<HTMLInputElement>(null);
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
    <div style={groupStyle}>
      {locations.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          Locations:{' '}
          <select
            style={{ flex: 1 }}
            value=""
            onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
              const index = Number(e.currentTarget.value);
              e.currentTarget.value = '';
              if (Number.isNaN(index)) return;
              const [lat, lon] = locations[index].latLong;
              onGo(lat, lon);
            }}
          >
            <option value="" disabled>— choose a location —</option>
            {locations.map((location, index) => (
              <option key={location.name} value={index}>{location.name}</option>
            ))}
          </select>
        </label>
      )}
      <div>
        Go to:{' '}
        <input ref={latLonRef} type="text" placeholder="lat, lon" style={{ ...inputStyle, width: '150px' }} />
        <button
          type="button"
          style={buttonStyle}
          onClick={() => {
            // Same "lat, lon" format Copy current produces below, so a
            // copied readout (or a locations.json latLong pair typed by
            // hand) pastes straight in.
            const [lat, lon] = (latLonRef.current?.value ?? '').split(',').map((part) => parseFloat(part.trim()));
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
      {onResetPosition && (
        <button type="button" style={{ marginTop: '8px', font: 'inherit', cursor: 'pointer' }} onClick={onResetPosition}>
          Reset position (back to trailhead)
        </button>
      )}
    </div>
  );
}
