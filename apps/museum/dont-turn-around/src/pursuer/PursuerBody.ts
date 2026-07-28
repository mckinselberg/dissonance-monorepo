import {
  Scene,
  TransformNode,
  AnimationGroup,
  AssetContainer,
  LoadAssetContainerAsync,
} from '@babylonjs/core';
import { ensureGltfLoader } from './gltfLoader';

const MODEL_URL_SUFFIX = 'models/husky/Husky.gltf';

// Husky.gltf's authored bind-pose bounding box is ~3.19 units tall / ~3.89
// long — much bigger than a real husky (~0.6m shoulder height). This scale
// is a first guess to bring it into game-world meters; tune visually once
// it's on screen next to the player capsule.
const MODEL_SCALE = 0.19;

// Movement speed (units/sec) thresholds for picking a locomotion animation.
const WALK_SPEED = 0.6;
const GALLOP_SPEED = 4.5;

export class PursuerBody {
  private root: TransformNode | null = null;
  private container: AssetContainer | null = null;
  private animations = new Map<string, AnimationGroup>();
  private currentAnim: AnimationGroup | null = null;
  private pendingVisible = true;
  private disposed = false;

  private lastX: number | null = null;
  private lastZ: number | null = null;

  constructor(private readonly scene: Scene) {
    void this.load();
  }

  private async load(): Promise<void> {
    await ensureGltfLoader();
    const url = `${import.meta.env.BASE_URL}${MODEL_URL_SUFFIX}`;
    const container = await LoadAssetContainerAsync(url, this.scene);

    // Game may have ended (dispose() called) before the load resolved.
    if (this.disposed) {
      container.dispose();
      return;
    }

    this.container = container;
    container.addAllToScene();

    // glTF imports wrap the whole hierarchy under one root TransformNode —
    // transform that as a unit rather than any individual mesh/bone.
    const root = container.rootNodes[0] as TransformNode;
    root.name = 'pursuerBody';
    root.scaling.scaleInPlace(MODEL_SCALE);
    root.setEnabled(this.pendingVisible);
    this.root = root;

    for (const group of container.animationGroups) {
      this.animations.set(group.name, group);
    }
    this.playAnimation('Idle');
  }

  private playAnimation(name: string): void {
    const next = this.animations.get(name);
    if (!next || next === this.currentAnim) return;
    this.currentAnim?.stop();
    next.start(true, 1.0);
    this.currentAnim = next;
  }

  setStress(_stress: number): void {
    // Locomotion animation is speed-driven (see update()) — the dog has no
    // separate stress-glow effect like the retired devil body (DevilBody.ts).
  }

  setVisible(visible: boolean): void {
    this.pendingVisible = visible;
    this.root?.setEnabled(visible);
  }

  update(
    dt: number,
    pos: { x: number; z: number },
    groundY: number,
  ): void {
    if (!this.root) return;

    const dxMove = this.lastX === null ? 0 : pos.x - this.lastX;
    const dzMove = this.lastZ === null ? 0 : pos.z - this.lastZ;
    const speed = dt > 0 ? Math.sqrt(dxMove * dxMove + dzMove * dzMove) / dt : 0;
    this.lastX = pos.x;
    this.lastZ = pos.z;

    this.root.position.set(pos.x, groundY, pos.z);
    if (dxMove * dxMove + dzMove * dzMove > 0.0001) {
      this.root.rotation.y = Math.atan2(dxMove, dzMove);
    }

    if (speed < WALK_SPEED) this.playAnimation('Idle');
    else if (speed < GALLOP_SPEED) this.playAnimation('Walk');
    else this.playAnimation('Gallop');
  }

  dispose(): void {
    this.disposed = true;
    this.container?.dispose();
  }
}
