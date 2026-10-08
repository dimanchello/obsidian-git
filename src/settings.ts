import { DEFAULT_GIT_EXECUTABLE } from './git/git-constants';

const SETTING_DEFAULTS = {
  gitExecutable: DEFAULT_GIT_EXECUTABLE,
  autoFetchIntervalSeconds: 30,
  autoSyncIntervalMinutes: 0,
} as const;

export const SETTING_VALIDATION = {
  minimumFetchIntervalSeconds: 0,
  minimumSyncIntervalMinutes: 0,
} as const;

const JAVASCRIPT_TYPE_NAMES = {
  object: 'object',
} as const;

const EMPTY_STRING = '';

export interface GitPluginSettings {
  gitExecutable: string;
  autoFetchIntervalSeconds: number;
  autoSyncIntervalMinutes: number;
  commitMessageTemplate: string;
}

export function createDefaultSettings(commitMessageTemplate: string = EMPTY_STRING): GitPluginSettings {
  return {
    gitExecutable: SETTING_DEFAULTS.gitExecutable,
    autoFetchIntervalSeconds: SETTING_DEFAULTS.autoFetchIntervalSeconds,
    autoSyncIntervalMinutes: SETTING_DEFAULTS.autoSyncIntervalMinutes,
    commitMessageTemplate,
  };
}

export const DEFAULT_SETTINGS: Readonly<GitPluginSettings> = createDefaultSettings();

export function parseSettings(
  value: unknown,
  defaults: Readonly<GitPluginSettings> = DEFAULT_SETTINGS,
): GitPluginSettings {
  const stored =
    typeof value === JAVASCRIPT_TYPE_NAMES.object && value !== null
      ? (value as Record<string, unknown>)
      : {};
  const fetchInterval = stored.autoFetchIntervalSeconds;
  const syncInterval = stored.autoSyncIntervalMinutes;

  return {
    gitExecutable:
      typeof stored.gitExecutable === typeof defaults.gitExecutable &&
      (stored.gitExecutable as string).trim().length > EMPTY_STRING.length
        ? (stored.gitExecutable as string).trim()
        : defaults.gitExecutable,
    autoFetchIntervalSeconds:
      typeof fetchInterval === typeof defaults.autoFetchIntervalSeconds &&
      Number.isFinite(fetchInterval) &&
      (fetchInterval as number) >= SETTING_VALIDATION.minimumFetchIntervalSeconds
        ? Math.floor(fetchInterval as number)
        : defaults.autoFetchIntervalSeconds,
    autoSyncIntervalMinutes:
      typeof syncInterval === typeof defaults.autoSyncIntervalMinutes &&
      Number.isFinite(syncInterval) &&
      (syncInterval as number) >= SETTING_VALIDATION.minimumSyncIntervalMinutes
        ? Math.floor(syncInterval as number)
        : defaults.autoSyncIntervalMinutes,
    commitMessageTemplate:
      typeof stored.commitMessageTemplate === typeof defaults.commitMessageTemplate
        ? (stored.commitMessageTemplate as string)
        : defaults.commitMessageTemplate,
  };
}
