import { Color3, Vector3, type ShadowGenerator, type Scene } from '@babylonjs/core';
import type { ITerrain, Collider } from '@dissonance/world';
import type { PlayerController } from '@dissonance/player';
import type { Signal } from '@preact/signals';
import type { ScaleTuningSignals } from '../state/scaleTuning';
import type { AtmosphereSignals } from '../state/atmosphere';
import type { LineglassSignals } from '../state/lineglass';
import { scatterLocationProps, type LocationEntry, type LocationPropsHandle } from './LocationProps';
import {
  compositeGradeHeightAt,
  compositeObstacleClearanceAt,
  loadCompositeLocations,
  type CompositeLocationsHandle,
  type SurveilledLocationEntrance,
} from './CompositeLocations';
import { loadUtilityCorridors, type UtilityCorridorsHandle } from './UtilityCorridors';
import { loadRoadNetwork, type RoadHandle, type RoadNetworkHandle } from './RoadNetwork';
import { loadLineglassParts, type LineglassPartsHandle } from './LineglassParts';
import {
  loadBoulevardPatrolDrones,
  type BoulevardPatrolDronesHandle,
  type PatrolDroneSnapshot,
} from './BoulevardPatrolDrones';
import {
  loadFalloutShelterEntrance,
  type FalloutShelterEntranceHandle,
} from './FalloutShelterEntrance';
import {
  loadWorldTerminals,
  type WorldTerminalFixture,
  type WorldTerminalsHandle,
} from './WorldTerminals';
import { loadForestImpasses, type ForestImpassesHandle } from './ForestImpasses';
import { loadAssetShowcase, type AssetShowcaseHandle } from './AssetShowcase';
import type { ReplayRoute } from '../ui/RouteReplay';

function worldBounds(realWidth: number, realDepth: number, scaleTuning: ScaleTuningSignals) {
  return {
    minX: -(realWidth / 2) * scaleTuning.hScale.value,
    maxX: (realWidth / 2) * scaleTuning.hScale.value,
    minZ: -(realDepth / 2) * scaleTuning.hScale.value,
    maxZ: (realDepth / 2) * scaleTuning.hScale.value,
  };
}

function validateTerminalClearance(
  worldTerminals: WorldTerminalsHandle,
  locations: LocationEntry[],
  toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
  horizontalScale: number,
): void {
  for (const terminal of worldTerminals.terminals) {
    const clearance = compositeObstacleClearanceAt(
      locations,
      toRenderXZ,
      horizontalScale,
      terminal.position.x,
      terminal.position.z,
    );
    if (clearance < terminal.colliderRadius) {
      throw new Error(
        `[WorldFeaturesSystem] terminal "${terminal.id}" overlaps a compound obstacle.`,
      );
    }
  }
}

// Owns the four location-manifest-driven feature loaders (crude prop
// placeholders, composite building GLBs, utility-corridor power lines,
// Lineglass collectible parts) as one unit — every one of them reads the
// same `locations` manifest + `toRenderXZ` projection, feeds
// `applyPlayerColliders`, and gets disposed/rebuilt together on an
// hScale/vExag rescale (see rebuild()). Player-mode-only (see main.tsx —
// orbit mode never constructs this).
export class WorldFeaturesSystem {
  private compositeLocationsGeneration = 0;
  private readonly heightAt = (x: number, z: number): number => this.terrain.getHeightAt(x, z);
  private readonly inertPatrolDrones = new Map<
    string,
    { position: Vector3; settleSeconds: number }
  >();
  private readonly recoveredPatrolDroneIds = new Set<string>();

  private constructor(
    private readonly scene: Scene,
    private readonly locations: LocationEntry[],
    private readonly replayRoutes: ReplayRoute[],
    private readonly toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
    private readonly scaleTuning: ScaleTuningSignals,
    private readonly terrain: ITerrain,
    private readonly atmosphere: AtmosphereSignals,
    private readonly powerLinesVisible: Signal<boolean>,
    private readonly lineglass: LineglassSignals,
    private readonly realWidth: number,
    private readonly realDepth: number,
    private readonly shadowGenerator: ShadowGenerator | undefined,
    private readonly player: PlayerController,
    private locationProps: LocationPropsHandle,
    private compositeLocations: CompositeLocationsHandle,
    private utilityCorridors: UtilityCorridorsHandle,
    private roadNetwork: RoadNetworkHandle,
    private lineglassParts: LineglassPartsHandle,
    private patrolDrones: BoulevardPatrolDronesHandle,
    private shelterEntrance: FalloutShelterEntranceHandle,
    private worldTerminals: WorldTerminalsHandle,
    private forestImpasses: ForestImpassesHandle,
    private assetShowcase: AssetShowcaseHandle,
  ) {
    this.applyPlayerColliders();
  }

  static async create(
    scene: Scene,
    locations: LocationEntry[],
    replayRoutes: ReplayRoute[],
    toRenderXZ: (lat: number, lon: number) => { x: number; z: number },
    scaleTuning: ScaleTuningSignals,
    terrain: ITerrain,
    atmosphere: AtmosphereSignals,
    powerLinesVisible: Signal<boolean>,
    lineglass: LineglassSignals,
    realWidth: number,
    realDepth: number,
    shadowGenerator: ShadowGenerator | undefined,
    player: PlayerController,
  ): Promise<WorldFeaturesSystem> {
    const heightAt = (x: number, z: number) => terrain.getHeightAt(x, z);
    const locationProps = scatterLocationProps(scene, locations, toRenderXZ, heightAt, shadowGenerator);
    const compositeLocations = await loadCompositeLocations(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, heightAt,
      Color3.FromHexString(atmosphere.windowTintColor.value), atmosphere.windowGlow.value, shadowGenerator,
    );
    const utilityCorridors = loadUtilityCorridors(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, heightAt,
      worldBounds(realWidth, realDepth, scaleTuning), shadowGenerator,
    );
    utilityCorridors.setVisible(powerLinesVisible.value);
    const roadNetwork = loadRoadNetwork(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, scaleTuning.vExag.value, heightAt, replayRoutes,
    );
    // state/lineglass.ts's diegetic half — parts already collected last
    // session (lineglass.collectedPartIds, restored in main.tsx) load
    // already hidden, never re-awarded.
    const lineglassParts = loadLineglassParts(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, heightAt, new Set(lineglass.collectedPartIds.value),
    );
    const patrolDrones = loadBoulevardPatrolDrones(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, heightAt, shadowGenerator,
    );
    const shelterEntrance = loadFalloutShelterEntrance(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, heightAt, shadowGenerator,
    );
    const worldTerminals = loadWorldTerminals(
      scene,
      locations,
      toRenderXZ,
      scaleTuning.hScale.value,
      (x, z) => compositeGradeHeightAt(
        locations, toRenderXZ, scaleTuning.hScale.value, heightAt, x, z,
      ) ?? heightAt(x, z),
      shadowGenerator,
    );
    validateTerminalClearance(
      worldTerminals, locations, toRenderXZ, scaleTuning.hScale.value,
    );
    const forestImpasses = loadForestImpasses(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, heightAt, shadowGenerator,
    );
    const assetShowcase = loadAssetShowcase(
      scene, locations, toRenderXZ, scaleTuning.hScale.value, heightAt, shadowGenerator,
    );

    return new WorldFeaturesSystem(
      scene, locations, replayRoutes, toRenderXZ, scaleTuning, terrain, atmosphere, powerLinesVisible, lineglass,
      realWidth, realDepth, shadowGenerator, player, locationProps, compositeLocations, utilityCorridors, roadNetwork,
      lineglassParts, patrolDrones, shelterEntrance, worldTerminals, forestImpasses, assetShowcase,
    );
  }

  get milosEntrance(): SurveilledLocationEntrance | null {
    return this.compositeLocations.milosEntrance;
  }

  get falloutShelterPosition(): Vector3 | null {
    return this.shelterEntrance.position?.clone() ?? null;
  }

  get falloutShelterDoor(): { position: Vector3; interactionRadius: number } | null {
    const position = this.shelterEntrance.doorPosition;
    if (!position) return null;
    return {
      position: position.clone(),
      interactionRadius: this.shelterEntrance.interactionRadius,
    };
  }

  getTerminal(id: string): WorldTerminalFixture | null {
    const terminal = this.worldTerminals.get(id);
    if (!terminal) return null;
    return { ...terminal, position: terminal.position.clone() };
  }

  getRoad(locationId: string): RoadHandle | null {
    return this.roadNetwork.getRoad(locationId);
  }

  private terminalHeightAt(x: number, z: number): number {
    return compositeGradeHeightAt(
      this.locations,
      this.toRenderXZ,
      this.scaleTuning.hScale.value,
      this.heightAt,
      x,
      z,
    ) ?? this.heightAt(x, z);
  }

  setPowerLinesVisible(visible: boolean): void {
    this.utilityCorridors.setVisible(visible);
  }

  // Walking within pickup range collects a part outright, no interact key
  // (matching this app's existing "proximity is enough" convention). See
  // main.tsx's game loop for the newly-unlocked-layer follow-up.
  updateLineglass(dt: number, playerX: number, playerZ: number): string[] {
    return this.lineglassParts.update(dt, playerX, playerZ);
  }

  updatePatrolDrones(dt: number): void {
    this.patrolDrones.update(dt);
  }

  getPatrolDrone(id: string): PatrolDroneSnapshot | null {
    return this.patrolDrones.get(id);
  }

  setPatrolDroneInert(id: string, position: Vector3, settleSeconds: number): boolean {
    const applied = this.patrolDrones.setInert(id, position, settleSeconds);
    if (applied) {
      this.inertPatrolDrones.set(id, { position: position.clone(), settleSeconds });
    }
    return applied;
  }

  setPatrolDroneRecovered(id: string, recovered = true): boolean {
    const applied = this.patrolDrones.setRecovered(id, recovered);
    if (!applied) return false;
    if (recovered) this.recoveredPatrolDroneIds.add(id);
    else this.recoveredPatrolDroneIds.delete(id);
    return true;
  }

  // Buildings joined props/poles here 2026-07-27 ("make all buildings but
  // milo's apartment building un-enterable") — CompositeLocations.ts's own
  // BUILDING_COLLISION_RADII/MILOS_BUILDING_ID own the "which buildings,
  // how big a circle" decisions; this just combines whatever each loader
  // currently reports. Drive mode still has no collision logic at all
  // (only PlayerController/Walk does) — still a real follow-up, unchanged.
  private applyPlayerColliders(): void {
    const colliders: Collider[] = [
      ...this.locationProps.colliders,
      ...this.utilityCorridors.colliders,
      ...this.compositeLocations.colliders,
      ...this.compositeLocations.doorBlockerColliders(),
      ...this.shelterEntrance.colliders,
      ...this.worldTerminals.colliders,
      ...this.forestImpasses.colliders,
    ];
    this.player.setColliders(colliders);
    // Milo's stairwell steps + second-floor slab (2026-07-27) — the only
    // FloorSurfaces that exist today; empty for every other building.
    this.player.setFloorSurfaces(this.compositeLocations.floorSurfaces);
  }

  updateDoors(dt: number, playerX: number, playerZ: number): void {
    if (this.compositeLocations.updateDoors(dt, playerX, playerZ)) this.applyPlayerColliders();
  }

  rebuild(): void {
    this.locationProps.dispose();
    this.locationProps = scatterLocationProps(this.scene, this.locations, this.toRenderXZ, this.heightAt, this.shadowGenerator);

    // Composite GLBs load asynchronously. Scale/color sliders can request a
    // second rebuild before the first one finishes, so use a generation
    // token to ensure an older completion disposes its own newly-created
    // meshes instead of becoming a second live copy of the boulevard.
    const requestedCompositeGeneration = ++this.compositeLocationsGeneration;
    this.compositeLocations.dispose();
    void loadCompositeLocations(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value,
      this.heightAt, Color3.FromHexString(this.atmosphere.windowTintColor.value), this.atmosphere.windowGlow.value, this.shadowGenerator,
    )
      .then((next) => {
        if (requestedCompositeGeneration !== this.compositeLocationsGeneration) {
          next.dispose();
          return;
        }
        this.compositeLocations = next;
        this.applyPlayerColliders();
      })
      .catch((error) => {
        console.error('[CompositeLocations] failed to rebuild', error);
      });

    this.utilityCorridors.dispose();
    this.utilityCorridors = loadUtilityCorridors(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value,
      this.heightAt, worldBounds(this.realWidth, this.realDepth, this.scaleTuning), this.shadowGenerator,
    );
    this.utilityCorridors.setVisible(this.powerLinesVisible.value);
    this.applyPlayerColliders();

    this.roadNetwork.dispose();
    this.roadNetwork = loadRoadNetwork(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value, this.scaleTuning.vExag.value,
      this.heightAt, this.replayRoutes,
    );

    this.lineglassParts.dispose();
    // Live collected set, not savedSettings' original snapshot — a part
    // picked up earlier this session must not respawn on an hScale/vExag
    // rebuild.
    this.lineglassParts = loadLineglassParts(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value, this.heightAt,
      new Set(this.lineglass.collectedPartIds.value),
    );

    this.patrolDrones.dispose();
    this.patrolDrones = loadBoulevardPatrolDrones(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value, this.heightAt, this.shadowGenerator,
    );
    this.inertPatrolDrones.forEach(({ position, settleSeconds }, id) => {
      this.patrolDrones.setInert(id, position, settleSeconds);
    });
    this.recoveredPatrolDroneIds.forEach((id) => this.patrolDrones.setRecovered(id, true));

    this.shelterEntrance.dispose();
    this.shelterEntrance = loadFalloutShelterEntrance(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value, this.heightAt, this.shadowGenerator,
    );
    this.worldTerminals.dispose();
    this.worldTerminals = loadWorldTerminals(
      this.scene,
      this.locations,
      this.toRenderXZ,
      this.scaleTuning.hScale.value,
      (x, z) => this.terminalHeightAt(x, z),
      this.shadowGenerator,
    );
    validateTerminalClearance(
      this.worldTerminals, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value,
    );

    this.forestImpasses.dispose();
    this.forestImpasses = loadForestImpasses(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value, this.heightAt, this.shadowGenerator,
    );

    this.assetShowcase.dispose();
    this.assetShowcase = loadAssetShowcase(
      this.scene, this.locations, this.toRenderXZ, this.scaleTuning.hScale.value, this.heightAt, this.shadowGenerator,
    );
    this.applyPlayerColliders();
  }
}
