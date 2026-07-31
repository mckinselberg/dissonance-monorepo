import type { JSX } from 'preact';
import type { ActiveMode, MovementSignals } from '../state/movement';
import type { Signal } from '@preact/signals';
import { ToggleLabel } from './VisibilityToggles';

const rowStyle: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' };

export type MovementRowProps = {
  signals: MovementSignals;
  onModeChange: (mode: ActiveMode) => void;
  onCameraHeightInput: (value: number) => void;
  worldBounded: Signal<boolean>;
};

// Player-mode only (levels 1/2) — orbit (level 3) has no equivalent of these.
// World bounds live here because they constrain traversal, not presentation.
export function MovementRow({
  signals, onModeChange, onCameraHeightInput, worldBounded,
}: MovementRowProps) {
  return (
    <div style={{ marginTop: '4px' }}>
      Mode:{' '}
      <select
        value={signals.activeMode.value}
        onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
          const mode = e.currentTarget.value as ActiveMode;
          // Don't set signals.activeMode here — onModeChange (switchMode in
          // main.tsx) does the real controller handoff (position, ground-
          // snap, rotation, scene.activeCamera) and sets the signal itself
          // at the end. Setting it first made switchMode's own "already
          // this mode" guard see no change and bail before any of that ran
          // — the dropdown and readout would relabel, but the camera never
          // actually switched and the old controller kept rendering.
          onModeChange(mode);
          // Left focused, a <select> intercepts subsequent letter keys as
          // type-ahead search — pressing W or D to move (matching "Walk"/
          // "Drive") silently jumps the dropdown and re-fires onChange,
          // swapping the active controller out from under the player. Blur
          // it so WASD reaches the window-level movement listeners instead.
          e.currentTarget.blur();
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
      <ToggleLabel label="Bounded world" signal={worldBounded} onCommit={() => {}} />
    </div>
  );
}
