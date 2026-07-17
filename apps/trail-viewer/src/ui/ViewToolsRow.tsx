import { useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import type { SavedSettings } from '../main';

const textareaStyle: JSX.CSSProperties = {
  width: '100%', boxSizing: 'border-box', font: '11px monospace', background: '#111', color: '#eee',
  border: '1px solid #555', borderRadius: '3px', resize: 'vertical',
};
const buttonStyle: JSX.CSSProperties = { font: 'inherit', cursor: 'pointer' };

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
};

export function ViewToolsRow({ buildSnapshot, levelKey, validLevelKeys, saveSettings, onBeforeNavigate, onResetPosition }: ViewToolsRowProps) {
  const [copyLabel, setCopyLabel] = useState('📋 Copy View');
  const loadViewInputRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = () => {
    const snapshot = buildSnapshot();
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('📋 Copy View'), 1200);
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
    const targetLevel = snapshot.level;
    if (typeof targetLevel !== 'string' || !validLevelKeys.includes(targetLevel)) {
      alert('View JSON is missing a valid "level" field.');
      return;
    }
    const { level: _level, ...rest } = snapshot;
    onBeforeNavigate();
    saveSettings(targetLevel, rest);
    if (targetLevel === levelKey) {
      location.reload();
    } else {
      location.href = `?level=${targetLevel}`;
    }
  };

  return (
    <>
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
