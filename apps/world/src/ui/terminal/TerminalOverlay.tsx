import type { Signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type {
  AuthorizedTerminalDialogue,
  TerminalDockingSnapshot,
  TerminalDockingState,
} from '../../terminal';
import './terminal.css';

export interface TerminalOverlayProps {
  state: Signal<TerminalDockingSnapshot>;
  messages: Signal<readonly AuthorizedTerminalDialogue[]>;
  terminalId: string;
  terminalName: string;
  onUndock: () => void;
}

function stateLabel(state: TerminalDockingState): string {
  switch (state) {
    case 'docking':
      return 'LOCAL DOCK SEQUENCING';
    case 'docked':
      return 'LOCAL SESSION READY';
    case 'undocking':
      return 'LOCAL RELEASE SEQUENCING';
    case 'far':
    case 'available':
      return 'STANDBY';
  }
}

export function TerminalOverlay({
  state,
  messages,
  terminalId,
  terminalName,
  onUndock,
}: TerminalOverlayProps) {
  const snapshot = state.value;
  const undockButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (snapshot.state !== 'docked') return;
    undockButton.current?.focus();
  }, [snapshot.state]);

  if (snapshot.state === 'far' || snapshot.state === 'available') return null;

  const titleId = `terminal-overlay-title-${terminalId}`;
  const statusId = `terminal-overlay-status-${terminalId}`;
  const patternId = `terminal-overlay-grid-${terminalId}`;
  const visibleMessages = messages.value.filter((message) => message.terminalId === terminalId);
  const progress = snapshot.state === 'docked' ? 1 : snapshot.transitionProgress;
  const percent = Math.round(progress * 100);

  return (
    <section
      class='terminal-overlay'
      data-state={snapshot.state}
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      aria-describedby={statusId}
      aria-busy={snapshot.state !== 'docked'}
    >
      <svg
        class='terminal-overlay__instrument'
        viewBox='0 0 100 100'
        preserveAspectRatio='none'
        aria-hidden='true'
        focusable='false'
      >
        <defs>
          <pattern id={patternId} width='5' height='5' patternUnits='userSpaceOnUse'>
            <path d='M 5 0 L 0 0 0 5' />
          </pattern>
        </defs>
        <rect width='100' height='100' fill={`url(#${patternId})`} />
        <path class='terminal-overlay__frame-line' d='M3 14 H97 M3 86 H97' />
        <path class='terminal-overlay__corner' d='M3 9 V3 H9 M91 3 H97 V9 M97 91 V97 H91 M9 97 H3 V91' />
        <line class='terminal-overlay__scan' x1='3' y1='0' x2='97' y2='0' />
      </svg>

      <div class='terminal-overlay__shell'>
        <header class='terminal-overlay__header'>
          <div>
            <p class='terminal-overlay__eyebrow'>PUBLIC SANITATION // LOCAL FIXTURE</p>
            <h1 id={titleId}>{terminalName}</h1>
            <code>{terminalId}</code>
          </div>
          <dl class='terminal-overlay__authority'>
            <div>
              <dt>MODE</dt>
              <dd>OFFLINE</dd>
            </div>
            <div>
              <dt>AUTHORITY</dt>
              <dd>IN-PROCESS / LOCAL</dd>
            </div>
          </dl>
        </header>

        <div class='terminal-overlay__transition' id={statusId} aria-live='polite'>
          <span>{stateLabel(snapshot.state)}</span>
          <progress value={progress} max={1} aria-label='Terminal transition progress' />
          <output aria-label='Terminal transition percentage'>{percent}%</output>
        </div>

        <main class='terminal-overlay__messages' aria-label='Authorized fixture messages'>
          <div class='terminal-overlay__section-heading'>
            <h2>AUTHORIZED FIXTURE MESSAGES</h2>
            <span>{visibleMessages.length.toString().padStart(2, '0')} RECORDS</span>
          </div>
          {visibleMessages.length === 0 ? (
            <p class='terminal-overlay__empty'>NO AUTHORIZED LOCAL FIXTURE MESSAGES</p>
          ) : (
            <ol>
              {visibleMessages.map((message) => (
                <li key={message.id}>
                  <header>
                    <span>SEQ {message.sequence.toString().padStart(3, '0')}</span>
                    <span>AUTHORIZED / LOCAL</span>
                  </header>
                  <p>{message.body}</p>
                  <footer>
                    <code>{message.fixtureMessageKey}</code>
                    <span>REV {message.simulationRevision}</span>
                  </footer>
                </li>
              ))}
            </ol>
          )}
        </main>

        <footer class='terminal-overlay__footer'>
          <span>LOCAL READ-ONLY PRESENTATION</span>
          <button
            ref={undockButton}
            type='button'
            disabled={snapshot.state !== 'docked'}
            onClick={onUndock}
          >
            Undock
          </button>
        </footer>
      </div>
    </section>
  );
}
