import { MainMenu } from './ui/MainMenu';
import { Game } from './game/Game';
import type { GameConfig } from './types';

function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = 'renderCanvas';
  document.getElementById('app')!.appendChild(canvas);
  return canvas;
}

async function launch(config: GameConfig): Promise<void> {
  const canvas = createCanvas();
  const game = new Game(canvas, config);
  await game.start();
}

new MainMenu((config) => {
  launch(config).catch(console.error);
});
