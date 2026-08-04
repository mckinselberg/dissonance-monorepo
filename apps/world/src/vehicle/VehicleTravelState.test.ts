import { describe, expect, it } from 'vitest';
import { estimateFuel, VehicleTravelState } from './VehicleTravelState';
import type { VehicleProfile } from './vehicleProfile';

const profile: VehicleProfile = {
  id: 'test-vehicle',
  fuelCapacity: 10,
  speedMetersPerSecond: { careful: 2, fast: 5, reckless: 10 },
  consumptionPerMeter: { careful: 0.1, fast: 0.2, reckless: 0.4 },
};

const TOTAL_LENGTH = 100;

describe('estimateFuel', () => {
  it('returns a min/expected/max band around distance × consumption', () => {
    const estimate = estimateFuel(50, 'careful', profile);
    expect(estimate.expected).toBeCloseTo(5);
    expect(estimate.minimum).toBeLessThan(estimate.expected);
    expect(estimate.maximum).toBeGreaterThan(estimate.expected);
  });
});

describe('VehicleTravelState', () => {
  it('starts at distance 0 with a full tank by default', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH);
    const snapshot = state.snapshot();
    expect(snapshot.distanceMeters).toBe(0);
    expect(snapshot.fuelCurrent).toBe(profile.fuelCapacity);
    expect(snapshot.stranded).toBe(false);
  });

  it('advances distance and drains fuel proportionally while throttling forward', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { travelMode: 'careful' });
    const snapshot = state.update(1, { throttle: 1 }); // 1s at 2 m/s = 2m
    expect(snapshot.distanceMeters).toBeCloseTo(2);
    expect(snapshot.fuelCurrent).toBeCloseTo(10 - 2 * 0.1);
  });

  it('idle throttle does not move or consume fuel', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH);
    const snapshot = state.update(5, { throttle: 0 });
    expect(snapshot.distanceMeters).toBe(0);
    expect(snapshot.fuelCurrent).toBe(profile.fuelCapacity);
  });

  it('reverse throttle decreases distance, clamped at zero', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { distanceMeters: 1, travelMode: 'careful' });
    const snapshot = state.update(5, { throttle: -1 }); // would travel -10m, clamps to 0
    expect(snapshot.distanceMeters).toBe(0);
  });

  it('clamps distance at the road total length', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { distanceMeters: 99, travelMode: 'reckless' });
    const snapshot = state.update(10, { throttle: 1 }); // would travel far past the end
    expect(snapshot.distanceMeters).toBe(TOTAL_LENGTH);
  });

  it('consumes more fuel per meter in faster travel modes', () => {
    const careful = new VehicleTravelState(profile, TOTAL_LENGTH, { travelMode: 'careful' });
    const reckless = new VehicleTravelState(profile, TOTAL_LENGTH, { travelMode: 'reckless' });
    careful.update(1, { throttle: 1 });
    reckless.update(1, { throttle: 1 });
    const carefulUsed = profile.fuelCapacity - careful.snapshot().fuelCurrent;
    const recklessUsed = profile.fuelCapacity - reckless.snapshot().fuelCurrent;
    expect(recklessUsed).toBeGreaterThan(carefulUsed);
  });

  it('strands at zero fuel, stopping at the real position without exceeding the tank', () => {
    // 10 fuel / 0.4 per meter at reckless = 25m affordable, tank empties well
    // before the 100 s of throttle requested (10 m/s × 100 s = 1000 m desired).
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { travelMode: 'reckless' });
    const snapshot = state.update(100, { throttle: 1 });
    expect(snapshot.fuelCurrent).toBe(0);
    expect(snapshot.stranded).toBe(true);
    expect(snapshot.distanceMeters).toBeCloseTo(25);
  });

  it('stays stranded and immobile on further throttle once out of fuel', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { travelMode: 'reckless' });
    state.update(100, { throttle: 1 });
    const strandedDistance = state.snapshot().distanceMeters;
    const next = state.update(5, { throttle: 1 });
    expect(next.distanceMeters).toBe(strandedDistance);
    expect(next.stranded).toBe(true);
  });

  it('refuel clears the stranded flag and allows movement again', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { travelMode: 'reckless' });
    // Fuel-limited stranding well short of the 100m road (25m range at reckless).
    state.update(100, { throttle: 1 });
    const strandedSnapshot = state.snapshot();
    expect(strandedSnapshot.fuelCurrent).toBe(0);
    expect(strandedSnapshot.stranded).toBe(true);
    state.refuel(5);
    expect(state.snapshot().stranded).toBe(false);
    const next = state.update(1, { throttle: 1 });
    expect(next.distanceMeters).toBeGreaterThan(strandedSnapshot.distanceMeters);
  });

  it('loading a seed with zero fuel starts stranded even before any update', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { fuelCurrent: 0 });
    expect(state.snapshot().stranded).toBe(true);
  });

  it('estimateRemainingRangeMeters reflects current fuel and travel mode', () => {
    const state = new VehicleTravelState(profile, TOTAL_LENGTH, { travelMode: 'fast' });
    expect(state.estimateRemainingRangeMeters()).toBeCloseTo(10 / 0.2);
  });
});
