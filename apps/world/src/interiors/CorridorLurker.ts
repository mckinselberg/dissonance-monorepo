import {
  Color3,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Scene,
} from '@babylonjs/core';

export const REY_CAVERNS_LURKER_ID = 'rey-caverns-lurker-01';

export type CorridorLurkerState = 'watching' | 'fleeing' | 'gone';
export type CorridorLurkerTrigger = 'proximity' | 'flashlight' | null;

export interface CorridorLurkerSnapshot {
  id: typeof REY_CAVERNS_LURKER_ID;
  state: CorridorLurkerState;
  trigger: CorridorLurkerTrigger;
  distanceToMilo: number;
}

export class CorridorLurker {
  private readonly root: TransformNode;
  private readonly meshes: AbstractMesh[] = [];
  private readonly material: StandardMaterial;
  private readonly leftArm: AbstractMesh;
  private readonly rightArm: AbstractMesh;
  private readonly leftLeg: AbstractMesh;
  private readonly rightLeg: AbstractMesh;
  private state: CorridorLurkerState;
  private trigger: CorridorLurkerTrigger = null;
  private distanceToMilo = Infinity;
  private runElapsed = 0;

  constructor(
    scene: Scene,
    parent: TransformNode,
    private readonly spawn: Vector3,
    private readonly fleeTarget: Vector3,
    initiallyGone: boolean,
    private readonly onFled: (trigger: Exclude<CorridorLurkerTrigger, null>) => void,
  ) {
    this.root = new TransformNode(REY_CAVERNS_LURKER_ID, scene);
    this.root.parent = parent;
    this.root.position.copyFrom(spawn);

    this.material = new StandardMaterial('reyCavernsLurkerMaterial', scene);
    this.material.diffuseColor = new Color3(0.055, 0.06, 0.058);
    this.material.emissiveColor = new Color3(0.012, 0.015, 0.014);
    this.material.specularColor = Color3.Black();

    const body = MeshBuilder.CreateCapsule(
      `${REY_CAVERNS_LURKER_ID}:torso`,
      { height: 0.9, radius: 0.25, tessellation: 10 },
      scene,
    );
    body.position.y = 1.13;
    this.parentMesh(body);

    const head = MeshBuilder.CreateSphere(
      `${REY_CAVERNS_LURKER_ID}:head`,
      { diameter: 0.38, segments: 10 },
      scene,
    );
    head.position.y = 1.75;
    this.parentMesh(head);

    this.leftArm = this.createLimb(scene, 'leftArm', -0.34, 1.15, 0.58, 0.09);
    this.rightArm = this.createLimb(scene, 'rightArm', 0.34, 1.15, 0.58, 0.09);
    this.leftLeg = this.createLimb(scene, 'leftLeg', -0.14, 0.42, 0.82, 0.11);
    this.rightLeg = this.createLimb(scene, 'rightLeg', 0.14, 0.42, 0.82, 0.11);

    this.state = initiallyGone ? 'gone' : 'watching';
    this.root.setEnabled(!initiallyGone);
  }

  update(dt: number, miloPosition: Vector3, flashlightHits: boolean): void {
    if (this.state === 'gone') return;
    const worldPosition = this.root.getAbsolutePosition();
    this.distanceToMilo = Vector3.Distance(worldPosition, miloPosition);

    if (this.state === 'watching') {
      const toMilo = miloPosition.subtract(worldPosition);
      this.root.rotation.y = Math.atan2(toMilo.x, toMilo.z);
      const trigger = flashlightHits ? 'flashlight' : this.distanceToMilo <= 8.5 ? 'proximity' : null;
      if (!trigger) return;
      this.state = 'fleeing';
      this.trigger = trigger;
      this.onFled(trigger);
    }

    this.runElapsed += Math.max(0, dt);
    const toTarget = this.fleeTarget.subtract(this.root.position);
    const remaining = toTarget.length();
    if (remaining <= 0.15) {
      this.root.position.copyFrom(this.fleeTarget);
      this.root.setEnabled(false);
      this.state = 'gone';
      return;
    }
    const direction = toTarget.scale(1 / remaining);
    this.root.rotation.y = Math.atan2(direction.x, direction.z);
    this.root.position.addInPlace(direction.scale(Math.min(remaining, dt * 4.8)));
    const stride = Math.sin(this.runElapsed * 14) * 0.72;
    this.leftArm.rotation.x = stride;
    this.rightArm.rotation.x = -stride;
    this.leftLeg.rotation.x = -stride;
    this.rightLeg.rotation.x = stride;
  }

  getLookPoint(): Vector3 {
    return this.root.getAbsolutePosition().add(new Vector3(0, 1.45, 0));
  }

  snapshot(): CorridorLurkerSnapshot {
    return {
      id: REY_CAVERNS_LURKER_ID,
      state: this.state,
      trigger: this.trigger,
      distanceToMilo: this.distanceToMilo,
    };
  }

  reset(): void {
    this.state = 'watching';
    this.trigger = null;
    this.distanceToMilo = Infinity;
    this.runElapsed = 0;
    this.root.position.copyFrom(this.spawn);
    this.root.rotation.setAll(0);
    this.leftArm.rotation.setAll(0);
    this.rightArm.rotation.setAll(0);
    this.leftLeg.rotation.setAll(0);
    this.rightLeg.rotation.setAll(0);
    this.root.setEnabled(true);
  }

  dispose(): void {
    this.meshes.forEach((mesh) => mesh.dispose());
    this.material.dispose();
    this.root.dispose();
  }

  private createLimb(
    scene: Scene,
    name: string,
    x: number,
    y: number,
    height: number,
    radius: number,
  ): AbstractMesh {
    const limb = MeshBuilder.CreateCapsule(
      `${REY_CAVERNS_LURKER_ID}:${name}`,
      { height, radius, tessellation: 8 },
      scene,
    );
    limb.position.set(x, y, 0);
    this.parentMesh(limb);
    return limb;
  }

  private parentMesh(mesh: AbstractMesh): void {
    mesh.material = this.material;
    mesh.isPickable = false;
    mesh.parent = this.root;
    this.meshes.push(mesh);
  }
}
