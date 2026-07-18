import * as Tone from 'tone';

export class AudioEngine {
  private static started = false;

  static async start(): Promise<void> {
    if (!this.started) {
      await Tone.start();
      Tone.getDestination().volume.value = -6;
      this.started = true;
    }
  }

  static isStarted(): boolean {
    return this.started;
  }

  // Global mute — keeps Tone.js's destination node encapsulated in this
  // package (per D1: Tone.js owns the AudioContext) rather than consumer
  // apps importing `tone` directly just to reach getDestination().mute.
  static setMuted(muted: boolean): void {
    Tone.getDestination().mute = muted;
  }

  static createWindLayer(): { start: () => void; stop: () => void; setIntensity: (v: number) => void } {
    const noise = new Tone.Noise('pink');
    const filter = new Tone.Filter(400, 'bandpass');
    const gain = new Tone.Gain(0);
    const lfo = new Tone.LFO({ frequency: 0.05, min: -30, max: -8 });

    noise.connect(filter);
    filter.connect(gain);
    gain.toDestination();
    lfo.connect(gain.gain);

    let running = false;

    return {
      start() {
        if (running) return;
        noise.start();
        lfo.start();
        running = true;
      },
      stop() {
        noise.stop();
        lfo.stop();
        running = false;
      },
      setIntensity(v: number) {
        gain.gain.rampTo(v * 0.4, 1.5);
        filter.frequency.rampTo(200 + v * 600, 2);
      },
    };
  }

  static playBranchSnap(panValue: number = 0, volumeDb: number = -18): void {
    const panner = new Tone.Panner(panValue);
    const filter = new Tone.Filter(1200, 'highpass');
    const env = new Tone.AmplitudeEnvelope({ attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 });
    const gainNode = new Tone.Gain(Tone.dbToGain(volumeDb));
    const noise = new Tone.Noise('brown');

    noise.connect(filter);
    filter.connect(env);
    env.connect(gainNode);
    gainNode.connect(panner);
    panner.toDestination();

    noise.start();
    env.triggerAttackRelease(0.15);

    setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
      env.dispose();
      gainNode.dispose();
      panner.dispose();
    }, 600);
  }

  static playLeafRustle(panValue: number = 0, volume: number = -12): void {
    const panner = new Tone.Panner(panValue);
    const filter = new Tone.Filter(3000, 'bandpass');
    const gain = new Tone.Gain(Tone.dbToGain(volume));
    const env = new Tone.AmplitudeEnvelope({ attack: 0.05, decay: 0.4, sustain: 0, release: 0.3 });
    const noise = new Tone.Noise('white');

    noise.connect(filter);
    filter.connect(env);
    env.connect(gain);
    gain.connect(panner);
    panner.toDestination();

    noise.start();
    env.triggerAttackRelease(0.6);

    setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
      env.dispose();
      gain.dispose();
      panner.dispose();
    }, 1500);
  }

  // Player footstep: soft forest-soil character.
  // Main layer is a low squelch (250–430 Hz) rather than the old 900–1500 Hz
  // crunch which read as pavement. Sub-bass thud stays but is tuned lower.
  // Crack is rare and soft — a leaf, not a twig snap.
  static playForestStep(panValue: number = 0, volumeDb: number = -20, withCrack: boolean = false): void {
    const panner = new Tone.Panner(panValue);
    panner.toDestination();

    const squelchFreq = 260 + Math.random() * 170;
    const squelchNoise = new Tone.Noise('pink');
    const squelchFilter = new Tone.Filter(squelchFreq, 'bandpass');
    (squelchFilter as unknown as { Q: { value: number } }).Q.value = 2;
    const squelchEnv = new Tone.AmplitudeEnvelope({
      attack: 0.001, decay: 0.07 + Math.random() * 0.04, sustain: 0.01, release: 0.04,
    });
    const squelchGain = new Tone.Gain(Tone.dbToGain(volumeDb + 1));
    squelchNoise.connect(squelchFilter);
    squelchFilter.connect(squelchEnv);
    squelchEnv.connect(squelchGain);
    squelchGain.connect(panner);
    squelchNoise.start();
    squelchEnv.triggerAttackRelease(0.11);

    const weightNoise = new Tone.Noise('brown');
    const weightFilter = new Tone.Filter(150, 'lowpass');
    const weightEnv = new Tone.AmplitudeEnvelope({
      attack: 0.001, decay: 0.04, sustain: 0, release: 0.012,
    });
    const weightGain = new Tone.Gain(Tone.dbToGain(volumeDb - 2));
    weightNoise.connect(weightFilter);
    weightFilter.connect(weightEnv);
    weightEnv.connect(weightGain);
    weightGain.connect(panner);
    weightNoise.start();
    weightEnv.triggerAttackRelease(0.04);

    if (withCrack) {
      // Soft leaf snap — quiet and brief, not a sharp twig
      const crackNoise = new Tone.Noise('white');
      const crackFilter = new Tone.Filter(2000 + Math.random() * 700, 'highpass');
      const crackEnv = new Tone.AmplitudeEnvelope({
        attack: 0.0005, decay: 0.011 + Math.random() * 0.007, sustain: 0, release: 0.006,
      });
      const crackGain = new Tone.Gain(Tone.dbToGain(volumeDb - 3));
      crackNoise.connect(crackFilter);
      crackFilter.connect(crackEnv);
      crackEnv.connect(crackGain);
      crackGain.connect(panner);
      crackNoise.start();
      crackEnv.triggerAttackRelease(0.018);
      setTimeout(() => {
        crackNoise.stop(); crackNoise.dispose();
        crackFilter.dispose(); crackEnv.dispose(); crackGain.dispose();
      }, 300);
    }

    setTimeout(() => {
      squelchNoise.stop(); squelchNoise.dispose();
      squelchFilter.dispose(); squelchEnv.dispose(); squelchGain.dispose();
      weightNoise.stop(); weightNoise.dispose();
      weightFilter.dispose(); weightEnv.dispose(); weightGain.dispose();
      panner.dispose();
    }, 400);
  }

  // Trail footstep (trail-viewer): open dirt/gravel character — brighter and
  // more percussive than playForestStep's damp-soil squelch, no sub-bass
  // weight layer (that read as "heavy forest floor," wrong for an open
  // trail). The optional crack is a bright pebble click, not a leaf snap.
  static playTrailStep(panValue: number = 0, volumeDb: number = -20, withCrack: boolean = false): void {
    const panner = new Tone.Panner(panValue);
    panner.toDestination();

    const gritFreq = 420 + Math.random() * 260;
    const gritNoise = new Tone.Noise('pink');
    const gritFilter = new Tone.Filter(gritFreq, 'bandpass');
    (gritFilter as unknown as { Q: { value: number } }).Q.value = 1.4;
    const gritEnv = new Tone.AmplitudeEnvelope({
      attack: 0.001, decay: 0.045 + Math.random() * 0.025, sustain: 0, release: 0.03,
    });
    const gritGain = new Tone.Gain(Tone.dbToGain(volumeDb));
    gritNoise.connect(gritFilter);
    gritFilter.connect(gritEnv);
    gritEnv.connect(gritGain);
    gritGain.connect(panner);
    gritNoise.start();
    gritEnv.triggerAttackRelease(0.07);

    if (withCrack) {
      // Pebble/twig click underfoot — bright and brief.
      const crackNoise = new Tone.Noise('white');
      const crackFilter = new Tone.Filter(3000 + Math.random() * 900, 'highpass');
      const crackEnv = new Tone.AmplitudeEnvelope({
        attack: 0.0005, decay: 0.009 + Math.random() * 0.006, sustain: 0, release: 0.005,
      });
      const crackGain = new Tone.Gain(Tone.dbToGain(volumeDb - 2));
      crackNoise.connect(crackFilter);
      crackFilter.connect(crackEnv);
      crackEnv.connect(crackGain);
      crackGain.connect(panner);
      crackNoise.start();
      crackEnv.triggerAttackRelease(0.014);
      setTimeout(() => {
        crackNoise.stop(); crackNoise.dispose();
        crackFilter.dispose(); crackEnv.dispose(); crackGain.dispose();
      }, 300);
    }

    setTimeout(() => {
      gritNoise.stop(); gritNoise.dispose();
      gritFilter.dispose(); gritEnv.dispose(); gritGain.dispose();
      panner.dispose();
    }, 300);
  }

  // Pursuer footstep: heavier and darker than the player's squelch.
  // Sub-bass layer (~70–90 Hz) is the key differentiator — an unmistakably
  // heavy entity. Player steps have no sub-bass at all.
  static playPursuerStep(panValue: number = 0, volumeDb: number = -20, withCrack: boolean = false): void {
    const panner = new Tone.Panner(panValue);
    panner.toDestination();

    // Low-mid thud — brown noise, 180–330 Hz (darker/lower than player squelch)
    const thudFreq = 180 + Math.random() * 150;
    const thudNoise = new Tone.Noise('brown');
    const thudFilter = new Tone.Filter(thudFreq, 'bandpass');
    (thudFilter as unknown as { Q: { value: number } }).Q.value = 1.8;
    const thudEnv = new Tone.AmplitudeEnvelope({
      attack: 0.001, decay: 0.11 + Math.random() * 0.05, sustain: 0, release: 0.04,
    });
    const thudGain = new Tone.Gain(Tone.dbToGain(volumeDb + 2));
    thudNoise.connect(thudFilter);
    thudFilter.connect(thudEnv);
    thudEnv.connect(thudGain);
    thudGain.connect(panner);
    thudNoise.start();
    thudEnv.triggerAttackRelease(0.15);

    // Sub-bass body impact — this layer distinguishes the pursuer from the player
    const subNoise = new Tone.Noise('brown');
    const subFilter = new Tone.Filter(80, 'lowpass');
    const subEnv = new Tone.AmplitudeEnvelope({
      attack: 0.001, decay: 0.09, sustain: 0, release: 0.018,
    });
    const subGain = new Tone.Gain(Tone.dbToGain(volumeDb + 5));
    subNoise.connect(subFilter);
    subFilter.connect(subEnv);
    subEnv.connect(subGain);
    subGain.connect(panner);
    subNoise.start();
    subEnv.triggerAttackRelease(0.10);

    if (withCrack) {
      // Dry branch snap — heavier than player's soft leaf, more percussive
      const crackNoise = new Tone.Noise('brown');
      const crackFilter = new Tone.Filter(1600 + Math.random() * 700, 'highpass');
      const crackEnv = new Tone.AmplitudeEnvelope({
        attack: 0.001, decay: 0.032 + Math.random() * 0.018, sustain: 0, release: 0.014,
      });
      const crackGain = new Tone.Gain(Tone.dbToGain(volumeDb + 6));
      crackNoise.connect(crackFilter);
      crackFilter.connect(crackEnv);
      crackEnv.connect(crackGain);
      crackGain.connect(panner);
      crackNoise.start();
      crackEnv.triggerAttackRelease(0.04);
      setTimeout(() => {
        crackNoise.stop(); crackNoise.dispose();
        crackFilter.dispose(); crackEnv.dispose(); crackGain.dispose();
      }, 400);
    }

    setTimeout(() => {
      thudNoise.stop(); thudNoise.dispose();
      thudFilter.dispose(); thudEnv.dispose(); thudGain.dispose();
      subNoise.stop(); subNoise.dispose();
      subFilter.dispose(); subEnv.dispose(); subGain.dispose();
      panner.dispose();
    }, 600);
  }

  static playPursuerGrowl(panValue: number = 0, volumeDb: number = -18, intensity: number = 0.5): void {
    const panner = new Tone.Panner(panValue);
    panner.toDestination();

    const baseFreq = 42 + Math.random() * 18;
    const osc = new Tone.Oscillator(baseFreq, 'sawtooth');
    const sub = new Tone.Oscillator(baseFreq * 0.5, 'triangle');
    const noise = new Tone.Noise('brown');
    const filter = new Tone.Filter(120 + intensity * 180, 'lowpass');
    (filter as unknown as { Q: { value: number } }).Q.value = 3.2;
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.04,
      decay: 0.26 + intensity * 0.20,
      sustain: 0.18,
      release: 0.24 + intensity * 0.20,
    });
    const gain = new Tone.Gain(Tone.dbToGain(volumeDb));
    const noiseGain = new Tone.Gain(Tone.dbToGain(volumeDb - 7));

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(env);
    env.connect(gain);
    gain.connect(panner);

    noise.connect(noiseGain);
    noiseGain.connect(filter);

    osc.start();
    sub.start();
    noise.start();
    osc.frequency.rampTo(baseFreq * (0.72 + Math.random() * 0.15), 0.28);
    sub.frequency.rampTo(baseFreq * 0.42, 0.28);
    env.triggerAttackRelease(0.42 + intensity * 0.28);

    setTimeout(() => {
      osc.stop(); osc.dispose();
      sub.stop(); sub.dispose();
      noise.stop(); noise.dispose();
      filter.dispose(); env.dispose(); gain.dispose(); noiseGain.dispose(); panner.dispose();
    }, 1200);
  }

  // Short directional rustle for when the player brushes past a tree at jog/sprint.
  // Crisper onset than playLeafRustle (which is slower and more ambient).
  static playProximityRustle(panValue: number = 0): void {
    const vol = -13 + (Math.random() - 0.5) * 4;
    const panner = new Tone.Panner(panValue);
    panner.toDestination();
    const noise = new Tone.Noise('white');
    const filter = new Tone.Filter(3200 + Math.random() * 1400, 'bandpass');
    (filter as unknown as { Q: { value: number } }).Q.value = 1.8;
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.008, decay: 0.14 + Math.random() * 0.10, sustain: 0, release: 0.16,
    });
    const gain = new Tone.Gain(Tone.dbToGain(vol));
    noise.connect(filter);
    filter.connect(env);
    env.connect(gain);
    gain.connect(panner);
    noise.start();
    env.triggerAttackRelease(0.26);
    setTimeout(() => {
      noise.stop(); noise.dispose();
      filter.dispose(); env.dispose(); gain.dispose(); panner.dispose();
    }, 800);
  }

  static playBreathCatch(volumeDb: number = -20, intensity: number = 0.7): void {
    const noise = new Tone.Noise('pink');
    const filter = new Tone.Filter(520 + intensity * 520, 'bandpass');
    (filter as unknown as { Q: { value: number } }).Q.value = 1.1 + intensity * 0.8;
    const env = new Tone.AmplitudeEnvelope({
      attack: 0.018,
      decay: 0.18 + intensity * 0.08,
      sustain: 0.05,
      release: 0.16 + intensity * 0.10,
    });
    const gain = new Tone.Gain(Tone.dbToGain(volumeDb + intensity * 3));

    noise.connect(filter);
    filter.connect(env);
    env.connect(gain);
    gain.toDestination();

    noise.start();
    env.triggerAttackRelease(0.18 + intensity * 0.12);

    setTimeout(() => {
      noise.stop();
      noise.dispose();
      filter.dispose();
      env.dispose();
      gain.dispose();
    }, 700);
  }

  static createBreathLayer(): {
    start: () => void;
    stop: () => void;
    setLoad: (load: number) => void;
  } {
    const noise = new Tone.Noise('pink');
    const filter = new Tone.Filter(600, 'bandpass');
    const gain = new Tone.Gain(0.0);
    const lfo = new Tone.LFO({ frequency: 0.25, min: 0, max: 1 });
    const lfoGain = new Tone.Gain(0);

    noise.connect(filter);
    filter.connect(gain);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    gain.toDestination();

    let running = false;

    return {
      start() {
        if (running) return;
        noise.start();
        lfo.start();
        running = true;
      },
      stop() {
        noise.stop();
        lfo.stop();
        running = false;
      },
      setLoad(load: number) {
        const effort = Math.pow(Math.max(0, Math.min(1, load)), 1.55);
        const breathRate = 0.18 + effort * 1.05;
        lfo.frequency.rampTo(breathRate, 0.6);
        lfoGain.gain.rampTo(effort * 0.23, 0.45);
        filter.frequency.rampTo(360 + effort * 680, 0.65);
      },
    };
  }
}
