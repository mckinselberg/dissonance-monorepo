import type { Signal } from '@preact/signals';
import type {
  ExteriorReturnSnapshot,
  WorldRoute,
  WorldTransitionState,
} from '../state/worldSession';

interface InteriorDebugRowProps {
  route: Signal<WorldRoute>;
  transition: Signal<WorldTransitionState>;
  exteriorSnapshot: Signal<ExteriorReturnSnapshot | null>;
  onEnter(): void;
  onExit(): void;
}

export function InteriorDebugRow({
  route,
  transition,
  exteriorSnapshot,
  onEnter,
  onExit,
}: InteriorDebugRowProps) {
  const routeLabel = route.value.kind === 'exterior'
    ? 'exterior'
    : `surveillance/${route.value.locationId}`;
  return (
    <div>
      <div>route: {routeLabel}</div>
      <div>transition: {transition.value}</div>
      <div>return snapshot: {exteriorSnapshot.value ? 'ready' : 'none'}</div>
      <button type='button' disabled={transition.value !== 'exterior'} onClick={onEnter}>
        Enter Milo apartment
      </button>{' '}
      <button type='button' disabled={transition.value !== 'interior'} onClick={onExit}>
        Exit interior
      </button>
    </div>
  );
}
