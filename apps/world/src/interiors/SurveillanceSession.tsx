import type { Scene } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import type { ITerrain } from '@dissonance/world';
import { render } from 'preact';
import {
  MILOS_APARTMENT_ROUTE,
  WorldSessionCoordinator,
  parseWorldRoute,
  pathForWorldRoute,
  type ExteriorReturnSnapshot,
} from '../state/worldSession';
import type { ActiveMode, MovementSignals } from '../state/movement';
import type { TraversalController } from '../world/TraversalRig';
import type { WorldFeaturesSystem } from '../world/WorldFeaturesSystem';
import {
  loadMilosApartmentInterior,
  type SurveillanceInteriorHandle,
} from './MilosApartmentInterior';
import { SurveillanceCameraControls } from '../ui/SurveillanceCameraControls';
import type { KeyActionDispatcher } from '../input/keyActionDispatcher';

export type EnterInteriorSource = 'interaction' | 'history' | 'deep-link' | 'debug';

export interface SurveillanceSession {
  readonly worldSession: WorldSessionCoordinator;
  enterInterior(source: EnterInteriorSource): Promise<void>;
  requestExit(): void;
  isNearEntrance(): boolean;
}

// Owns Milo's-apartment surveillance-interior routing: the exterior<->
// interior transition state machine (WorldSessionCoordinator), the loaded
// interior handle, and the history/deep-link wiring around it
// (popstate + 'E' to enter/exit). `terrain`/`locationFeatures` are held by
// reference (both are stable instances that rebuild themselves in place —
// see TerrainOverlaySystem/WorldFeaturesSystem's own comments) rather than
// snapshotted, so this stays correct across an hScale/vExag rescale.
// Player-mode-only (see main.tsx — orbit mode never constructs this).
export function createSurveillanceSession(deps: {
  scene: Scene;
  canvas: HTMLCanvasElement;
  terrain: ITerrain;
  locationFeatures: WorldFeaturesSystem;
  controllers: Record<ActiveMode, TraversalController>;
  movement: MovementSignals;
  switchMode: (mode: ActiveMode) => void;
  onBeforeEnter?: () => void;
  // Also written directly by main.tsx's game loop (the exterior "E — Enter
  // Milo's apartment" proximity prompt) — shared rather than looked up
  // twice, so there's one DOM node both sides agree on.
  interactionPrompt: HTMLDivElement;
  dispatcher: KeyActionDispatcher;
}): SurveillanceSession {
  const {
    scene,
    canvas,
    terrain,
    locationFeatures,
    controllers,
    movement,
    switchMode,
    onBeforeEnter,
    interactionPrompt,
    dispatcher,
  } = deps;

  const worldSession = new WorldSessionCoordinator(window.location.pathname);
  let surveillanceInterior: SurveillanceInteriorHandle | null = null;
  let interiorLoadGeneration = 0;

  const snapshotExterior = (): ExteriorReturnSnapshot => {
    const controller = controllers[movement.activeMode.value];
    const position = controller.getPosition();
    const rotation = controller.camera.rotation;
    return {
      featureId: 'milos-building',
      traversalMode: movement.activeMode.value,
      position: { x: position.x, y: position.y, z: position.z },
      cameraRotation: { x: rotation.x, y: rotation.y, z: rotation.z },
      hadPointerLock: document.pointerLockElement === canvas,
    };
  };

  const doorwayReturnSnapshot = (): ExteriorReturnSnapshot => {
    const entrance = locationFeatures.milosEntrance;
    if (!entrance) return snapshotExterior();
    return {
      featureId: entrance.featureId,
      traversalMode: 'walk',
      position: {
        x: entrance.position.x,
        y: terrain.getHeightAt(entrance.position.x, entrance.position.z),
        z: entrance.position.z,
      },
      cameraRotation: {
        x: entrance.cameraRotation.x,
        y: entrance.cameraRotation.y,
        z: entrance.cameraRotation.z,
      },
      hadPointerLock: false,
    };
  };

  const setHistoryRoute = (path: string, mode: 'push' | 'replace'): void => {
    const url = `${path}${window.location.search}${window.location.hash}`;
    const state = path === MILOS_APARTMENT_ROUTE
      ? { ...window.history.state, dissonanceWorldInterior: true }
      : { ...window.history.state, dissonanceWorldInterior: false };
    if (mode === 'push') window.history.pushState(state, '', url);
    else window.history.replaceState(state, '', url);
  };

  const enterInterior = async (source: EnterInteriorSource): Promise<void> => {
    if (!worldSession.isExterior()) return;

    onBeforeEnter?.();
    const loadGeneration = ++interiorLoadGeneration;
    worldSession.setTransition('entering');
    worldSession.exteriorSnapshot.value =
      source === 'deep-link' ? doorwayReturnSnapshot() : snapshotExterior();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    worldSession.setRoute({ kind: 'surveillance', locationId: 'milos-apartment' });
    if (source === 'interaction' || source === 'debug') {
      setHistoryRoute(pathForWorldRoute(worldSession.route.value), 'push');
    }
    interactionPrompt.textContent = 'Loading Milo’s apartment…';
    interactionPrompt.style.display = 'block';

    try {
      const loadedInterior = await loadMilosApartmentInterior(scene);
      if (loadGeneration !== interiorLoadGeneration) {
        loadedInterior.dispose();
        return;
      }
      surveillanceInterior = loadedInterior;
      scene.activeCamera = surveillanceInterior.cameraController.camera;
      render(
        <SurveillanceCameraControls controller={surveillanceInterior.cameraController} />,
        document.getElementById('surveillance-camera-controls-root') as HTMLDivElement,
      );
      worldSession.setTransition('interior');
      interactionPrompt.textContent = 'E — Exit Milo’s apartment';
    } catch (error) {
      if (loadGeneration !== interiorLoadGeneration) return;
      console.error('[MilosApartment] failed to load runtime capture', error);
      worldSession.setRoute({ kind: 'exterior' });
      worldSession.setTransition('exterior');
      setHistoryRoute(pathForWorldRoute(worldSession.route.value), 'replace');
      interactionPrompt.textContent = 'Milo’s apartment failed to load';
      window.setTimeout(() => {
        if (worldSession.isExterior()) interactionPrompt.style.display = 'none';
      }, 2500);
    }
  };

  const exitInterior = (historyMode: 'none' | 'replace'): void => {
    if (worldSession.transition.value === 'entering') {
      interiorLoadGeneration++;
      worldSession.setRoute({ kind: 'exterior' });
      worldSession.setTransition('exterior');
      interactionPrompt.style.display = 'none';
      if (historyMode === 'replace') {
        setHistoryRoute(pathForWorldRoute(worldSession.route.value), 'replace');
      }
      return;
    }
    if (worldSession.transition.value !== 'interior') return;
    interiorLoadGeneration++;
    worldSession.setTransition('exiting');

    render(null, document.getElementById('surveillance-camera-controls-root') as HTMLDivElement);
    surveillanceInterior?.dispose();
    surveillanceInterior = null;

    const snapshot = worldSession.exteriorSnapshot.value ?? doorwayReturnSnapshot();
    switchMode(snapshot.traversalMode);
    const controller = controllers[snapshot.traversalMode];
    controller.setPosition(new Vector3(snapshot.position.x, snapshot.position.y, snapshot.position.z));
    controller.camera.rotation.copyFromFloats(
      snapshot.cameraRotation.x,
      snapshot.cameraRotation.y,
      snapshot.cameraRotation.z,
    );
    controller.clearLookDelta();
    scene.activeCamera = controller.camera;

    worldSession.setRoute({ kind: 'exterior' });
    worldSession.setTransition('exterior');
    interactionPrompt.style.display = 'none';
    if (historyMode === 'replace') {
      setHistoryRoute(pathForWorldRoute(worldSession.route.value), 'replace');
    }
    if (snapshot.hadPointerLock) {
      void canvas.requestPointerLock().catch(() => {
        // History navigation may not carry a user gesture. A subsequent
        // canvas click restores the controller's normal pointer lock.
      });
    }
  };

  const requestExit = (): void => {
    if (window.history.state?.dissonanceWorldInterior === true) window.history.back();
    else exitInterior('replace');
  };

  window.addEventListener('popstate', () => {
    const route = parseWorldRoute(window.location.pathname);
    if (route.kind === 'surveillance') {
      void enterInterior('history');
    } else {
      exitInterior('none');
      worldSession.setRoute(route);
    }
  });

  const isNearEntrance = (): boolean => {
    const entrance = locationFeatures.milosEntrance;
    if (!entrance || !worldSession.isExterior()) return false;
    const position = controllers[movement.activeMode.value].getPosition();
    return Math.hypot(position.x - entrance.position.x, position.z - entrance.position.z)
      <= entrance.interactionRadius;
  };

  // Priority 0 vs. main.tsx's world.contextualInteractE (priority 10): near
  // Milo's entrance, this binding wins and the terminal/vehicle/workshop/
  // strike-recovery cascade is skipped for that keypress. `when` must encode
  // the full original condition — not just `!event.repeat` — since a passing
  // guard consumes the event by default and no later KeyE binding will run.
  dispatcher.register({
    id: 'interior.milosApartment',
    phase: 'keydown',
    code: 'KeyE',
    priority: 0,
    when: (event) => !event.repeat && (worldSession.transition.value === 'interior' || isNearEntrance()),
    handler: () => {
      if (worldSession.transition.value === 'interior') requestExit();
      else void enterInterior('interaction');
    },
  });

  return { worldSession, enterInterior, requestExit, isNearEntrance };
}
