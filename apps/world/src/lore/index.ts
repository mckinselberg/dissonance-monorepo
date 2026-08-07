import type { Beat } from '../narrative';
import { companionDogAmbiguityBeat } from './beats/companionDog';

export * from './conditions';
export * from './manifest';

export const beats: Beat[] = [companionDogAmbiguityBeat];
