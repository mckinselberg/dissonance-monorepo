import { useRef } from 'preact/hooks';

const inputStyle = {
  width: '68px', font: 'inherit', background: '#111', color: '#eee',
  border: '1px solid #555', borderRadius: '3px', padding: '2px 4px',
};
const buttonStyle = { font: 'inherit', marginLeft: '4px', cursor: 'pointer' };

export type GotoRowProps = {
  // Orbit's version recenters the orbit pivot; player's version teleports
  // the active controller — see main.tsx's two mount sites.
  onGo: (lat: number, lon: number) => void;
};

// Lat/lon values aren't persisted or bound to any signal (matching today's
// behavior — they're read from the DOM only at click-time), so plain
// uncontrolled inputs via refs are enough here, no signal needed.
export function GotoRow({ onGo }: GotoRowProps) {
  const latRef = useRef<HTMLInputElement>(null);
  const lonRef = useRef<HTMLInputElement>(null);
  return (
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
  );
}
