/**
 * Config for one audio "channel" (e.g. footsteps, growls) within a single
 * proximity tier: how often it fires, how strongly ambient weather masks it,
 * and the sound it triggers. Volume/variation randomization belongs inside
 * `play` — the scheduler only owns timing and the weather-mask gate.
 */
export interface ProximityAudioTierConfig {
  minInterval: number;
  intervalRange: number;
  /** Gate probability scale: event is skipped when Math.random() <= mask * maskScale. */
  maskScale: number;
  play: (pan: number) => void;
}

export interface ProximityAudioChannel<TTier extends string> {
  id: string;
  /** Seconds before this channel can first fire; defaults to 0. */
  initialTimer?: number;
  /** Tiers this channel is active in. Omitted tiers freeze the channel's timer. */
  tiers: Partial<Record<TTier, ProximityAudioTierConfig>>;
}

/**
 * Tiered timer-based event scheduler for a proximity-driven entity's sound
 * design (e.g. a pursuer's footsteps/growls/rustles across far/near/close
 * tiers). Each channel keeps its own timer that persists across tier
 * transitions — a channel inactive in the current tier simply pauses rather
 * than resetting, matching how a pursuer's footstep cadence should carry
 * through a near->close transition rather than restart. Sound content is
 * fully injected via each tier config's `play` callback, so this class has
 * no knowledge of what's actually making noise.
 */
export class TieredProximityAudioScheduler<TTier extends string> {
  private readonly timers = new Map<string, number>();

  constructor(private readonly channels: ProximityAudioChannel<TTier>[]) {
    this.reset();
  }

  update(dt: number, tier: TTier, pan: number, mask: number): void {
    for (const channel of this.channels) {
      const cfg = channel.tiers[tier];
      if (!cfg) continue;

      const remaining = (this.timers.get(channel.id) ?? 0) - dt;
      if (remaining <= 0) {
        this.timers.set(channel.id, cfg.minInterval + Math.random() * cfg.intervalRange);
        if (Math.random() > mask * cfg.maskScale) cfg.play(pan);
      } else {
        this.timers.set(channel.id, remaining);
      }
    }
  }

  reset(): void {
    for (const channel of this.channels) {
      this.timers.set(channel.id, channel.initialTimer ?? 0);
    }
  }
}
