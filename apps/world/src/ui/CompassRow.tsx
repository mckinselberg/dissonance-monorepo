import type { Signal } from '@preact/signals';
import type { CompassReading } from '@dissonance/navigation';
import { cardinalDirection } from '../state/compass';

const groupStyle = { marginTop: '8px' };
const landmarkRowStyle = { display: 'flex', justifyContent: 'space-between', gap: '8px' };

// T28's compass HUD slice — a live readout, not the deferred diegetic pickup/
// interference item (see docs/design/world/RURAL-INFRASTRUCTURE.md). Reading
// is null before the first game-loop frame updates it.
export function CompassRow({ reading }: { reading: Signal<CompassReading | null> }) {
  const value = reading.value;
  if (!value) return null;
  const { bearingDegrees, nearbyLandmarks } = value;
  return (
    <div style={groupStyle}>
      <div>
        Heading: {cardinalDirection(bearingDegrees)} ({bearingDegrees.toFixed(0)}°)
      </div>
      {nearbyLandmarks.length > 0 && (
        <div style={{ marginTop: '4px' }}>
          {nearbyLandmarks.map((landmark) => (
            <div key={landmark.name} style={landmarkRowStyle}>
              <span>{landmark.name}</span>
              <span>
                {cardinalDirection(landmark.bearingDegrees)} · {landmark.distanceMeters.toFixed(0)}m
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
