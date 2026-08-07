import { describe, expect, it } from 'vitest';
import { resolveWorldAudioEngine } from './WorldAudioStack';

describe('resolveWorldAudioEngine', () => {
  it('allows the legacy Babylon stack only in development', () => {
    expect(resolveWorldAudioEngine('?audioEngine=babylon', true)).toBe('babylon');
    expect(resolveWorldAudioEngine('?audioEngine=babylon', false)).toBe('tone');
  });

  it('defaults to Tone for missing or unknown selections', () => {
    expect(resolveWorldAudioEngine('', true)).toBe('tone');
    expect(resolveWorldAudioEngine('?audioEngine=other', true)).toBe('tone');
  });
});
