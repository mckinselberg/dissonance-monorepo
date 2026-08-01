# sound-as-control-prompt-v1.md — Handoff Prompt (T9)

**Supersedes:** `Oscilloscope_prompt` (Godot 4.6 — discarded engine, retained as design reference only).
**Thread:** T9 (Layer 5 — Mechanics).
**Gating:** implementation session may not open until **T3 pursuer extraction has landed** (`@dta/audio` is single-writer; T3 owns it until then). This document may be refined on paper at any time.
**Session scope:** one package per session per conflict rules. This prompt expects the session to create `packages/sound-control` and touch `@dta/audio` only through its public API. Out-of-bounds: pursuer package internals, `@dta/world`, `@dta/engine` core.

---

## Phase 0 — Audit gate (mandatory, before any code)

1. Confirm T3 has landed and `@dta/audio` exposes: master chain, named buses (spatial / ambient-beds / interior / music-synth), and a way to attach analyser taps. Record actual API surface.
2. Confirm the AudioContext unlock flow (user gesture) exists and where it lives.
3. Confirm Zustand store conventions in the repo (store-per-package vs. central) and Vitest setup.
4. Confirm whether the T4 drone embodiment (waveform locomotion) exists yet. If yes, note the `EmbodimentProfile` parameter names for entrainment (§5). If no, stub the seam and flag it.
5. Report findings and **stop for sign-off** before Phase 1.

---

## 1. Design goal

Prototype the core Dissonance mechanic: the player emits a signal; a Synod drone's behavior degrades or inverts based on how closely that signal matches a target frequency; the player reads everything through an oscilloscope, not a tutorial.

Player experience goal: *tuning*, not shooting. Tension comes from holding a fragile match while a detection meter punishes loudness. Precision under restraint — control vs. expression as a hand skill.

This is a systems prototype, not a level. Primitive visuals, no assets.

## 2. Architecture (respects D1 / D1a — frozen, do not relitigate)

| Concern | Where it runs | Why |
|---|---|---|
| Player signal generation | Tone.js oscillator on **main thread**, routed into the `music-synth` bus | D1: Tone owns the AudioContext; the future polyphonic synth is native Tone territory |
| Target signal | Second Tone oscillator, **muted** (analysis-only tap) — it exists as a reference waveform, not audible sound | The target is SignalNet's sanctioned waveform; the world doesn't play it for you |
| Waveform capture | `Tone.Analyser` (waveform + FFT) taps on both signals | Signal-level access is why Tone was chosen |
| Match scoring | **Web worker**: analyser frames posted out, score posted back | D1a(3): FFT match scoring is game logic, not audio rendering |
| Oscilloscope render | HTML `<canvas>` 2D overlay, drawn from analyser waveform buffers in rAF | Cheapest correct thing; Babylon GUI adds nothing here |
| Drone state + visuals | BabylonJS scene, driven by match score from the Zustand store | Standard render path |
| State | Zustand store: `matchScore`, `droneState`, `detection`, `playerFrequency`, `playerAmplitude`, `targetFrequency` | Single source of truth; UI and scene both subscribe |

No AudioWorklet needed at this stage — built-in oscillators suffice. Note the seam for later custom synthesis (D1a(2)).

## 3. Package structure

```
packages/sound-control/
  src/
    constants.ts          // every tunable — no magic numbers anywhere else
    store.ts              // Zustand store + actions
    signal/
      PlayerSignal.ts     // Tone oscillator wrapper: setFrequency / setAmplitude
      TargetSignal.ts     // muted reference oscillator
      AnalyserTaps.ts     // waveform + FFT frame extraction
    scoring/
      matchScore.ts       // PURE function: (playerFFT, targetFFT|freqs) → 0..1
      scoring.worker.ts   // worker shell around matchScore
    drone/
      DroneStateMachine.ts // IDLE | CONFUSED | CONTROLLED, threshold-driven
      DroneVisual.ts       // Babylon primitive (box/sphere), color per state
    ui/
      Oscilloscope.ts      // canvas overlay: player trace + faint target overlay
      DetectionMeter.ts    // bar; rises with amplitude, decays over time
    input/
      keyboardControl.ts   // arrows: L/R frequency, U/D amplitude (temp — see §7)
    index.ts               // prototype scene bootstrap
  test/
    matchScore.test.ts     // Vitest — pure-function coverage, no audio needed
    droneStateMachine.test.ts
```

## 4. System rules (ported + revised from the Godot doc)

**Constants (names final, values provisional — all in `constants.ts`):**

```
FREQ_MIN / FREQ_MAX            // playable band, e.g. 80–880 Hz
FREQ_STEP_PER_SECOND           // held-key sweep rate
AMP_MIN / AMP_MAX / AMP_STEP_PER_SECOND
MATCH_IDLE_BELOW      = 0.3
MATCH_CONTROLLED_ABOVE = 0.7   // between the two → CONFUSED
MATCH_HYSTERESIS      = 0.05   // prevent state flicker at thresholds
DETECTION_RISE_PER_AMP        // detection gain ∝ amplitude
DETECTION_DECAY_PER_SECOND
DETECTION_MAX
SCORE_SMOOTHING_ALPHA          // EMA over worker scores; raw FFT scores are jittery
WORKER_FRAME_INTERVAL_MS       // don't post every rAF; ~30–60ms is plenty
```

**Match scoring (`matchScore.ts`, pure):**
- v1: dominant-bin comparison — extract peak frequency from player FFT, score `1 - clamp(|f_player - f_target| / TOLERANCE_HZ, 0, 1)` with a smooth falloff curve, not linear.
- Must be a pure function of typed-array inputs → deterministic Vitest coverage with synthetic FFT frames. No Tone imports in this file.
- Seam comment for v2: spectral-envelope correlation (multi-partial matching) once the polyphonic synth exists.

**Drone state machine:**
- IDLE (< 0.3): holds position/route, neutral gray.
- CONFUSED (0.3–0.7): slow rotation drift, amber.
- CONTROLLED (> 0.7): follows player position at fixed speed, teal-green.
- Hysteresis on both thresholds. State transitions emit through the store — nothing reads Tone directly except the signal layer.

**Detection meter:**
- `detection += amplitude * DETECTION_RISE_PER_AMP * dt; detection -= DETECTION_DECAY_PER_SECOND * dt` (clamped).
- The core trade: a strong match is easier to *hold* at higher amplitude, but amplitude feeds detection. Tune so the winning play is a quiet, precise match.
- Prototype-local for now; seam comment noting T5 will eventually consume detection state for environment reactivity. Do not integrate with T5 in this session.

**Oscilloscope UI:**
- Player trace: bright line from waveform analyser buffer.
- Target trace: faint overlay from the muted reference analyser.
- Match feedback is *visual convergence of the traces* — the meterless read. A numeric debug readout is fine behind a dev flag, but the intended perception channel is the shapes aligning.

## 5. Drone entrainment seam (from T13 extraction doc §2a)

When the T4 waveform-locomotion drone exists, CONTROLLED state additionally entrains the drone's `EmbodimentProfile` locomotion parameters toward the player signal:

- `spatialFrequency` lerps toward a mapping of `playerFrequency`
- `bobAmplitude` lerps toward a mapping of `playerAmplitude`

The tell that you have control is the drone's *body moving to your waveform* — oscilloscope and world converge. In this prototype, stub it: expose `entrainmentTarget` in the store, consume it in `DroneVisual` as a simple bob on the primitive so the seam is proven.

## 6. Diegetic framing (keep in comments, keep out of UI text)

- The target frequency is a sanctioned SignalNet carrier; matching it is impersonating infrastructure, not "casting sound magic."
- The oscilloscope is a tool Milo would plausibly have from data-sanitation work.
- No UI copy that explains the fiction. The prototype has zero words on screen beyond dev-flag debug values.

## 7. Explicitly future (seam comments only, no implementation)

- Microphone input replacing keyboard control (getUserMedia → analyser; same scoring path).
- Polyphonic synth keys as the input device (D1 music-synth bus; likely the diegetic hacking interface).
- Multi-drone: N state machines subscribing to one score — architecture must not assume a singleton drone even though v1 spawns one.
- Real spectral matching (v2 scorer).

## 8. Acceptance

1. Arrow keys sweep frequency/amplitude; oscilloscope traces update live and visibly converge near match.
2. Drone transitions IDLE → CONFUSED → CONTROLLED with hysteresis; no flicker at thresholds.
3. Detection rises with amplitude, decays at rest; values tunable from `constants.ts` alone.
4. `matchScore` and `DroneStateMachine` fully covered by Vitest with no audio context required.
5. Scoring runs in the worker; main thread never computes FFT comparisons.
6. No second code path into the engine; no writes outside `packages/sound-control` and declared `@dta/audio` API usage.
7. THREADS.md updated at session end (T9 status, owning doc field).

## 9. Risks

- **Analyser jitter** → raw scores oscillate; the EMA constant exists for this. If CONFUSED flickers anyway, widen hysteresis before touching thresholds.
- **Worker round-trip latency** → score lags input by a frame or two; acceptable for tuning feel, unacceptable if it grows — keep frames small (dominant-bin only needs the FFT array, nothing else).
- **AudioContext unlock** → prototype must reuse the existing gesture flow from Phase 0(2), not add its own.
