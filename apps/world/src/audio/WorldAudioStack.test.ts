import { describe, expect, it } from 'vitest';
import { resolveWorldAudioEngine } from './WorldAudioStack';

describe('resolveWorldAudioEngine', () => {
  it('allows the legacy Tone stack only in development', () => {
    expect(resolveWorldAudioEngine('?audioEngine=tone', true)).toBe('tone');
    expect(resolveWorldAudioEngine('?audioEngine=tone', false)).toBe('babylon');
  });

  it('defaults to Babylon for missing or unknown selections', () => {
    expect(resolveWorldAudioEngine('', true)).toBe('babylon');
    expect(resolveWorldAudioEngine('?audioEngine=other', true)).toBe('babylon');
  });
});
