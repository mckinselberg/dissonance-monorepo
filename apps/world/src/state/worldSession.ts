import { signal, type Signal } from '@preact/signals';
import type { ActiveMode } from './movement';

export const MILOS_APARTMENT_ROUTE = '/world/surveillance/milos-apartment';

export type WorldRoute =
  | { kind: 'exterior' }
  | { kind: 'surveillance'; locationId: 'milos-apartment' };

export type WorldTransitionState = 'exterior' | 'entering' | 'interior' | 'exiting';

export interface ExteriorReturnSnapshot {
  featureId: 'milos-building';
  traversalMode: ActiveMode;
  position: { x: number; y: number; z: number };
  cameraRotation: { x: number; y: number; z: number };
  hadPointerLock: boolean;
}

export function parseWorldRoute(pathname: string): WorldRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === MILOS_APARTMENT_ROUTE) {
    return { kind: 'surveillance', locationId: 'milos-apartment' };
  }
  return { kind: 'exterior' };
}

export function pathForWorldRoute(route: WorldRoute): string {
  return route.kind === 'exterior' ? '/world/' : MILOS_APARTMENT_ROUTE;
}

export class WorldSessionCoordinator {
  readonly route: Signal<WorldRoute>;
  readonly transition: Signal<WorldTransitionState>;
  readonly exteriorSnapshot = signal<ExteriorReturnSnapshot | null>(null);

  constructor(initialPathname: string) {
    const initialRoute = parseWorldRoute(initialPathname);
    this.route = signal(initialRoute);
    this.transition = signal('exterior');
  }

  setRoute(route: WorldRoute): void {
    this.route.value = route;
  }

  setTransition(transition: WorldTransitionState): void {
    this.transition.value = transition;
  }

  isExterior(): boolean {
    return this.transition.value === 'exterior';
  }
}
