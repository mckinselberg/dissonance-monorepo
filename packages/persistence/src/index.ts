export type { PlayerSaveState } from '@dta/shared-types';

const STORAGE_KEY = 'dta_player_state';

export class PlayerPersistence {
  save(state: import('@dta/shared-types').PlayerSaveState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  load(): import('@dta/shared-types').PlayerSaveState | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as import('@dta/shared-types').PlayerSaveState;
    } catch {
      return null;
    }
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  updateDistance(additionalMeters: number): void {
    const state = this.load();
    if (!state) return;
    state.distanceTraveledMeters += additionalMeters;
    state.savedAt = Date.now();
    this.save(state);
  }

  updatePosition(position: import('@dta/shared-types').WorldPosition): void {
    const state = this.load();
    if (!state) return;
    state.position = position;
    state.savedAt = Date.now();
    this.save(state);
  }

  markPlacardDiscovered(placardId: string): void {
    const state = this.load();
    if (!state) return;
    if (!state.discoveredPlacardIds.includes(placardId)) {
      state.discoveredPlacardIds.push(placardId);
      this.save(state);
    }
  }

  markPlacardGrokked(placardId: string): void {
    this.markPlacardDiscovered(placardId);
  }

  createInitialState(position: import('@dta/shared-types').WorldPosition): import('@dta/shared-types').PlayerSaveState {
    return {
      position,
      distanceTraveledMeters: 0,
      sessionCount: 1,
      savedAt: Date.now(),
      discoveredPlacardIds: [],
      knownRouteIds: [],
    };
  }
}
