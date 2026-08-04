// Live telemetry only (distance/fuel/mode change every frame) — same
// "plain div, updated via textContent from the game loop" convention as the
// T29/T31 status lines in main.tsx's debug-root block, not a signals-driven
// component. main.tsx writes into these ids each frame.
export function VehicleRow() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px', marginTop: '4px' }}>
      <span>Road position</span><span id='vehicle-road-status'>—</span>
      <span>Travel mode</span><span id='vehicle-travel-mode'>—</span>
      <span>Fuel</span><span id='vehicle-fuel'>—</span>
      <span>Est. range</span><span id='vehicle-range'>—</span>
      <span>Status</span><span id='vehicle-occupancy'>—</span>
    </div>
  );
}
