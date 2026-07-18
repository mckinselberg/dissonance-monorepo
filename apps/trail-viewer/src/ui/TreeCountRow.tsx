import type { Signal } from '@preact/signals';
import { SliderRow } from './AtmosphereRow';

export type TreeCountRowProps = {
  signal: Signal<number>;
  max: number;
  onCommit: (value: number) => void;
};

// Split out of AtmosphereRow and grouped under "World" instead of "Sky" —
// tree count is world/terrain density, not an atmosphere control. Unlike
// H-scale/V-exagg/water-level (level-1-only), tree count applies on every
// level, so it's mounted unconditionally alongside ScaleTuningRow rather
// than gated the same way — see main.tsx's "World" Section.
export function TreeCountRow({ signal, max, onCommit }: TreeCountRowProps) {
  return (
    <div style={{ marginTop: '4px' }}>
      {/* step stays 1 unconditionally — see main.ts's tree-count comment:
          setting .value via JS snaps to the nearest step boundary, so a
          coarser step would silently desync the shown count from the thumb. */}
      <SliderRow label="# Trees" signal={signal} min={0} max={max} step={1} commitOn="change" onCommit={onCommit} />
    </div>
  );
}
