import type { Signal } from '@preact/signals';
import type { JSX } from 'preact';
import type { VisibilitySignals } from '../state/visibility';
import { unlockedLineglassLayers } from '../state/lineglass';

// Exported for compact boolean controls shared by the Layers, Weather,
// Player, Movement, and Companion modules.
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
  onGridCommit: (checked: boolean) => void;
  onMountainsCommit: (checked: boolean) => void;
  // state/lineglass.ts — the Signal itself (not a plain boolean snapshot),
  // so reading .value here during render subscribes this component to it
  // the same way ToggleLabel already does for each individual checkbox.
  // Passing a pre-computed boolean instead would freeze at whatever was
  // true the one time the enclosing <Section> was rendered, since that
  // render() call never re-runs on its own.
  lineglassCollectedPartIds: Signal<string[]>;
};

export function VisibilityToggles({
  signals, onTerrainCommit, onOsmCommit, onGpxCommit, onWaterCommit, onGridCommit,
  onMountainsCommit, lineglassCollectedPartIds,
}: VisibilityTogglesProps) {
  const unlocked = unlockedLineglassLayers(lineglassCollectedPartIds.value.length);
  return (
    <>
      <ToggleLabel label="Terrain" signal={signals.terrain} onCommit={onTerrainCommit} />
      {/* Grid/OSM/GPX are the Lineglass's own geo-reference layers (see
          state/lineglass.ts) — hidden, not just disabled, until their tier's
          part count is collected. The player doesn't know they're missing
          something; the device simply doesn't have that capability yet. */}
      {unlocked.has('osm') && <ToggleLabel label="OSM Trails" signal={signals.osm} onCommit={onOsmCommit} />}
      {unlocked.has('gpx') && <ToggleLabel label="GPX Track" signal={signals.gpx} onCommit={onGpxCommit} />}
      <ToggleLabel label="Water" signal={signals.water} onCommit={onWaterCommit} />
      {unlocked.has('grid') && <ToggleLabel label="Lat/Long Grid" signal={signals.grid} onCommit={onGridCommit} />}
      <ToggleLabel label="Mountains" signal={signals.mountains} onCommit={onMountainsCommit} />
      {/* Power lines deliberately not here — utilityCorridors (main.tsx) only
          exists in the non-orbit code path, same as the boulevard buildings;
          it's rendered as its own orbit-gated ToggleLabel next to "Bounded
          world" instead of through this shared, orbit-safe prop contract. */}
    </>
  );
}
