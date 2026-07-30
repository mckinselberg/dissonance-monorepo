import type { Signal } from '@preact/signals';
import type { PrecipitationMode, WeatherMode } from '@dissonance/shared-types';
import type { AtmosphereSignals } from './atmosphere';
import type { ScaleTuningSignals } from './scaleTuning';
import type { VisibilitySignals } from './visibility';
import type { AudioSignals } from './audio';
import type { TrailsideScatterSignals } from './trailsideScatter';
import type { BulkForestScatterSignals } from './bulkForestScatter';
import type { SavedSettings } from './settingsStorage';

// The fields level 1/2 (player mode, via persistSettings) and level 3
// (orbit mode) both save identically — everything except where-the-camera-
// is, which each mode represents differently (player: x/y/z/rotation/
// activeMode/cameraHeightOffset; orbit: orbitTarget*/orbitAlpha/Beta/
// Radius). Previously this ~45-field object was written out three times
// (persistSettings, plus each mode's own ViewToolsRow.buildSnapshot) —
// this is the one place that field list is spelled out; each call site
// spreads it and adds only its own position fields.
export type SharedSettingsSnapshot = Pick<
  SavedSettings,
  | 'hScale'
  | 'vExag'
  | 'waterLevel'
  | 'timeOfDay'
  | 'fogDensity'
  | 'fogColor'
  | 'overcast'
  | 'starCount'
  | 'cloudCount'
  | 'cloudColor'
  | 'cloudOpacity'
  | 'waterColor'
  | 'starColor'
  | 'skyDayColor'
  | 'skyNightColor'
  | 'terrainLowColor'
  | 'terrainHighColor'
  | 'sunTint'
  | 'windowTintColor'
  | 'windowGlow'
  | 'treeRegionRadius'
  | 'trailsideHScale'
  | 'trailsideVScale'
  | 'trailsideCount'
  | 'bulkForestHScale'
  | 'bulkForestVScale'
  | 'bulkForestCount'
  | 'bulkForestRadius'
  | 'weatherMode'
  | 'precipitationMode'
  | 'masterMuted'
  | 'windVolume'
  | 'footstepMuted'
  | 'breathMuted'
  | 'hudVisible'
  | 'worldBounded'
  | 'terrainVisible'
  | 'osmVisible'
  | 'gpxVisible'
  | 'waterVisible'
  | 'cloudsVisible'
  | 'gridVisible'
  | 'mountainsVisible'
  | 'powerLinesVisible'
  | 'mechDogVisible'
>;

export function buildSharedSettingsSnapshot(deps: {
  scaleTuning: ScaleTuningSignals;
  atmosphere: AtmosphereSignals;
  visibility: VisibilitySignals;
  audio: AudioSignals;
  trailsideScale: TrailsideScatterSignals;
  bulkForestScale: BulkForestScatterSignals;
  treeRegionRadius: Signal<number>;
  bulkForestRadius: Signal<number>;
  weatherMode: Signal<WeatherMode>;
  precipitationMode: Signal<PrecipitationMode>;
  // Plain mutable local in main(), not a signal — passed by value at
  // call time rather than unwrapped here.
  hudVisible: boolean;
  worldBounded: Signal<boolean>;
}): SharedSettingsSnapshot {
  const {
    scaleTuning, atmosphere, visibility, audio,
    trailsideScale, bulkForestScale, treeRegionRadius, bulkForestRadius,
    weatherMode, precipitationMode, hudVisible, worldBounded,
  } = deps;
  return {
    hScale: scaleTuning.hScale.value,
    vExag: scaleTuning.vExag.value,
    waterLevel: scaleTuning.waterLevel.value,
    timeOfDay: atmosphere.timeOfDay.value,
    fogDensity: atmosphere.fogDensity.value,
    fogColor: atmosphere.fogColor.value,
    overcast: atmosphere.overcast.value,
    starCount: atmosphere.starCount.value,
    cloudCount: atmosphere.cloudCount.value,
    cloudColor: atmosphere.cloudColor.value,
    cloudOpacity: atmosphere.cloudOpacity.value,
    waterColor: atmosphere.waterColor.value,
    starColor: atmosphere.starColor.value,
    skyDayColor: atmosphere.skyDayColor.value,
    skyNightColor: atmosphere.skyNightColor.value,
    terrainLowColor: atmosphere.terrainLowColor.value,
    terrainHighColor: atmosphere.terrainHighColor.value,
    sunTint: atmosphere.sunTint.value,
    windowTintColor: atmosphere.windowTintColor.value,
    windowGlow: atmosphere.windowGlow.value,
    treeRegionRadius: treeRegionRadius.value,
    trailsideHScale: trailsideScale.hScale.value,
    trailsideVScale: trailsideScale.vScale.value,
    trailsideCount: trailsideScale.count.value,
    bulkForestHScale: bulkForestScale.hScale.value,
    bulkForestVScale: bulkForestScale.vScale.value,
    bulkForestCount: bulkForestScale.count.value,
    bulkForestRadius: bulkForestRadius.value,
    weatherMode: weatherMode.value,
    precipitationMode: precipitationMode.value,
    masterMuted: audio.masterMuted.value,
    windVolume: audio.windVolume.value,
    footstepMuted: audio.footstepMuted.value,
    breathMuted: audio.breathMuted.value,
    hudVisible,
    worldBounded: worldBounded.value,
    terrainVisible: visibility.terrain.value,
    osmVisible: visibility.osm.value,
    gpxVisible: visibility.gpx.value,
    waterVisible: visibility.water.value,
    cloudsVisible: visibility.clouds.value,
    gridVisible: visibility.grid.value,
    mountainsVisible: visibility.mountains.value,
    powerLinesVisible: visibility.powerLines.value,
    mechDogVisible: visibility.mechDog.value,
  };
}
