import type { Signal } from '@preact/signals';
import { SliderRow } from './AtmosphereRow';

export type TreeCountRowProps = {
  label?: string;
  signal: Signal<number>;
  // A Signal, not a plain number — its pool shrinks/grows as the tree
  // region radius changes (main.tsx), and passing the signal itself (read
  // via .value below, during this component's own render) is what lets
  // @preact/signals auto-re-render this row when that happens, without
  // main.tsx re-invoking render() for the whole "World" Section.
  max: Signal<number>;
  onCommit: (value: number) => void;
};

// Split out of AtmosphereRow and grouped under "World" instead of "Sky" —
// tree count is world/terrain density, not an atmosphere control. Unlike
// H-scale/V-exagg/water-level (level-1-only), tree count applies on every
// level, so it's mounted unconditionally alongside ScaleTuningRow rather
// than gated the same way — see main.tsx's "World" Section.
export function TreeCountRow({ label = '# Trees', signal, max, onCommit }: TreeCountRowProps) {
  return (
    <div style={{ marginTop: '4px' }}>
      {/* step stays 1 unconditionally — see main.ts's tree-count comment:
          setting .value via JS snaps to the nearest step boundary, so a
          coarser step would silently desync the shown count from the thumb. */}
      <SliderRow label={label} signal={signal} min={0} max={max.value} step={1} commitOn="change" onCommit={onCommit} />
    </div>
  );
}
