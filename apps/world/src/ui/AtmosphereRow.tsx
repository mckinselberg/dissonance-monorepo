import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import type { AtmosphereSignals } from '../state/atmosphere';

// Mirrors the original static #atmosphere-row markup's inline styles
// (apps/world/index.html) so the pilot doesn't shift layout.
const rowStyle: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' };
const tuningRowStyle: JSX.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '88px minmax(0, 1fr) 62px',
  alignItems: 'center',
  gap: '7px',
  margin: 0,
};
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
    // This handler is attached to exactly one matching event below, so
    // input-mode controls must invoke their callback here too.
    onCommit?.(value);
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

export type ColorPickerProps = {
  signal: Signal<string>;
  // Fog color applies live (scene.fogColor = ... is a cheap direct set);
  // cloud color/opacity require a full dispose/recreate (DriftingClouds
  // bakes them in at construction, same as count/altitude/diameter — no
  // live-update method), so cloud color commits on 'change' instead.
  commitOn?: 'input' | 'change';
  onCommit?: (value: string) => void;
};

// Exported — ScaleTuningRow reuses this for water/terrain color pickers
// rather than duplicating the input/change commit-timing logic, same reason
// SliderRow is exported for TreeCountRow.
export function ColorPicker({ signal: sig, commitOn = 'input', onCommit }: ColorPickerProps) {
  const handleValue = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    sig.value = value;
    if (commitOn === 'change') onCommit?.(value);
  };
  const eventProp = commitOn === 'change' ? { onChange: handleValue } : { onInput: handleValue };
  return <input type="color" value={sig.value} style={colorInputStyle} {...eventProp} />;
}

function ColorRow({
  label,
  signal,
  commitOn = 'input',
  onCommit,
}: ColorPickerProps & { label: string }) {
  return (
    <label class="atmosphere-color-row">
      <span>{label}</span>
      <ColorPicker signal={signal} commitOn={commitOn} onCommit={onCommit} />
      <output>{signal.value.toUpperCase()}</output>
    </label>
  );
}

function ControlGroup({ label, children }: { label: string; children: JSX.Element | JSX.Element[] }) {
  return (
    <div class="atmosphere-control-group">
      <div class="atmosphere-control-group__label">{label}</div>
      {children}
    </div>
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
  onCloudColorCommit: (value: string) => void;
  onCloudOpacityCommit: (value: number) => void;
};

export function AtmosphereRow({
  signals, onStarCountCommit, onCloudCountCommit, onCloudColorCommit, onCloudOpacityCommit,
}: AtmosphereRowProps) {
  return (
    <div id="atmosphere-row" class="atmosphere-controls">
      <ControlGroup label="Lighting">
        <SliderRow
          label="Time"
          signal={signals.timeOfDay}
          min={0} max={24} step={0.1}
          suffix=" h"
          format={(v) => v.toFixed(1)}
          style={tuningRowStyle}
        />
        <ColorRow label="Night sky" signal={signals.skyNightColor} />
        <ColorRow label="Day sky" signal={signals.skyDayColor} />
        <ColorRow label="Sun tint" signal={signals.sunTint} />
      </ControlGroup>

      <ControlGroup label="Fog">
        <SliderRow
          label="Density"
          signal={signals.fogDensity}
          min={0} max={0.002} step={0.00005}
          format={(v) => v.toFixed(5)}
          style={tuningRowStyle}
        />
        <ColorRow label="Color" signal={signals.fogColor} />
      </ControlGroup>

      <ControlGroup label="Stars">
        <SliderRow
          label="Count"
          signal={signals.starCount}
          min={0} max={3000} step={100}
          commitOn="change"
          onCommit={onStarCountCommit}
          style={tuningRowStyle}
        />
        <ColorRow label="Color" signal={signals.starColor} />
      </ControlGroup>

      <ControlGroup label="Clouds">
        <SliderRow
          label="Count"
          signal={signals.cloudCount}
          min={0} max={60} step={2}
          commitOn="change"
          onCommit={onCloudCountCommit}
          style={tuningRowStyle}
        />
        <SliderRow
          label="Opacity"
          signal={signals.cloudOpacity}
          min={0} max={1} step={0.05}
          format={(v) => v.toFixed(2)}
          commitOn="change"
          onCommit={onCloudOpacityCommit}
          style={tuningRowStyle}
        />
        <ColorRow label="Color" signal={signals.cloudColor} commitOn="change" onCommit={onCloudColorCommit} />
      </ControlGroup>
    </div>
  );
}
