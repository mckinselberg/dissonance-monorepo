# Don't Turn Around

A first-person horror walking game set in a procedurally generated forest at dusk. Something is following you. Don't turn around.

Built with [BabylonJS](https://www.babylonjs.com/) and [Tone.js](https://tonejs.github.io/).

## Features

- Procedural terrain, forest, mountain ring, and cloud system
- PS1 / dark experience profiles with distinct visuals and audio
- Pursuer AI with proximity states (distant → near → close) driving audio and visual tension
- Heartbeat audio, ambient soundscape, and footstep layers that respond to adrenaline level
- Proximity vignette overlay and watcher eye effects
- Dev HUD for testing (toggle with `` ` ``)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build   # outputs to dist/
npm run preview # serve the build locally
```

## Deploy

The repo includes a `render.yaml` blueprint. Connect the repo on [Render](https://render.com) via **New → Blueprint** and it will auto-deploy on every push to `main`.
