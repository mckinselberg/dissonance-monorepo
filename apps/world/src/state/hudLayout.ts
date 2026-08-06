import { signal, effect, type Signal } from '@preact/signals';

// Dev-tool window chrome (which screen edge the Lineglass panel docks to),
// not authored environment state — persisted to its own small localStorage
// key rather than through SavedSettings/Copy-Load View.
export type HudSide = 'left' | 'right';

const STORAGE_KEY = 'dissonance.dev-hud.side.v1';

function loadHudSide(): HudSide {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
}

export interface HudLayoutSignals {
  // Lineglass's own side. KeymapOverlay reads this and docks itself to the
  // opposite edge, so the two never overlap.
  side: Signal<HudSide>;
}

export function createHudLayoutSignals(): HudLayoutSignals {
  const side = signal<HudSide>(loadHudSide());
  effect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, side.value);
    } catch {
      // UI preference only; storage denial must not break the toggle.
    }
  });
  return { side };
}
