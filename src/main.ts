// Intercept Ctrl+W / Cmd+W before the browser acts on them.
// Capture phase runs before native browser handling.
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
  }
}, { capture: true });

import { MainMenu } from './ui/MainMenu';
import { Game } from './game/Game';
import { DevHUD } from './ui/DevHUD';
import type { GameConfig } from './types';

const STORAGE_KEY = 'dta_config';

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = 'renderCanvas';
  document.getElementById('app')!.appendChild(canvas);
  return canvas;
}

async function launch(config: GameConfig): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  const canvas = createCanvas();
  const game = new Game(canvas, config);
  await game.start();
  new DevHUD(game);
}

// If a previous session was saved, show a minimal "click to resume" screen
// rather than the full menu. This survives hot-reloads during development.
const savedRaw = localStorage.getItem(STORAGE_KEY);
if (savedRaw) {
  try {
    const saved = JSON.parse(savedRaw) as GameConfig;
    showResumeScreen(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    showMenu();
  }
} else {
  showMenu();
}

function showMenu(): void {
  new MainMenu((config) => {
    launch(config).catch(console.error);
  });
}

function showResumeScreen(config: GameConfig): void {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; inset: 0; background: #000;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; font-family: monospace; color: #555;
    z-index: 50; cursor: pointer; user-select: none;
  `;
  el.innerHTML = `
    <p style="font-size:0.65rem;letter-spacing:0.3em;color:#333;margin:0 0 1.2rem">
      DON'T TURN AROUND
    </p>
    <p style="font-size:0.75rem;letter-spacing:0.2em;color:#666;margin:0 0 0.4rem">
      ${config.experienceMode.toUpperCase()} &nbsp;·&nbsp; ${config.departureTime.toUpperCase()}
    </p>
    <p style="font-size:0.6rem;letter-spacing:0.15em;color:#333;margin:1.5rem 0 0">
      click to enter
    </p>
    <p style="font-size:0.5rem;letter-spacing:0.1em;color:#222;margin:2.5rem 0 0">
      esc → menu
    </p>
  `;

  const go = (): void => {
    el.style.transition = 'opacity 0.6s';
    el.style.opacity = '0';
    setTimeout(() => {
      el.remove();
      launch(config).catch(console.error);
    }, 600);
  };

  el.addEventListener('click', go);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      localStorage.removeItem(STORAGE_KEY);
      el.remove();
      showMenu();
    }
  }, { once: true });

  document.body.appendChild(el);
}
