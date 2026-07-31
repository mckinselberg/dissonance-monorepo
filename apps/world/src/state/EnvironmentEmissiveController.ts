import {
  Color3,
  Material,
  MultiMaterial,
  type Observer,
  type Scene,
} from '@babylonjs/core';
import type {
  EmissivePresentation,
  EnvironmentRenderingProfile,
} from './environmentRenderingProfile';

type EmissiveProfile = Readonly<Record<string, EmissivePresentation>>;
type EmissiveSource = EnvironmentRenderingProfile | EmissiveProfile | null | undefined;
type EmissiveGroup = 'windows' | 'streetLamps';
type EmissiveMaterial = Material & { emissiveColor: Color3 };

type TrackedMaterial = {
  readonly material: EmissiveMaterial;
  readonly group: EmissiveGroup;
  readonly baseline: Color3;
};

type ActivePresentation = {
  readonly profile: EmissivePresentation;
  readonly baseColor: Color3;
};

const WINDOW_MATERIAL_PREFIX = 'MI_FakeInterior';
const STREET_LAMP_MATERIAL_NAME = 'locProp_lampGlobeMat';
const UINT32_RANGE = 0x1_0000_0000;

function isEnvironmentProfile(source: Exclude<EmissiveSource, null | undefined>): source is EnvironmentRenderingProfile {
  return 'atmosphere' in source && 'foliage' in source && 'visibility' in source;
}

function profileFrom(source: EmissiveSource): EmissiveProfile | undefined {
  if (!source) return undefined;
  return isEnvironmentProfile(source) ? source.emissive : source;
}

function isEmissiveMaterial(material: Material): material is EmissiveMaterial {
  return 'emissiveColor' in material && material.emissiveColor instanceof Color3;
}

function isNamedMaterialInstance(name: string, baseName: string): boolean {
  return name === baseName
    || name.startsWith(`${baseName}.`)
    || name.startsWith(`${baseName}#`)
    || name.startsWith(`${baseName} (`);
}

function groupFor(material: Material): EmissiveGroup | null {
  if (material.name.startsWith(WINDOW_MATERIAL_PREFIX)) return 'windows';
  if (isNamedMaterialInstance(material.name, STREET_LAMP_MATERIAL_NAME)) return 'streetLamps';
  return null;
}

function seededUnit(seed: number, index: number): number {
  let value = (Math.trunc(Number.isFinite(seed) ? seed : 0) ^ Math.imul(index, 0x9e37_79b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0_aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a_2d97);
  value ^= value >>> 15;
  return (value >>> 0) / UINT32_RANGE;
}

function flickerMultiplier(
  flicker: EmissivePresentation['flicker'],
  elapsedSeconds: number,
): number {
  if (flicker.amp === 0 || flicker.hz === 0) return 1;

  const samplePosition = elapsedSeconds * Math.abs(flicker.hz);
  const sampleIndex = Math.floor(samplePosition);
  const fraction = samplePosition - sampleIndex;
  const smoothed = fraction * fraction * (3 - 2 * fraction);
  const from = seededUnit(flicker.seed, sampleIndex);
  const to = seededUnit(flicker.seed, sampleIndex + 1);
  const noise = (from + (to - from) * smoothed) * 2 - 1;
  return Math.max(0, 1 + flicker.amp * noise);
}

/**
 * Applies app-owned environment emissive profiles to World materials.
 *
 * Babylon exposes the merged street-lamp globe as a PBR submaterial, while
 * imported fake interiors arrive as ordinary scene materials. Scanning both
 * material collections keeps the adapter independent of either loader shape.
 */
export class EnvironmentEmissiveController {
  private readonly scene: Scene;
  private readonly tracked = new Map<Material, TrackedMaterial>();
  private readonly pendingMaterials = new Set<Material>();
  private readonly pendingMultiMaterials = new Set<MultiMaterial>();
  private readonly active = new Map<EmissiveGroup, ActivePresentation>();
  private elapsedSeconds = 0;
  private disposed = false;
  private materialAddedObserver: Observer<Material> | null;
  private multiMaterialAddedObserver: Observer<MultiMaterial> | null;
  private materialRemovedObserver: Observer<Material> | null;
  private multiMaterialRemovedObserver: Observer<MultiMaterial> | null;
  private renderObserver: Observer<Scene> | null;
  private sceneDisposeObserver: Observer<Scene> | null;

  constructor(scene: Scene) {
    this.scene = scene;
    this.materialAddedObserver = scene.onNewMaterialAddedObservable.add((material) => {
      // Babylon announces a material from its constructor, before the owning
      // builder has assigned its authored emissive baseline. Defer capture to
      // the next render, after synchronous construction is complete.
      this.pendingMaterials.add(material);
    });
    this.multiMaterialAddedObserver = scene.onNewMultiMaterialAddedObservable.add((material) => {
      this.pendingMultiMaterials.add(material);
    });
    this.materialRemovedObserver = scene.onMaterialRemovedObservable.add((material) => {
      this.pendingMaterials.delete(material);
      this.restoreAndForget(material);
    });
    this.multiMaterialRemovedObserver = scene.onMultiMaterialRemovedObservable.add((material) => {
      this.pendingMultiMaterials.delete(material);
    });
    this.renderObserver = scene.onBeforeRenderObservable.add(() => this.update());
    this.sceneDisposeObserver = scene.onDisposeObservable.add(() => this.dispose());

    for (const material of scene.materials) this.track(material);
    for (const material of scene.multiMaterials) this.trackMultiMaterial(material);
  }

  setProfile(source: EmissiveSource): void {
    if (this.disposed) return;
    const profile = profileFrom(source);
    this.active.clear();
    this.activate('windows', profile?.windows);
    this.activate('streetLamps', profile?.streetLamps);

    for (const tracked of this.tracked.values()) this.apply(tracked);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    if (this.materialAddedObserver) {
      this.scene.onNewMaterialAddedObservable.remove(this.materialAddedObserver);
      this.materialAddedObserver = null;
    }
    if (this.multiMaterialAddedObserver) {
      this.scene.onNewMultiMaterialAddedObservable.remove(this.multiMaterialAddedObserver);
      this.multiMaterialAddedObserver = null;
    }
    if (this.materialRemovedObserver) {
      this.scene.onMaterialRemovedObservable.remove(this.materialRemovedObserver);
      this.materialRemovedObserver = null;
    }
    if (this.multiMaterialRemovedObserver) {
      this.scene.onMultiMaterialRemovedObservable.remove(this.multiMaterialRemovedObserver);
      this.multiMaterialRemovedObserver = null;
    }
    if (this.renderObserver) {
      this.scene.onBeforeRenderObservable.remove(this.renderObserver);
      this.renderObserver = null;
    }
    if (this.sceneDisposeObserver) {
      this.scene.onDisposeObservable.remove(this.sceneDisposeObserver);
      this.sceneDisposeObserver = null;
    }

    for (const tracked of this.tracked.values()) {
      tracked.material.emissiveColor.copyFrom(tracked.baseline);
    }
    this.tracked.clear();
    this.pendingMaterials.clear();
    this.pendingMultiMaterials.clear();
    this.active.clear();
  }

  private activate(group: EmissiveGroup, profile: EmissivePresentation | undefined): void {
    if (!profile) return;
    // occupancyMask is intentionally carried by the profile unchanged but is
    // a future UV-mask consumer. bloomThreshold is likewise global on
    // DefaultRenderingPipeline, so this per-group adapter must not race it.
    this.active.set(group, {
      profile,
      baseColor: Color3.FromHexString(profile.color).scale(profile.intensity),
    });
  }

  private update(): void {
    if (this.disposed) return;
    this.flushPending();
    const deltaSeconds = this.scene.getEngine().getDeltaTime() / 1_000;
    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) this.elapsedSeconds += deltaSeconds;

    for (const tracked of this.tracked.values()) {
      const presentation = this.active.get(tracked.group);
      if (presentation && presentation.profile.flicker.amp !== 0 && presentation.profile.flicker.hz !== 0) {
        this.apply(tracked);
      }
    }
  }

  private flushPending(): void {
    for (const material of this.pendingMaterials) this.track(material);
    this.pendingMaterials.clear();
    for (const material of this.pendingMultiMaterials) this.trackMultiMaterial(material);
    this.pendingMultiMaterials.clear();
  }

  private trackMultiMaterial(material: MultiMaterial): void {
    for (const subMaterial of material.subMaterials) {
      if (subMaterial) this.track(subMaterial);
    }
  }

  private track(material: Material): void {
    if (this.tracked.has(material)) return;
    if (material instanceof MultiMaterial) {
      this.trackMultiMaterial(material);
      return;
    }
    const group = groupFor(material);
    if (!group || !isEmissiveMaterial(material)) return;

    const tracked: TrackedMaterial = {
      material,
      group,
      baseline: material.emissiveColor.clone(),
    };
    this.tracked.set(material, tracked);
    this.apply(tracked);
  }

  private apply(tracked: TrackedMaterial): void {
    const presentation = this.active.get(tracked.group);
    if (!presentation) {
      tracked.material.emissiveColor.copyFrom(tracked.baseline);
      return;
    }

    const multiplier = flickerMultiplier(presentation.profile.flicker, this.elapsedSeconds);
    tracked.material.emissiveColor.copyFrom(presentation.baseColor).scaleInPlace(multiplier);
  }

  private restoreAndForget(material: Material): void {
    const tracked = this.tracked.get(material);
    if (!tracked) return;
    tracked.material.emissiveColor.copyFrom(tracked.baseline);
    this.tracked.delete(material);
  }
}
