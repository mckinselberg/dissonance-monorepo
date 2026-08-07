import { createNarrativeState, reduce, type Intent, type NarrativeState } from '../narrative';
import { beats, worldManifest } from '../lore';

const NEAR_TICK_INTERVAL_SECONDS = 1;

// Host-side bridge between MechDogController's real player interactions and
// the pure narrative reducer (THREADS.md T40). Not a package, not exported
// beyond this app — see narrative/types.ts's header note.
//
// `mediate()` — the eng doc's proposed terminal delivery path — doesn't
// exist (T40/O33, still open). So every emitted intent just logs; there is
// no delivery surface wired up yet. This bridge exists to prove the
// reducer/Beat plumbing end-to-end, not to ship a finished narrative moment.
export class NarrativeDogBridge {
  private state: NarrativeState = createNarrativeState();
  // Host-maintained clock/counter, not a beat-emitted intent — same category
  // as event.t and state.zone, which the eng doc also treats as host-supplied
  // rather than reducer-produced (§1.3/§4.3). Not yet consumed by any beat;
  // ready for a future zone/proximity-gated beat.
  private clockSeconds = 0;
  private nearSecondsAccumulator = 0;
  private nearTicks = 0;

  reportProximity(distanceMeters: number, nearThresholdMeters: number, dt: number): void {
    this.clockSeconds += dt;
    if (distanceMeters > nearThresholdMeters) {
      this.nearSecondsAccumulator = 0;
      return;
    }
    this.nearSecondsAccumulator += dt;
    if (this.nearSecondsAccumulator < NEAR_TICK_INTERVAL_SECONDS) return;
    this.nearSecondsAccumulator -= NEAR_TICK_INTERVAL_SECONDS;
    this.nearTicks += 1;
    this.state = {
      ...this.state,
      proximityTicks: { ...this.state.proximityTicks, 'companion-dog': this.nearTicks },
    };
  }

  reportPet(): void {
    this.post({ t: this.clockSeconds, kind: 'companion:pet', subject: 'companion-dog' });
  }

  reportWhistle(): void {
    this.post({ t: this.clockSeconds, kind: 'companion:whistle', subject: 'companion-dog' });
  }

  private post(event: { t: number; kind: string; subject?: string; zone?: string }): void {
    const { state: nextState, intents } = reduce(this.state, event, beats, worldManifest);
    this.state = nextState;
    logIntents(intents);
  }
}

function logIntents(intents: Intent[]): void {
  for (const intent of intents) {
    if (intent.kind === 'surface') {
      console.log(
        `[narrative] surface ${intent.id} (${intent.subject}, ${intent.readingCount ?? '?'} readings)`,
      );
    } else if (intent.kind !== 'mark-fired') {
      // mark-fired is bookkeeping, not narratively interesting on its own.
      console.log('[narrative]', intent.kind, intent);
    }
  }
}
