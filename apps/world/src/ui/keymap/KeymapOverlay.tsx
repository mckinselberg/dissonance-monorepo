import type { Signal } from '@preact/signals';
import './keymap.css';

interface KeymapEntry {
  keys: string[];
  action: string;
}

interface KeymapGroup {
  label: string;
  entries: KeymapEntry[];
}

// Curated, gameplay-relevant subset — not the full binding set (movement
// modifiers like fly/drive boost, dev-only camera controls, etc. are
// omitted). Static for now; wire to a real rebinding UI later.
const KEYMAP_GROUPS: KeymapGroup[] = [
  {
    label: 'Movement',
    entries: [
      { keys: ['W', 'A', 'S', 'D'], action: 'Move' },
      { keys: ['Shift'], action: 'Sprint' },
      { keys: ['Ctrl'], action: 'Crouch' },
    ],
  },
  {
    label: 'Interaction',
    entries: [
      { keys: ['E'], action: 'Interact / enter / exit' },
      { keys: ['L'], action: 'Toggle flashlight' },
    ],
  },
  {
    label: 'Companion',
    entries: [
      { keys: ['M'], action: 'Whistle selected melody' },
      { keys: ['1–9'], action: 'Select melody' },
      { keys: ['P'], action: 'Pet' },
    ],
  },
  {
    label: 'Interface',
    entries: [{ keys: ['I'], action: 'Toggle this panel' }],
  },
];

export interface KeymapOverlayProps {
  open: Signal<boolean>;
  onToggle: () => void;
}

export function KeymapOverlay({ open, onToggle }: KeymapOverlayProps) {
  const isOpen = open.value;
  return (
    <>
      <button
        type='button'
        class={`keymap-overlay-toggle${isOpen ? ' is-active' : ''}`}
        aria-pressed={isOpen}
        aria-label='Toggle keybindings panel'
        onClick={onToggle}
      >
        <span class='keymap-overlay-toggle__glyph' aria-hidden='true'>👻</span>
        <span>I</span>
      </button>
      {isOpen && (
        <section class='keymap-overlay' role='dialog' aria-label='Keybindings'>
          <header class='keymap-overlay__header'>
            <strong>Keybindings</strong>
            <span>Reference</span>
          </header>
          {KEYMAP_GROUPS.map((group) => (
            <div class='keymap-overlay__group' key={group.label}>
              <div class='keymap-overlay__group-label'>{group.label}</div>
              {group.entries.map((entry) => (
                <div class='keymap-overlay__row' key={entry.action}>
                  <div class='keymap-overlay__keys'>
                    {entry.keys.map((key) => (
                      <span class='keymap-overlay__key' key={key}>{key}</span>
                    ))}
                  </div>
                  <span class='keymap-overlay__action'>{entry.action}</span>
                </div>
              ))}
            </div>
          ))}
          <footer class='keymap-overlay__footer'>Not yet configurable — fixed bindings.</footer>
        </section>
      )}
    </>
  );
}
