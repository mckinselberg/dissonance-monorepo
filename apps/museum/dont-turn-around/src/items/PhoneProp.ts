import { Scene, MeshBuilder, StandardMaterial, Color3, Mesh } from '@babylonjs/core';
import type { Terrain } from '@dissonance/world';

const PICKUP_RADIUS = 2.5;

export class PhoneProp {
  private body: Mesh;
  private screen: Mesh;
  private screenMat: StandardMaterial;
  private picked = false;
  private flickerTimer = 0;
  private screenBright = true;
  private bobTime = 0;
  private readonly groundY: number;
  readonly x: number;
  readonly z: number;

  // x and z are the final world position of the phone — caller is responsible
  // for placing it outside the pickup radius from the player spawn.
  constructor(scene: Scene, x: number, z: number, terrain: Terrain) {
    this.x = x;
    this.z = z;
    this.groundY = terrain.getHeightAt(this.x, this.z);

    const bodyMat = new StandardMaterial('phonePropBodyMat', scene);
    bodyMat.diffuseColor = new Color3(0.08, 0.08, 0.08);
    bodyMat.specularColor = new Color3(0.3, 0.3, 0.3);

    // Phone body — scaled up ~3x real size so it reads clearly from 5+ units away
    this.body = MeshBuilder.CreateBox('phonePropBody', { width: 0.24, height: 0.045, depth: 0.45 }, scene);
    this.body.position.set(this.x, this.groundY + 0.022, this.z);
    this.body.material = bodyMat;
    this.body.isPickable = false;

    this.screenMat = new StandardMaterial('phonePropScreenMat', scene);
    this.screenMat.emissiveColor = new Color3(0.9, 0.9, 1.0);
    this.screenMat.disableLighting = true;

    this.screen = MeshBuilder.CreateBox('phonePropScreen', { width: 0.20, height: 0.003, depth: 0.37 }, scene);
    this.screen.position.set(this.x, this.groundY + 0.047, this.z);
    this.screen.material = this.screenMat;
    this.screen.isPickable = false;
  }

  // Returns true on the frame the player picks up the phone.
  update(dt: number, playerX: number, playerZ: number): boolean {
    if (this.picked) return false;

    this.bobTime += dt;
    const bobY = Math.sin(this.bobTime * 1.8) * 0.008;
    this.body.position.y = this.groundY + 0.022 + bobY;
    this.screen.position.y = this.groundY + 0.047 + bobY;

    this.flickerTimer -= dt;
    if (this.flickerTimer <= 0) {
      if (this.screenBright) {
        if (Math.random() < 0.18) {
          this.screenBright = false;
          this.screenMat.emissiveColor = new Color3(0.0, 0.02, 0.08);
          this.flickerTimer = 0.05 + Math.random() * 0.12;
        } else {
          this.flickerTimer = 0.15 + Math.random() * 0.5;
        }
      } else {
        this.screenBright = true;
        this.screenMat.emissiveColor = new Color3(0.9, 0.9, 1.0);
        this.flickerTimer = 0.25 + Math.random() * 0.6;
      }
    }

    const dx = playerX - this.x;
    const dz = playerZ - this.z;
    if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
      this.picked = true;
      this.body.isVisible = false;
      this.screen.isVisible = false;
      return true;
    }
    return false;
  }

  dispose(): void {
    this.body.material?.dispose();
    this.body.dispose();
    this.screenMat.dispose();
    this.screen.dispose();
  }
}
