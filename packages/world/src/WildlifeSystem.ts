import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { ExperienceProfile } from '@dissonance/shared-types';
import type { Terrain } from './Terrain';

type Bird = {
  root: TransformNode;
  leftWing: Mesh;
  rightWing: Mesh;
  speed: number;
  heading: number;
  phase: number;
};

type GroundAnimal = {
  root: TransformNode;
  kind: 'deer' | 'fox' | 'turkey';
  heading: number;
  speed: number;
  fleeTimer: number;
};

const WILDLIFE_RADIUS = 155;

export class WildlifeSystem {
  private birds: Bird[] = [];
  private animals: GroundAnimal[] = [];
  private meshes: Mesh[] = [];

  constructor(
    scene: Scene,
    profile: ExperienceProfile,
    private readonly terrain: Terrain,
    playerStart: Vector3,
  ) {
    if (profile.mode !== 'ps3') return;

    const birdMat = new StandardMaterial('wildlifeBirdMat', scene);
    birdMat.disableLighting = true;
    birdMat.emissiveColor = new Color3(0.045, 0.038, 0.030);
    birdMat.diffuseColor = Color3.Black();
    birdMat.specularColor = Color3.Black();

    const deerMat = new StandardMaterial('wildlifeDeerMat', scene);
    deerMat.diffuseColor = new Color3(0.20, 0.13, 0.08);
    deerMat.specularColor = new Color3(0.02, 0.015, 0.01);

    const foxMat = new StandardMaterial('wildlifeFoxMat', scene);
    foxMat.diffuseColor = new Color3(0.34, 0.17, 0.07);
    foxMat.specularColor = new Color3(0.03, 0.02, 0.01);

    const turkeyMat = new StandardMaterial('wildlifeTurkeyMat', scene);
    turkeyMat.diffuseColor = new Color3(0.12, 0.10, 0.075);
    turkeyMat.specularColor = new Color3(0.015, 0.012, 0.01);

    for (let i = 0; i < 9; i++) {
      this.createBird(scene, birdMat, playerStart, i);
    }

    for (let i = 0; i < 3; i++) this.createGroundAnimal(scene, deerMat, playerStart, 'deer');
    this.createGroundAnimal(scene, foxMat, playerStart, 'fox');
    this.createGroundAnimal(scene, turkeyMat, playerStart, 'turkey');
  }

  update(dt: number, playerPos: Vector3): void {
    for (const bird of this.birds) {
      bird.root.position.x += Math.sin(bird.heading) * bird.speed * dt;
      bird.root.position.z += Math.cos(bird.heading) * bird.speed * dt;
      const flap = Math.sin(performance.now() * 0.006 + bird.phase) * 0.32;
      bird.leftWing.rotation.z = 0.18 + flap;
      bird.rightWing.rotation.z = -0.18 - flap;

      const dx = bird.root.position.x - playerPos.x;
      const dz = bird.root.position.z - playerPos.z;
      if (dx * dx + dz * dz > WILDLIFE_RADIUS * WILDLIFE_RADIUS) {
        this.placeBirdAhead(bird, playerPos);
      }
    }

    for (const animal of this.animals) {
      const dx = animal.root.position.x - playerPos.x;
      const dz = animal.root.position.z - playerPos.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < 38 * 38) {
        animal.fleeTimer = 5.0;
        animal.heading = Math.atan2(dx, dz);
      } else {
        animal.fleeTimer = Math.max(0, animal.fleeTimer - dt);
        animal.heading += Math.sin(performance.now() * 0.00035 + animal.root.uniqueId) * dt * 0.14;
      }

      const moveSpeed = animal.fleeTimer > 0 ? animal.speed * 2.5 : animal.speed;
      animal.root.position.x += Math.sin(animal.heading) * moveSpeed * dt;
      animal.root.position.z += Math.cos(animal.heading) * moveSpeed * dt;
      animal.root.position.y = this.terrain.getHeightAt(animal.root.position.x, animal.root.position.z) + 0.06;
      animal.root.rotation.y = animal.heading;

      const farDx = animal.root.position.x - playerPos.x;
      const farDz = animal.root.position.z - playerPos.z;
      if (farDx * farDx + farDz * farDz > 130 * 130) {
        this.placeGroundAnimal(animal, playerPos);
      }
    }
  }

  dispose(): void {
    this.meshes.forEach(m => m.dispose());
    this.birds.forEach(b => b.root.dispose());
    this.animals.forEach(a => a.root.dispose());
  }

  private createBird(scene: Scene, mat: StandardMaterial, origin: Vector3, index: number): void {
    const root = new TransformNode(`wildlifeBirdRoot_${index}`, scene);
    const body = MeshBuilder.CreateBox(`wildlifeBirdBody_${index}`, {
      width: 0.12,
      height: 0.05,
      depth: 0.48,
    }, scene);
    const leftWing = MeshBuilder.CreateBox(`wildlifeBirdWingL_${index}`, {
      width: 0.72,
      height: 0.025,
      depth: 0.08,
    }, scene);
    const rightWing = MeshBuilder.CreateBox(`wildlifeBirdWingR_${index}`, {
      width: 0.72,
      height: 0.025,
      depth: 0.08,
    }, scene);

    for (const mesh of [body, leftWing, rightWing]) {
      mesh.parent = root;
      mesh.material = mat;
      mesh.applyFog = false;
      mesh.isPickable = false;
      this.meshes.push(mesh);
    }
    leftWing.position.x = -0.36;
    rightWing.position.x = 0.36;

    const bird = {
      root,
      leftWing,
      rightWing,
      speed: 5.5 + Math.random() * 3.2,
      heading: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
    };
    this.placeBirdAhead(bird, origin);
    this.birds.push(bird);
  }

  private createGroundAnimal(
    scene: Scene,
    mat: StandardMaterial,
    origin: Vector3,
    kind: GroundAnimal['kind'],
  ): void {
    const root = new TransformNode(`wildlife${kind}Root`, scene);
    const scale = kind === 'deer' ? 1 : kind === 'fox' ? 0.55 : 0.42;

    const body = MeshBuilder.CreateBox(`wildlife${kind}Body`, {
      width: 0.55 * scale,
      height: 0.55 * scale,
      depth: 1.35 * scale,
    }, scene);
    body.position.y = 0.62 * scale;
    body.scaling.y = kind === 'turkey' ? 1.15 : 0.62;

    const head = MeshBuilder.CreateBox(`wildlife${kind}Head`, {
      width: 0.34 * scale,
      height: 0.34 * scale,
      depth: 0.36 * scale,
    }, scene);
    head.position.set(0, 0.88 * scale, 0.78 * scale);

    const legCount = kind === 'turkey' ? 2 : 4;
    for (let i = 0; i < legCount; i++) {
      const leg = MeshBuilder.CreateBox(`wildlife${kind}Leg_${i}`, {
        width: 0.08 * scale,
        height: 0.7 * scale,
        depth: 0.08 * scale,
      }, scene);
      const side = i % 2 === 0 ? -1 : 1;
      const front = i < 2 ? 1 : -1;
      leg.position.set(side * 0.18 * scale, 0.25 * scale, front * 0.38 * scale);
      leg.parent = root;
      leg.material = mat;
      leg.isPickable = false;
      this.meshes.push(leg);
    }

    for (const mesh of [body, head]) {
      mesh.parent = root;
      mesh.material = mat;
      mesh.isPickable = false;
      this.meshes.push(mesh);
    }

    const animal: GroundAnimal = {
      root,
      kind,
      heading: Math.random() * Math.PI * 2,
      speed: kind === 'deer' ? 1.25 : kind === 'fox' ? 1.8 : 0.9,
      fleeTimer: 0,
    };
    this.placeGroundAnimal(animal, origin);
    this.animals.push(animal);
  }

  private placeBirdAhead(bird: Bird, playerPos: Vector3): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = 58 + Math.random() * 85;
    bird.root.position.set(
      playerPos.x + Math.sin(angle) * radius,
      playerPos.y + 24 + Math.random() * 22,
      playerPos.z + Math.cos(angle) * radius,
    );
    bird.heading = angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.8;
    bird.root.rotation.y = bird.heading;
  }

  private placeGroundAnimal(animal: GroundAnimal, playerPos: Vector3): void {
    const angle = Math.random() * Math.PI * 2;
    const radius = 58 + Math.random() * 54;
    const x = playerPos.x + Math.sin(angle) * radius;
    const z = playerPos.z + Math.cos(angle) * radius;
    animal.root.position.set(x, this.terrain.getHeightAt(x, z) + 0.06, z);
    animal.heading = angle + Math.PI + (Math.random() - 0.5) * 0.6;
    animal.root.rotation.y = animal.heading;
    animal.fleeTimer = 0;
  }
}
