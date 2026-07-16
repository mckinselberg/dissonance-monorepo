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

type SliderRowProps = {
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

function SliderRow({ label, signal: sig, min, max, step, suffix, format, commitOn = 'input', onCommit, style }: SliderRowProps) {
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

function CheckboxRow({ label, signal: sig, onCommit }: { label: string; signal: Signal<boolean>; onCommit: (value: boolean) => void }) {
  const handleChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const checked = e.currentTarget.checked;
    sig.value = checked;
    onCommit(checked);
  };
  return (
    <label style={{ marginTop: '4px' }}>
      <input type="checkbox" checked={sig.value} onChange={handleChange} /> {label}
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

export type AtmosphereRowProps = {
  signals: AtmosphereSignals & { treeCount: Signal<number> };
  maxTreeCount: number;
  onStarCountCommit: (value: number) => void;
  onCloudCountCommit: (value: number) => void;
  onOvercastCommit: (value: boolean) => void;
  onTreeCountCommit: (value: number) => void;
};

export function AtmosphereRow({ signals, maxTreeCount, onStarCountCommit, onCloudCountCommit, onOvercastCommit, onTreeCountCommit }: AtmosphereRowProps) {
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
      <CheckboxRow label="Overcast" signal={signals.overcast} onCommit={onOvercastCommit} />
      {/* step stays 1 unconditionally — see main.ts's tree-count comment:
          setting .value via JS snaps to the nearest step boundary, so a
          coarser step would silently desync the shown count from the thumb. */}
      <SliderRow label="# Trees" signal={signals.treeCount} min={0} max={maxTreeCount} step={1} commitOn="change" onCommit={onTreeCountCommit} />
    </div>
  );
}
