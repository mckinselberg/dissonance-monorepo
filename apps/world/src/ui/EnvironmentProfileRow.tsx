import type { JSX } from 'preact';
import type { Signal } from '@preact/signals';
import type { EnvironmentRenderingProfile } from '../state/environmentRenderingProfile';

export function EnvironmentProfileRow({
  profiles,
  activeProfileId,
  onSelect,
}: {
  profiles: EnvironmentRenderingProfile[];
  activeProfileId: Signal<string>;
  onSelect: (profile: EnvironmentRenderingProfile) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
      Environment profile{' '}
      <select
        value={activeProfileId.value}
        onChange={(event: JSX.TargetedEvent<HTMLSelectElement>) => {
          const profile = profiles.find((candidate) => candidate.id === event.currentTarget.value);
          if (profile) onSelect(profile);
        }}
      >
        {profiles.map((profile) => <option value={profile.id}>{profile.label}</option>)}
      </select>
    </label>
  );
}
