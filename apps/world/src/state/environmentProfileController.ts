import { signal, type ReadonlySignal } from '@preact/signals';
import type { EnvironmentRenderingProfile } from './environmentRenderingProfile';

export type EnvironmentProfileSource = 'default' | 'session-seed' | 'manual' | 'location' | 'narrative';

const SOURCE_PRIORITY: Record<EnvironmentProfileSource, number> = {
  default: 0,
  'session-seed': 10,
  location: 20,
  narrative: 30,
  manual: 40,
};

export interface EnvironmentProfileSelection {
  profileId: string;
  source: EnvironmentProfileSource;
  reason?: string;
}

export interface EnvironmentProfileController {
  readonly active: ReadonlySignal<EnvironmentProfileSelection>;
  request(selection: EnvironmentProfileSelection): void;
  clear(source: Exclude<EnvironmentProfileSource, 'default'>): void;
}

export function createEnvironmentProfileController(options: {
  profiles: readonly EnvironmentRenderingProfile[];
  initialProfileId?: string;
  initialSource?: EnvironmentProfileSource;
  onChange(selection: EnvironmentProfileSelection, profile: EnvironmentRenderingProfile): void;
}): EnvironmentProfileController {
  const profiles = new Map(options.profiles.map((profile) => [profile.id, profile]));
  const fallback = options.profiles[0];
  if (!fallback) throw new Error('[EnvironmentProfiles] at least one profile is required.');
  const initial = profiles.has(options.initialProfileId ?? '')
    ? options.initialProfileId as string
    : fallback.id;
  const requests = new Map<EnvironmentProfileSource, EnvironmentProfileSelection>([
    ['default', { profileId: fallback.id, source: 'default' }],
  ]);
  if (options.initialProfileId) {
    requests.set(options.initialSource ?? 'session-seed', {
      profileId: initial,
      source: options.initialSource ?? 'session-seed',
    });
  }
  const active = signal<EnvironmentProfileSelection>(choose(requests));

  const apply = () => {
    const next = choose(requests);
    if (next.profileId === active.value.profileId && next.source === active.value.source) return;
    active.value = next;
    options.onChange(next, profiles.get(next.profileId) ?? fallback);
  };

  return {
    active,
    request: (selection) => {
      if (!profiles.has(selection.profileId)) {
        throw new Error(`[EnvironmentProfiles] unknown profile "${selection.profileId}".`);
      }
      requests.set(selection.source, selection);
      apply();
    },
    clear: (source) => {
      requests.delete(source);
      apply();
    },
  };
}

function choose(
  requests: ReadonlyMap<EnvironmentProfileSource, EnvironmentProfileSelection>,
): EnvironmentProfileSelection {
  return [...requests.values()].sort((a, b) => SOURCE_PRIORITY[b.source] - SOURCE_PRIORITY[a.source])[0];
}

