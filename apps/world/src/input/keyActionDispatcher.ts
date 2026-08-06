export type KeyPhase = 'keydown' | 'keyup';

export interface KeyBinding {
  /** Debug identity, unique per binding. */
  id: string;
  phase: KeyPhase;
  /** KeyboardEvent.code(s) to match. Omit to match every code in this phase. */
  code?: string | readonly string[];
  /** Bubble (default) or capture. All capture bindings run before all bubble
   * bindings for the same phase, matching native DOM event order. */
  capture?: boolean;
  /** Dispatch order within the same phase+capture group; lower runs first.
   * Default 0, ties broken by registration order. */
  priority?: number;
  /** Full guard for whether this binding actually applies — must encode the
   * complete condition (not just an early-return), since a passing guard
   * consumes the event by default and stops later bindings from running. */
  when?: (event: KeyboardEvent) => boolean;
  handler: (event: KeyboardEvent) => void;
  preventDefault?: boolean;
  /** Real event.stopImmediatePropagation() — reserve for bindings that must
   * suppress every other listener on this target (e.g. system-level capture
   * bindings), since it also blocks listeners the dispatcher doesn't own. */
  stopPropagation?: boolean;
  /** Stop trying further same-phase/capture bindings once this one's guard
   * passes. Default true (first-match-wins). */
  consume?: boolean;
}

export interface KeyActionDispatcher {
  register(binding: KeyBinding): () => void;
  dispose(): void;
}

function matchesCode(binding: KeyBinding, event: KeyboardEvent): boolean {
  if (binding.code === undefined) return true;
  return Array.isArray(binding.code) ? binding.code.includes(event.code) : binding.code === event.code;
}

function sortByPriority(bindings: KeyBinding[]): KeyBinding[] {
  return bindings
    .map((binding, index) => ({ binding, index }))
    .sort((a, b) => (a.binding.priority ?? 0) - (b.binding.priority ?? 0) || a.index - b.index)
    .map((entry) => entry.binding);
}

export function createKeyActionDispatcher(target: EventTarget = window): KeyActionDispatcher {
  const all: KeyBinding[] = [];

  const dispatch = (phase: KeyPhase, capture: boolean) => (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    const candidates = sortByPriority(
      all.filter((binding) => binding.phase === phase && !!binding.capture === capture),
    );
    for (const binding of candidates) {
      if (!matchesCode(binding, keyboardEvent)) continue;
      if (binding.when && !binding.when(keyboardEvent)) continue;
      if (binding.preventDefault) keyboardEvent.preventDefault();
      if (binding.stopPropagation) keyboardEvent.stopImmediatePropagation();
      binding.handler(keyboardEvent);
      if (binding.consume ?? true) return;
    }
  };

  const listeners: Array<[KeyPhase, boolean, EventListener]> = [
    ['keydown', true, dispatch('keydown', true)],
    ['keydown', false, dispatch('keydown', false)],
    ['keyup', true, dispatch('keyup', true)],
    ['keyup', false, dispatch('keyup', false)],
  ];
  for (const [phase, capture, listener] of listeners) {
    target.addEventListener(phase, listener, { capture });
  }

  return {
    register(binding: KeyBinding): () => void {
      all.push(binding);
      return () => {
        const index = all.indexOf(binding);
        if (index !== -1) all.splice(index, 1);
      };
    },
    dispose(): void {
      for (const [phase, capture, listener] of listeners) {
        target.removeEventListener(phase, listener, { capture });
      }
      all.length = 0;
    },
  };
}

/** Whether a keyboard event target is text-entry — the guard shared by every
 * binding that must not fire while the player is typing into a field. Two
 * variants exist because some interactions (e.g. a focused toggle button)
 * still need to respond to a key press after being clicked. */
interface ElementLike {
  isContentEditable?: boolean;
  closest(selector: string): unknown;
}

function isElementLike(target: EventTarget | null): target is EventTarget & ElementLike {
  return target !== null && typeof (target as Partial<ElementLike>).closest === 'function';
}

export function isTextEntryTarget(
  target: EventTarget | null,
  options?: { includeButtons?: boolean },
): boolean {
  if (!isElementLike(target)) return false;
  if (target.isContentEditable) return true;
  const selector = options?.includeButtons
    ? 'input, select, textarea, button, [contenteditable]'
    : 'input, select, textarea, [contenteditable]';
  return target.closest(selector) !== null;
}
