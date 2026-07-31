import { Vector3 } from '@babylonjs/core';
import { describe, expect, it, vi } from 'vitest';
import { DroneRecovery } from './DroneRecovery';
import { selectStrikeAnchor, type StrikeAnchor } from './StrikeAnchorSelector';
import { StrikeGate } from './StrikeGate';
import { copyStrikeProfile, parseStrikeProfile, type StrikeProfile } from './strikeProfile';

const profile: StrikeProfile = parseStrikeProfile({
  id: 'test-strike',
  strikeRainThreshold: 0.4,
  strikeWindupMinSeconds: 2,
  strikeWindupMaxSeconds: 4,
  rainEstablishTimeoutSeconds: 5,
  losRange: 20,
  strikeAnchorCaptureRange: 5,
  flashIntensity: 0.2,
  flashDurationSeconds: 0.1,
  clapDelayFromFlashSeconds: 0.1,
  recoveryProximityRange: 2,
  droneInertSettleSeconds: 1,
});

const anchors: StrikeAnchor[] = [
  { id: 'one', position: Vector3.Zero(), patrolDroneRef: 'drone', losProbeOffset: Vector3.Zero(), eligible: true, weight: 1 },
  { id: 'two', position: Vector3.Zero(), patrolDroneRef: 'drone', losProbeOffset: Vector3.Zero(), eligible: true, weight: 1 },
  { id: 'three', position: Vector3.Zero(), patrolDroneRef: 'drone', losProbeOffset: Vector3.Zero(), eligible: true, weight: 1 },
];

function inputs(overrides: Partial<Parameters<StrikeGate['update']>[1]> = {}) {
  return {
    hasLineOfSight: true,
    distanceToAnchor: 5,
    droneDistanceToAnchor: 1,
    rainIntensity: 1,
    ...overrides,
  };
}

describe('StrikeGate', () => {
  it('commands rain on dry entry and cannot fire before rain reaches threshold', () => {
    const requestStorm = vi.fn();
    const forceStormThreshold = vi.fn();
    const gate = new StrikeGate(anchors[0], 1, { requestStorm, forceStormThreshold }, profile);
    expect(gate.update(0, inputs({ rainIntensity: 0 }))).toBe('ARMED');
    expect(requestStorm).toHaveBeenCalledOnce();
    expect(gate.update(10, inputs({ rainIntensity: 0 }))).toBe('ARMED');
    expect(forceStormThreshold).toHaveBeenCalledOnce();
  });

  it('fires after the seeded wind-up on an already-wet entry', () => {
    const gate = new StrikeGate(anchors[0], 2, {
      requestStorm: vi.fn(),
      forceStormThreshold: vi.fn(),
    }, profile);
    expect(gate.update(0, inputs())).toBe('ARMED');
    expect(gate.update(gate.windupSeconds, inputs())).toBe('FIRING');
  });

  it('holds armed across LOS loss and fires when LOS returns', () => {
    const gate = new StrikeGate(anchors[0], 3, {
      requestStorm: vi.fn(),
      forceStormThreshold: vi.fn(),
    }, profile);
    gate.update(0, inputs());
    expect(gate.update(gate.windupSeconds + 1, inputs({ hasLineOfSight: false }))).toBe('ARMED');
    expect(gate.update(0, inputs({ hasLineOfSight: true }))).toBe('FIRING');
  });

  it('is one-shot after being marked spent', () => {
    const gate = new StrikeGate(anchors[0], 4, {
      requestStorm: vi.fn(),
      forceStormThreshold: vi.fn(),
    }, profile);
    gate.update(0, inputs());
    gate.update(gate.windupSeconds, inputs());
    gate.markSpent();
    expect(gate.update(100, inputs())).toBe('SPENT');
  });

  it('selects deterministically and honors a restored anchor', () => {
    expect(selectStrikeAnchor(anchors, 123).id).toBe(selectStrikeAnchor(anchors, 123).id);
    expect(selectStrikeAnchor(anchors, 123, 'three').id).toBe('three');
    const first = new StrikeGate(anchors[0], 123, { requestStorm: vi.fn(), forceStormThreshold: vi.fn() }, profile);
    const second = new StrikeGate(anchors[0], 123, { requestStorm: vi.fn(), forceStormThreshold: vi.fn() }, profile);
    expect(first.windupSeconds).toBe(second.windupSeconds);
  });
});

describe('DroneRecovery', () => {
  it('emits only the acquisition hand-off inside recovery range', () => {
    const recovery = new DroneRecovery(profile);
    recovery.markRecoverable(new Vector3(10, 5, 10));
    expect(recovery.isAvailable(new Vector3(0, 0, 0))).toBe(false);
    expect(recovery.isAvailable(new Vector3(11, 0, 10))).toBe(true);
    expect(recovery.recover()).toEqual({ emitterAcquired: true, chassisRecovered: true });
    expect(recovery.recover()).toBeNull();
  });
});

describe('StrikeProfile', () => {
  it('round-trips losslessly through JSON and applies validated overrides', () => {
    const imported = parseStrikeProfile(JSON.parse(JSON.stringify(profile)) as unknown);
    const target = structuredClone(profile);
    copyStrikeProfile(target, { ...imported, losRange: 42 });
    expect(target.losRange).toBe(42);
    expect(JSON.parse(JSON.stringify(target))).toEqual({ ...profile, losRange: 42 });
  });
});
