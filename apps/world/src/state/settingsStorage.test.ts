import { describe, expect, it } from 'vitest';
import { seedSettingsFromView } from './settingsStorage';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), values };
}

describe('seedSettingsFromView', () => {
  it('seeds an empty level and records session provenance', () => {
    const local = memoryStorage();
    const session = memoryStorage();
    expect(seedSettingsFromView({
      levelKey: '1', local, session,
      viewName: 'seed',
      views: [{ name: 'seed', level: '1', x: 12, environmentProfileId: 'urban-edge-dusk' }],
    })).toBe(true);
    expect(JSON.parse(local.values.get('trail-viewer:settings:1') ?? '{}')).toMatchObject({ x: 12, environmentProfileId: 'urban-edge-dusk' });
    expect(JSON.parse(session.values.get('dissonance:environment-seed:v1') ?? '{}')).toMatchObject({ viewName: 'seed' });
  });

  it('never overwrites existing settings', () => {
    const local = memoryStorage();
    local.setItem('trail-viewer:settings:1', JSON.stringify({ x: 99 }));
    expect(seedSettingsFromView({ levelKey: '1', local, session: memoryStorage(), views: [] })).toBe(false);
    expect(JSON.parse(local.values.get('trail-viewer:settings:1') ?? '{}').x).toBe(99);
  });

  it('supports an explicit one-shot overwrite', () => {
    const local = memoryStorage();
    local.setItem('trail-viewer:settings:1', JSON.stringify({ x: 99 }));
    expect(seedSettingsFromView({
      levelKey: '1', local, session: memoryStorage(), overwrite: true, viewName: 'seed',
      views: [{ name: 'seed', level: '1', x: 12 }],
    })).toBe(true);
    expect(JSON.parse(local.values.get('trail-viewer:settings:1') ?? '{}').x).toBe(12);
  });
});
