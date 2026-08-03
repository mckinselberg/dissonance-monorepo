import type { WhistleNote } from './AudioTypes';

const SAMPLE_RATE = 22_050;

type Samples = Float32Array;

export function createWindWav(): ArrayBuffer {
  const samples = windNoiseSamples(8, 0x57_49_4e_44);
  for (let i = 0; i < samples.length; i++) {
    const time = i / SAMPLE_RATE;
    samples[i] *= 0.55 + 0.3 * Math.sin(time * Math.PI * 0.22);
  }
  softenLoopBoundary(samples);
  normalizePeak(samples, 0.8);
  return encodeWav(samples);
}

export function createRainWav(): ArrayBuffer {
  const samples = noiseSamples(8, 0x52_41_49_4e, 'high');
  softenLoopBoundary(samples);
  return encodeWav(samples);
}

export function createInsectsWav(): ArrayBuffer {
  const samples = new Float32Array(8 * SAMPLE_RATE);
  const random = mulberry32(0x1a_5e_c7);
  for (let chirp = 0; chirp < 34; chirp++) {
    const start = Math.floor(random() * (samples.length - SAMPLE_RATE * 0.12));
    const length = Math.floor(SAMPLE_RATE * (0.025 + random() * 0.08));
    const frequency = 4200 + random() * 2800;
    for (let i = 0; i < length; i++) {
      const envelope = Math.sin((i / length) * Math.PI) ** 2;
      samples[start + i] += Math.sin((i / SAMPLE_RATE) * Math.PI * 2 * frequency) * envelope * 0.3;
    }
  }
  softenLoopBoundary(samples);
  return encodeWav(samples);
}

export function createDroneWav(): ArrayBuffer {
  const samples = new Float32Array(4 * SAMPLE_RATE);
  for (let i = 0; i < samples.length; i++) {
    const phase = (i / SAMPLE_RATE) * Math.PI * 2;
    samples[i] = Math.sin(phase * 38) * 0.7 + Math.sin(phase * 76) * 0.12;
  }
  softenLoopBoundary(samples);
  return encodeWav(samples);
}

export function createThunderWav(): ArrayBuffer {
  const duration = 4.2;
  const samples = noiseSamples(duration, 0x7a_11_0d, 'low');
  for (let i = 0; i < samples.length; i++) {
    const time = i / SAMPLE_RATE;
    const initialCrack = Math.exp(-time * 18);
    const rumble = time < 0.04 ? time / 0.04 : Math.exp(-(time - 0.04) * 0.82);
    const secondary = time > 0.7 ? Math.exp(-(time - 0.7) * 1.5) * 0.35 : 0;
    samples[i] *= initialCrack * 0.55 + rumble + secondary;
  }
  return encodeWav(samples);
}

export function createBreathLoopWav(): ArrayBuffer {
  const samples = noiseSamples(4, 0xb4_ea_71, 'band');
  for (let i = 0; i < samples.length; i++) {
    const phase = (i / samples.length) * Math.PI * 2;
    const inhaleExhale = Math.max(0, Math.sin(phase)) ** 1.8;
    samples[i] *= inhaleExhale;
  }
  softenLoopBoundary(samples);
  return encodeWav(samples);
}

export function createBreathCatchWav(): ArrayBuffer {
  const samples = noiseSamples(0.65, 0xca_7c_4, 'band');
  applyEnvelope(samples, 0.025, 0.42);
  return encodeWav(samples);
}

export function createTrailStepWav(seed: number): ArrayBuffer {
  const samples = noiseSamples(0.24, seed, 'band');
  for (let i = 0; i < samples.length; i++) {
    const time = i / SAMPLE_RATE;
    const grit = Math.exp(-time * 30);
    const weight = Math.sin(time * Math.PI * 2 * 105) * Math.exp(-time * 24) * 0.45;
    samples[i] = samples[i] * grit + weight;
  }
  applyEnvelope(samples, 0.002, 0.16);
  return encodeWav(samples);
}

export function createShelterChimeWav(): ArrayBuffer {
  const samples = new Float32Array(Math.floor(SAMPLE_RATE * 1.1));
  addTone(samples, noteFrequency('D4'), 0, 0.78, 0.58, 0.035, 0.62);
  addTone(samples, noteFrequency('A4'), 0.045, 0.78, 0.52, 0.05, 0.66);
  return encodeWav(samples);
}

export function createWhistleWav(notes: WhistleNote[]): ArrayBuffer {
  const duration = Math.max(0.1, ...notes.map((note) => note.time + note.duration)) + 0.25;
  const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  for (const note of notes) {
    addTone(samples, noteFrequency(note.note), note.time, note.duration, 0.82, 0.025, 0.14, true);
  }
  return encodeWav(samples);
}

function addTone(
  samples: Samples,
  frequency: number,
  startSeconds: number,
  durationSeconds: number,
  gain: number,
  attackSeconds: number,
  releaseSeconds: number,
  vibrato = false,
): void {
  const start = Math.max(0, Math.floor(startSeconds * SAMPLE_RATE));
  const length = Math.min(samples.length - start, Math.ceil((durationSeconds + releaseSeconds) * SAMPLE_RATE));
  for (let i = 0; i < length; i++) {
    const time = i / SAMPLE_RATE;
    const attack = Math.min(1, time / Math.max(0.001, attackSeconds));
    const release = time <= durationSeconds ? 1 : Math.max(0, 1 - (time - durationSeconds) / releaseSeconds);
    const modulation = vibrato ? Math.sin(time * Math.PI * 11) * 0.003 : 0;
    const phase = Math.PI * 2 * frequency * (time + modulation);
    samples[start + i] += Math.sin(phase) * attack * release * gain;
  }
}

function noteFrequency(note: string): number {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(note);
  if (!match) throw new Error(`Unsupported note: ${note}`);
  const semitones: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = (Number(match[3]) + 1) * 12 + semitones[match[1]] + accidental;
  return 440 * 2 ** ((midi - 69) / 12);
}

function noiseSamples(duration: number, seed: number, filter: 'low' | 'high' | 'band'): Samples {
  const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  const random = mulberry32(seed);
  let low = 0;
  let lower = 0;
  for (let i = 0; i < samples.length; i++) {
    const white = random() * 2 - 1;
    low += 0.08 * (white - low);
    lower += 0.018 * (low - lower);
    samples[i] = filter === 'low' ? lower * 2.6 : filter === 'high' ? (white - low) * 0.62 : (low - lower) * 3.2;
  }
  return samples;
}

function windNoiseSamples(duration: number, seed: number): Samples {
  const samples = new Float32Array(Math.ceil(duration * SAMPLE_RATE));
  const random = mulberry32(seed);
  let body = 0;
  let low = 0;
  for (let i = 0; i < samples.length; i++) {
    const white = random() * 2 - 1;
    body += 0.18 * (white - body);
    low += 0.03 * (body - low);
    samples[i] = (body - low) * 2.6 + (white - body) * 0.13;
  }
  return samples;
}

function normalizePeak(samples: Samples, targetPeak: number): void {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak === 0) return;
  const scale = targetPeak / peak;
  for (let i = 0; i < samples.length; i++) samples[i] *= scale;
}

function applyEnvelope(samples: Samples, attackSeconds: number, releaseSeconds: number): void {
  const attackSamples = Math.max(1, Math.floor(attackSeconds * SAMPLE_RATE));
  const releaseSamples = Math.max(1, Math.floor(releaseSeconds * SAMPLE_RATE));
  for (let i = 0; i < samples.length; i++) {
    const attack = Math.min(1, i / attackSamples);
    const release = Math.min(1, (samples.length - 1 - i) / releaseSamples);
    samples[i] *= Math.max(0, Math.min(attack, release));
  }
}

function softenLoopBoundary(samples: Samples): void {
  applyEnvelope(samples, 0.04, 0.04);
}

function encodeWav(samples: Samples): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function dbToGain(db: number): number {
  return 10 ** (db / 20);
}
