import { Color3, SpotLight, Vector3, type Camera, type Scene } from '@babylonjs/core';

export type FlashlightTuning = {
  intensity: number;
  range: number;
  angle: number;
  exponent: number;
  color: { r: number; g: number; b: number };
};

export const DEFAULT_FLASHLIGHT_TUNING: FlashlightTuning = {
  intensity: 2.8,
  range: 22,
  angle: Math.PI / 3,
  exponent: 2,
  color: { r: 1, g: 0.82, b: 0.55 },
};

export class CameraFlashlight {
  private readonly light: SpotLight;
  private enabled = false;
  private tuning: FlashlightTuning = {
    ...DEFAULT_FLASHLIGHT_TUNING,
    color: { ...DEFAULT_FLASHLIGHT_TUNING.color },
  };

  constructor(
    scene: Scene,
    private readonly camera: Camera,
    name = 'flashlight',
  ) {
    this.light = new SpotLight(
      name,
      camera.position.clone(),
      Vector3.Forward(),
      this.tuning.angle,
      this.tuning.exponent,
      scene,
    );
    this.light.specular = Color3.Black();
    this.applyTuning();
    this.light.intensity = 0;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.light.intensity = enabled ? this.tuning.intensity : 0;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setTuning(tuning: FlashlightTuning): void {
    this.tuning = { ...tuning, color: { ...tuning.color } };
    this.applyTuning();
  }

  update(): void {
    this.light.position.copyFrom(this.camera.position);
    this.light.direction = this.camera.getDirection(Vector3.Forward());
  }

  isPointIlluminated(point: Vector3): boolean {
    if (!this.enabled) return false;
    const toPoint = point.subtract(this.camera.position);
    const distance = toPoint.length();
    if (distance < 0.001 || distance > this.tuning.range) return false;
    const direction = this.camera.getDirection(Vector3.Forward());
    return Vector3.Dot(direction, toPoint.normalize()) > Math.cos(this.tuning.angle);
  }

  getPressure(point: Vector3): number {
    if (!this.enabled) return 0;
    const toPoint = point.subtract(this.camera.position);
    const distance = toPoint.length();
    if (distance < 0.001 || distance > this.tuning.range) return 0;

    const direction = this.camera.getDirection(Vector3.Forward());
    const cosine = Vector3.Dot(direction, toPoint.normalize());
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine)));
    const inner = this.tuning.angle;
    const outer = inner * 1.65;
    if (angle >= outer) return 0;
    const conePressure = angle <= inner ? 1 : 1 - (angle - inner) / (outer - inner);
    const rangePressure = 1 - Math.min(0.45, distance / this.tuning.range * 0.45);
    return Math.max(0, Math.min(1, conePressure * rangePressure));
  }

  dispose(): void {
    this.light.dispose();
  }

  private applyTuning(): void {
    this.light.range = this.tuning.range;
    this.light.angle = this.tuning.angle;
    this.light.exponent = this.tuning.exponent;
    this.light.diffuse = new Color3(this.tuning.color.r, this.tuning.color.g, this.tuning.color.b);
    if (this.enabled) this.light.intensity = this.tuning.intensity;
  }
}
