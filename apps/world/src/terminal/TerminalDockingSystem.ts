export type TerminalDockingState =
  | 'far'
  | 'available'
  | 'docking'
  | 'docked'
  | 'undocking';

export type TerminalDockingConfig = Readonly<{
  availableDistance: number;
  dockingDurationSeconds: number;
  undockingDurationSeconds: number;
}>;

export type TerminalDockingUpdate = Readonly<{
  activeWorld: boolean;
  distanceToDock: number;
}>;

export type TerminalDockingSnapshot = Readonly<{
  state: TerminalDockingState;
  transitionProgress: number;
  blocksWorldInput: boolean;
}>;

function requireFiniteNonNegative(label: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`[TerminalDockingSystem] ${label} must be finite and non-negative`);
  }
}

function requireFinitePositive(label: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`[TerminalDockingSystem] ${label} must be finite and positive`);
  }
}

/**
 * Pure interaction state for one terminal and one authored dock.
 *
 * World code supplies proximity and whether the owning world session is active;
 * this class deliberately knows nothing about Babylon, Preact, input listeners,
 * persistence, or terminal consumers.
 */
export class TerminalDockingSystem {
  private state: TerminalDockingState = 'far';
  private transitionElapsedSeconds = 0;
  private dockAvailable = false;
  private readonly config: TerminalDockingConfig;

  constructor(config: TerminalDockingConfig) {
    requireFinitePositive('availableDistance', config.availableDistance);
    requireFinitePositive('dockingDurationSeconds', config.dockingDurationSeconds);
    requireFinitePositive('undockingDurationSeconds', config.undockingDurationSeconds);
    this.config = { ...config };
  }

  get blocksWorldInput(): boolean {
    return this.state === 'docking' || this.state === 'docked' || this.state === 'undocking';
  }

  getState(): TerminalDockingState {
    return this.state;
  }

  snapshot(): TerminalDockingSnapshot {
    return Object.freeze({
      state: this.state,
      transitionProgress: this.transitionProgress(),
      blocksWorldInput: this.blocksWorldInput,
    });
  }

  update(deltaSeconds: number, input: TerminalDockingUpdate): TerminalDockingSnapshot {
    requireFiniteNonNegative('deltaSeconds', deltaSeconds);
    requireFiniteNonNegative('distanceToDock', input.distanceToDock);
    this.dockAvailable = input.activeWorld && input.distanceToDock <= this.config.availableDistance;

    switch (this.state) {
      case 'far':
        if (this.dockAvailable) this.setState('available');
        break;
      case 'available':
        if (!this.dockAvailable) this.setState('far');
        break;
      case 'docking':
        if (!this.dockAvailable) {
          this.setState('undocking');
          break;
        }
        this.transitionElapsedSeconds += deltaSeconds;
        if (this.transitionElapsedSeconds >= this.config.dockingDurationSeconds) {
          this.setState('docked');
        }
        break;
      case 'docked':
        if (!this.dockAvailable) this.setState('undocking');
        break;
      case 'undocking':
        this.transitionElapsedSeconds += deltaSeconds;
        if (this.transitionElapsedSeconds >= this.config.undockingDurationSeconds) {
          this.setState(this.dockAvailable ? 'available' : 'far');
        }
        break;
    }

    return this.snapshot();
  }

  requestDock(): boolean {
    if (this.state !== 'available' || !this.dockAvailable) return false;
    this.setState('docking');
    return true;
  }

  requestUndock(): boolean {
    if (this.state !== 'docking' && this.state !== 'docked') return false;
    this.setState('undocking');
    return true;
  }

  private transitionProgress(): number {
    if (this.state === 'docking') {
      return Math.min(1, this.transitionElapsedSeconds / this.config.dockingDurationSeconds);
    }
    if (this.state === 'undocking') {
      return Math.min(1, this.transitionElapsedSeconds / this.config.undockingDurationSeconds);
    }
    return 0;
  }

  private setState(state: TerminalDockingState): void {
    this.state = state;
    this.transitionElapsedSeconds = 0;
  }
}
