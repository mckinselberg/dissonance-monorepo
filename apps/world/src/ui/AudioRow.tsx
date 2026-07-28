import type { JSX } from 'preact';
import type { AudioSignals } from '../state/audio';

const rowStyle: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' };

export type AudioRowProps = {
  signals: AudioSignals;
  // False in orbit mode — no player there, so footsteps/breath don't apply
  // (ambient wind/night/heartbeat still do, handled outside this row).
  showPlayerControls: boolean;
  onMasterMutedCommit: (muted: boolean) => void;
  onWindVolumeInput: (value: number) => void;
  onFootstepMutedCommit: (muted: boolean) => void;
  onBreathMutedCommit: (muted: boolean) => void;
};

export function AudioRow({
  signals, showPlayerControls, onMasterMutedCommit, onWindVolumeInput, onFootstepMutedCommit, onBreathMutedCommit,
}: AudioRowProps) {
  return (
    <div style={{ marginTop: '4px' }}>
      <label>
        <input
          type="checkbox"
          checked={signals.masterMuted.value}
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const muted = e.currentTarget.checked;
            signals.masterMuted.value = muted;
            onMasterMutedCommit(muted);
          }}
        /> Mute all
      </label>
      <label style={rowStyle}>
        Wind vol{' '}
        <input
          type="range" min={0} max={1} step={0.05} value={signals.windVolume.value} style={{ flex: 1 }}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            const value = parseFloat(e.currentTarget.value);
            signals.windVolume.value = value;
            onWindVolumeInput(value);
          }}
        />{' '}
        <span>{signals.windVolume.value.toFixed(2)}</span>
      </label>
      {showPlayerControls && (
        <>
          <label style={{ marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={signals.footstepMuted.value}
              onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
                const muted = e.currentTarget.checked;
                signals.footstepMuted.value = muted;
                onFootstepMutedCommit(muted);
              }}
            /> Mute footsteps
          </label>
          <label style={{ marginTop: '4px' }}>
            <input
              type="checkbox"
              checked={signals.breathMuted.value}
              onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
                const muted = e.currentTarget.checked;
                signals.breathMuted.value = muted;
                onBreathMutedCommit(muted);
              }}
            /> Mute breath
          </label>
          {/* Live, read-only — updated directly via textContent from the game
              loop each frame (same pattern as #readout/#level-label), not a
              signal: re-rendering this whole row every frame for one number
              would be wasteful. Preact leaves this leaf node alone across
              re-renders triggered by the signals above since the vdom shape
              around it doesn't change. */}
          <div style={{ marginTop: '4px' }}>
            Breath: <span id="breath-load-value">—</span>
          </div>
        </>
      )}
    </div>
  );
}
