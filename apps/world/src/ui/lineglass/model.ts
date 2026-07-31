import type {
  LineglassCapability,
  LineglassMode,
  LineglassModuleDefinition,
  LineglassValueSource,
} from './types';

export function resolveLineglassModules(
  modules: LineglassModuleDefinition[],
  mode: LineglassMode,
  capabilities: ReadonlySet<LineglassCapability>,
): LineglassModuleDefinition[] {
  return modules
    .filter((module) => module.modes.includes(mode))
    .filter((module) => (module.capabilities ?? []).every((capability) => capabilities.has(capability)))
    .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label));
}

export function formatLineglassSource(source: LineglassValueSource): string {
  return source.toUpperCase();
}

export function nextModuleIndex(current: number, direction: 1 | -1, count: number): number {
  if (count === 0) return -1;
  return (Math.max(0, current) + direction + count) % count;
}
