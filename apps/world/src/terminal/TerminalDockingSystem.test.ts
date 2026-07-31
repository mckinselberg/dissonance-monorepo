import { describe, expect, it } from 'vitest';
import { TerminalDockingSystem, type TerminalDockingConfig } from './TerminalDockingSystem';

const config: TerminalDockingConfig = {
  availableDistance: 3,
  dockingDurationSeconds: 2,
  undockingDurationSeconds: 1,
};

describe('TerminalDockingSystem', () => {
  it('exposes docking only inside proximity in the active world', () => {
    const docking = new TerminalDockingSystem(config);

    expect(docking.update(0, { activeWorld: false, distanceToDock: 1 }).state).toBe('far');
    expect(docking.update(0, { activeWorld: true, distanceToDock: 4 }).state).toBe('far');
    expect(docking.update(0, { activeWorld: true, distanceToDock: 3 }).state).toBe('available');
    expect(docking.update(0, { activeWorld: false, distanceToDock: 1 }).state).toBe('far');
  });

  it('blocks world input throughout docking and the docked state', () => {
    const docking = new TerminalDockingSystem(config);
    docking.update(0, { activeWorld: true, distanceToDock: 1 });

    expect(docking.requestDock()).toBe(true);
    expect(docking.blocksWorldInput).toBe(true);
    expect(docking.update(1, { activeWorld: true, distanceToDock: 1 })).toEqual({
      state: 'docking',
      transitionProgress: 0.5,
      blocksWorldInput: true,
    });
    expect(docking.update(1, { activeWorld: true, distanceToDock: 1 }).state).toBe('docked');
    expect(docking.blocksWorldInput).toBe(true);
    expect(docking.requestDock()).toBe(false);
  });

  it('keeps input blocked until undocking completes', () => {
    const docking = new TerminalDockingSystem(config);
    docking.update(0, { activeWorld: true, distanceToDock: 1 });
    docking.requestDock();
    docking.update(2, { activeWorld: true, distanceToDock: 1 });

    expect(docking.requestUndock()).toBe(true);
    expect(docking.update(0.5, { activeWorld: true, distanceToDock: 1 })).toEqual({
      state: 'undocking',
      transitionProgress: 0.5,
      blocksWorldInput: true,
    });
    expect(docking.update(0.5, { activeWorld: true, distanceToDock: 1 })).toEqual({
      state: 'available',
      transitionProgress: 0,
      blocksWorldInput: false,
    });
  });

  it('undocks safely when proximity or the active world disappears', () => {
    const docking = new TerminalDockingSystem(config);
    docking.update(0, { activeWorld: true, distanceToDock: 1 });
    docking.requestDock();
    docking.update(2, { activeWorld: true, distanceToDock: 1 });

    expect(docking.update(0, { activeWorld: false, distanceToDock: 1 }).state).toBe('undocking');
    expect(docking.update(1, { activeWorld: false, distanceToDock: 1 })).toEqual({
      state: 'far',
      transitionProgress: 0,
      blocksWorldInput: false,
    });
  });

  it('allows a docking request to be cancelled through the same undocking path', () => {
    const docking = new TerminalDockingSystem(config);
    docking.update(0, { activeWorld: true, distanceToDock: 1 });
    docking.requestDock();
    docking.update(0.5, { activeWorld: true, distanceToDock: 1 });

    expect(docking.requestUndock()).toBe(true);
    expect(docking.getState()).toBe('undocking');
    expect(docking.update(1, { activeWorld: true, distanceToDock: 1 }).state).toBe('available');
  });
});
