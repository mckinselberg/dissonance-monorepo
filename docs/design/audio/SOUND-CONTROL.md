# Sound Control and Voice Rig

**Status:** blocked  
**Owning thread:** T9 / T20  
**Canonical scope:** Player-produced sound as authentication, interference, and embodied control  
**Does not own:** Generic audio mixing, pursuer extraction, or underground tonal culture  
**Runtime owner:** `packages/audio` plus a control module `VERIFY`  
**State owner:** session control state + authored acoustic/profile data `TBD`  
**Presentation owner:** Tone.js, oscilloscope/Lineglass feedback, controlled embodiment response  
**Depends on:** T20 typed acoustic domain and confirmed analyser/bus seams  
**Consumed by:** T4, T31/T34, future acoustic infrastructure  
**Decisions:** existing D1 bus names  
**Open questions:** O8, O10, O11  
**Last reviewed:** 2026-07-31

The canonical direction is a voice-rig/vocoder interaction in which live sound is
a world force and authentication is multidimensional. The old dominant-frequency
oscilloscope loop is useful prototype material but must not collapse this into a
single-number matching minigame.

No implementation has started. A new prompt must first audit the actual
`@dissonance/audio` exports, AudioContext gesture flow, test conventions, and T4
embodiment seam. It must use the real `@dissonance/*` scope and keep partial-match
consequences and waveform-driven embodiment perceptible in-world.

