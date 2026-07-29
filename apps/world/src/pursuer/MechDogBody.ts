import {
  AnimationGroup,
  AssetContainer,
  Color3,
  LoadAssetContainerAsync,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  TransformNode,
} from '@babylonjs/core';
import { ensureGltfLoader } from '../world/gltfLoader';

export type MechDogSkin = 'default' | 'black';

const MODEL_URL_SUFFIX_BY_SKIN: Record<MechDogSkin, string> = {
  default: 'models/mech-dog/Husky.gltf',
  black: 'models/mech-dog/HuskyBlack.gltf',
};

// The source model is authored at roughly 3.2 units tall. This brings it
// down to a dog-sized silhouette in World's meter-based coordinate space.
const MODEL_SCALE = 0.19;
const WALK_SPEED = 0.6;
const GALLOP_SPEED = 4.5;

/**
 * World-owned visual presentation for the animated dog pursuer.
 *
 * Pursuit behavior stays in @dissonance/pursuit; this class owns only the
 * glTF hierarchy, mechanical material treatment, animation selection, and
 * render-space transform.
 */
export class MechDogBody {
  private root: TransformNode | null = null;
  private container: AssetContainer | null = null;
  private animations = new Map<string, AnimationGroup>();
  private currentAnimation: AnimationGroup | null = null;
  private pendingVisible = true;
  private disposed = false;
  private lastX: number | null = null;
  private lastZ: number | null = null;
  // Bumped on every load() call so a stale in-flight load (from a skin swap
  // that got superseded by another before the first fetch resolved) can
  // recognize it's no longer current and discard its result instead of
  // clobbering the newer one.
  private loadToken = 0;
  // update() runs every frame and picks Idle/Walk/Gallop from the dog's
  // current speed — without this it would stomp a one-shot reaction clip
  // (started via playReaction) within a single frame of it starting.
  private isReacting = false;

  constructor(
    private readonly scene: Scene,
    private readonly shadowGenerator?: ShadowGenerator,
    private skin: MechDogSkin = 'default',
  ) {
    void this.load();
  }

  /** Swaps to a different reskin of the same rig/animations, e.g. for a friendlier pet-dog look vs. the menacing mech-dog default. */
  setSkin(skin: MechDogSkin): void {
    if (this.disposed || this.skin === skin) return;
    this.skin = skin;
    void this.load();
  }

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    try {
      await ensureGltfLoader();
      const url = `${import.meta.env.BASE_URL}${MODEL_URL_SUFFIX_BY_SKIN[this.skin]}`;
      const container = await LoadAssetContainerAsync(url, this.scene);

      if (this.disposed || token !== this.loadToken) {
        container.dispose();
        return;
      }

      // Old visual (if any — this load may be a skin swap, not the first
      // load) stays on screen until the replacement is ready, then gets
      // torn down here so the swap doesn't leave a gap with no dog visible.
      this.currentAnimation?.stop();
      this.currentAnimation = null;
      this.isReacting = false;
      this.container?.dispose();
      this.root?.dispose();
      this.animations.clear();

      this.container = container;
      container.addAllToScene();

      // Keep the imported glTF coordinate-conversion root intact. A separate
      // parent owns World movement/rotation so an imported root quaternion
      // cannot silently override our heading.
      const root = new TransformNode('mechDogPursuer', this.scene);
      for (const importedRoot of container.rootNodes) {
        importedRoot.parent = root;
      }
      root.scaling.setAll(MODEL_SCALE);
      root.setEnabled(this.pendingVisible);
      this.root = root;

      // The supplied Husky uses simple solid PBR colors and no textures.
      // A cool metallic response makes it read as the intended mechanical
      // quadruped while preserving the authored rig and color separation.
      for (const material of container.materials) {
        if (!(material instanceof PBRMaterial)) continue;
        material.metallic = 0.78;
        material.roughness = 0.3;
        if (material.name === 'Material.003') {
          material.emissiveColor = new Color3(0.08, 0.72, 1);
        }
      }

      for (const mesh of container.meshes) {
        mesh.receiveShadows = true;
        this.shadowGenerator?.addShadowCaster(mesh, true);
      }

      for (const group of container.animationGroups) {
        this.animations.set(group.name, group);
      }
      this.playAnimation('Idle');
      console.info(
        `[MechDog] loaded ${container.meshes.length} meshes; ` +
        `animations: ${[...this.animations.keys()].join(', ')}`,
      );
    } catch (error) {
      console.error('[MechDog] failed to load animated pursuer body', error);
    }
  }

  private playAnimation(name: string): void {
    const next = this.animations.get(name);
    if (!next || next === this.currentAnimation) return;
    this.currentAnimation?.stop();
    next.start(true, 1);
    this.currentAnimation = next;
  }

  /**
   * Interrupts the current loop for one non-looping pass of `clipName`
   * (e.g. a called-to-attention or petted reaction), then falls back to
   * whatever the next update() call's speed says it should be playing.
   * No-ops if the rig has no clip by that name — reaction hooks are
   * best-effort, not load-bearing.
   */
  private playReaction(clipName: string): void {
    const reaction = this.animations.get(clipName);
    if (!reaction || reaction === this.currentAnimation) return;
    this.currentAnimation?.stop();
    reaction.start(false, 1);
    this.currentAnimation = reaction;
    this.isReacting = true;
    reaction.onAnimationGroupEndObservable.addOnce(() => {
      if (this.disposed || this.currentAnimation !== reaction) return;
      this.currentAnimation = null;
      this.isReacting = false;
    });
  }

  /** Called when the player whistles — see WHISTLE_MELODIES/main.tsx. */
  reactToWhistle(): void {
    this.playReaction('Idle_2_HeadLow');
  }

  /** Called when the player pets the dog while it's close by. */
  reactToPet(): void {
    this.playReaction('Idle_2');
  }

  setVisible(visible: boolean): void {
    this.pendingVisible = visible;
    this.root?.setEnabled(visible);
  }

  update(dt: number, position: { x: number; z: number }, groundY: number): void {
    if (!this.root) return;

    const dx = this.lastX === null ? 0 : position.x - this.lastX;
    const dz = this.lastZ === null ? 0 : position.z - this.lastZ;
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    this.lastX = position.x;
    this.lastZ = position.z;

    this.root.position.set(position.x, groundY, position.z);
    if (dx * dx + dz * dz > 0.0001) {
      this.root.rotation.y = Math.atan2(dx, dz);
    }

    if (this.isReacting) return;
    if (speed < WALK_SPEED) this.playAnimation('Idle');
    else if (speed < GALLOP_SPEED) this.playAnimation('Walk');
    else this.playAnimation('Gallop');
  }

  dispose(): void {
    this.disposed = true;
    this.currentAnimation?.stop();
    this.container?.dispose();
    this.root?.dispose();
    this.animations.clear();
  }
}
