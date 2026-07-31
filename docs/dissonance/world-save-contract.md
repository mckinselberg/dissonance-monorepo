# World save contract

World durable progression is owned by
`apps/world/src/state/worldSave.ts`. Its storage key is
`dissonance:world-save:v1`. It does not read, write, migrate, or clear the
museum/DTA key `dta_player_state`.

## Ownership

| State | Owner | Durable |
|---|---|---|
| story flags | World save | yes |
| recovered hardware | World save inventory | yes |
| Lineglass part IDs | World save inventory | yes |
| last safe exterior transform and traversal mode | World save | yes |
| Milo flashlight enabled state | World save equipment | yes |
| active exterior/workshop/surveillance route | World save | yes, diagnostic/recovery |
| atmosphere, visibility, audio, scale, HUD tuning | per-level settings | yes, preferences |
| camera/view presets | view snapshot | authored/exported |
| run seed | World session | session only |
| breath, velocity, strike windup, interior camera | owning runtime systems | no |

The active route records where a save occurred, but interiors are not reload
targets: their cameras and procedural meshes are runtime resources. Reloading
from an interior deliberately resumes at `lastExterior` and immediately
normalizes the saved route to `exterior`.

## Version 1

```ts
type WorldSaveDocument = {
  version: 1;
  savedAt: number;
  activeRoute: 'exterior' | 'workshop' | 'surveillance';
  lastExterior: {
    levelKey: string;
    mode: 'walk' | 'fly' | 'drive';
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  } | null;
  equipment: {
    flashlightEnabled: boolean;
  };
  progression: {
    storyFlags: string[];
    inventory: {
      lineglassPartIds: string[];
      hardwareIds: string[];
    };
  };
};
```

Updates replace the complete versioned document. Arrays are deduplicated and
sorted before writing. View snapshots no longer export Lineglass inventory.

The first stable hardware IDs are centralized in `WORLD_HARDWARE_IDS`:

- `patrol-drone-emitter`;
- `boulevard-patrol-01-chassis`.

Workshop inventory-as-room meshes are presentation consumers of these IDs.
They may hide or reveal independently, but they never write progression or
infer ownership from mesh visibility; the World save remains authoritative.
On load, known acquisition flags repair any missing corresponding hardware ID;
`chassisRecovered` also restores the app-local exterior-drone suppression.

## One-time compatibility

When no v1 World save exists, the store seeds itself from the previous
World-only locations:

- `dissonance:world-story-flags:v1`;
- `lineglassPartIds` and the last exterior transform in per-level settings.

Legacy values remain untouched as a recovery fallback. Once v1 exists it is
authoritative; subsequent changes do not dual-write progression into legacy
keys.
