import type { Mesh } from '@babylonjs/core';

export function setMeshesEnabled(meshes: Mesh[], enabled: boolean): void {
  meshes.forEach((m) => m.setEnabled(enabled));
}

// Coalesces rapid-fire calls (e.g. every 'input' tick while dragging a
// slider) into one trailing call after activity stops — used for the
// trailside scatter's H/V-scale + count sliders, which commit live on
// 'input' (so dragging previews) rather than waiting for 'change' (mouse
// release), but shouldn't rebuild the scatter on every single tick.
export function debounce<Args extends unknown[]>(fn: (...args: Args) => void, delayMs: number): (...args: Args) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

// Covers the black screen during initial load and during the several
// reload()/href navigations this app does on purpose (Load View,
// reset-position, the saved-views dropdown) — hidden once the scene is
// actually ready to render, right before each branch's gameLoop.start().
export function hideLoadingOverlay(): void {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}
