const TERMINAL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUTHORITATIVE_PROPOSAL_KEYS = new Set([
  'id',
  'authorizedId',
  'messageId',
  'sequence',
  'authorizedBy',
]);
const PROPOSAL_KEYS = new Set(['kind', 'body']);
const FIXTURE_MESSAGE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TerminalSimulationSnapshot = Readonly<{
  terminalId: string;
  revision: number;
  fixtureMessages: Readonly<Record<string, string>>;
}>;

export type TerminalDialogueRequest = Readonly<{
  fixtureMessageKey: string;
}>;

export type TerminalDialogueContext = Readonly<{
  terminalId: string;
  simulationRevision: number;
  fixtureMessageKey: string;
  fixtureBody: string;
}>;

export type TerminalDialogueProposal = Readonly<{
  kind: 'display-message';
  body: string;
}>;

declare const validatedProposalBrand: unique symbol;
export type ValidatedTerminalDialogueProposal = TerminalDialogueProposal & {
  readonly [validatedProposalBrand]: true;
};

export type AuthorizedTerminalDialogue = Readonly<{
  id: string;
  sequence: number;
  authorizedBy: 'in-process-scrambler';
  terminalId: string;
  simulationRevision: number;
  fixtureMessageKey: string;
  kind: 'display-message';
  body: string;
}>;

export type TerminalDialogueProvider = (context: TerminalDialogueContext) => unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireNonEmpty(label: string, value: string): void {
  if (value.trim().length === 0) throw new Error(`[TerminalDialogue] ${label} must not be empty`);
}

/** Validates the committed, read-only fixture at the data-loading boundary. */
export function parseTerminalSimulationSnapshot(raw: unknown): TerminalSimulationSnapshot {
  if (!isRecord(raw)) throw new Error('[TerminalDialogue] fixture must be an object');
  if (typeof raw.terminalId !== 'string' || !TERMINAL_ID_PATTERN.test(raw.terminalId)) {
    throw new Error('[TerminalDialogue] terminalId must be lowercase kebab-case');
  }
  if (!Number.isInteger(raw.revision) || (raw.revision as number) < 0) {
    throw new Error('[TerminalDialogue] simulation revision must be a non-negative integer');
  }
  if (!isRecord(raw.fixtureMessages)) {
    throw new Error('[TerminalDialogue] fixtureMessages must be an object');
  }

  const fixtureMessages: Record<string, string> = {};
  for (const [key, body] of Object.entries(raw.fixtureMessages)) {
    if (!FIXTURE_MESSAGE_KEY_PATTERN.test(key)) {
      throw new Error(`[TerminalDialogue] invalid fixture message key "${key}"`);
    }
    if (typeof body !== 'string') {
      throw new Error(`[TerminalDialogue] fixture message "${key}" must be text`);
    }
    requireNonEmpty(`fixture message "${key}"`, body);
    fixtureMessages[key] = body;
  }
  if (Object.keys(fixtureMessages).length === 0) {
    throw new Error('[TerminalDialogue] fixtureMessages must contain at least one message');
  }

  return Object.freeze({
    terminalId: raw.terminalId,
    revision: raw.revision as number,
    fixtureMessages: Object.freeze(fixtureMessages),
  });
}

function fnv1a(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/** Simulation -> immutable provider context. */
export function buildTerminalDialogueContext(
  simulation: TerminalSimulationSnapshot,
  request: TerminalDialogueRequest,
): TerminalDialogueContext {
  if (!TERMINAL_ID_PATTERN.test(simulation.terminalId)) {
    throw new Error('[TerminalDialogue] terminalId must be lowercase kebab-case');
  }
  if (!Number.isInteger(simulation.revision) || simulation.revision < 0) {
    throw new Error('[TerminalDialogue] simulation revision must be a non-negative integer');
  }
  requireNonEmpty('fixtureMessageKey', request.fixtureMessageKey);
  if (!Object.prototype.hasOwnProperty.call(simulation.fixtureMessages, request.fixtureMessageKey)) {
    throw new Error(`[TerminalDialogue] unknown fixture message "${request.fixtureMessageKey}"`);
  }
  const fixtureBody = simulation.fixtureMessages[request.fixtureMessageKey];
  if (typeof fixtureBody !== 'string') {
    throw new Error(`[TerminalDialogue] fixture message "${request.fixtureMessageKey}" must be text`);
  }

  return Object.freeze({
    terminalId: simulation.terminalId,
    simulationRevision: simulation.revision,
    fixtureMessageKey: request.fixtureMessageKey,
    fixtureBody,
  });
}

/** Provider proposal -> validated, explicitly non-authoritative proposal. */
export function validateTerminalDialogueProposal(candidate: unknown): ValidatedTerminalDialogueProposal {
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    throw new Error('[TerminalDialogue] provider proposal must be an object');
  }
  const record = candidate as Record<string, unknown>;
  const authoritativeKey = Object.keys(record).find((key) => AUTHORITATIVE_PROPOSAL_KEYS.has(key));
  if (authoritativeKey) {
    throw new Error(`[TerminalDialogue] provider proposal cannot set authoritative field "${authoritativeKey}"`);
  }
  const unsupportedKey = Object.keys(record).find((key) => !PROPOSAL_KEYS.has(key));
  if (unsupportedKey) {
    throw new Error(`[TerminalDialogue] unsupported provider proposal field "${unsupportedKey}"`);
  }
  if (record.kind !== 'display-message') {
    throw new Error('[TerminalDialogue] provider proposal kind must be "display-message"');
  }
  if (typeof record.body !== 'string') {
    throw new Error('[TerminalDialogue] provider proposal body must be text');
  }
  requireNonEmpty('provider proposal body', record.body);

  return Object.freeze({ kind: record.kind, body: record.body }) as ValidatedTerminalDialogueProposal;
}

/**
 * Offline authority boundary. IDs are derived from the configured seed and
 * authorization order; providers never receive or choose the sequence or ID.
 */
export class InProcessTerminalScrambler {
  private sequence = 0;
  private readonly seed: string;

  constructor(seed: string | number) {
    this.seed = String(seed);
    requireNonEmpty('Scrambler seed', this.seed);
  }

  authorize(
    context: TerminalDialogueContext,
    proposal: ValidatedTerminalDialogueProposal,
  ): AuthorizedTerminalDialogue {
    const sequence = this.sequence;
    const hashInput = [
      this.seed,
      sequence,
      context.terminalId,
      context.simulationRevision,
      context.fixtureMessageKey,
      proposal.kind,
      proposal.body,
    ].join('|');
    const id = `terminal-dialogue-${fnv1a(hashInput).toString(16).padStart(8, '0')}`;
    this.sequence += 1;

    return Object.freeze({
      id,
      sequence,
      authorizedBy: 'in-process-scrambler',
      terminalId: context.terminalId,
      simulationRevision: context.simulationRevision,
      fixtureMessageKey: context.fixtureMessageKey,
      kind: proposal.kind,
      body: proposal.body,
    });
  }
}

export function fixtureMessageProvider(context: TerminalDialogueContext): TerminalDialogueProposal {
  return Object.freeze({ kind: 'display-message', body: context.fixtureBody });
}

/** Simulation -> Context -> Provider -> Validation -> Authorized Dialogue. */
export function runOfflineTerminalDialogue(options: {
  simulation: TerminalSimulationSnapshot;
  request: TerminalDialogueRequest;
  provider: TerminalDialogueProvider;
  scrambler: InProcessTerminalScrambler;
}): AuthorizedTerminalDialogue {
  const context = buildTerminalDialogueContext(options.simulation, options.request);
  const proposal = validateTerminalDialogueProposal(options.provider(context));
  return options.scrambler.authorize(context, proposal);
}
