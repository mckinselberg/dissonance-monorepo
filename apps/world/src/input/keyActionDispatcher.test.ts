import { describe, expect, it } from 'vitest';
import { createKeyActionDispatcher, isTextEntryTarget } from './keyActionDispatcher';

// No jsdom in this workspace, so tests use Node's native EventTarget/Event
// (both available as globals) plus a KeyboardEvent-shaped payload attached
// via property assignment — the dispatcher only ever type-asserts to
// KeyboardEvent, it never checks the constructor at runtime.
function keydown(code: string, extra?: Partial<KeyboardEvent>): KeyboardEvent {
  const event = new Event('keydown', { cancelable: true, bubbles: true });
  return Object.assign(event, { code, repeat: false, shiftKey: false, ...extra }) as unknown as KeyboardEvent;
}

function keyup(code: string): KeyboardEvent {
  return Object.assign(new Event('keyup'), { code, repeat: false, shiftKey: false }) as unknown as KeyboardEvent;
}

describe('createKeyActionDispatcher', () => {
  it('dispatches to a matching binding in registration order by default', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    dispatcher.register({ id: 'a', phase: 'keydown', code: 'KeyE', handler: () => calls.push('a') });
    dispatcher.register({ id: 'b', phase: 'keydown', code: 'KeyE', handler: () => calls.push('b') });

    target.dispatchEvent(keydown('KeyE'));

    expect(calls).toEqual(['a']);
  });

  it('orders bindings by priority, not registration order, within the same phase/capture group', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    dispatcher.register({ id: 'low', phase: 'keydown', code: 'KeyE', priority: 10, handler: () => calls.push('low') });
    dispatcher.register({ id: 'high', phase: 'keydown', code: 'KeyE', priority: 0, handler: () => calls.push('high') });

    target.dispatchEvent(keydown('KeyE'));

    expect(calls).toEqual(['high']);
  });

  it('falls through to the next binding when an earlier guard fails', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    dispatcher.register({
      id: 'guarded',
      phase: 'keydown',
      code: 'KeyE',
      priority: 0,
      when: () => false,
      handler: () => calls.push('guarded'),
    });
    dispatcher.register({ id: 'fallback', phase: 'keydown', code: 'KeyE', priority: 10, handler: () => calls.push('fallback') });

    target.dispatchEvent(keydown('KeyE'));

    expect(calls).toEqual(['fallback']);
  });

  it('does not stop dispatch when consume is false', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    dispatcher.register({ id: 'first', phase: 'keydown', code: 'KeyE', priority: 0, consume: false, handler: () => calls.push('first') });
    dispatcher.register({ id: 'second', phase: 'keydown', code: 'KeyE', priority: 10, handler: () => calls.push('second') });

    target.dispatchEvent(keydown('KeyE'));

    expect(calls).toEqual(['first', 'second']);
  });

  it('matches an array of codes', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    dispatcher.register({ id: 'wOrS', phase: 'keydown', code: ['KeyW', 'KeyS'], handler: (e) => calls.push(e.code) });

    target.dispatchEvent(keydown('KeyW'));
    target.dispatchEvent(keydown('KeyS'));
    target.dispatchEvent(keydown('KeyD'));

    expect(calls).toEqual(['KeyW', 'KeyS']);
  });

  it('keeps capture and bubble bindings, and keydown and keyup bindings, independent', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    dispatcher.register({ id: 'capture', phase: 'keydown', code: 'KeyE', capture: true, handler: () => calls.push('capture') });
    dispatcher.register({ id: 'bubble', phase: 'keydown', code: 'KeyE', capture: false, handler: () => calls.push('bubble') });
    dispatcher.register({ id: 'up', phase: 'keyup', code: 'KeyE', handler: () => calls.push('up') });

    target.dispatchEvent(keydown('KeyE'));
    target.dispatchEvent(keyup('KeyE'));

    expect(calls).toEqual(['capture', 'bubble', 'up']);
  });

  it('calls stopImmediatePropagation only when a binding opts in', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    dispatcher.register({ id: 'stops', phase: 'keydown', code: 'KeyE', stopPropagation: true, handler: () => {} });

    const event = keydown('KeyE');
    let called = false;
    event.stopImmediatePropagation = () => { called = true; };

    target.dispatchEvent(event);

    expect(called).toBe(true);
  });

  it('removes a binding from dispatch once unregistered', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    const unregister = dispatcher.register({ id: 'a', phase: 'keydown', code: 'KeyE', handler: () => calls.push('a') });

    unregister();
    target.dispatchEvent(keydown('KeyE'));

    expect(calls).toEqual([]);
  });

  it('stops dispatching to any binding after dispose', () => {
    const target = new EventTarget();
    const dispatcher = createKeyActionDispatcher(target);
    const calls: string[] = [];
    dispatcher.register({ id: 'a', phase: 'keydown', code: 'KeyE', handler: () => calls.push('a') });

    dispatcher.dispose();
    target.dispatchEvent(keydown('KeyE'));

    expect(calls).toEqual([]);
  });
});

describe('isTextEntryTarget', () => {
  function fakeElement(matchesSelector: (selector: string) => boolean, isContentEditable = false) {
    return { isContentEditable, closest: (selector: string) => (matchesSelector(selector) ? {} : null) };
  }

  it('treats content-editable elements as text entry', () => {
    const target = fakeElement(() => false, true);
    expect(isTextEntryTarget(target as unknown as EventTarget)).toBe(true);
  });

  it('treats elements matching the text-entry selector as text entry', () => {
    const input = fakeElement((selector) => selector.includes('input'));
    expect(isTextEntryTarget(input as unknown as EventTarget)).toBe(true);
  });

  it('treats non-matching elements as not text entry', () => {
    const div = fakeElement(() => false);
    expect(isTextEntryTarget(div as unknown as EventTarget)).toBe(false);
  });

  it('excludes buttons by default but includes them when includeButtons is set', () => {
    const button = fakeElement((selector) => selector.includes('button'));
    expect(isTextEntryTarget(button as unknown as EventTarget)).toBe(false);
    expect(isTextEntryTarget(button as unknown as EventTarget, { includeButtons: true })).toBe(true);
  });

  it('treats null and non-element targets as not text entry', () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(new EventTarget())).toBe(false);
  });
});
