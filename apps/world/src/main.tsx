import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  Color3,
  DefaultRenderingPipeline,
} from '@babylonjs/core';
import { GameLoop } from '@dissonance/engine';
import {
  WaterPlane,
  defaultWaterLevel,
  ForestFire,
  ThunderScheduler,
  WeatherSystem,
  type FoliageSwaySource,
} from '@dissonance/world';
import { PlayerController, FlightController, DriveController } from '@dissonance/player';
import {
  AmbientAudio,
  AudioEngine,
  HeartbeatAudio,
  ShelterAlarmAudio,
  TrailPlayerAudio,
} from '@dissonance/audio';
import type { PrecipitationMode, WeatherMode } from '@dissonance/shared-types';
import { preventAccidentalClose } from '@dissonance/utils';
import {
  decodeHeightmapPng,
  HeightmapSampler,
  originFromBoundingBox,
  latLonToWorld,
  worldToLatLon,
} from '@dissonance/geo';
import { render } from 'preact';
import type { JSX } from 'preact';
import { signal, effect } from '@preact/signals';
import { LEVELS, currentLevelKey } from './state/levels';
import { loadSavedSettings, saveSettings } from './state/settingsStorage';
import { buildSharedSettingsSnapshot } from './state/snapshot';
import {
  loadHeightmap,
  loadTrails,
  loadGpxTrack,
  loadSavedViews,
  loadLocations,
  loadReplayRoutes,
  loadStoryManifest,
} from './data/loaders';
import { hideLoadingOverlay } from './utils';
import { createAtmosphereSignals } from './state/atmosphere';
import { createScaleTuningSignals } from './state/scaleTuning';
import { createTrailsideScatterSignals } from './state/trailsideScatter';
import { TerrainOverlaySystem } from './world/TerrainOverlaySystem';
import { BackdropSystem } from './world/BackdropSystem';
import { PrecipitationVisualSystem } from './world/PrecipitationVisualSystem';
import { BulkForestSystem, MAX_TREE_COUNT } from './world/BulkForestSystem';
import { TrailsideForestSystem } from './world/TrailsideForestSystem';
import { WorldFeaturesSystem } from './world/WorldFeaturesSystem';
import { createTraversalRig } from './world/TraversalRig';
import { createVisibilitySignals } from './state/visibility';
import { createAudioSignals } from './state/audio';
import { createLineglassSignals, unlockedLineglassLayers, LINEGLASS_TIERS } from './state/lineglass';
import type { EnvironmentRenderingProfile } from './state/environmentRenderingProfile';
import { applyEnvironmentRenderingProfile } from './state/applyEnvironmentRenderingProfile';
import { createEnvironmentProfileRegistry, findEnvironmentProfile } from './state/environmentProfiles';
import { AtmosphereRow, SliderRow } from './ui/AtmosphereRow';
import { EnvironmentProfileRow } from './ui/EnvironmentProfileRow';
import { VisibilityToggles, ToggleLabel } from './ui/VisibilityToggles';
import { MovementRow } from './ui/MovementRow';
import { ScaleTuningRow } from './ui/ScaleTuningRow';
import { ViewToolsRow } from './ui/ViewToolsRow';
import { GotoRow } from './ui/GotoRow';
import { RouteRecorder, type RouteSample } from './ui/RouteRecorder';
import { RouteReplay } from './ui/RouteReplay';
import { Section } from './ui/Section';
import { LineglassShell, type LineglassModuleDefinition } from './ui/lineglass';
import { AudioRow } from './ui/AudioRow';
import type { MechDogSkin } from './pursuer/MechDogBody';
import { MechDogController } from './pursuer/MechDogController';
import { WHISTLE_MELODIES } from './state/whistle';
import { createSurveillanceSession } from './interiors/SurveillanceSession';
import { createWorkshopSession } from './interiors/WorkshopSession';
import { InteriorDebugRow } from './ui/InteriorDebugRow';
import { StrikeAcquisitionSystem } from './systems/strike/StrikeAcquisitionSystem';
import { createStoryState } from './state/story';
import { WorldSaveStore, type WorldRouteId } from './state/worldSave';

// Underwater look — WaterPlane's own "murky underside" mesh already gives a
// plausible ceiling when you dip below the surface (Fly/Drive have no
// collision, so this is easy to do by accident), but nothing before this
// changed how the *rest* of the view reads once you're actually submerged:
// scene fog stayed at whatever the outdoor atmosphere sliders had it set
// to. This overrides fog color/density while the active controller's Y is
// below the water plane's current render-space level, restoring the
// atmosphere-driven values the moment it isn't — same fogMode (EXP2,
// already set once below), just a denser, murkier reading while submerged.
// Deliberately fog-only for a first pass — a real screen tint/caustics
// pass would read better but is a separate, riskier visual change.
const UNDERWATER_FOG_COLOR = Color3.FromHexString('#0a2e33');
const UNDERWATER_FOG_DENSITY = 0.04;
const RUN_SEED_SESSION_KEY = 'dissonance:world-run-seed';

function getOrCreateRunSeed(): number {
  const stored = sessionStorage.getItem(RUN_SEED_SESSION_KEY);
  if (stored !== null) {
    const parsed = Number(stored);
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
  }
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  const seed = values[0];
  sessionStorage.setItem(RUN_SEED_SESSION_KEY, String(seed));
  return seed;
}

// Fly and Drive are unconditionally available in this POC — no unlock gate
// exists yet. Design intent for whatever game eventually grows out of this
// viewer: these read naturally as *fast travel skills the player unlocks*
// rather than default abilities, e.g. gated behind reaching a landmark or
// finding an item. Not built now — a real unlock system needs persistence
// (packages/persistence is still a stub) and a reason to gate progression
// at all, neither of which exists yet.
// (ActiveMode itself lives in state/movement.ts, alongside its signal.)

async function main() {
  const removeAccidentalCloseGuard = preventAccidentalClose();

  const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const levelKey = currentLevelKey();
  const level = LEVELS[levelKey];
  const savedSettings = loadSavedSettings(levelKey);
  const worldSave = new WorldSaveStore({
    levelKey,
    mode: savedSettings.activeMode,
    position: savedSettings.x !== undefined && savedSettings.y !== undefined && savedSettings.z !== undefined
      ? { x: savedSettings.x, y: savedSettings.y, z: savedSettings.z }
      : undefined,
    rotation: savedSettings.rotationX !== undefined && savedSettings.rotationY !== undefined
      ? { x: savedSettings.rotationX, y: savedSettings.rotationY, z: 0 }
      : undefined,
    lineglassPartIds: savedSettings.lineglassPartIds,
  });
  const restoredExterior = worldSave.snapshot().lastExterior;
  const restoredHere = restoredExterior?.levelKey === levelKey ? restoredExterior : null;
  const flashlightEnabled = signal(worldSave.snapshot().equipment.flashlightEnabled);
  if (worldSave.snapshot().activeRoute !== 'exterior') {
    // Interior cameras/geometry are runtime resources, not safe reload
    // targets. A reload resumes from the last committed exterior transform.
    worldSave.setActiveRoute('exterior');
  }
  // First concrete T1/T24 profile seam. Only existing live consumers (fog)
  // are applied today; chunk/LOD distances remain validated profile data
  // until their systems land, rather than appearing as inert HUD controls.
  const environmentProfiles = createEnvironmentProfileRegistry({
    farClip: level.farClip,
    defaultFogDensity: savedSettings.fogDensity ?? 0,
    defaultFogColor: savedSettings.fogColor ?? '#8ca6c7',
  });
  const initialEnvironmentProfile = findEnvironmentProfile(
    environmentProfiles,
    savedSettings.environmentProfileId,
  );
  const environmentProfileId = signal(initialEnvironmentProfile.id);
  let activeEnvironmentProfile = initialEnvironmentProfile;
  let renderingPipeline: DefaultRenderingPipeline | undefined;

  // Persisted via SavedSettings/persistSettings and both buildSnapshot()
  // export paths — grid/gpx/osm are handled separately below since they're
  // also gated by Lineglass unlock state. Shared by both orbit and player mode.
  const visibility = createVisibilitySignals({
    terrain: savedSettings.terrainVisible,
    water: savedSettings.waterVisible,
    clouds: savedSettings.cloudsVisible,
    mountains: savedSettings.mountainsVisible,
    powerLines: savedSettings.powerLinesVisible,
    mechDog: savedSettings.mechDogVisible,
  });
  // Created here (rather than owned by MechDogController) because the
  // shared Toggles-section HUD below reads it synchronously in a <select
  // value=...> prop — see MechDogController's own comment on `skin`.
  const mechDogSkin = signal<MechDogSkin>('default');
  // state/lineglass.ts — restores whichever parts were already collected
  // last session, then combines that unlock state with the saved on/off
  // preference (defaulting to visible once unlocked, matching the historical
  // auto-enable-on-unlock behavior) before anything downstream reads
  // visibility.osm/gpx/grid.value (TerrainOverlaySystem's own initial-
  // visibility constructor argument further down, and ScaleTuning/
  // VisibilityToggles' own gating). A part never re-locks a layer the
  // player already earned —
  // unlockedLineglassLayers is a pure function of collected count, monotonic
  // by construction.
  const lineglass = createLineglassSignals({
    collectedPartIds: worldSave.snapshot().progression.inventory.lineglassPartIds,
  });
  const lineglassUnlocked = unlockedLineglassLayers(lineglass.collectedPartIds.value.length);
  visibility.grid.value = lineglassUnlocked.has('grid') && (savedSettings.gridVisible ?? true);
  visibility.gpx.value = lineglassUnlocked.has('gpx') && (savedSettings.gpxVisible ?? true);
  visibility.osm.value = lineglassUnlocked.has('osm') && (savedSettings.osmVisible ?? true);

  // Atmosphere-row pilot (see docs/THREADS.md) — these 6 signals back the
  // Preact-rendered #atmosphere-root panel mounted further down.
  const atmosphere = createAtmosphereSignals({
    timeOfDay: savedSettings.timeOfDay ?? 12,
    // Persisted values are explicit runtime overrides layered on the named
    // profile. Selecting a profile below resets these signals to its values.
    fogDensity: savedSettings.fogDensity ?? initialEnvironmentProfile.atmosphere.fogDensity,
    fogColor: savedSettings.fogColor ?? initialEnvironmentProfile.atmosphere.fogColor,
    overcast: savedSettings.overcast ?? false,
    starCount: savedSettings.starCount ?? 800,
    cloudCount: savedSettings.cloudCount ?? 16,
    cloudColor: savedSettings.cloudColor ?? '#e6e6eb',
    cloudOpacity: savedSettings.cloudOpacity ?? 0.75,
    waterColor: savedSettings.waterColor ?? '#0d2e3d',
    starColor: savedSettings.starColor ?? '#ffffff',
    skyDayColor: savedSettings.skyDayColor ?? '#8ca6c7',
    skyNightColor: savedSettings.skyNightColor ?? '#050814',
    terrainLowColor: savedSettings.terrainLowColor ?? '#241c12',
    terrainHighColor: savedSettings.terrainHighColor ?? '#8c8c85',
    sunTint: savedSettings.sunTint ?? '#ffffff',
    windowTintColor: savedSettings.windowTintColor ?? '#ffffff',
    windowGlow: savedSettings.windowGlow ?? 0,
  });

  // Ported from dont-turn-around (@dissonance/audio) — AmbientAudio and
  // HeartbeatAudio are already fully generic (no ExperienceProfile/DTA
  // coupling), reused as-is. TrailPlayerAudio is a decoupled sibling of
  // DTA's PlayerAudio: same breath-handling logic, but calls
  // AudioEngine.playTrailStep() (open dirt/gravel) instead of
  // playForestStep() for footsteps. All three construct with zero args
  // (matches DTA's own Game.ts constructor pattern) — real playback only
  // starts once the Enable Audio button fires a genuine user gesture
  // (browsers require this for AudioContext unlock; World has no
  // menu/start-screen gesture to piggyback on the way DTA's "Begin" button
  // does, hence the dedicated button — see index.html).
  const audio = createAudioSignals({
    masterMuted: savedSettings.masterMuted ?? false,
    windVolume: savedSettings.windVolume ?? 0.7,
    footstepMuted: savedSettings.footstepMuted ?? false,
    breathMuted: savedSettings.breathMuted ?? false,
  });
  const ambientAudio = new AmbientAudio();
  const heartbeatAudio = new HeartbeatAudio();
  const shelterAlarmAudio = new ShelterAlarmAudio();
  const trailPlayerAudio = new TrailPlayerAudio();
  AudioEngine.setMuted(audio.masterMuted.value);
  trailPlayerAudio.setFootstepMuted(audio.footstepMuted.value);
  trailPlayerAudio.setBreathMuted(audio.breathMuted.value);
  let audioStarted = false;

  applyEnvironmentRenderingProfile(scene, activeEnvironmentProfile);
  effect(() => {
    scene.fogDensity = atmosphere.fogDensity.value;
  });
  effect(() => {
    scene.fogColor = Color3.FromHexString(atmosphere.fogColor.value);
  });

  const { contract, pngBytes } = await loadHeightmap();
  // Mutable via signals — level 1 exposes live HUD sliders that rebuild the
  // terrain and trail/GPX overlays with new scale values (see the
  // scale-tuning section below). Every other read of "the current scale" in
  // this function goes through these signals, not level.* directly, so a
  // live rescale stays consistent everywhere. Exist for every level (not
  // just level 1) — only the slider UI itself is level-1-gated.
  const scaleTuning = createScaleTuningSignals({
    hScale: savedSettings.hScale ?? level.horizontalScale,
    vExag: savedSettings.vExag ?? level.verticalExaggeration,
    waterLevel: savedSettings.waterLevel ?? defaultWaterLevel(contract),
  });
  const origin = originFromBoundingBox(contract.bbox);
  const elevations = decodeHeightmapPng(pngBytes, contract);
  const sampler = new HeightmapSampler(elevations, contract, origin);

  // Stand-in water: the DEM has no tagged lake/river geometry to trace (see
  // WaterPlane's own comment), so this is a flat plane at a configurable
  // elevation rather than a real water body traced from OSM data.
  const water = new WaterPlane(scene, contract, origin, {
    level: scaleTuning.waterLevel.value,
    verticalExaggeration: scaleTuning.vExag.value,
    horizontalScale: scaleTuning.hScale.value,
    color: Color3.FromHexString(atmosphere.waterColor.value),
    // WaterMaterial's historical default bump map is remote. The core water
    // surface remains usable without it and the viewer stays fully local.
    bumpTextureUrl: null,
  });
  // terrain (below, once trails/gpxTrack finish loading) adds its own mesh
  // to this render list once constructed.
  effect(() => {
    water.setColor(Color3.FromHexString(atmosphere.waterColor.value));
  });

  // Scattered once in real (unscaled) world space, independent of hScale/
  // vExag, so a rescale re-renders the same forest instead of re-rolling
  // different tree positions. World space is centered on the bbox (see
  // originFromBoundingBox/utmToWorld — origin = bbox center, so real world
  // X/Z each span [-width/2, width/2]).
  const realWidth = contract.bbox.maxX - contract.bbox.minX;
  const realDepth = contract.bbox.maxZ - contract.bbox.minZ;

  // Fly/Drive have no collision or bounds of their own (see their "no
  // collision" comments) — it's easy to wander straight off the edge of
  // the loaded DEM into the featureless void beyond it (the same problem
  // the reset-position button exists to recover from). This clamps X/Z to
  // the DEM's actual rectangular bbox extent every frame when enabled.
  // PlayerController already has a boundary mechanism of its own
  // (setWorldBoundaryRadius, used for DTA's mountain ring) but it's
  // circular and FlightController/DriveController don't have an
  // equivalent at all — done here app-locally instead of extending the
  // shared player package for a rectangular case it doesn't need yet.
  const worldBounded = signal(savedSettings.worldBounded ?? false);

  // Ported directly from dont-turn-around (@dissonance/world) rather than
  // rebuilt — it's already fully decoupled from ExperienceProfile/DTA's
  // world scale (the Scene param is unused, kept only for future particle
  // systems), so unlike Sun/DriftingClouds/StarField this needed no
  // World-local sibling. update() runs every frame in both game
  // loops below to keep its internal gust dynamics alive for future
  // consumers (e.g. tree sway, ambient wind audio — neither exists in this
  // app yet); the driftSpeed bump on cloud rebuild below reads the toggle
  // directly rather than the live windIntensity, since clouds only rebuild
  // occasionally (density/overcast/windy changes) and windIntensity ramps in
  // over ~2.5s (see WeatherSystem.update) — reading it at one rebuild moment
  // would usually show almost no change right when the toggle is flipped.
  const weatherMode = signal<WeatherMode>(savedSettings.weatherMode ?? 'clear');
  const precipitationMode = signal<PrecipitationMode>(savedSettings.precipitationMode ?? 'none');
  const weatherSystem = new WeatherSystem(scene);
  weatherSystem.setMode(weatherMode.value);
  weatherSystem.requestPrecipitation(
    precipitationMode.value,
    precipitationMode.value === 'none' ? 0 : 1,
  );
  const thunderScheduler = new ThunderScheduler(0x743235);
  const precipitationVisuals = new PrecipitationVisualSystem(scene);
  let flashRemainingSeconds = 0;
  let flashAmbientIntensity = 0.16;
  const baseAmbientColor = scene.ambientColor.clone();
  // Wind audio already runs weatherSystem's live windIntensity through the
  // user-facing "Wind vol" slider (see the ambientAudio.setWeatherIntensity
  // calls below); foliage sway read weatherSystem directly instead, so
  // muting/lowering Wind vol changed what you heard with no visible change
  // in how hard the trees moved. This wraps the same weatherSystem for
  // FoliageSwayPlugin consumers so "Wind vol" reads as one master wind-
  // strength knob — audible and visible together — not just an audio gain.
  const visualWindSource: FoliageSwaySource = {
    getWindIntensity: () => weatherSystem.getWindIntensity() * audio.windVolume.value,
    getWindTime: () => weatherSystem.getWindTime(),
  };

  // Sky/backdrop layer — sun/light/stars (time-of-day driven) plus
  // clouds/mountains (hScale/vExag + density driven) — see BackdropSystem's
  // own comment for why these are one unit.
  const backdrop = new BackdropSystem(
    scene, water, contract, level.farClip, atmosphere, weatherMode, scaleTuning, visibility, ambientAudio,
  );

  const clampToWorldBounds = (controller: { getPosition(): Vector3; setPosition(pos: Vector3): void }) => {
    if (!worldBounded.value) return;
    const pos = controller.getPosition();
    const maxX = (realWidth / 2) * scaleTuning.hScale.value;
    const maxZ = (realDepth / 2) * scaleTuning.hScale.value;
    const clampedX = Math.max(-maxX, Math.min(maxX, pos.x));
    const clampedZ = Math.max(-maxZ, Math.min(maxZ, pos.z));
    if (clampedX !== pos.x || clampedZ !== pos.z) {
      controller.setPosition(new Vector3(clampedX, pos.y, clampedZ));
    }
  };
  // Trailside (spread along the GPX/OSM trail corridor, player-mode-only —
  // see the HERO_ASSETS section below) and bulk forest (the rest of the
  // region, orbit+player) are each their own signal group — visually
  // separate clusters the user should be able to size independently rather
  // than incidentally coupled because they're both "trees". Created here
  // (rather than alongside the trailside GLB-loading code) because both
  // orbit's and player's settings snapshots persist trailsideHScale/VScale/
  // Count regardless of whether the trailside scatter itself gets built.
  // Trailside's default count of 60 is intentionally conservative — see
  // TrailsideForestSystem's own comment on why a full-trail scatter's
  // triangle budget needs care.
  const trailsideScale = createTrailsideScatterSignals({
    hScale: savedSettings.trailsideHScale ?? 1,
    vScale: savedSettings.trailsideVScale ?? 1,
    count: savedSettings.trailsideCount ?? 60,
  });
  // Owns the map-wide tree candidate pool (feeds ForestFire, below, via
  // treePointsInRegion) plus the bulk/decimated forest scatter — see
  // BulkForestSystem's own comment.
  const bulkForest = await BulkForestSystem.create(
    scene, sampler, contract, scaleTuning, backdrop.getShadowGenerator(), visualWindSource, savedSettings,
  );

  const [trails, gpxTrack, savedViews, worldFeatures, replayRoutes] = await Promise.all([
    loadTrails(),
    loadGpxTrack(),
    loadSavedViews(),
    loadLocations(),
    loadReplayRoutes(),
  ]);
  const storyManifest = await loadStoryManifest(worldFeatures);
  const story = createStoryState(storyManifest, {
    initialFlags: worldSave.snapshot().progression.storyFlags,
    save: (flags) => worldSave.setStoryFlags(flags),
  });
  if (story.has('shelterAlarmSilenced')) shelterAlarmAudio.silence();
  const locations = worldFeatures.entries;
  // Owns the terrain mesh plus its OSM/GPX/grid overlays as one unit — see
  // TerrainOverlaySystem's own comment. Grid defaults off (a measurement
  // layer, not something every session should pay rendering cost for
  // unless explicitly enabled).
  const terrain = new TerrainOverlaySystem(
    scene, sampler, contract, origin, level.gridResolution, trails, gpxTrack,
    scaleTuning.hScale.value, scaleTuning.vExag.value,
    Color3.FromHexString(atmosphere.terrainLowColor.value),
    Color3.FromHexString(atmosphere.terrainHighColor.value),
    {
      terrain: visibility.terrain.value,
      osm: visibility.osm.value,
      gpx: visibility.gpx.value,
      grid: visibility.grid.value,
    },
  );
  water.addToRenderList(terrain.getMesh());

  const lineglassModules: LineglassModuleDefinition[] = [
    {
      id: 'context', label: 'Interior', icon: '▣', modes: ['inspect'], priority: 10,
      capabilities: ['inspect-world'],
      source: 'live',
      summary: () => ({ primary: level.cameraMode === 'orbit' ? 'Overview' : 'Exterior', secondary: 'active' }),
      rootIds: ['interior-debug-root'],
    },
    {
      id: 'world', label: 'World', icon: '♟', modes: ['tune'], priority: 10,
      capabilities: ['edit-world'],
      source: 'profile',
      overrideCount: [
        savedSettings.hScale, savedSettings.vExag, savedSettings.waterLevel,
        savedSettings.trailsideCount, savedSettings.bulkForestCount, savedSettings.bulkForestRadius,
      ].filter((value) => value !== undefined).length,
      summary: () => ({
        primary: 'Forest',
        secondary: `${bulkForest.bulkForestPlacedCount.value.toFixed(0)} placed · R ${bulkForest.bulkForestRadius.value.toFixed(0)} m`,
      }),
      rootIds: ['toggles-root', 'world-root'],
    },
    {
      id: 'sky', label: 'Sky', icon: '☁', modes: ['tune'], priority: 20,
      capabilities: ['edit-world'],
      source: 'profile',
      overrideCount: [
        savedSettings.environmentProfileId, savedSettings.timeOfDay, savedSettings.fogDensity, savedSettings.overcast,
        savedSettings.starCount, savedSettings.cloudCount, savedSettings.cloudOpacity,
      ].filter((value) => value !== undefined).length,
      summary: () => ({
        primary: findEnvironmentProfile(environmentProfiles, environmentProfileId.value).label,
        secondary: `Fog ${atmosphere.fogDensity.value.toFixed(4)}`,
      }),
      rootIds: ['atmosphere-root'],
    },
    {
      id: 'audio', label: 'Audio', icon: '≋', modes: ['inspect', 'tune'], priority: 30,
      capabilities: ['inspect-world'],
      source: 'live',
      overrideCount: [
        savedSettings.masterMuted, savedSettings.windVolume,
        savedSettings.footstepMuted, savedSettings.breathMuted,
      ].filter((value) => value !== undefined).length,
      summary: () => ({
        primary: `Wind ${Math.round(audio.windVolume.value * 100)}%`,
        secondary: audio.masterMuted.value ? 'muted' : 'active',
      }),
      rootIds: ['audio-root'],
    },
    ...(level.cameraMode === 'orbit' ? [] : [{
      id: 'movement', label: 'Movement', icon: '↟', modes: ['inspect', 'tune'], priority: 40,
      capabilities: ['inspect-world'],
      source: 'live',
      summary: () => ({
        primary: savedSettings.activeMode ?? 'walk',
        secondary: `${(savedSettings.cameraHeightOffset ?? 0).toFixed(1)} m camera`,
      }),
      rootIds: ['movement-root'],
    } satisfies LineglassModuleDefinition]),
    {
      id: 'navigation', label: 'Navigation', icon: '⌖', modes: ['inspect', 'author'], priority: 20,
      capabilities: ['teleport'],
      source: 'live',
      summary: () => ({ primary: level.cameraMode === 'orbit' ? 'Orbit position' : 'World position', secondary: 'locations · views' }),
      rootIds: ['navigation-root'],
    },
    {
      id: 'routes', label: 'Routes', icon: '⌁', modes: ['author'], priority: 30,
      capabilities: ['author-routes'],
      source: 'recorded',
      summary: () => ({ primary: 'Route recorder', secondary: 'local draft' }),
      rootIds: ['routes-root'],
    },
    {
      id: 'replay', label: 'Replay', icon: '▷', modes: ['author'], priority: 40,
      capabilities: ['author-routes'],
      source: 'recorded',
      status: replayRoutes.length === 0 ? 'disabled' : 'normal',
      summary: () => ({
        primary: replayRoutes.length === 0 ? 'No route selected' : `${replayRoutes.length} routes`,
        secondary: 'playback',
      }),
      rootIds: ['replay-root'],
    },
    {
      id: 'diagnostics', label: 'Diagnostics', icon: '⌁', modes: ['system'], priority: 10,
      capabilities: ['view-diagnostics'],
      source: 'derived',
      summary: () => ({ primary: level.label, secondary: 'live engineering state' }),
      rootIds: ['level-links', 'level-label', 'readout'],
    },
  ];
  render(
    <LineglassShell
      modules={lineglassModules}
      capabilities={[
        'inspect-world', 'edit-world', 'author-routes', 'view-diagnostics',
        'teleport', 'edit-profile',
      ]}
    />,
    document.getElementById('lineglass-root') as HTMLDivElement,
  );

  const levelLinks = document.getElementById('level-links') as HTMLDivElement;
  levelLinks.innerHTML = 'Level: <a href="?level=1">1</a> <a href="?level=2">2</a> <a href="?level=3">3 (orbit)</a>';
  const activeLevelLink = levelLinks.querySelector<HTMLAnchorElement>(`a[href="?level=${levelKey}"]`);
  activeLevelLink?.classList.add('active');
  const readout = document.getElementById('readout') as HTMLDivElement;
  readout.textContent = 'loading...';
  const levelLabel = document.getElementById('level-label') as HTMLDivElement;
  levelLabel.textContent = level.label;

  // All toggle checkboxes in one place — visibility (7) + Overcast (was in
  // AtmosphereRow) + Bounded world (was in MovementRow, player-mode only).
  // Grid instead of one-per-line: that stacked layout was the whole reason
  // this pass started (see THREADS.md). VisibilityToggles returns a
  // Fragment, so its <label> children land as direct grid-item siblings of
  // the Overcast/Bounded-world labels below — one flat grid, not nested.
  render(
    <Section title='Toggles'>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', columnGap: '10px' }}>
        <VisibilityToggles
          signals={visibility}
          onTerrainCommit={(checked) => terrain.setTerrainVisible(checked)}
          onOsmCommit={(checked) => terrain.setOsmVisible(checked)}
          onGpxCommit={(checked) => terrain.setGpxVisible(checked)}
          onWaterCommit={(checked) => water.setVisible(checked)}
          onCloudsCommit={(checked) => backdrop.setCloudsVisible(checked)}
          onGridCommit={(checked) => terrain.setGridVisible(checked)}
          onMountainsCommit={(checked) => backdrop.setMountainsVisible(checked)}
          lineglassCollectedPartIds={lineglass.collectedPartIds}
        />
        <ToggleLabel label='Overcast' signal={atmosphere.overcast} onCommit={() => backdrop.rebuildClouds()} />
        {/* Not a ToggleLabel — weatherMode is 'clear'|'windy', not a plain
            boolean signal, so it needs its own checked/onChange conversion
            rather than ToggleLabel's Signal<boolean> contract. */}
        <label>
          <input
            type='checkbox'
            checked={weatherMode.value === 'windy'}
            onChange={(e: JSX.TargetedEvent<HTMLInputElement>) => {
              weatherMode.value = e.currentTarget.checked ? 'windy' : 'clear';
              weatherSystem.setMode(weatherMode.value);
              backdrop.rebuildClouds();
            }}
          />{' '}
          Windy
        </label>
        <label>
          Precipitation{' '}
          <select
            value={precipitationMode.value}
            onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
              precipitationMode.value = e.currentTarget.value as PrecipitationMode;
              weatherSystem.requestPrecipitation(
                precipitationMode.value,
                precipitationMode.value === 'none' ? 0 : 1,
              );
            }}
          >
            <option value='none'>None</option>
            <option value='rain'>Rain</option>
            <option value='snow'>Snow</option>
            <option value='storm'>Storm</option>
          </select>
        </label>
        {level.cameraMode !== 'orbit' && (
          <ToggleLabel label='Bounded world' signal={worldBounded} onCommit={() => {}} />
        )}
        {/* utilityCorridors (boulevard power line) only loads in the
            non-orbit path, same as compositeLocations' buildings — gated
            here rather than through VisibilityToggles' shared, orbit-safe
            prop contract. */}
        {level.cameraMode !== 'orbit' && (
          <ToggleLabel
            label='Power lines'
            signal={visibility.powerLines}
            onCommit={(checked) => locationFeatures.setPowerLinesVisible(checked)}
          />
        )}
        {level.cameraMode !== 'orbit' && (
          <ToggleLabel
            label='Mech dog'
            signal={visibility.mechDog}
            onCommit={(checked) => mechDog.setVisible(checked)}
          />
        )}
        {/* Same rig/animations underneath either way — this just swaps
            which glTF reskins it, from the menacing mech-dog default
            toward a plainer pet-dog look. Not a ToggleLabel: more than two
            skins may land later (see MechDogSkin), so this is a <select>
            rather than a boolean checkbox. */}
        {level.cameraMode !== 'orbit' && (
          <label>
            Dog skin{' '}
            <select
              value={mechDogSkin.value}
              onChange={(e: JSX.TargetedEvent<HTMLSelectElement>) => {
                mechDog.setSkin(e.currentTarget.value as MechDogSkin);
              }}
            >
              <option value='default'>Mech (default)</option>
              <option value='black'>Black (pet-friend)</option>
            </select>
          </label>
        )}
      </div>
    </Section>,
    document.getElementById('toggles-root') as HTMLDivElement,
  );

  // World — level-1-only scale-tuning (H-scale/V-exagg/water-level) plus
  // tree count, which (unlike H/V/water) applies on every level, so it
  // mounts unconditionally while ScaleTuningRow stays gated beneath it.
  // Mounted into its own root (right after Toggles in index.html's DOM
  // order) so "what the terrain looks like" controls read as one group,
  // even though the underlying signals (created earlier) and the rebuild
  // logic they trigger stay exactly where they were.
  render(
    <Section title='World'>
      <div style={{ marginTop: '6px', color: '#9cf', fontWeight: 700 }}>Trailside trees (full-detail GLBs)</div>
      <SliderRow
        label='Trailside H-scale'
        signal={trailsideScale.hScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => trailsideForest.rebuildDebounced()}
      />
      <SliderRow
        label='Trailside V-scale'
        signal={trailsideScale.vScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => trailsideForest.rebuildDebounced()}
      />
      <SliderRow
        label='Trailside count'
        signal={trailsideScale.count}
        min={0}
        max={600}
        step={10}
        format={(v) => v.toFixed(0)}
        commitOn='input'
        onCommit={() => trailsideForest.rebuildDebounced()}
      />
      <div style={{ marginTop: '10px', color: '#9cf', fontWeight: 700 }}>Bulk forest (decimated high-def GLB)</div>
      <SliderRow
        label='Bulk forest H-scale'
        signal={bulkForest.bulkForestScale.hScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => bulkForest.repositionDebounced()}
      />
      <SliderRow
        label='Bulk forest V-scale'
        signal={bulkForest.bulkForestScale.vScale}
        min={0.25}
        max={3}
        step={0.25}
        suffix='x'
        format={(v) => v.toFixed(2)}
        commitOn='input'
        onCommit={() => bulkForest.repositionDebounced()}
      />
      <SliderRow
        label='Bulk forest radius'
        signal={bulkForest.bulkForestRadius}
        min={0}
        max={bulkForest.treeRegionRadiusMax}
        step={bulkForest.treeRegionRadiusMax / 100}
        suffix='m'
        format={(v) => v.toFixed(0)}
        commitOn='input'
        onCommit={() => bulkForest.repositionDebounced()}
      />
      <SliderRow
        label='Bulk forest count'
        signal={bulkForest.bulkForestScale.count}
        min={0}
        // Never derive this range from the current pool: radius=0 made
        // max=0 and physically prevented this recovery control from moving.
        max={MAX_TREE_COUNT}
        step={50}
        format={(v) => `${v.toFixed(0)} requested / ${bulkForest.bulkForestPlacedCount.value.toFixed(0)} placed`}
        commitOn='input'
        onCommit={(value) => {
          if (value > 0 && bulkForest.bulkForestRadius.value === 0) {
            bulkForest.bulkForestRadius.value = bulkForest.defaultTreeRegionRadius;
          }
          bulkForest.repositionDebounced();
        }}
      />
      {levelKey === '1' && (
        <ScaleTuningRow
          signals={scaleTuning}
          waterMin={contract.elevation.min}
          waterMax={contract.elevation.max}
          waterStep={(contract.elevation.max - contract.elevation.min) / 200}
          onScaleCommit={() => rebuildWorld(scaleTuning.hScale.value, scaleTuning.vExag.value)}
          atmosphere={atmosphere}
          onWaterColorCommit={(value) => water.setColor(Color3.FromHexString(value))}
          onTerrainColorCommit={() => rebuildWorld(scaleTuning.hScale.value, scaleTuning.vExag.value)}
          onWindowTintCommit={() => rebuildWorld(scaleTuning.hScale.value, scaleTuning.vExag.value)}
        />
      )}
    </Section>,
    document.getElementById('world-root') as HTMLDivElement,
  );

  // Sky controls — mounted here (before the orbit early-return below)
  // rather than alongside movement-mode/camera-height, since time-of-day/
  // fog/stars/clouds all render in orbit mode (level 3) too, unlike
  // Walk/Fly/Drive which orbit has no equivalent of. Preact-rendered pilot
  // (see docs/THREADS.md); commit handlers below mirror the dispose/
  // recreate bodies the old change-listeners used 1:1.
  const selectEnvironmentProfile = (profile: EnvironmentRenderingProfile) => {
    activeEnvironmentProfile = profile;
    environmentProfileId.value = profile.id;
    atmosphere.fogDensity.value = profile.atmosphere.fogDensity;
    atmosphere.fogColor.value = profile.atmosphere.fogColor;
    const windows = profile.emissive?.windows;
    if (windows) {
      atmosphere.windowTintColor.value = windows.color;
      atmosphere.windowGlow.value = windows.intensity;
    }
    applyEnvironmentRenderingProfile(scene, profile, renderingPipeline);
    saveSettings(levelKey, { ...loadSavedSettings(levelKey), environmentProfileId: profile.id });
  };

  render(
    <Section title='Sky'>
      <EnvironmentProfileRow
        profiles={environmentProfiles}
        activeProfileId={environmentProfileId}
        onSelect={selectEnvironmentProfile}
      />
      <AtmosphereRow
        signals={atmosphere}
        onStarCountCommit={() => backdrop.rebuildStars()}
        onCloudCountCommit={() => backdrop.rebuildClouds()}
        onCloudColorCommit={() => backdrop.rebuildClouds()}
        onCloudOpacityCommit={() => backdrop.rebuildClouds()}
      />
    </Section>,
    document.getElementById('atmosphere-root') as HTMLDivElement,
  );

  render(
    <Section title='Audio'>
      <AudioRow
        signals={audio}
        showPlayerControls={level.cameraMode !== 'orbit'}
        onMasterMutedCommit={(muted) => AudioEngine.setMuted(muted)}
        onWindVolumeInput={() => {}}
        onFootstepMutedCommit={(muted) => trailPlayerAudio.setFootstepMuted(muted)}
        onBreathMutedCommit={(muted) => trailPlayerAudio.setBreathMuted(muted)}
      />
    </Section>,
    document.getElementById('audio-root') as HTMLDivElement,
  );

  // Real playback only starts from here — a genuine click, satisfying the
  // browser's AudioContext-unlock gesture requirement (see the block near
  // audio/ambientAudio's construction above for why World needs its
  // own dedicated button rather than piggybacking a menu gesture the way
  // DTA's Game.start() does).
  const audioToggleButton = document.getElementById('toggle-audio-button') as HTMLButtonElement;
  audioToggleButton.addEventListener('click', async () => {
    if (audioStarted) return;
    audioStarted = true;
    audioToggleButton.textContent = '🔊 Audio on';
    audioToggleButton.disabled = true;
    await AudioEngine.start();
    ambientAudio.start();
    heartbeatAudio.start();
    if (level.cameraMode !== 'orbit') trailPlayerAudio.start();
  });

  const hudToggleButton = document.getElementById('toggle-hud-button') as HTMLButtonElement;
  const uiPanel = document.getElementById('ui') as HTMLDivElement;
  let hudVisible = savedSettings.hudVisible ?? true;
  const applyHudVisible = () => {
    uiPanel.style.display = hudVisible ? 'block' : 'none';
  };
  applyHudVisible();
  hudToggleButton.addEventListener('click', () => {
    hudVisible = !hudVisible;
    applyHudVisible();
    // persistSettings (and the position/mode state it reads) doesn't apply
    // in orbit mode — see SavedSettings' own comment on why.
    if (level.cameraMode !== 'orbit') persistSettings();
  });

  // Unregisters app-owned unload hooks right before a reload/navigate:
  // autosave in player mode plus the accidental-close guard. reload()/href
  // fire beforeunload/pagehide on the page being torn down *before* the new
  // one loads; persistSettings would otherwise immediately re-persist the
  // current in-memory state and clobber whatever was just written.
  const unregisterBeforeNavigate = () => {
    removeAccidentalCloseGuard();
    if (level.cameraMode !== 'orbit') {
      window.removeEventListener('beforeunload', persistSettings);
      window.removeEventListener('pagehide', persistSettings);
    }
  };
  document.querySelectorAll<HTMLAnchorElement>('#level-links a').forEach((link) => {
    link.addEventListener('click', () => unregisterBeforeNavigate());
  });

  if (level.cameraMode === 'orbit') {
    // The original Phase 3/4 validation view — free orbit over the whole
    // model, no player/collision involved. Orbit doesn't autosave (see
    // SavedSettings' comment), but a loaded view snapshot writes these same
    // fields into localStorage, so restoring them here if present is what
    // makes "Load View" work for level 3.
    const worldWidth = (contract.bbox.maxX - contract.bbox.minX) * level.horizontalScale;
    const orbitCamera = new ArcRotateCamera(
      'orbitCamera',
      savedSettings.orbitAlpha ?? -Math.PI / 2,
      savedSettings.orbitBeta ?? Math.PI / 3,
      savedSettings.orbitRadius ?? worldWidth * 0.7,
      new Vector3(savedSettings.orbitTargetX ?? 0, savedSettings.orbitTargetY ?? 0, savedSettings.orbitTargetZ ?? 0),
      scene,
    );
    orbitCamera.attachControl(canvas, true);
    orbitCamera.lowerRadiusLimit = 20;
    orbitCamera.upperRadiusLimit = worldWidth * 2;
    orbitCamera.wheelPrecision = 8;
    orbitCamera.panningSensibility = 50;
    orbitCamera.maxZ = level.farClip;
    scene.activeCamera = orbitCamera;

    render(
      <>
        <ViewToolsRow
          buildSnapshot={() => ({
            level: levelKey,
            orbitTargetX: orbitCamera.target.x,
            orbitTargetY: orbitCamera.target.y,
            orbitTargetZ: orbitCamera.target.z,
            orbitAlpha: orbitCamera.alpha,
            orbitBeta: orbitCamera.beta,
            orbitRadius: orbitCamera.radius,
            ...buildSharedSettingsSnapshot({
              scaleTuning, atmosphere, visibility, audio,
              trailsideScale,
              bulkForestScale: bulkForest.bulkForestScale,
              treeRegionRadius: bulkForest.treeRegionRadius,
              bulkForestRadius: bulkForest.bulkForestRadius,
              weatherMode, precipitationMode, hudVisible, worldBounded, environmentProfileId,
            }),
          })}
          levelKey={levelKey}
          validLevelKeys={Object.keys(LEVELS)}
          saveSettings={saveSettings}
          onBeforeNavigate={unregisterBeforeNavigate}
          savedViews={savedViews}
        />
        <GotoRow
          onGo={(lat, lon) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * level.horizontalScale;
            const renderZ = real.z * level.horizontalScale;
            const groundY = terrain.getHeightAt(renderX, renderZ);
            // Re-centers the orbit pivot on the target point, keeping
            // current alpha/beta/radius (viewing angle/zoom) unchanged.
            orbitCamera.target = new Vector3(renderX, groundY, renderZ);
          }}
          getCurrentLatLon={() => {
            const pos = orbitCamera.position;
            const real = { x: pos.x / level.horizontalScale, z: pos.z / level.horizontalScale };
            return worldToLatLon(real, origin);
          }}
          locations={locations}
        />
      </>,
      document.getElementById('navigation-root') as HTMLDivElement,
    );
    render(
        <RouteRecorder
          storageKey='trail-viewer.route-recorder.v1'
          getCurrentSample={() => {
            const pos = orbitCamera.position;
            const real = { x: pos.x / level.horizontalScale, z: pos.z / level.horizontalScale };
            const latLon = worldToLatLon(real, origin);
            return {
              ...latLon,
              heightmap: sampler.sampleHeight(real),
              worldX: real.x,
              worldZ: real.z,
            } satisfies RouteSample;
          }}
        />
      ,
      document.getElementById('routes-root') as HTMLDivElement,
    );
    render(
        <RouteReplay
          routes={replayRoutes}
          onSeek={({ lat, lon }) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * level.horizontalScale;
            const renderZ = real.z * level.horizontalScale;
            orbitCamera.target = new Vector3(renderX, terrain.getHeightAt(renderX, renderZ), renderZ);
          }}
        />
      ,
      document.getElementById('replay-root') as HTMLDivElement,
    );

    const gameLoop = new GameLoop(engine, (dt) => {
      backdrop.update(dt);
      weatherSystem.update(dt, (windIntensity) => {
        ambientAudio.setWeatherIntensity(windIntensity * audio.windVolume.value);
      });
      const weatherState = weatherSystem.getState();
      ambientAudio.setRainIntensity(weatherState.rainIntensity);
      precipitationVisuals.update(weatherState, orbitCamera.position);
      scene.fogDensity = atmosphere.fogDensity.value + weatherState.fogBoost;
      const thunder = thunderScheduler.update(
        dt,
        weatherState.precipitationMode === 'storm' ? weatherState.precipitationIntensity : 0,
      );
      if (thunder) {
        flashAmbientIntensity = 0.16;
        flashRemainingSeconds = 0.12;
        if (audioStarted) ambientAudio.playThunder(thunder.gain, thunder.clapDelaySeconds);
      }
      flashRemainingSeconds = Math.max(0, flashRemainingSeconds - dt);
      scene.ambientColor = flashRemainingSeconds > 0
        ? baseAmbientColor.add(new Color3(
            flashAmbientIntensity,
            flashAmbientIntensity * 1.12,
            flashAmbientIntensity * 1.35,
          ))
        : baseAmbientColor;
      const pos = orbitCamera.position;
      const groundY = terrain.getHeightAt(pos.x, pos.z);
      readout.textContent =
        `camera: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
        `ground under camera: ${groundY.toFixed(1)}m\n` +
        `fps: ${engine.getFps().toFixed(0)}\n` +
        `left-drag to orbit, scroll to zoom, right-drag to pan`;
      scene.render();
    });
    hideLoadingOverlay();
    gameLoop.start();
    return;
  }

  // Spawn at the recorded hike's own starting point — a real trailhead,
  // rather than an arbitrary bbox-center point that might not sit on a trail
  // — unless a saved position exists for this level from a previous visit.
  const spawnPoint = gpxTrack[0]?.points[0];
  const spawnReal = spawnPoint ? latLonToWorld(spawnPoint, origin) : { x: 0, z: 0 };
  const spawnRenderX = restoredHere?.position.x ?? savedSettings.x ?? spawnReal.x * scaleTuning.hScale.value;
  const spawnRenderZ = restoredHere?.position.z ?? savedSettings.z ?? spawnReal.z * scaleTuning.hScale.value;
  const spawnGroundY = terrain.getHeightAt(spawnRenderX, spawnRenderZ);
  // Y is a placeholder — PlayerController.update() overwrites it with
  // groundY + its own (scale-adjusted) eye height on the very first frame.
  const startPosition = new Vector3(
    spawnRenderX,
    restoredHere?.position.y ?? savedSettings.y ?? spawnGroundY,
    spawnRenderZ,
  );

  const player = new PlayerController(scene, startPosition, { scale: level.playerScale, farClip: level.farClip });
  player.setFlashlightEnabled(flashlightEnabled.value);
  player.setTerrain(terrain);

  // Fast air travel — a free-fly camera for covering this real-world-scale
  // map quickly, alongside walking. All three controllers stay alive
  // simultaneously (rather than being created/destroyed on toggle) so
  // switching between them is instant and position carries over cleanly.
  const flight = new FlightController(scene, startPosition.clone(), {
    farClip: level.farClip,
    speed: level.flightSpeed,
  });

  // Same idea as Fly, but grounded — WASD at flight-grade speed with Y
  // snapped to the terrain every frame, for players who want to cover
  // ground quickly without losing their footing on the map.
  const drive = new DriveController(scene, startPosition.clone(), {
    farClip: level.farClip,
    speed: level.flightSpeed,
    scale: level.playerScale,
  });
  drive.setTerrain(terrain);

  // Conservative bloom-only pass — added so the city kit's emissive window
  // tint (see atmosphere.windowTintColor/windowGlow, CompositeLocations.ts)
  // actually reads as a glowing window rather than a flat bright rectangle;
  // also softens the street lamps' existing emissive globes the same way.
  // scene.cameras already holds player/flight/drive by this point (each
  // camera self-registers on construction) — no per-controller wiring
  // needed. Every other pipeline feature (FXAA, grain, DoF, vignette,
  // chromatic aberration) stays off; this is scoped to bloom alone.
  renderingPipeline = new DefaultRenderingPipeline('bloomPipeline', true, scene, scene.cameras);
  applyEnvironmentRenderingProfile(scene, activeEnvironmentProfile, renderingPipeline);
  // The named profile is the inherited source; persisted fog values are
  // explicit runtime overrides and must win after post-processing setup.
  scene.fogDensity = atmosphere.fogDensity.value;
  scene.fogColor = Color3.FromHexString(atmosphere.fogColor.value);

  // Autosave never restored look direction even before the Copy/Load View
  // mechanism existed (only position) — a real gap, since "the same spot,
  // facing the default direction" isn't the same view at all. Applied to
  // all three controllers so whichever mode ends up active (see
  // switchMode's own restore below) already has the right look direction.
  const restoredRotation = restoredHere?.rotation ??
    (savedSettings.rotationX !== undefined && savedSettings.rotationY !== undefined
      ? { x: savedSettings.rotationX, y: savedSettings.rotationY, z: 0 }
      : null);
  if (restoredRotation) {
    const savedRotation = new Vector3(restoredRotation.x, restoredRotation.y, restoredRotation.z);
    player.camera.rotation.copyFrom(savedRotation);
    flight.camera.rotation.copyFrom(savedRotation);
    drive.camera.rotation.copyFrom(savedRotation);
  }

  // Player-mode-only trailside hero-detail scatter — see
  // TrailsideForestSystem's own comment.
  const trailsideForest = await TrailsideForestSystem.create(
    scene, origin, gpxTrack, trails, terrain, scaleTuning, trailsideScale,
    backdrop.getShadowGenerator(), visualWindSource,
  );

  // Landmark manifest (locations.json) — crude primitive placeholder props
  // (LocationProps.ts) thin-instanced at named real-world coordinates, one
  // prop type per THREADS.md T22 asset-queue/picnic-grounds/stairway/
  // creek-corridor mention that doesn't have an authored asset yet. Meant
  // to be swapped for real assets later; the placement mechanism itself
  // (this block) won't need to change when that happens.
  const locationToRenderXZ = (lat: number, lon: number) => {
    const real = latLonToWorld({ lat, lon }, origin);
    return { x: real.x * scaleTuning.hScale.value, z: real.z * scaleTuning.hScale.value };
  };
  // Landmark-manifest-driven features (crude prop placeholders, composite
  // building GLBs, utility-corridor power lines, Lineglass collectibles) —
  // see WorldFeaturesSystem's own comment.
  const locationFeatures = await WorldFeaturesSystem.create(
    scene, locations, locationToRenderXZ, scaleTuning, terrain, atmosphere, visibility.powerLines, lineglass,
    realWidth, realDepth, backdrop.getShadowGenerator(), player,
  );
  const strikeAcquisition = new StrikeAcquisitionSystem(
    scene,
    locations,
    locationToRenderXZ,
    scaleTuning.hScale.value,
    (x, z) => terrain.getHeightAt(x, z),
    getOrCreateRunSeed(),
    weatherSystem,
    {
      get: (id) => locationFeatures.getPatrolDrone(id),
      setInert: (id) => locationFeatures.setPatrolDroneInert(id),
    },
    {
      flash: (intensity, durationSeconds) => {
        flashAmbientIntensity = intensity;
        flashRemainingSeconds = Math.max(flashRemainingSeconds, durationSeconds);
      },
      clap: (gain, delaySeconds) => {
        if (audioStarted) ambientAudio.playThunder(gain, delaySeconds);
      },
    },
  );
  strikeAcquisition.setWorkshopDiscovered(story.has('workshopDiscovered'));
  strikeAcquisition.restoreProgress({
    droneStrikeWitnessed: story.has('droneStrikeWitnessed'),
    emitterAcquired: story.has('emitterAcquired'),
    chassisRecovered: story.has('chassisRecovered'),
  });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat) return;
    const flags = strikeAcquisition.recover(
      controllers[movement.activeMode.value].getPosition(),
    );
    if (flags) {
      story.applyBeat('recover-emitter-and-chassis');
      console.info('[T31] recovery hand-off', flags);
    }
  });

  // Forest fire game mechanic — press F to ignite the nearest tree; fire
  // spreads through neighboring trees over time. Reuses treePointsInRegion()
  // (not the full candidate pool), so it can't ignite trees outside that
  // region — treeRegionRadius has no live HUD control anymore, so this pool
  // is fixed for the session once built.
  let forestFire = new ForestFire(scene, bulkForest.treePointsInRegion(), {
    horizontalScale: scaleTuning.hScale.value,
    verticalExaggeration: scaleTuning.vExag.value,
  });
  const igniteAtActiveController = () => {
    const pos = controllers[movement.activeMode.value].getPosition();
    forestFire.ignite(pos.x / scaleTuning.hScale.value, pos.z / scaleTuning.hScale.value);
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF') igniteAtActiveController();

    // 'M' whistles the currently-selected melody (number keys 1-9 pick
    // which one); 'P' pets the dog if it's close enough. `mechDog` is
    // declared further down but already constructed by the time any of
    // this can fire from a real keypress.
    if (e.code === 'KeyM') mechDog.whistle();
    const melodyDigit = /^Digit([1-9])$/.exec(e.code);
    if (melodyDigit) mechDog.selectMelody(Number(melodyDigit[1]) - 1);
    if (e.code === 'KeyP') mechDog.tryPet();
  });

  // Walk/Fly/Drive mode-switching — see TraversalRig's own comment.
  const traversalDefaults = {
    ...savedSettings,
    activeMode: restoredHere?.mode ?? savedSettings.activeMode,
  };
  const { controllers, movement, switchMode } = createTraversalRig(
    scene, terrain, player, flight, drive, traversalDefaults,
  );

  // The concrete spawn is selected on the controller's first update() call
  // (see MechDogController), after the active controller has grounded/
  // raised its camera — constructing before that first update would test
  // sightlines from the terrain surface instead of from the player's
  // actual eye.
  const mechDog = new MechDogController(
    scene, backdrop.getShadowGenerator(),
    controllers[movement.activeMode.value].getPosition(),
    visibility.mechDog.value,
    mechDogSkin,
  );

  // Milo's-apartment surveillance-interior routing — see
  // SurveillanceSession's own comment.
  const interactionPrompt = document.getElementById('interaction-prompt') as HTMLDivElement;
  const commitExteriorState = (activeRoute: WorldRouteId) => {
    const controller = controllers[movement.activeMode.value];
    const position = controller.getPosition();
    worldSave.saveRuntime(activeRoute, {
      levelKey,
      mode: movement.activeMode.value,
      position: { x: position.x, y: position.y, z: position.z },
      rotation: {
        x: controller.camera.rotation.x,
        y: controller.camera.rotation.y,
        z: controller.camera.rotation.z,
      },
    });
  };
  const surveillance = createSurveillanceSession({
    scene,
    canvas,
    terrain,
    locationFeatures,
    controllers,
    movement,
    switchMode,
    onBeforeEnter: () => commitExteriorState('surveillance'),
    interactionPrompt,
  });
  const { worldSession } = surveillance;
  const workshop = createWorkshopSession({
    scene,
    canvas,
    locationFeatures,
    controllers,
    movement,
    corridorSeed: getOrCreateRunSeed(),
    flashlightEnabled: flashlightEnabled.value,
    onEntered: () => {
      commitExteriorState('workshop');
      story.set('shelterAlarmSilenced');
      shelterAlarmAudio.silence();
    },
    onWorkbenchEntered: () => {
      if (story.applyBeat('discover-underground-workshop')) {
        console.info('[T32] underground workshop discovered');
      }
      strikeAcquisition.setWorkshopDiscovered(story.has('workshopDiscovered'));
    },
  });
  const isExteriorGameplay = () => worldSession.isExterior() && !workshop.isInterior();
  const corridorDiagnostics = workshop.corridorDiagnostics();
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyE' || event.repeat || !worldSession.isExterior()) return;
    if (workshop.isInterior()) {
      if (workshop.isNearExit()) workshop.exit();
    } else if (workshop.isNearEntrance()) {
      workshop.enter();
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyL' || event.repeat) return;
    flashlightEnabled.value = !flashlightEnabled.value;
    worldSave.setFlashlightEnabled(flashlightEnabled.value);
    workshop.setFlashlightEnabled(flashlightEnabled.value);
    player.setFlashlightEnabled(
      flashlightEnabled.value && isExteriorGameplay() && movement.activeMode.value === 'walk',
    );
  });

  render(
    <>
      <Section title='T31 Strike Acquisition'>
        <div id='t31-strike-status'>Loading strike state…</div>
        <label>
          <input
            type='checkbox'
            checked={story.has('workshopDiscovered')}
            onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              story.set('workshopDiscovered', event.currentTarget.checked);
              strikeAcquisition.setWorkshopDiscovered(story.has('workshopDiscovered'));
            }}
          />{' '}
          Workshop discovered (persistent story flag debug)
        </label>
        <br />
        <button
          type='button'
          onClick={() => {
            const anchor = strikeAcquisition.getSelectedAnchor();
            const controller = controllers[movement.activeMode.value];
            controller.setPosition(new Vector3(
              anchor.position.x,
              anchor.position.y,
              anchor.position.z - 10,
            ));
          }}
        >
          Go to selected strike anchor
        </button>
        {' '}
        <button
          type='button'
          onClick={() => {
            weatherSystem.setPrecipitationImmediate('storm', 0.5);
          }}
        >
          Prime strike rain
        </button>
      </Section>
      <Section title='T32 Shelter Entrance'>
        <button
          type='button'
          onClick={() => {
            const entrance = locationFeatures.falloutShelterPosition;
            if (!entrance) return;
            controllers[movement.activeMode.value].setPosition(
              new Vector3(entrance.x, entrance.y, entrance.z - 15),
            );
          }}
        >
          Go to crater shelter
        </button>
        <div>
          Corridor: {corridorDiagnostics.valid ? 'valid' : 'invalid'} ·{' '}
          {corridorDiagnostics.segmentCount} segments ·{' '}
          {corridorDiagnostics.collisionMeshCount} collision meshes ·{' '}
          reverse {corridorDiagnostics.reversible ? 'yes' : 'no'}
        </div>
        <label>
          <input
            type='checkbox'
            checked={workshop.isCorridorUnlocked()}
            onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              workshop.setCorridorUnlocked(event.currentTarget.checked);
            }}
          />{' '}
          Unlock workshop test corridor (debug only)
        </label>
        <br />
        <label>
          <input
            type='checkbox'
            checked={flashlightEnabled.value}
            onChange={(event: JSX.TargetedEvent<HTMLInputElement>) => {
              flashlightEnabled.value = event.currentTarget.checked;
              worldSave.setFlashlightEnabled(flashlightEnabled.value);
              workshop.setFlashlightEnabled(flashlightEnabled.value);
            }}
          />{' '}
          Milo flashlight (L)
        </label>
      </Section>
      <Section title='Surveillance Interior'>
        <InteriorDebugRow
          route={worldSession.route}
          transition={worldSession.transition}
          exteriorSnapshot={worldSession.exteriorSnapshot}
          onEnter={() => { void surveillance.enterInterior('debug'); }}
          onExit={surveillance.requestExit}
        />
      </Section>
    </>,
    document.getElementById('interior-debug-root') as HTMLDivElement,
  );

  if (worldSession.route.value.kind === 'surveillance') {
    void surveillance.enterInterior('deep-link');
  }

  // Live scale tuning — level 1 only. Rebuilds the terrain mesh and both
  // trail overlays from scratch with new scale values, preserving the
  // active camera's real-world lat/long (and, for fly mode, its height
  // above ground) across the rebuild so changing a slider doesn't strand
  // you somewhere unrelated to where you were. hScale/vExag/waterLevel
  // signals exist for every level (see scaleTuning's own comment) — only
  // this rebuild function and the slider UI below are level-1-gated.
  const rebuildWorld = (newHScale: number, newVExag: number) => {
    const horizontalScaleRatio = newHScale / scaleTuning.hScale.value;
    const activeController = controllers[movement.activeMode.value];
    const beforePos = activeController.getPosition();
    const beforeGroundY = terrain.getHeightAt(beforePos.x, beforePos.z);
    const heightAboveGround = beforePos.y - beforeGroundY;
    const realX = beforePos.x / scaleTuning.hScale.value;
    const realZ = beforePos.z / scaleTuning.hScale.value;

    water.removeFromRenderList(terrain.getMesh());

    scaleTuning.hScale.value = newHScale;
    scaleTuning.vExag.value = newVExag;
    mechDog.rescale(horizontalScaleRatio);

    terrain.rebuild(
      scaleTuning.hScale.value,
      scaleTuning.vExag.value,
      Color3.FromHexString(atmosphere.terrainLowColor.value),
      Color3.FromHexString(atmosphere.terrainHighColor.value),
      {
        terrain: visibility.terrain.value,
        osm: visibility.osm.value,
        gpx: visibility.gpx.value,
        grid: visibility.grid.value,
      },
    );
    // player/drive already hold this same TerrainOverlaySystem instance
    // (it implements ITerrain and rebuilds itself in place, rather than
    // being replaced) — no setTerrain() call needed after a rebuild.
    water.setScale(scaleTuning.hScale.value, scaleTuning.vExag.value, scaleTuning.waterLevel.value);
    water.addToRenderList(terrain.getMesh());
    trailsideForest.rebuild();
    locationFeatures.rebuild();

    backdrop.rebuildClouds();
    backdrop.rebuildMountains();

    // Positions are cached (treePoints), so this just re-scatters the same
    // candidate points at the new scale rather than re-rolling placement.
    bulkForest.reposition();
    forestFire.setScale(scaleTuning.hScale.value, scaleTuning.vExag.value);

    const newRenderX = realX * scaleTuning.hScale.value;
    const newRenderZ = realZ * scaleTuning.hScale.value;
    const newGroundY = terrain.getHeightAt(newRenderX, newRenderZ);
    if (movement.activeMode.value === 'fly') {
      activeController.setPosition(new Vector3(newRenderX, newGroundY + heightAboveGround, newRenderZ));
    } else {
      activeController.setPosition(new Vector3(newRenderX, newGroundY, newRenderZ));
    }
    persistSettings();
  };

  // Unlike H-scale/V-exagg (rebuildWorld, above — an expensive dispose/
  // recreate), moving the water plane doesn't touch terrain geometry at all
  // — just its own position — so this updates live on every drag tick.
  // hScale/vExag are peeked (not tracked) so this effect only re-runs on a
  // waterLevel change; rebuildWorld's own water.setScale call already
  // covers the hScale/vExag-changed case.
  effect(() => {
    water.setScale(scaleTuning.hScale.peek(), scaleTuning.vExag.peek(), scaleTuning.waterLevel.value);
  });

  render(
    <MovementRow
          signals={movement}
          onModeChange={(mode) => {
            if (!isExteriorGameplay()) return;
            switchMode(mode);
            persistSettings();
          }}
          onCameraHeightInput={(value) => {
            player.setHeightOffset(value);
            drive.setHeightOffset(value);
          }}
    />,
    document.getElementById('movement-root') as HTMLDivElement,
  );
  render(
    <>
      <ViewToolsRow
          buildSnapshot={() => {
            const activeCamera = controllers[movement.activeMode.value].camera;
            const pos = controllers[movement.activeMode.value].getPosition();
            return {
              level: levelKey,
              activeMode: movement.activeMode.value,
              x: pos.x,
              y: pos.y,
              z: pos.z,
              rotationX: activeCamera.rotation.x,
              rotationY: activeCamera.rotation.y,
              cameraHeightOffset: movement.cameraHeightOffset.value,
              ...buildSharedSettingsSnapshot({
                scaleTuning, atmosphere, visibility, audio,
                trailsideScale,
                bulkForestScale: bulkForest.bulkForestScale,
                treeRegionRadius: bulkForest.treeRegionRadius,
                bulkForestRadius: bulkForest.bulkForestRadius,
                weatherMode, precipitationMode, hudVisible, worldBounded, environmentProfileId,
              }),
            };
          }}
          levelKey={levelKey}
          validLevelKeys={Object.keys(LEVELS)}
          saveSettings={saveSettings}
          onBeforeNavigate={unregisterBeforeNavigate}
          savedViews={savedViews}
        />
        <GotoRow
          onGo={(lat, lon) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * scaleTuning.hScale.value;
            const renderZ = real.z * scaleTuning.hScale.value;
            const groundY = terrain.getHeightAt(renderX, renderZ);
            const activeController = controllers[movement.activeMode.value];
            if (movement.activeMode.value === 'fly') {
              // Hover well above ground so the destination is actually
              // visible, rather than dropping you right at ground level
              // facing who-knows-where.
              activeController.setPosition(new Vector3(renderX, groundY + 50, renderZ));
            } else {
              activeController.setPosition(new Vector3(renderX, groundY, renderZ));
            }
          }}
          getCurrentLatLon={() => {
            const pos = controllers[movement.activeMode.value].getPosition();
            const real = { x: pos.x / scaleTuning.hScale.value, z: pos.z / scaleTuning.hScale.value };
            return worldToLatLon(real, origin);
          }}
          onResetPosition={() => {
            // Fly Mode has no bounds clamping, so it's easy to end up saved
            // somewhere far outside the DEM's real footprint (nothing but
            // sky, a distant sliver of terrain). This drops just the saved
            // position for the current level (keeping scale/water/camera-
            // height tuning intact) and reloads back to the recorded hike's
            // trailhead.
            unregisterBeforeNavigate();
            const withoutPosition = loadSavedSettings(levelKey);
            delete withoutPosition.x;
            delete withoutPosition.y;
            delete withoutPosition.z;
            saveSettings(levelKey, withoutPosition);
            location.reload();
          }}
          locations={locations}
        />
    </>,
    document.getElementById('navigation-root') as HTMLDivElement,
  );
  render(
    <RouteRecorder
          storageKey='trail-viewer.route-recorder.v1'
          getCurrentSample={() => {
            const pos = controllers[movement.activeMode.value].getPosition();
            const real = { x: pos.x / scaleTuning.hScale.value, z: pos.z / scaleTuning.hScale.value };
            const latLon = worldToLatLon(real, origin);
            return {
              ...latLon,
              heightmap: sampler.sampleHeight(real),
              worldX: real.x,
              worldZ: real.z,
            } satisfies RouteSample;
          }}
    />,
    document.getElementById('routes-root') as HTMLDivElement,
  );
  render(
    <RouteReplay
          routes={replayRoutes}
          onSeek={({ lat, lon }) => {
            const real = latLonToWorld({ lat, lon }, origin);
            const renderX = real.x * scaleTuning.hScale.value;
            const renderZ = real.z * scaleTuning.hScale.value;
            const groundY = terrain.getHeightAt(renderX, renderZ);
            const activeController = controllers[movement.activeMode.value];
            const y = movement.activeMode.value === 'fly' ? groundY + 5 : groundY;
            activeController.setPosition(new Vector3(renderX, y, renderZ));
          }}
    />,
    document.getElementById('replay-root') as HTMLDivElement,
  );

  const SAVE_INTERVAL_SECONDS = 2;
  let timeSinceSave = 0;
  // Tracked so the underwater fog override (see UNDERWATER_FOG_COLOR above)
  // only touches scene.fogColor/fogDensity on the frame the player actually
  // crosses the water surface, not every frame — the atmosphere sliders'
  // own effect()s already own those properties while above water, and
  // fighting them every frame would make live-dragging Fog while surfaced
  // pointless.
  const persistSettings = () => {
    const activeCamera = controllers[movement.activeMode.value].camera;
    const pos = controllers[movement.activeMode.value].getPosition();
    const activeRoute = workshop.isInterior()
      ? 'workshop'
      : worldSession.route.value.kind === 'surveillance'
        ? 'surveillance'
        : 'exterior';
    worldSave.saveRuntime(
      activeRoute,
      isExteriorGameplay() ? {
        levelKey,
        mode: movement.activeMode.value,
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: {
          x: activeCamera.rotation.x,
          y: activeCamera.rotation.y,
          z: activeCamera.rotation.z,
        },
      } : undefined,
    );
    saveSettings(levelKey, {
      x: pos.x,
      y: pos.y,
      z: pos.z,
      rotationX: activeCamera.rotation.x,
      rotationY: activeCamera.rotation.y,
      activeMode: movement.activeMode.value,
      cameraHeightOffset: movement.cameraHeightOffset.value,
      ...buildSharedSettingsSnapshot({
        scaleTuning, atmosphere, visibility, audio,
        trailsideScale,
        bulkForestScale: bulkForest.bulkForestScale,
        treeRegionRadius: bulkForest.treeRegionRadius,
        bulkForestRadius: bulkForest.bulkForestRadius,
        weatherMode, precipitationMode, hudVisible, worldBounded, environmentProfileId,
      }),
    });
  };
  window.addEventListener('beforeunload', persistSettings);
  window.addEventListener('pagehide', persistSettings);

  const gameLoop = new GameLoop(engine, (dt) => {
    player.setFlashlightEnabled(
      flashlightEnabled.value && isExteriorGameplay() && movement.activeMode.value === 'walk',
    );
    workshop.setFlashlightEnabled(flashlightEnabled.value && workshop.isInterior());
    if (isExteriorGameplay()) {
      controllers[movement.activeMode.value].update(dt);
      clampToWorldBounds(controllers[movement.activeMode.value]);
    }
    backdrop.update(dt);
    weatherSystem.update(dt, (windIntensity) => {
      ambientAudio.setWeatherIntensity(windIntensity * audio.windVolume.value);
    });
    const weatherState = weatherSystem.getState();
    ambientAudio.setRainIntensity(weatherState.rainIntensity);
    const thunder = thunderScheduler.update(
      dt,
      weatherState.precipitationMode === 'storm' ? weatherState.precipitationIntensity : 0,
    );
    if (thunder) {
      flashAmbientIntensity = 0.16;
      flashRemainingSeconds = 0.12;
      if (audioStarted) ambientAudio.playThunder(thunder.gain, thunder.clapDelaySeconds);
    }
    flashRemainingSeconds = Math.max(0, flashRemainingSeconds - dt);
    scene.ambientColor = flashRemainingSeconds > 0
      ? baseAmbientColor.add(new Color3(
          flashAmbientIntensity,
          flashAmbientIntensity * 1.12,
          flashAmbientIntensity * 1.35,
        ))
      : baseAmbientColor;
    forestFire.update(dt);
    locationFeatures.updatePatrolDrones(dt);

    // Breath/footsteps: PlayerController (walk) is the only controller with
    // a BreathSystem — Fly/Drive are deliberately simpler traversal tools
    // with no breath/adrenaline (see their own file comments) — so this
    // only runs while walking, and stops footsteps immediately otherwise.
    const breathReadout = document.getElementById('breath-load-value');
    if (isExteriorGameplay() && movement.activeMode.value === 'walk') {
      const breathLoad = player.breath.getLoad();
      trailPlayerAudio.updateBreath(breathLoad);
      trailPlayerAudio.updateFootsteps(player.getSpeed());
      if (breathReadout) breathReadout.textContent = `${Math.round(breathLoad * 100)}%`;
    } else {
      trailPlayerAudio.updateFootsteps(0);
      if (breathReadout) breathReadout.textContent = '—';
    }

    const pos = controllers[movement.activeMode.value].getPosition();
    if (isExteriorGameplay()) strikeAcquisition.update(dt, pos);
    workshop.update();
    const shelterDoor = locationFeatures.falloutShelterDoor;
    if (audioStarted && isExteriorGameplay() && shelterDoor) {
      const distance = Math.hypot(pos.x - shelterDoor.position.x, pos.z - shelterDoor.position.z);
      shelterAlarmAudio.setProximity(Math.max(0, 1 - distance / 45));
    } else {
      shelterAlarmAudio.setProximity(0);
    }
    precipitationVisuals.update(weatherState, pos);
    const groundY = terrain.getHeightAt(pos.x, pos.z);
    if (worldSession.isExterior()) locationFeatures.updateDoors(dt, pos.x, pos.z);
    mechDog.update(
      dt,
      controllers[movement.activeMode.value],
      movement.activeMode.value === 'walk' && player.isCrouching,
      (x, z) => terrain.getHeightAt(x, z),
    );
    const mechDogModel = mechDog.getModel();
    const strikeSnapshot = strikeAcquisition.snapshot();
    if (strikeSnapshot.state === 'SPENT') {
      story.applyBeat('witness-boulevard-drone-strike');
    }
    const strikeStatus = document.getElementById('t31-strike-status');
    if (strikeStatus) {
      strikeStatus.textContent =
        `${strikeSnapshot.state} — ${strikeSnapshot.blockingReason} · ` +
        `LOS ${strikeSnapshot.hasLineOfSight ? 'yes' : 'no'} · ` +
        `Milo ${strikeSnapshot.distanceToAnchor.toFixed(1)}m · ` +
        `drone ${strikeSnapshot.droneDistanceToAnchor.toFixed(1)}m · ` +
        `rain ${Math.round(strikeSnapshot.rainIntensity * 100)}% · ` +
        `windup ${Math.round(strikeSnapshot.windupProgress * 100)}%`;
    }

    // state/lineglass.ts — walking within pickup range collects a part
    // outright, no interact key (matching this app's existing "proximity is
    // enough" convention for collision/placement rather than adding a new
    // binding for one feature). Newly-unlocked layers auto-enable their
    // visibility signal so the moment of unlock is immediately visible,
    // not just newly-toggleable.
    const newlyCollected = isExteriorGameplay()
      ? locationFeatures.updateLineglass(dt, pos.x, pos.z)
      : [];
    if (newlyCollected.length > 0) {
      const before = unlockedLineglassLayers(lineglass.collectedPartIds.value.length);
      lineglass.collectedPartIds.value = [...lineglass.collectedPartIds.value, ...newlyCollected];
      worldSave.setLineglassPartIds(lineglass.collectedPartIds.value);
      const after = unlockedLineglassLayers(lineglass.collectedPartIds.value.length);
      if (after.has('grid') && !before.has('grid')) visibility.grid.value = true;
      if (after.has('gpx') && !before.has('gpx')) visibility.gpx.value = true;
      if (after.has('osm') && !before.has('osm')) visibility.osm.value = true;
      console.info(
        `[Lineglass] collected ${newlyCollected.join(', ')} ` +
        `(${lineglass.collectedPartIds.value.length}/${LINEGLASS_TIERS.length}) — unlocked: ${[...after].join(', ') || 'none yet'}`,
      );
      persistSettings();
    }

    // See UNDERWATER_FOG_COLOR/wasSubmerged's own comments — matches
    // WaterPlane.setScale's own level*verticalExaggeration render-space math
    // rather than adding a getter to that class for one call site.
    const waterY = scaleTuning.waterLevel.value * scaleTuning.vExag.value;
    const isSubmerged = visibility.water.value && pos.y < waterY;
    if (isSubmerged) {
      scene.fogColor = UNDERWATER_FOG_COLOR;
      scene.fogDensity = UNDERWATER_FOG_DENSITY;
    } else {
      scene.fogColor = Color3.FromHexString(atmosphere.fogColor.value);
      scene.fogDensity = atmosphere.fogDensity.value + weatherState.fogBoost;
    }

    const real = { x: pos.x / scaleTuning.hScale.value, z: pos.z / scaleTuning.hScale.value };
    const latLon = worldToLatLon(real, origin);
    const controlsHint =
      workshop.isInterior()
        ? 'underground workshop — click to look, WASD to move, L flashlight, return to the threshold to exit'
        : worldSession.transition.value === 'interior'
        ? 'surveillance interior placeholder — press E to exit'
        : movement.activeMode.value === 'fly'
        ? 'click canvas to look around, WASD to fly, space/ctrl up/down, shift to boost'
        : movement.activeMode.value === 'drive'
          ? 'click canvas to look around, WASD to drive, shift to boost'
          : 'click canvas to look around, WASD to move, shift to run, L flashlight';
    const routeLabel = workshop.isInterior()
      ? 'workshop/mountain-crater'
      : worldSession.route.value.kind === 'exterior'
      ? 'exterior'
      : `surveillance/${worldSession.route.value.locationId}`;
    readout.textContent =
      `route: ${routeLabel} (${worldSession.transition.value})\n` +
      `${movement.activeMode.value}: (${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})\n` +
      `lat/lon: ${latLon.lat.toFixed(6)}, ${latLon.lon.toFixed(6)}\n` +
      `ground below: ${groundY.toFixed(1)}m\n` +
      `mech dog: ${mechDogModel.distance.toFixed(1)}m (${mechDogModel.state})\n` +
      `T31: ${strikeSnapshot.state} · ${strikeSnapshot.anchorId} · windup ${Math.round(strikeSnapshot.windupProgress * 100)}%` +
        `${strikeSnapshot.flags.chassisRecovered ? ' · recovered' : ''}\n` +
      `T31 gate: LOS ${strikeSnapshot.hasLineOfSight ? 'yes' : 'no'} · Milo ${strikeSnapshot.distanceToAnchor.toFixed(1)}m · drone ${strikeSnapshot.droneDistanceToAnchor.toFixed(1)}m · rain ${Math.round(strikeSnapshot.rainIntensity * 100)}%\n` +
      `whistle [M]: "${WHISTLE_MELODIES[mechDog.whistleMelodyIndex.value].label}" (1-${WHISTLE_MELODIES.length} to pick) — pet [P]${mechDog.isPettable() ? '' : ' (get closer)'}\n` +
      `fps: ${engine.getFps().toFixed(0)}\n` +
      controlsHint;

    if (workshop.isInterior()) {
      if (workshop.isNearExit()) {
        interactionPrompt.textContent = 'E — Return through the shelter door';
        interactionPrompt.style.display = 'block';
      } else {
        interactionPrompt.style.display = 'none';
      }
    } else if (worldSession.isExterior()) {
      if (workshop.isNearEntrance()) {
        interactionPrompt.textContent = 'E — Enter the fallout shelter';
        interactionPrompt.style.display = 'block';
      } else if (strikeSnapshot.recoveryAvailable) {
        interactionPrompt.textContent = 'E — Recover emitter and drone chassis';
        interactionPrompt.style.display = 'block';
      } else if (surveillance.isNearEntrance()) {
        interactionPrompt.textContent = 'E — Enter Milo’s apartment';
        interactionPrompt.style.display = 'block';
      } else {
        interactionPrompt.style.display = 'none';
      }
    }
    scene.render();

    timeSinceSave += dt;
    if (timeSinceSave >= SAVE_INTERVAL_SECONDS) {
      timeSinceSave = 0;
      persistSettings();
    }
  });
  hideLoadingOverlay();
  gameLoop.start();
}

main();
