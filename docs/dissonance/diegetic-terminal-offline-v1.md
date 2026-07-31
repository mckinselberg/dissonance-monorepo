# Diegetic terminal offline v1 (T29)

**Status:** offline v1 validated.
**Runtime owner:** `apps/world`.
**Fixture:** `public-sanitation-terminal-01`, Dissonance Boulevard.

## Purpose

This slice proves the offline T29 interaction boundary before any networking.
It gives one stable public-sanitation fixture a diegetic Preact/Signals terminal
surface over Babylon without turning the terminal into progression, inventory,
or a captured-drone controller.

The fixture is deliberately independent of O17. Milo does not need a chosen
credential story to read a public terminal; no trust tier, gatekeeper award, or
workshop/Rey Caverns placement is implied.

## Runtime contract

- The dock lifecycle is explicit: `far → available → docking → docked → undocking`.
- Docking transfers input focus from gameplay to the terminal. Undocking returns
  gameplay focus without allowing terminal keystrokes to trigger world actions.
- The terminal observes a read-only snapshot through Signals and submits intent
  through a narrow command seam; the Preact view does not reach into Babylon or
  mutate simulation state.
- The in-process Scrambler fixture exposes validated, authored
  public-sanitation messages. It has no player-authored send path and makes no
  claim of network or server authority.
- `public-sanitation-terminal-01` is stable authored identity. Labels and visual
  presentation may change without changing that ID.
- Its model, collider, and proximity radius share the authored-meter world
  scale, and its base samples the Boulevard compound's fitted grade rather than
  the raw DEM beneath the street pad.

## Validation

- Passed: all 22 World tests, including 15 focused docking, dialogue,
  placement-scale, and compound-grade tests.
- Passed: strict TypeScript and the production World build.
- Passed: user-confirmed World walkthrough of terminal availability, docking,
  readable authorized fixture content, undocking, and return to gameplay. The
  World Dev HUD retains its T29 state readout and
  `Go to public sanitation terminal` test shortcut for later tuning.

The offline-v1 runtime gate is closed. The deferred boundaries below remain in
force.

## Explicitly deferred

- T11 networking: WebSockets, WebRTC, sessions, reconnect, replication,
  provenance, factions, and server authority;
- World-save changes, terminal/message persistence, and durable message history;
- story flags, inventory, credentials, unlocks, awards, or other progression;
- T31 drone addressing/control, receiver feeds, recorded-feed review, piloting,
  repair-queue access, and interference behavior;
- terminal or receiver placement in Milo's workshop or Rey Caverns, including
  trust-economy and gatekeeper routes.

O17 must be decided before a terminal becomes T31's addressing/control surface.
It does not gate this read-only public fixture.
