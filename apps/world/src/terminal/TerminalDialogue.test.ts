import { describe, expect, it } from 'vitest';
import {
  InProcessTerminalScrambler,
  buildTerminalDialogueContext,
  fixtureMessageProvider,
  parseTerminalSimulationSnapshot,
  runOfflineTerminalDialogue,
  validateTerminalDialogueProposal,
  type TerminalSimulationSnapshot,
} from './TerminalDialogue';

function simulation(): TerminalSimulationSnapshot {
  return {
    terminalId: 'boulevard-terminal-fixture-01',
    revision: 7,
    fixtureMessages: {
      welcome: 'LOCAL LOOP READY',
      status: 'NO NETWORK ROUTE',
    },
  };
}

describe('TerminalDialogue', () => {
  it('validates and freezes a committed offline fixture', () => {
    const parsed = parseTerminalSimulationSnapshot({
      terminalId: 'public-sanitation-terminal-01',
      revision: 1,
      fixtureMessages: { 'local-status': 'LOCAL CACHE READY' },
    });

    expect(parsed).toEqual({
      terminalId: 'public-sanitation-terminal-01',
      revision: 1,
      fixtureMessages: { 'local-status': 'LOCAL CACHE READY' },
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.fixtureMessages)).toBe(true);
    expect(() => parseTerminalSimulationSnapshot({
      terminalId: 'public-sanitation-terminal-01',
      revision: 1,
      fixtureMessages: {},
    })).toThrow('at least one message');
  });

  it('builds a frozen context without exposing mutable simulation state', () => {
    const source = simulation();
    const context = buildTerminalDialogueContext(source, { fixtureMessageKey: 'welcome' });

    expect(context).toEqual({
      terminalId: 'boulevard-terminal-fixture-01',
      simulationRevision: 7,
      fixtureMessageKey: 'welcome',
      fixtureBody: 'LOCAL LOOP READY',
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(context).not.toBe(source);
  });

  it('runs the ordered offline pipeline without mutating the simulation snapshot', () => {
    const source = simulation();
    const before = structuredClone(source);
    const result = runOfflineTerminalDialogue({
      simulation: source,
      request: { fixtureMessageKey: 'status' },
      provider: (context) => {
        expect(Object.isFrozen(context)).toBe(true);
        try {
          (context as { fixtureBody: string }).fixtureBody = 'MUTATED';
        } catch {
          // Frozen provider input rejects mutation in strict runtimes.
        }
        return fixtureMessageProvider(context);
      },
      scrambler: new InProcessTerminalScrambler('offline-test'),
    });

    expect(source).toEqual(before);
    expect(result).toMatchObject({
      sequence: 0,
      authorizedBy: 'in-process-scrambler',
      terminalId: source.terminalId,
      simulationRevision: source.revision,
      fixtureMessageKey: 'status',
      kind: 'display-message',
      body: 'NO NETWORK ROUTE',
    });
    expect(result.id).toMatch(/^terminal-dialogue-[0-9a-f]{8}$/);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('assigns deterministic IDs from Scrambler seed and authorization order', () => {
    const run = () => {
      const scrambler = new InProcessTerminalScrambler('same-seed');
      return ['welcome', 'status'].map((fixtureMessageKey) => runOfflineTerminalDialogue({
        simulation: simulation(),
        request: { fixtureMessageKey },
        provider: fixtureMessageProvider,
        scrambler,
      }).id);
    };

    const first = run();
    const second = run();
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(2);
  });

  it('rejects provider-authored IDs before authorization', () => {
    expect(() => validateTerminalDialogueProposal({
      kind: 'display-message',
      body: 'forged',
      id: 'provider-owned-id',
    })).toThrow('cannot set authoritative field "id"');
  });

  it('rejects malformed proposals and missing fixture messages', () => {
    expect(() => validateTerminalDialogueProposal({
      kind: 'display-message',
      body: '',
    })).toThrow('must not be empty');
    expect(() => buildTerminalDialogueContext(
      simulation(),
      { fixtureMessageKey: 'missing' },
    )).toThrow('unknown fixture message "missing"');
  });
});
