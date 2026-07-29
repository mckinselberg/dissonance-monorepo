import {
  ArcRotateCamera,
  type AbstractEngine,
  Camera,
  type AbstractMesh,
  type Observer,
  type Scene,
  Vector3,
} from '@babylonjs/core';
import { signal } from '@preact/signals';
import {
  calculateOrthographicFraming,
  clampInteriorZoom,
  type InteriorBounds,
} from './interiorFraming';

type Orientation = 0 | 1 | 2 | 3;

interface SurveilledInteriorCameraOptions {
  target: Vector3;
  bounds: InteriorBounds;
  occluders?: Partial<Record<Orientation, AbstractMesh[]>>;
  animationDurationMs?: number;
}

const CAMERA_BETA = Math.PI / 3;
const QUARTER_TURN = Math.PI / 2;

function wrapOrientation(value: number): Orientation {
  return ((value % 4) + 4) % 4 as Orientation;
}

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

export class SurveilledInteriorCamera {
  readonly camera: ArcRotateCamera;
  readonly orientation = signal<Orientation>(0);
  readonly zoom = signal(1);
  readonly isAnimating = signal(false);

  private readonly scene: Scene;
  private readonly bounds: InteriorBounds;
  private readonly occluders: Partial<Record<Orientation, AbstractMesh[]>>;
  private readonly animationDurationMs: number;
  private readonly beforeRenderObserver: Observer<Scene>;
  private readonly resizeObserver: Observer<AbstractEngine>;
  private animation:
    | { elapsedMs: number; fromAlpha: number; toAlpha: number; targetOrientation: Orientation }
    | null = null;

  constructor(scene: Scene, options: SurveilledInteriorCameraOptions) {
    this.scene = scene;
    this.bounds = options.bounds;
    this.occluders = options.occluders ?? {};
    this.animationDurationMs = options.animationDurationMs ?? 400;
    this.camera = new ArcRotateCamera(
      'surveillance_orthographic_camera',
      -Math.PI / 2,
      CAMERA_BETA,
      Math.max(options.bounds.width, options.bounds.depth) * 1.5,
      options.target,
      scene,
    );
    this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 200;
    this.camera.inputs.clear();

    this.beforeRenderObserver = scene.onBeforeRenderObservable.add(() => this.updateAnimation());
    this.resizeObserver = scene.getEngine().onResizeObservable.add(() => this.updateFraming());
    window.addEventListener('keydown', this.handleKeyDown);
    scene.getEngine().getRenderingCanvas()?.addEventListener('wheel', this.handleWheel, { passive: false });

    this.applyOccluders([this.orientation.value]);
    this.updateFraming();
  }

  rotate(direction: -1 | 1): void {
    if (this.isAnimating.value) return;
    const targetOrientation = wrapOrientation(this.orientation.value + direction);
    this.animation = {
      elapsedMs: 0,
      fromAlpha: this.camera.alpha,
      toAlpha: this.camera.alpha + direction * QUARTER_TURN,
      targetOrientation,
    };
    this.isAnimating.value = true;
    this.applyOccluders([this.orientation.value, targetOrientation]);
    this.updateFraming();
  }

  changeZoom(delta: number): void {
    if (this.isAnimating.value) return;
    const next = clampInteriorZoom(this.zoom.value + delta);
    if (next === this.zoom.value) return;
    this.zoom.value = next;
    this.updateFraming();
  }

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    this.scene.getEngine().getRenderingCanvas()?.removeEventListener('wheel', this.handleWheel);
    this.scene.onBeforeRenderObservable.remove(this.beforeRenderObserver);
    this.scene.getEngine().onResizeObservable.remove(this.resizeObserver);
    this.camera.dispose();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if (event.code === 'ArrowLeft' || event.code === 'KeyQ') this.rotate(-1);
    else if (event.code === 'ArrowRight' || event.code === 'KeyR') this.rotate(1);
    else if (event.code === 'Equal' || event.code === 'NumpadAdd') this.changeZoom(0.1);
    else if (event.code === 'Minus' || event.code === 'NumpadSubtract') this.changeZoom(-0.1);
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.changeZoom(event.deltaY < 0 ? 0.1 : -0.1);
  };

  private updateAnimation(): void {
    if (!this.animation) return;
    this.animation.elapsedMs += this.scene.getEngine().getDeltaTime();
    const progress = Math.min(1, this.animation.elapsedMs / this.animationDurationMs);
    const eased = easeInOut(progress);
    this.camera.alpha =
      this.animation.fromAlpha + (this.animation.toAlpha - this.animation.fromAlpha) * eased;
    if (progress < 1) return;

    this.camera.alpha = this.animation.toAlpha;
    this.orientation.value = this.animation.targetOrientation;
    this.animation = null;
    this.isAnimating.value = false;
    this.applyOccluders([this.orientation.value]);
    this.updateFraming();
  }

  private updateFraming(): void {
    const engine = this.scene.getEngine();
    const framingBounds = this.isAnimating.value
      ? {
          width: Math.hypot(this.bounds.width, this.bounds.depth),
          depth: Math.hypot(this.bounds.width, this.bounds.depth),
          height: this.bounds.height,
        }
      : this.bounds;
    const framing = calculateOrthographicFraming(
      framingBounds,
      this.orientation.value,
      engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()),
      this.zoom.value,
    );
    this.camera.orthoLeft = framing.left;
    this.camera.orthoRight = framing.right;
    this.camera.orthoTop = framing.top;
    this.camera.orthoBottom = framing.bottom;
  }

  private applyOccluders(hiddenOrientations: Orientation[]): void {
    const hidden = new Set(hiddenOrientations.flatMap((orientation) => this.occluders[orientation] ?? []));
    for (const meshes of Object.values(this.occluders)) {
      for (const mesh of meshes ?? []) mesh.setEnabled(!hidden.has(mesh));
    }
  }
}
