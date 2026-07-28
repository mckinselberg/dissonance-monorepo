import type { JSX } from 'preact';
import type { ScaleTuningSignals } from '../state/scaleTuning';
import type { AtmosphereSignals } from '../state/atmosphere';
import { ColorPicker } from './AtmosphereRow';

const labelStyle: JSX.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' };
const valueStyle: JSX.CSSProperties = { width: '34px', textAlign: 'right' };

export type ScaleTuningRowProps = {
  signals: ScaleTuningSignals;
  waterMin: number;
  waterMax: number;
  waterStep: number;
  // H-scale/V-exagg rebuild the terrain mesh + both trail overlays from
  // scratch (expensive) — committed on release, not live, same as
  // AtmosphereRow's star/cloud/tree-count controls. Water-level has no
  // callback here: it's live (input-cadence), handled by an effect in
  // main.tsx watching scaleTuning.waterLevel.value directly.
  onScaleCommit: () => void;
  atmosphere: AtmosphereSignals;
  // Water color is a cheap shader-uniform set — commits live (input-cadence).
  onWaterColorCommit: (value: string) => void;
  // Terrain's elevation-gradient colors are baked into the mesh at build
  // time, same as H-scale/V-exagg — commits on release via a full
  // rebuildWorld(), not a dedicated rebuild path.
  onTerrainColorCommit: () => void;
  // City-kit "fake interior" window tint/glow (CompositeLocations.ts) —
  // baked into each building's materials at load time same as terrain
  // color, so it also commits via a full rebuildWorld().
  onWindowTintCommit: () => void;
};

// Rendered only when levelKey === '1' (see main.tsx) — levels 2/3 have no
// equivalent UI, though the underlying signals exist for every level.
export function ScaleTuningRow({
  signals, waterMin, waterMax, waterStep, onScaleCommit, atmosphere, onWaterColorCommit, onTerrainColorCommit,
  onWindowTintCommit,
}: ScaleTuningRowProps) {
  return (
    <div style={{ marginTop: '8px' }}>
      <label style={labelStyle}>
        H-scale{' '}
        <input
          type="range" min={1} max={15} step={0.5} value={signals.hScale.value} style={{ flex: 1 }}
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            signals.hScale.value = parseFloat(e.currentTarget.value);
            onScaleCommit();
          }}
        />{' '}
        <span style={valueStyle}>{signals.hScale.value}</span>x
      </label>
      <label style={labelStyle}>
        V-exagg{' '}
        <input
          type="range" min={1} max={20} step={0.5} value={signals.vExag.value} style={{ flex: 1 }}
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            signals.vExag.value = parseFloat(e.currentTarget.value);
            onScaleCommit();
          }}
        />{' '}
        <span style={valueStyle}>{signals.vExag.value}</span>x
      </label>
      <label style={labelStyle}>
        Water lvl{' '}
        <input
          type="range" min={waterMin} max={waterMax} step={waterStep} value={signals.waterLevel.value} style={{ flex: 1 }}
          onInput={(e: JSX.TargetedEvent<HTMLInputElement>) => { signals.waterLevel.value = parseFloat(e.currentTarget.value); }}
        />{' '}
        <span style={valueStyle}>{signals.waterLevel.value.toFixed(1)}</span>m{' '}
        <ColorPicker signal={atmosphere.waterColor} onCommit={onWaterColorCommit} />
      </label>
      <label style={labelStyle}>
        Terrain (low/high){' '}
        <ColorPicker signal={atmosphere.terrainLowColor} commitOn="change" onCommit={onTerrainColorCommit} />
        <ColorPicker signal={atmosphere.terrainHighColor} commitOn="change" onCommit={onTerrainColorCommit} />
      </label>
      <label style={labelStyle}>
        Window tint/glow{' '}
        <ColorPicker signal={atmosphere.windowTintColor} commitOn="change" onCommit={onWindowTintCommit} />
        <input
          type="range" min={0} max={1.5} step={0.05} value={atmosphere.windowGlow.value} style={{ flex: 1 }}
          onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
            atmosphere.windowGlow.value = parseFloat(e.currentTarget.value);
            onWindowTintCommit();
          }}
        />{' '}
        <span style={valueStyle}>{atmosphere.windowGlow.value.toFixed(2)}</span>
      </label>
    </div>
  );
}
