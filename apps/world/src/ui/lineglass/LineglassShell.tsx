import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { resolveLineglassModules, nextModuleIndex } from './model';
import type {
  LineglassCapability,
  LineglassMode,
  LineglassModuleDefinition,
  LineglassStatus,
  LineglassValueSource,
} from './types';
import './lineglass.css';

const MODES: LineglassMode[] = ['inspect', 'tune', 'author', 'system'];
const SOURCES: LineglassValueSource[] = ['profile', 'override', 'live'];
const PREFERENCE_KEY = 'dissonance.dev-lineglass.ui.v1';

type LineglassPreferences = {
  mode?: LineglassMode;
  openByMode?: Partial<Record<LineglassMode, string>>;
};

function loadPreferences(initialMode: LineglassMode): Required<LineglassPreferences> {
  const fallback = { mode: initialMode, openByMode: { inspect: 'context', tune: 'world' } };
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCE_KEY) ?? 'null') as LineglassPreferences | null;
    const mode = parsed?.mode && MODES.includes(parsed.mode) ? parsed.mode : fallback.mode;
    return { mode, openByMode: { ...fallback.openByMode, ...parsed?.openByMode } };
  } catch {
    return fallback;
  }
}

function statusLabel(status: LineglassStatus): string {
  return status === 'normal' ? 'normal' : status;
}

function SourceBadge({ source }: { source: LineglassValueSource }) {
  return <span class={`lineglass-value-source lineglass-value-source--${source}`}>{source}</span>;
}

export interface LineglassShellProps {
  modules: LineglassModuleDefinition[];
  capabilities: LineglassCapability[];
  initialMode?: LineglassMode;
}

export function LineglassShell({
  modules,
  capabilities,
  initialMode = 'inspect',
}: LineglassShellProps) {
  const initialPreferences = useMemo(() => loadPreferences(initialMode), [initialMode]);
  const [mode, setMode] = useState<LineglassMode>(initialPreferences.mode);
  const [openByMode, setOpenByMode] = useState<Partial<Record<LineglassMode, string>>>(
    initialPreferences.openByMode,
  );
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const capabilitySet = useMemo(() => new Set(capabilities), [capabilities]);
  const visibleModules = resolveLineglassModules(modules, mode, capabilitySet);
  const visibleIds = new Set(visibleModules.map((module) => module.id));
  const openId = openByMode[mode];

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ mode, openByMode }));
    } catch {
      // UI preferences are optional; storage denial must not hide the HUD.
    }
  }, [mode, openByMode]);

  const selectMode = (nextMode: LineglassMode) => {
    setMode(nextMode);
    queueMicrotask(() => {
      const first = resolveLineglassModules(modules, nextMode, capabilitySet)[0];
      if (first) rowRefs.current.get(first.id)?.focus();
    });
  };

  const toggleModule = (id: string) => {
    setOpenByMode((current) => ({ ...current, [mode]: current[mode] === id ? undefined : id }));
  };

  const onRowKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLButtonElement>, id: string) => {
    const index = visibleModules.findIndex((module) => module.id === id);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = nextModuleIndex(index, event.key === 'ArrowDown' ? 1 : -1, visibleModules.length);
      rowRefs.current.get(visibleModules[next].id)?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpenByMode((current) => ({ ...current, [mode]: undefined }));
    }
  };

  return (
    <section class='lineglass' aria-label='Dissonance Dev Lineglass'>
      <header class='lineglass__header'>
        <div>
          <strong>DISSONANCE</strong>
          <span>DEV LINEGLASS</span>
        </div>
        <div class='lineglass__device-id'>LG-03<br /><time>LIVE</time></div>
      </header>

      <div class='lineglass__tabs' role='tablist' aria-label='Lineglass mode'>
        {MODES.map((candidate) => (
          <button
            type='button'
            role='tab'
            aria-selected={mode === candidate}
            class={mode === candidate ? 'is-active' : ''}
            onClick={() => selectMode(candidate)}
          >
            {candidate}
          </button>
        ))}
      </div>

      <div class='lineglass__modules'>
        {modules.map((module) => {
          const summary = module.summary();
          const isVisible = visibleIds.has(module.id);
          const isOpen = isVisible && openId === module.id;
          const status = module.status ?? 'normal';
          return (
            <article
              key={module.id}
              class={`lineglass-module lineglass-module--${status}${isOpen ? ' is-open' : ''}`}
              hidden={!isVisible}
            >
              <button
                type='button'
                class='lineglass-module__row'
                aria-expanded={isOpen}
                aria-controls={`lineglass-panel-${module.id}`}
                ref={(node) => {
                  if (node) rowRefs.current.set(module.id, node);
                  else rowRefs.current.delete(module.id);
                }}
                onClick={() => toggleModule(module.id)}
                onKeyDown={(event) => onRowKeyDown(event, module.id)}
              >
                <span class='lineglass-module__icon' aria-hidden='true'>{module.icon}</span>
                <span class='lineglass-module__copy'>
                  <span class='lineglass-module__label'>
                    <i aria-label={statusLabel(status)} />
                    {module.label}
                  </span>
                  <span class='lineglass-module__summary'>
                    {summary.primary}{summary.secondary ? ` · ${summary.secondary}` : ''}
                  </span>
                  {module.source && <SourceBadge source={module.source} />}
                </span>
                {(summary.badge || module.overrideCount) && (
                  <span class='lineglass-module__badge'>
                    {summary.badge ?? module.overrideCount}
                  </span>
                )}
                <span class='lineglass-module__chevron' aria-hidden='true'>{isOpen ? '⌃' : '›'}</span>
              </button>
              <div
                id={`lineglass-panel-${module.id}`}
                class='lineglass-module__panel'
                hidden={!isOpen}
                onClick={(event) => event.stopPropagation()}
              >
                {module.rootIds.map((rootId) => <div key={rootId} id={rootId} />)}
              </div>
            </article>
          );
        })}
      </div>

      <footer class='lineglass__legend' aria-label='Value source legend'>
        {SOURCES.map((source) => <span class={`lineglass-source lineglass-source--${source}`}>{source}</span>)}
      </footer>
    </section>
  );
}
