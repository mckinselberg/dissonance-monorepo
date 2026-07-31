import { NullEngine, Scene } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import type { LocationEntry } from './LocationProps';
import { loadWorldTerminals } from './WorldTerminals';

const locations: LocationEntry[] = [{
  id: 'public-sanitation-terminal-01',
  name: 'public sanitation terminal',
  latLong: [40.7, -74.2],
  terminal: {
    headingDegrees: 90,
    interactionRadiusMeters: 2.4,
  },
}];

describe('WorldTerminals', () => {
  it('scales authored geometry, collision, and interaction range together', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const handle = loadWorldTerminals(
      scene,
      locations,
      () => ({ x: 12, z: -18 }),
      7,
      () => 4,
    );

    const terminal = handle.get('public-sanitation-terminal-01');
    expect(terminal).toMatchObject({
      id: 'public-sanitation-terminal-01',
      name: 'public sanitation terminal',
      interactionRadius: 16.8,
    });
    expect(terminal?.colliderRadius).toBeCloseTo(3.85);
    expect(terminal?.position.asArray()).toEqual([12, 4, -18]);
    expect(handle.colliders).toHaveLength(1);
    expect(handle.colliders[0]).toMatchObject({ x: 12, z: -18 });
    expect(handle.colliders[0].radius).toBeCloseTo(3.85);
    expect(scene.getTransformNodeByName('worldTerminal:public-sanitation-terminal-01')?.scaling.asArray())
      .toEqual([7, 7, 7]);

    handle.dispose();
    expect(handle.get('public-sanitation-terminal-01')).toBeNull();
    expect(() => handle.dispose()).not.toThrow();
    scene.dispose();
    engine.dispose();
  });

  it('rejects a non-positive world scale', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    expect(() => loadWorldTerminals(scene, locations, () => ({ x: 0, z: 0 }), 0, () => 0))
      .toThrow('horizontalScale must be finite and positive');
    scene.dispose();
    engine.dispose();
  });
});
