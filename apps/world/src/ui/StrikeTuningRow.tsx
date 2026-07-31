import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import {
  copyStrikeProfile,
  parseStrikeProfile,
  STRIKE_PROFILE_NUMERIC_KEYS,
  type StrikeProfile,
} from '../systems/strike/strikeProfile';

const LABELS: Record<(typeof STRIKE_PROFILE_NUMERIC_KEYS)[number], string> = {
  strikeRainThreshold: 'Rain threshold',
  strikeWindupMinSeconds: 'Wind-up min (s)',
  strikeWindupMaxSeconds: 'Wind-up max (s)',
  rainEstablishTimeoutSeconds: 'Rain timeout (s)',
  losRange: 'LOS range (m)',
  strikeAnchorCaptureRange: 'Drone capture range (m)',
  flashIntensity: 'Flash intensity',
  flashDurationSeconds: 'Flash duration (s)',
  clapDelayFromFlashSeconds: 'Clap delay (s)',
  recoveryProximityRange: 'Recovery range (m)',
  droneInertSettleSeconds: 'Drone settle (s)',
};

export function StrikeTuningRow({ profile }: { profile: StrikeProfile }) {
  const initial = useRef(structuredClone(profile));
  const [revision, setRevision] = useState(0);
  const [json, setJson] = useState(() => JSON.stringify(profile, null, 2));
  const [error, setError] = useState('');
  const refresh = () => {
    setRevision((value) => value + 1);
    setJson(JSON.stringify(profile, null, 2));
    setError('');
  };
  const importJson = () => {
    try {
      copyStrikeProfile(profile, parseStrikeProfile(JSON.parse(json) as unknown));
      refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  };
  return (
    <div data-revision={revision}>
      <div style={{ color: '#83a2a8', marginTop: '6px' }}>Profile: {profile.id}</div>
      {STRIKE_PROFILE_NUMERIC_KEYS.map((key) => (
        <label style={{ display: 'grid', gridTemplateColumns: '1fr 82px', gap: '6px', marginTop: '4px' }}>
          {LABELS[key]}
          <input
            type='number'
            min={0}
            step='any'
            value={profile[key]}
            onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              try {
                copyStrikeProfile(profile, parseStrikeProfile({
                  ...profile,
                  [key]: Number(event.currentTarget.value),
                }));
                refresh();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              }
            }}
          />
        </label>
      ))}
      <details style={{ marginTop: '8px' }}>
        <summary>Profile JSON</summary>
        <textarea
          aria-label='Strike profile JSON'
          rows={10}
          value={json}
          onInput={(event: JSX.TargetedEvent<HTMLTextAreaElement>) => setJson(event.currentTarget.value)}
          style={{ width: '100%', boxSizing: 'border-box', font: 'inherit' }}
        />
        <button type='button' onClick={importJson}>Import JSON</button>{' '}
        <button type='button' onClick={() => void navigator.clipboard.writeText(JSON.stringify(profile, null, 2))}>
          Copy JSON
        </button>{' '}
        <button type='button' onClick={() => { copyStrikeProfile(profile, initial.current); refresh(); }}>
          Clear overrides
        </button>
        {error && <div role='alert' style={{ color: '#ef5148', marginTop: '5px' }}>{error}</div>}
      </details>
    </div>
  );
}
