import {
  Scene, DirectionalLight, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3,
  ShadowGenerator, LensFlareSystem, LensFlare,
} from '@babylonjs/core';

export type SunOptions = {
  // 0-24, default 12 (noon). See setTimeOfDay for the model.
  hour?: number;
  // Fixed compass direction (radians) the sun arcs across as hour changes —
  // real sunrise/sunset direction isn't modeled, just a believable arc.
  azimuth?: number;
  // Visual disc — camera-relative (Mesh.infiniteDistance), so it stays a
  // fixed apparent size/bearing in the sky no matter how far the player
  // roams or how a level's horizontalScale stretches the terrain — the
  // same reasoning a real sun doesn't get bigger just because the world
  // around it does.
  discDistance?: number;
  discDiameter?: number;
  // Opt-in — a real per-caster cost, off by default so existing consumers
  // (and any future one that doesn't need it) don't pay for it. Callers
  // register their own casters via getShadowGenerator().addShadowCaster(...).
  castShadows?: boolean;
  // Opt-in camera-lens artifact, attached to the visual disc (see getMesh's
  // own comment on why the disc and not the DirectionalLight itself).
  lensFlare?: boolean;
  // Multiplies on top of the computed day/night curve (warm at the horizon,
  // white at zenith) rather than replacing it — a plain override would fight
  // that physically-modeled curve instead of just tinting it.
  colorTint?: Color3;
};

const DEFAULT_AZIMUTH = Math.PI * 0.6;
// Babylon's own official lens-flare sample textures (see
// https://doc.babylonjs.com/features/featuresDeepDive/environment/lenseFlare)
// — same "no local texture pipeline, pull from the official asset CDN"
// convention as WaterPlane's bump map.
const FLARE_TEXTURE_BASE = 'https://assets.babylonjs.com/textures/';

// -1 (midnight) .. 0 (sunrise/sunset, at the horizon) .. 1 (noon, zenith).
// Exported so callers (main.ts's ambient light / sky color / star fade) can
// derive consistent day/night state from the same hour value without
// duplicating this formula.
export function sunHeightForHour(hour: number): number {
  return Math.sin(((hour - 6) / 12) * Math.PI);
}

// A directional light plus a simple glowing disc standing in for the sun,
// driven by a single 0-24 hour value. Deliberately not DaylightSystem
// (packages/world's existing day/night system) — that one is wired to
// RunProfile/ExperienceProfile's decay-over-time and ps1/ps2/ps3 color
// tables, neither of which trail-viewer has any use for, and it still has
// no visible sun mesh of its own to reuse.
export class Sun {
  readonly light: DirectionalLight;
  private readonly disc: Mesh;
  private readonly discMat: StandardMaterial;
  private readonly azimuth: number;
  private readonly discDistance: number;
  private readonly shadowGenerator: ShadowGenerator | undefined;
  private lensFlareSystem: LensFlareSystem | undefined;
  private colorTint: Color3;
  private lastHour = 12;

  constructor(scene: Scene, options: SunOptions = {}) {
    this.azimuth = options.azimuth ?? DEFAULT_AZIMUTH;
    this.discDistance = options.discDistance ?? 2000;
    const discDiameter = options.discDiameter ?? 150;
    this.colorTint = options.colorTint ?? new Color3(1, 1, 1);

    this.light = new DirectionalLight('sun', Vector3.Down(), scene);

    this.disc = MeshBuilder.CreateDisc('sunDisc', { radius: discDiameter / 2, tessellation: 24 }, scene);
    this.disc.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.disc.infiniteDistance = true;
    this.disc.applyFog = false;

    this.discMat = new StandardMaterial('sunDiscMat', scene);
    this.discMat.disableLighting = true;
    this.discMat.backFaceCulling = false;
    // Renders as if at infinity, like a skybox — without this, standing
    // closer to a peak than discDistance would clip the sun behind it.
    this.discMat.disableDepthWrite = true;
    this.disc.material = this.discMat;

    if (options.castShadows) {
      // Same setup as DaylightSystem's existing shadow generator (packages/
      // world's DTA day/night system) — 1024 map, PCF filtering, small bias.
      // Unlike DaylightSystem's static forest, trail-viewer's time-of-day
      // slider moves this light live, so the shadow map is deliberately left
      // at its default (continuous) refresh rate rather than RENDER_ONCE —
      // a perf tradeoff worth revisiting if the scene gets much heavier.
      this.shadowGenerator = new ShadowGenerator(1024, this.light);
      this.shadowGenerator.usePercentageCloserFiltering = true;
      this.shadowGenerator.bias = 0.002;
    }

    if (options.lensFlare) {
      // Attached to the visual disc, not `this.light` — a DirectionalLight
      // has no meaningful world position for the flare system to project
      // from, but the disc is a real positioned/billboarded mesh standing in
      // for the sun visually. Textures are Babylon's own official lens-flare
      // samples (see FLARE_TEXTURE_BASE) — no local texture pipeline exists
      // in this repo yet, same reasoning as WaterPlane's bump map.
      this.lensFlareSystem = new LensFlareSystem('sunLensFlare', this.disc, scene);
      new LensFlare(0.1, 0, new Color3(1, 1, 1), `${FLARE_TEXTURE_BASE}flare.png`, this.lensFlareSystem);
      new LensFlare(0.075, 0.5, new Color3(0.8, 0.56, 0.72), `${FLARE_TEXTURE_BASE}flare3.png`, this.lensFlareSystem);
      new LensFlare(0.1, -0.15, new Color3(0.71, 0.8, 0.95), `${FLARE_TEXTURE_BASE}Flare2.png`, this.lensFlareSystem);
    }

    this.setTimeOfDay(options.hour ?? 12);
  }

  // Recomputes direction (the sun arcs from horizon to horizon at a fixed
  // azimuth), color/intensity, and the visual disc's position — all from a
  // single 0-24 hour value.
  setTimeOfDay(hour: number): void {
    this.lastHour = hour;
    const sunHeight = sunHeightForHour(hour);
    const elevationAngle = sunHeight * (Math.PI / 2);
    const horizontal = Math.cos(elevationAngle);
    const direction = new Vector3(
      horizontal * Math.cos(this.azimuth),
      -Math.sin(elevationAngle),
      horizontal * Math.sin(this.azimuth),
    ).normalize();
    this.light.direction = direction;
    // Sits opposite the light's travel direction — i.e. where the light
    // visually comes from.
    this.disc.position = direction.scale(-this.discDistance);

    // 0 at/below the horizon (night), ramping to 1 at noon — colors warm
    // (orange) near the horizon and whiten toward zenith.
    const dayFactor = Math.max(0, sunHeight);
    this.light.intensity = 0.15 + dayFactor * 2.3;
    const curveColor = new Color3(1.0, 0.55 + dayFactor * 0.4, 0.3 + dayFactor * 0.6);
    const tinted = curveColor.multiply(this.colorTint);
    this.light.diffuse = tinted;
    this.light.specular = tinted;
    this.discMat.emissiveColor = tinted;
  }

  // Re-tints the day/night curve without moving the sun — cheap, no need to
  // recompute direction/intensity, just the color multiply above.
  setColorTint(tint: Color3): void {
    this.colorTint = tint;
    this.setTimeOfDay(this.lastHour);
  }

  // Lets a caller register the disc with WaterPlane.addToRenderList so the
  // sun shows up in the water's reflection too.
  getMesh(): Mesh {
    return this.disc;
  }

  // Undefined unless constructed with castShadows: true — callers register
  // their own casters (e.g. ThinInstanceTrees) via addShadowCaster.
  getShadowGenerator(): ShadowGenerator | undefined {
    return this.shadowGenerator;
  }

  dispose(): void {
    this.disc.dispose();
    this.light.dispose();
    this.shadowGenerator?.dispose();
    this.lensFlareSystem?.dispose();
  }
}
