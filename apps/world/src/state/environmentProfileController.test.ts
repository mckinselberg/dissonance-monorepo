import { describe, expect, it, vi } from 'vitest';
import { createDefaultEnvironmentRenderingProfile } from './environmentRenderingProfile';
import { createEnvironmentProfileController } from './environmentProfileController';

const base = createDefaultEnvironmentRenderingProfile({ farClip: 1000, fogDensity: 0, fogColor: '#000000' });
const profiles = [base, { ...base, id: 'location', label: 'Location' }, { ...base, id: 'story', label: 'Story' }];

describe('environment profile controller', () => {
  it('resolves source precedence and falls back when a source clears', () => {
    const onChange = vi.fn();
    const controller = createEnvironmentProfileController({ profiles, onChange });
    controller.request({ source: 'location', profileId: 'location', reason: 'entered boulevard' });
    controller.request({ source: 'narrative', profileId: 'story', reason: 'story beat' });
    expect(controller.active.value).toMatchObject({ source: 'narrative', profileId: 'story' });
    controller.clear('narrative');
    expect(controller.active.value).toMatchObject({ source: 'location', profileId: 'location' });
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('lets an explicit manual choice override automatic sources', () => {
    const controller = createEnvironmentProfileController({ profiles, onChange: vi.fn() });
    controller.request({ source: 'narrative', profileId: 'story' });
    controller.request({ source: 'manual', profileId: 'location' });
    expect(controller.active.value.source).toBe('manual');
  });

  it('rejects unknown profile ids loudly', () => {
    const controller = createEnvironmentProfileController({ profiles, onChange: vi.fn() });
    expect(() => controller.request({ source: 'location', profileId: 'missing' })).toThrow('unknown profile');
  });
});

