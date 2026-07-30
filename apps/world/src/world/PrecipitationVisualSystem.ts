import {
  Color4,
  DynamicTexture,
  ParticleSystem,
  Scene,
  Vector3,
} from '@babylonjs/core';
import type { WeatherState } from '@dissonance/world';

const RAIN_CAPACITY = 1400;
const SNOW_CAPACITY = 700;
const RAIN_MAX_EMIT_RATE = 950;
const SNOW_MAX_EMIT_RATE = 260;
const FIELD_HALF_WIDTH = 18;
const FIELD_HEIGHT = 14;

function createRainTexture(scene: Scene): DynamicTexture {
  const texture = new DynamicTexture('rainDropTexture', { width: 8, height: 32 }, scene, false);
  const context = texture.getContext();
  context.clearRect(0, 0, 8, 32);
  const gradient = context.createLinearGradient(0, 0, 0, 32);
  gradient.addColorStop(0, 'rgba(195,220,235,0)');
  gradient.addColorStop(0.25, 'rgba(195,220,235,0.7)');
  gradient.addColorStop(1, 'rgba(215,235,245,0)');
  context.fillStyle = gradient;
  context.fillRect(3, 0, 2, 32);
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

function createSnowTexture(scene: Scene): DynamicTexture {
  const texture = new DynamicTexture('snowFlakeTexture', { width: 16, height: 16 }, scene, false);
  const context = texture.getContext();
  context.clearRect(0, 0, 16, 16);
  const gradient = context.createRadialGradient(8, 8, 0, 8, 8, 7);
  gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.45, 'rgba(235,242,246,0.8)');
  gradient.addColorStop(1, 'rgba(235,242,246,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 16, 16);
  texture.hasAlpha = true;
  texture.update();
  return texture;
}

export class PrecipitationVisualSystem {
  private readonly emitter = new Vector3();
  private readonly rain: ParticleSystem;
  private readonly snow: ParticleSystem;

  constructor(scene: Scene) {
    this.rain = new ParticleSystem('weatherRain', RAIN_CAPACITY, scene);
    this.rain.particleTexture = createRainTexture(scene);
    this.rain.emitter = this.emitter;
    this.rain.minEmitBox = new Vector3(-FIELD_HALF_WIDTH, 2, -FIELD_HALF_WIDTH);
    this.rain.maxEmitBox = new Vector3(FIELD_HALF_WIDTH, FIELD_HEIGHT, FIELD_HALF_WIDTH);
    this.rain.direction1 = new Vector3(-0.8, -26, -0.5);
    this.rain.direction2 = new Vector3(0.8, -34, 0.5);
    this.rain.minLifeTime = 0.45;
    this.rain.maxLifeTime = 0.75;
    this.rain.minSize = 0.35;
    this.rain.maxSize = 0.65;
    this.rain.color1 = new Color4(0.72, 0.84, 0.9, 0.55);
    this.rain.color2 = new Color4(0.55, 0.7, 0.8, 0.32);
    this.rain.colorDead = new Color4(0.55, 0.7, 0.8, 0);
    this.rain.gravity = new Vector3(0, -12, 0);
    this.rain.emitRate = 0;
    this.rain.start();

    this.snow = new ParticleSystem('weatherSnow', SNOW_CAPACITY, scene);
    this.snow.particleTexture = createSnowTexture(scene);
    this.snow.emitter = this.emitter;
    this.snow.minEmitBox = new Vector3(-FIELD_HALF_WIDTH, 3, -FIELD_HALF_WIDTH);
    this.snow.maxEmitBox = new Vector3(FIELD_HALF_WIDTH, FIELD_HEIGHT, FIELD_HALF_WIDTH);
    this.snow.direction1 = new Vector3(-0.8, -1.5, -0.4);
    this.snow.direction2 = new Vector3(0.8, -3.2, 0.4);
    this.snow.minLifeTime = 4;
    this.snow.maxLifeTime = 7;
    this.snow.minSize = 0.08;
    this.snow.maxSize = 0.22;
    this.snow.color1 = new Color4(0.95, 0.97, 1, 0.9);
    this.snow.color2 = new Color4(0.78, 0.86, 0.92, 0.65);
    this.snow.colorDead = new Color4(0.78, 0.86, 0.92, 0);
    this.snow.gravity = new Vector3(0, -0.15, 0);
    this.snow.emitRate = 0;
    this.snow.start();
  }

  update(state: WeatherState, observerPosition: Vector3): void {
    this.emitter.copyFrom(observerPosition);
    const rainIntensity = state.rainIntensity;
    const snowIntensity = state.snowIntensity;
    this.rain.emitRate = rainIntensity < 0.01 ? 0 : RAIN_MAX_EMIT_RATE * rainIntensity;
    this.snow.emitRate = snowIntensity < 0.01 ? 0 : SNOW_MAX_EMIT_RATE * snowIntensity;
  }

  dispose(): void {
    this.rain.dispose();
    this.snow.dispose();
  }
}
