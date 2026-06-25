import { Vector3 } from '@babylonjs/core';
import { DestinationAudio } from '@dissonance/audio';

export class DestinationSystem {
  readonly position: Vector3;
  private audio: DestinationAudio;
  private readonly maxAudibleDistance = 180;
  private reached = false;

  constructor(position: Vector3) {
    this.position = position;
    this.audio = new DestinationAudio();
  }

  start(): void {
    this.audio.start();
  }

  update(playerPos: Vector3): void {
    const dx = this.position.x - playerPos.x;
    const dz = this.position.z - playerPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const normalized = Math.min(1, dist / this.maxAudibleDistance);
    this.audio.setDistance(normalized);

    if (dist < 5.0) {
      this.reached = true;
    }
  }

  isReached(): boolean {
    return this.reached;
  }

  getDistance(playerPos: Vector3): number {
    const dx = this.position.x - playerPos.x;
    const dz = this.position.z - playerPos.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  stop(): void {
    this.audio.stop();
  }

  dispose(): void {
    this.audio.dispose();
  }

  setGainMultiplier(v: number): void {
    this.audio.setGainMultiplier(v);
  }

  reset(): void {
    this.reached = false;
  }
}
