import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import type { AtmosphereSignals } from '../state/atmosphere';

// Mirrors the original static #atmosphere-row markup's inline styles
// (apps/trail-viewer/index.html) so the pilot doesn't shift layout.
const rowStyle: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' };
const firstRowStyle: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px' };
const colorInputStyle: JSX.CSSProperties = {
  width: '28px', height: '20px', padding: 0, border: '1px solid #555', borderRadius: '3px',
  background: 'none', cursor: 'pointer',
};

export type SliderRowProps = {
  label: string;
  signal: Signal<number>;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  format?: (v: number) => string;
  // Mirrors the input/change split each control had in main.ts: cheap,
  // continuous updates (time-of-day, fog density) commit on every drag
  // tick; expensive dispose/recreate ones (stars, clouds, trees) only
  // commit once the slider is released, via onCommit.
  commitOn?: 'input' | 'change';
  onCommit?: (value: number) => void;
  style?: JSX.CSSProperties;
};

// Exported — TreeCountRow reuses this rather than duplicating the
// input/change commit-timing logic (see its own comment on why tree count
// lives in the World section instead of here despite being wired the same
// way as the other commit-on-change sliders below).
export function SliderRow({ label, signal: sig, min, max, step, suffix, format, commitOn = 'input', onCommit, style }: SliderRowProps) {
  const fmt = format ?? ((v: number) => String(v));
  const handleValue = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const value = parseFloat(e.currentTarget.value);
    sig.value = value;
    if (commitOn === 'change') onCommit?.(value);
  };
  const eventProp = commitOn === 'change' ? { onChange: handleValue } : { onInput: handleValue };
  return (
    <label style={style ?? rowStyle}>
      {label}{' '}
      <input type="range" min={min} max={max} step={step} value={sig.value} style={{ flex: 1 }} {...eventProp} />{' '}
      <span>{fmt(sig.value)}</span>{suffix}
    </label>
  );
}

function ColorPicker({ signal: sig }: { signal: Signal<string> }) {
  return (
    <input
      type="color"
      value={sig.value}
      style={colorInputStyle}
      onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => { sig.value = e.currentTarget.value; }}
    />
  );
}

// Overcast moved to the shared "Toggles" section (main.tsx) and tree count
// to "World" (main.tsx's TreeCountRow) — both used to live here, but neither
// is really an "atmosphere" control: overcast is a toggle (grouped with the
// other toggles), tree count is world density (grouped with H-scale/V-exag/
// water-level). What's left here is genuinely sky-only.
export type AtmosphereRowProps = {
  signals: AtmosphereSignals;
  onStarCountCommit: (value: number) => void;
  onCloudCountCommit: (value: number) => void;
};

export function AtmosphereRow({ signals, onStarCountCommit, onCloudCountCommit }: AtmosphereRowProps) {
  return (
    <div id="atmosphere-row" style={{ marginTop: '4px' }}>
      <SliderRow
        label="Time of day"
        signal={signals.timeOfDay}
        min={0} max={24} step={0.1}
        suffix="h"
        format={(v) => v.toFixed(1)}
        style={firstRowStyle}
      />
      <label style={rowStyle}>
        Fog{' '}
        <input
          type="range" min={0} max={0.002} step={0.00005} value={signals.fogDensity.value} style={{ flex: 1 }}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => { signals.fogDensity.value = parseFloat(e.currentTarget.value); }}
        />{' '}
        <span>{signals.fogDensity.value.toFixed(5)}</span>
        <ColorPicker signal={signals.fogColor} />
      </label>
      <SliderRow label="Stars" signal={signals.starCount} min={0} max={3000} step={100} commitOn="change" onCommit={onStarCountCommit} />
      <SliderRow label="Cloud density" signal={signals.cloudCount} min={0} max={60} step={2} commitOn="change" onCommit={onCloudCountCommit} />
    </div>
  );
}
