import { Scene, DirectionalLight, Mesh, MeshBuilder, StandardMaterial, Color3, Vector3 } from '@babylonjs/core';

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
};

const DEFAULT_AZIMUTH = Math.PI * 0.6;

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
// no visible sun mesh of its own to reuse. No shadow generator here either
// — that's a real per-caster cost this scene doesn't need yet with nothing
// substantial casting shadows.
export class Sun {
  readonly light: DirectionalLight;
  private readonly disc: Mesh;
  private readonly discMat: StandardMaterial;
  private readonly azimuth: number;
  private readonly discDistance: number;

  constructor(scene: Scene, options: SunOptions = {}) {
    this.azimuth = options.azimuth ?? DEFAULT_AZIMUTH;
    this.discDistance = options.discDistance ?? 2000;
    const discDiameter = options.discDiameter ?? 150;

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

    this.setTimeOfDay(options.hour ?? 12);
  }

  // Recomputes direction (the sun arcs from horizon to horizon at a fixed
  // azimuth), color/intensity, and the visual disc's position — all from a
  // single 0-24 hour value.
  setTimeOfDay(hour: number): void {
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
    this.light.diffuse = new Color3(1.0, 0.55 + dayFactor * 0.4, 0.3 + dayFactor * 0.6);
    this.light.specular = this.light.diffuse;
    this.discMat.emissiveColor = this.light.diffuse;
  }

  // Lets a caller register the disc with WaterPlane.addToRenderList so the
  // sun shows up in the water's reflection too.
  getMesh(): Mesh {
    return this.disc;
  }

  dispose(): void {
    this.disc.dispose();
    this.light.dispose();
  }
}
