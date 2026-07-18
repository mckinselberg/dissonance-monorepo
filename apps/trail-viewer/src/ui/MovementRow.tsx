import type { JSX } from 'preact';
import type { ActiveMode, MovementSignals } from '../state/movement';

const rowStyle: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' };

export type MovementRowProps = {
  signals: MovementSignals;
  onModeChange: (mode: ActiveMode) => void;
  onCameraHeightInput: (value: number) => void;
  onIgniteFire: () => void;
  onResetFire: () => void;
};

// Player-mode only (levels 1/2) — orbit (level 3) has no equivalent of any
// of these, see main.tsx's cameraMode branch. Bounded-world moved to the
// shared "Toggles" section (main.tsx) — it's a toggle, not a movement
// control per se, same reasoning as Overcast leaving AtmosphereRow.
export function MovementRow({
  signals, onModeChange, onCameraHeightInput, onIgniteFire, onResetFire,
}: MovementRowProps) {
  return (
    <div style={{ marginTop: '4px' }}>
      Mode:{' '}
      <select
        value={signals.activeMode.value}
        onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
          const mode = e.currentTarget.value as ActiveMode;
          signals.activeMode.value = mode;
          onModeChange(mode);
        }}
      >
        <option value="walk">Walk</option>
        <option value="fly">Fly (fast air travel)</option>
        <option value="drive">Drive (fast ground travel)</option>
      </select>
      <label style={rowStyle}>
        Cam height{' '}
        <input
          type="range" min={0} max={3} step={0.1} value={signals.cameraHeightOffset.value} style={{ flex: 1 }}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const value = parseFloat(e.currentTarget.value);
            signals.cameraHeightOffset.value = value;
            onCameraHeightInput(value);
          }}
        />{' '}
        <span>{signals.cameraHeightOffset.value.toFixed(1)}</span>m
      </label>
      <div style={{ marginTop: '4px' }}>
        <button type="button" style={{ font: 'inherit', cursor: 'pointer' }} onClick={onIgniteFire}>🔥 Ignite fire (F)</button>{' '}
        <button type="button" style={{ font: 'inherit', cursor: 'pointer' }} onClick={onResetFire}>Reset fire</button>
      </div>
    </div>
  );
}
