import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import type { VisibilitySignals } from '../state/visibility';

// Exported so main.tsx can render Overcast/Bounded-world alongside these as
// siblings in one shared toggle grid — see the "Toggles" section there.
export function ToggleLabel({ label, signal: sig, onCommit }: { label: string; signal: Signal<boolean>; onCommit: (checked: boolean) => void }) {
  const handleChange = (e: JSX.TargetedEvent<HTMLInputElement>) => {
    const checked = e.currentTarget.checked;
    sig.value = checked;
    onCommit(checked);
  };
  return (
    <label>
      <input type="checkbox" checked={sig.value} onChange={handleChange} /> {label}
    </label>
  );
}

export type VisibilityTogglesProps = {
  signals: VisibilitySignals;
  onTerrainCommit: (checked: boolean) => void;
  onOsmCommit: (checked: boolean) => void;
  onGpxCommit: (checked: boolean) => void;
  onWaterCommit: (checked: boolean) => void;
  onCloudsCommit: (checked: boolean) => void;
  onTreesCommit: (checked: boolean) => void;
};

export function VisibilityToggles({
  signals, onTerrainCommit, onOsmCommit, onGpxCommit, onWaterCommit, onCloudsCommit, onTreesCommit,
}: VisibilityTogglesProps) {
  return (
    <>
      <ToggleLabel label="Terrain" signal={signals.terrain} onCommit={onTerrainCommit} />
      <ToggleLabel label="OSM Trails" signal={signals.osm} onCommit={onOsmCommit} />
      <ToggleLabel label="GPX Track" signal={signals.gpx} onCommit={onGpxCommit} />
      <ToggleLabel label="Water" signal={signals.water} onCommit={onWaterCommit} />
      <ToggleLabel label="Clouds" signal={signals.clouds} onCommit={onCloudsCommit} />
      <ToggleLabel label="Trees" signal={signals.trees} onCommit={onTreesCommit} />
    </>
  );
}
