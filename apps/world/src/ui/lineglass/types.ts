export type LineglassMode = 'inspect' | 'tune' | 'author' | 'system';
export type LineglassStatus = 'normal' | 'active' | 'warning' | 'error' | 'disabled';
export type LineglassValueSource = 'profile' | 'override' | 'live' | 'recorded' | 'derived';
export type LineglassCapability =
  | 'inspect-world'
  | 'edit-world'
  | 'author-routes'
  | 'inspect-signals'
  | 'record-artifacts'
  | 'view-diagnostics'
  | 'teleport'
  | 'edit-profile';

export interface LineglassSummary {
  primary: string;
  secondary?: string;
  badge?: string;
}

export interface LineglassModuleDefinition {
  id: string;
  label: string;
  icon: string;
  modes: LineglassMode[];
  priority: number;
  status?: LineglassStatus;
  capabilities?: LineglassCapability[];
  summary: () => LineglassSummary;
  rootIds: string[];
}

export interface LineglassControlState<T> {
  value: T;
  source?: LineglassValueSource;
  dirty?: boolean;
  disabled?: boolean;
  warning?: string;
}
