import { DEFAULT_GIT_EXECUTABLE, PullStrategy } from './git/git-constants';
import { PLUGIN_FORMAT } from './plugin-constants';

export enum AutoSyncNotificationMode {
  ErrorsOnly = 'errors-only',
  All = 'all',
  Silent = 'silent',
}

export enum StatusBarClickAction {
  Menu = 'menu',
  StatusModal = 'status-modal',
}

export const SETTING_DEFAULTS = {
  gitExecutable: DEFAULT_GIT_EXECUTABLE,
  autoFetchIntervalSeconds: 30,
  autoSyncIntervalMinutes: 0,
  autoBackupAfterEditMinutes: 0,
  autoPullOnLoad: false,
  pullStrategy: PullStrategy.Merge,
  processTimeoutSeconds: 120,
  autoSyncNotificationMode: AutoSyncNotificationMode.ErrorsOnly,
  statusBarClickAction: StatusBarClickAction.Menu,
  showRibbonIcon: false,
  commitMessageTemplate: PLUGIN_FORMAT.emptyString,
} as const;

export const SETTING_VALIDATION = {
  minimumFetchIntervalSeconds: 0,
  maximumFetchIntervalSeconds: 86_400,
  minimumSyncIntervalMinutes: 0,
  maximumSyncIntervalMinutes: 10_080,
  minimumAutoBackupMinutes: 0,
  maximumAutoBackupMinutes: 1_440,
  minimumProcessTimeoutSeconds: 5,
  maximumProcessTimeoutSeconds: 3_600,
  minimumPositiveInterval: 1,
} as const;

export const SETTING_PROPERTY_KEYS = {
  gitExecutable: 'gitExecutable',
  autoFetchIntervalSeconds: 'autoFetchIntervalSeconds',
  autoSyncIntervalMinutes: 'autoSyncIntervalMinutes',
  autoBackupAfterEditMinutes: 'autoBackupAfterEditMinutes',
  autoPullOnLoad: 'autoPullOnLoad',
  pullStrategy: 'pullStrategy',
  processTimeoutSeconds: 'processTimeoutSeconds',
  autoSyncNotificationMode: 'autoSyncNotificationMode',
  statusBarClickAction: 'statusBarClickAction',
  showRibbonIcon: 'showRibbonIcon',
  commitMessageTemplate: 'commitMessageTemplate',
} as const;

const JAVASCRIPT_TYPE_NAMES = {
  object: 'object',
  string: 'string',
  number: 'number',
  boolean: 'boolean',
} as const;

interface BoundedIntegerSpec {
  readonly min: number;
  readonly max: number;
  readonly clampFractionalPositiveToOne: boolean;
}

const INTERVAL_BOUNDS = {
  fetchSeconds: {
    min: SETTING_VALIDATION.minimumFetchIntervalSeconds,
    max: SETTING_VALIDATION.maximumFetchIntervalSeconds,
    clampFractionalPositiveToOne: true,
  },
  syncMinutes: {
    min: SETTING_VALIDATION.minimumSyncIntervalMinutes,
    max: SETTING_VALIDATION.maximumSyncIntervalMinutes,
    clampFractionalPositiveToOne: true,
  },
  autoBackupMinutes: {
    min: SETTING_VALIDATION.minimumAutoBackupMinutes,
    max: SETTING_VALIDATION.maximumAutoBackupMinutes,
    clampFractionalPositiveToOne: true,
  },
  processTimeoutSeconds: {
    min: SETTING_VALIDATION.minimumProcessTimeoutSeconds,
    max: SETTING_VALIDATION.maximumProcessTimeoutSeconds,
    clampFractionalPositiveToOne: false,
  },
} as const satisfies Record<string, BoundedIntegerSpec>;

const VALID_PULL_STRATEGIES: ReadonlySet<string> = new Set(Object.values(PullStrategy));
const VALID_NOTIFICATION_MODES: ReadonlySet<string> = new Set(
  Object.values(AutoSyncNotificationMode),
);
const VALID_STATUS_BAR_CLICK_ACTIONS: ReadonlySet<string> = new Set(
  Object.values(StatusBarClickAction),
);

export interface GitPluginSettings {
  gitExecutable: string;
  autoFetchIntervalSeconds: number;
  autoSyncIntervalMinutes: number;
  autoBackupAfterEditMinutes: number;
  autoPullOnLoad: boolean;
  pullStrategy: PullStrategy;
  processTimeoutSeconds: number;
  autoSyncNotificationMode: AutoSyncNotificationMode;
  statusBarClickAction: StatusBarClickAction;
  showRibbonIcon: boolean;
  commitMessageTemplate: string;
}

export function createDefaultSettings(
  commitMessageTemplate: string = SETTING_DEFAULTS.commitMessageTemplate,
): GitPluginSettings {
  return {
    gitExecutable: SETTING_DEFAULTS.gitExecutable,
    autoFetchIntervalSeconds: SETTING_DEFAULTS.autoFetchIntervalSeconds,
    autoSyncIntervalMinutes: SETTING_DEFAULTS.autoSyncIntervalMinutes,
    autoBackupAfterEditMinutes: SETTING_DEFAULTS.autoBackupAfterEditMinutes,
    autoPullOnLoad: SETTING_DEFAULTS.autoPullOnLoad,
    pullStrategy: SETTING_DEFAULTS.pullStrategy,
    processTimeoutSeconds: SETTING_DEFAULTS.processTimeoutSeconds,
    autoSyncNotificationMode: SETTING_DEFAULTS.autoSyncNotificationMode,
    statusBarClickAction: SETTING_DEFAULTS.statusBarClickAction,
    showRibbonIcon: SETTING_DEFAULTS.showRibbonIcon,
    commitMessageTemplate,
  };
}

export const DEFAULT_SETTINGS: Readonly<GitPluginSettings> = createDefaultSettings();

export function parseSettings(
  value: unknown,
  defaults: Readonly<GitPluginSettings> = DEFAULT_SETTINGS,
): GitPluginSettings {
  const stored: Record<string, unknown> = isRecord(value) ? value : {};

  return {
    gitExecutable: parseNonEmptyTrimmedString(
      stored[SETTING_PROPERTY_KEYS.gitExecutable],
      defaults.gitExecutable,
    ),
    autoFetchIntervalSeconds: parseBoundedInteger(
      stored[SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds],
      INTERVAL_BOUNDS.fetchSeconds,
      defaults.autoFetchIntervalSeconds,
    ),
    autoSyncIntervalMinutes: parseBoundedInteger(
      stored[SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes],
      INTERVAL_BOUNDS.syncMinutes,
      defaults.autoSyncIntervalMinutes,
    ),
    autoBackupAfterEditMinutes: parseBoundedInteger(
      stored[SETTING_PROPERTY_KEYS.autoBackupAfterEditMinutes],
      INTERVAL_BOUNDS.autoBackupMinutes,
      defaults.autoBackupAfterEditMinutes,
    ),
    autoPullOnLoad: parseBoolean(
      stored[SETTING_PROPERTY_KEYS.autoPullOnLoad],
      defaults.autoPullOnLoad,
    ),
    pullStrategy: parseEnumValue(
      stored[SETTING_PROPERTY_KEYS.pullStrategy],
      VALID_PULL_STRATEGIES,
      defaults.pullStrategy,
    ),
    processTimeoutSeconds: parseBoundedInteger(
      stored[SETTING_PROPERTY_KEYS.processTimeoutSeconds],
      INTERVAL_BOUNDS.processTimeoutSeconds,
      defaults.processTimeoutSeconds,
    ),
    autoSyncNotificationMode: parseEnumValue(
      stored[SETTING_PROPERTY_KEYS.autoSyncNotificationMode],
      VALID_NOTIFICATION_MODES,
      defaults.autoSyncNotificationMode,
    ),
    statusBarClickAction: parseEnumValue(
      stored[SETTING_PROPERTY_KEYS.statusBarClickAction],
      VALID_STATUS_BAR_CLICK_ACTIONS,
      defaults.statusBarClickAction,
    ),
    showRibbonIcon: parseBoolean(
      stored[SETTING_PROPERTY_KEYS.showRibbonIcon],
      defaults.showRibbonIcon,
    ),
    commitMessageTemplate: parseString(
      stored[SETTING_PROPERTY_KEYS.commitMessageTemplate],
      defaults.commitMessageTemplate,
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === JAVASCRIPT_TYPE_NAMES.object &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isString(value: unknown): value is string {
  return typeof value === JAVASCRIPT_TYPE_NAMES.string;
}

function isNumber(value: unknown): value is number {
  return typeof value === JAVASCRIPT_TYPE_NAMES.number;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === JAVASCRIPT_TYPE_NAMES.boolean;
}

function parseNonEmptyTrimmedString(value: unknown, fallback: string): string {
  if (!isString(value)) return fallback;
  const trimmed = value.trim();
  return trimmed.length > PLUGIN_FORMAT.emptyString.length ? trimmed : fallback;
}

function parseString(value: unknown, fallback: string): string {
  return isString(value) ? value : fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return isBoolean(value) ? value : fallback;
}

function parseEnumValue<T extends string>(
  value: unknown,
  validValues: ReadonlySet<string>,
  fallback: T,
): T {
  return isString(value) && validValues.has(value) ? (value as T) : fallback;
}

function parseBoundedInteger(
  value: unknown,
  bounds: BoundedIntegerSpec,
  fallback: number,
): number {
  if (!isNumber(value) || !Number.isFinite(value)) {
    return fallback;
  }
  if (value < bounds.min) {
    return fallback;
  }
  if (value === bounds.min) {
    return bounds.min;
  }
  if (
    bounds.clampFractionalPositiveToOne &&
    value > bounds.min &&
    value < SETTING_VALIDATION.minimumPositiveInterval
  ) {
    return SETTING_VALIDATION.minimumPositiveInterval;
  }
  return Math.min(Math.floor(value), bounds.max);
}
