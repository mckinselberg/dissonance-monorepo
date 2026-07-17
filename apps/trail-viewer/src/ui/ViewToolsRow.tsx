import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { SavedSettings } from '../main';

const textareaStyle: JSX.CSSProperties = {
  width: '100%', boxSizing: 'border-box', font: '11px monospace', background: '#111', color: '#eee',
  border: '1px solid #555', borderRadius: '3px', resize: 'vertical',
};
const buttonStyle: JSX.CSSProperties = { font: 'inherit', cursor: 'pointer' };

// A views.json entry — same shape Copy View produces, plus the human label
// the JSON file adds when a snapshot is pasted in by hand.
export type SavedView = SavedSettings & { level: string; name: string };

export type ViewToolsRowProps = {
  // Orbit and player mode build differently-shaped snapshots (orbit target/
  // alpha/beta/radius vs. position/rotation/activeMode/cameraHeightOffset)
  // — see main.tsx's two mount sites for the two closures passed in here.
  buildSnapshot: () => SavedSettings & { level: string };
  levelKey: string;
  validLevelKeys: string[];
  saveSettings: (levelKey: string, settings: SavedSettings) => void;
  // Unregisters the beforeunload/pagehide autosave listeners right before a
  // reload/navigate — a no-op in orbit mode, where persistSettings is never
  // registered in the first place (see SavedSettings' own comment in main.tsx).
  onBeforeNavigate: () => void;
  // Absent in orbit mode — no meaningful position is ever saved there (see
  // SavedSettings' comment) — rather than render a button whose handler
  // would reach into player-mode-only state.
  onResetPosition?: () => void;
  // docs/views.json, imported once in main.tsx and passed to both mount
  // sites (orbit + player) — a curated, committed alternative to pasting
  // clipboard JSON by hand. Same list regardless of the level currently
  // loaded; picking one navigates like Load View does if it targets a
  // different level.
  savedViews: SavedView[];
};

export function ViewToolsRow({ buildSnapshot, levelKey, validLevelKeys, saveSettings, onBeforeNavigate, onResetPosition, savedViews }: ViewToolsRowProps) {
  const [copyLabel, setCopyLabel] = useState('📋 Copy View');
  const loadViewInputRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = () => {
    const snapshot = buildSnapshot();
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('📋 Copy View'), 1200);
  };

  // Shared by both the pasted-JSON textarea and the saved-views dropdown —
  // "name" is stripped along with "level" since SavedSettings has no such
  // field; a dropdown-sourced view carries a name, a freshly pasted Copy
  // View snapshot doesn't, either way it shouldn't end up in localStorage.
  const applySnapshot = (snapshot: SavedSettings & { level?: string; name?: string }) => {
    const targetLevel = snapshot.level;
    if (typeof targetLevel !== 'string' || !validLevelKeys.includes(targetLevel)) {
      alert('View JSON is missing a valid "level" field.');
      return;
    }
    const { level: _level, name: _name, ...rest } = snapshot;
    onBeforeNavigate();
    saveSettings(targetLevel, rest);
    if (targetLevel === levelKey) {
      location.reload();
    } else {
      location.href = `?level=${targetLevel}`;
    }
  };

  const handleLoad = () => {
    const raw = loadViewInputRef.current?.value ?? '';
    let snapshot: SavedSettings & { level?: string };
    try {
      snapshot = JSON.parse(raw);
    } catch {
      alert('Could not parse that as JSON.');
      return;
    }
    applySnapshot(snapshot);
  };

  return (
    <>
      {savedViews.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          Saved views:{' '}
          <select
            style={{ flex: 1 }}
            value=""
            onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
              const index = Number(e.currentTarget.value);
              e.currentTarget.value = '';
              if (Number.isNaN(index)) return;
              applySnapshot(savedViews[index]);
            }}
          >
            <option value="" disabled>— choose a view —</option>
            {savedViews.map((view, index) => (
              <option key={view.name} value={index}>{view.name}</option>
            ))}
          </select>
        </label>
      )}
      <div style={{ marginTop: '4px' }}>
        <button type="button" style={buttonStyle} onClick={handleCopy}>{copyLabel}</button>
        <div style={{ marginTop: '4px' }}>
          <textarea ref={loadViewInputRef} rows={3} placeholder="paste a copied view JSON here" style={textareaStyle} />
          <button type="button" style={{ ...buttonStyle, marginTop: '2px' }} onClick={handleLoad}>Load View</button>
        </div>
      </div>
      {onResetPosition && (
        <button type="button" style={{ marginTop: '8px', ...buttonStyle }} onClick={onResetPosition}>
          Reset position (back to trailhead)
        </button>
      )}
    </>
  );
}
