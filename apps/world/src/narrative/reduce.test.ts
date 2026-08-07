import { describe, expect, it } from 'vitest';
import { reduce } from './reduce';
import { createNarrativeState, type Beat, type NarrativeEvent, type WorldManifest } from './types';

const manifest: WorldManifest = { bands: {} };

const petBeat: Beat = {
  id: 'test-pet',
  tier: 'EXPERIMENTAL',
  readingCount: 4,
  scopes: ['local'],
  once: true,
  when: (state, event) => event.kind === 'pet' && state.since['test-pet-fired'] === undefined,
  emits: (_state, event) => [
    { kind: 'surface', id: 'test-surface', subject: 'dog', via: 'console', readingCount: 4 },
    { kind: 'companion-keep', id: 'dog' },
    { kind: 'mark-fired', key: 'test-pet-fired', t: event.t },
  ],
  readings: ['a', 'b', 'c', 'd'],
};

const bandedBeat: Beat = {
  id: 'test-banded',
  tier: 'EXPERIMENTAL',
  readingCount: 4,
  scopes: ['local'],
  once: false,
  when: (_state, event) => event.kind === 'zone-check',
  emits: () => [{ kind: 'surface', id: 'banded-surface', subject: 'dog', via: 'console', readingCount: 4 }],
  readings: ['a', 'b', 'c', 'd'],
};

describe('reduce', () => {
  it('is deterministic: same (state, event) yields deep-equal output twice', () => {
    const state = createNarrativeState(7);
    const event: NarrativeEvent = { t: 1, kind: 'pet' };
    const first = reduce(state, event, [petBeat], manifest);
    const second = reduce(state, event, [petBeat], manifest);
    expect(first).toEqual(second);
  });

  it('does not mutate the input state', () => {
    const state = createNarrativeState(1);
    const before = JSON.parse(JSON.stringify(state));
    reduce(state, { t: 1, kind: 'pet' }, [petBeat], manifest);
    expect(state).toEqual(before);
  });

  it('is reorder-stable: registry order never affects sorted intents', () => {
    const otherBeat: Beat = { ...petBeat, id: 'aaa-other', once: false, emits: () => [] };
    const state = createNarrativeState(1);
    const event: NarrativeEvent = { t: 1, kind: 'pet' };
    const a = reduce(state, event, [petBeat, otherBeat], manifest);
    const b = reduce(state, event, [otherBeat, petBeat], manifest);
    expect(a.intents).toEqual(b.intents);
  });

  it('applies mark-fired to since and companion-keep to companions, never leaks delivery-only intents into state', () => {
    const state = createNarrativeState(1);
    const { state: next } = reduce(state, { t: 42, kind: 'pet' }, [petBeat], manifest);
    expect(next.since['test-pet-fired']).toBe(42);
    expect(next.companions.dog).toBe(true);
    expect(state.since['test-pet-fired']).toBeUndefined();
  });

  it('once-gates via since, not by re-firing on the next matching event', () => {
    const state = createNarrativeState(1);
    const first = reduce(state, { t: 1, kind: 'pet' }, [petBeat], manifest);
    const second = reduce(first.state, { t: 2, kind: 'pet' }, [petBeat], manifest);
    expect(first.intents.length).toBeGreaterThan(0);
    expect(second.intents).toEqual([]);
  });

  it('band filter drops a beat whose readingCount exceeds the zone band', () => {
    const narrowManifest: WorldManifest = { bands: { 'synod-core': 2 } };
    const state = { ...createNarrativeState(1), zone: 'synod-core' };
    const { intents } = reduce(state, { t: 1, kind: 'zone-check' }, [bandedBeat], narrowManifest);
    expect(intents).toEqual([]);
  });

  it('band filter allows a beat exactly at the band limit', () => {
    const exactManifest: WorldManifest = { bands: { 'anomaly-space': 4 } };
    const state = { ...createNarrativeState(1), zone: 'anomaly-space' };
    const { intents } = reduce(state, { t: 1, kind: 'zone-check' }, [bandedBeat], exactManifest);
    expect(intents.length).toBe(1);
  });

  it('defaults an unlisted zone to the widest band (4)', () => {
    const state = { ...createNarrativeState(1), zone: 'unlisted-zone' };
    const { intents } = reduce(state, { t: 1, kind: 'zone-check' }, [bandedBeat], manifest);
    expect(intents.length).toBe(1);
  });
});
