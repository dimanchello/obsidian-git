export enum GitAction {
  Status = 'status',
  Fetch = 'fetch',
  Pull = 'pull',
  CommitAll = 'commit-all',
  CommitWithMessage = 'commit-with-message',
  PushOnly = 'push-only',
  Push = 'push',
  Sync = 'sync',
  History = 'history',
  ShowLastError = 'show-last-error',
  Init = 'init',
  Abort = 'abort',
}

export const GIT_ACTION_ORDER = [
  GitAction.Status,
  GitAction.History,
  GitAction.Fetch,
  GitAction.Pull,
  GitAction.CommitAll,
  GitAction.CommitWithMessage,
  GitAction.PushOnly,
  GitAction.Push,
  GitAction.Sync,
  GitAction.ShowLastError,
  GitAction.Init,
  GitAction.Abort,
] as const;

export const GIT_ACTION_COMMAND_IDS: Record<GitAction, string> = {
  [GitAction.Status]: 'show-status',
  [GitAction.Fetch]: 'fetch',
  [GitAction.Pull]: 'pull',
  [GitAction.CommitAll]: 'commit-all',
  [GitAction.CommitWithMessage]: 'commit-with-message',
  [GitAction.PushOnly]: 'push-only',
  [GitAction.Push]: 'push',
  [GitAction.Sync]: 'sync',
  [GitAction.History]: 'show-history',
  [GitAction.ShowLastError]: 'show-last-error',
  [GitAction.Init]: 'init',
  [GitAction.Abort]: 'abort-operation',
};

export const GIT_ACTION_ICONS: Record<GitAction, string> = {
  [GitAction.Status]: 'git-branch',
  [GitAction.Fetch]: 'download',
  [GitAction.Pull]: 'arrow-down',
  [GitAction.CommitAll]: 'git-commit-horizontal',
  [GitAction.CommitWithMessage]: 'message-square-plus',
  [GitAction.PushOnly]: 'upload',
  [GitAction.Push]: 'arrow-up',
  [GitAction.Sync]: 'refresh-cw',
  [GitAction.History]: 'history',
  [GitAction.ShowLastError]: 'alert-triangle',
  [GitAction.Init]: 'folder-git-2',
  [GitAction.Abort]: 'x-circle',
};

export const GIT_EXECUTABLE_RESOLUTION_STATE = {
  firstGeneration: 0,
} as const;

export const SETTINGS_DEBOUNCE_MS = 400;

export const DEFAULT_HISTORY_LIMIT = 20;

export const OBSIDIAN_WORKSPACE_FILE_NAMES = [
  'workspace.json',
  'workspace-mobile.json',
] as const;

export const STATUS_BAR_KEYBOARD_KEYS = {
  Enter: 'Enter',
  Space: ' ',
  Escape: 'Escape',
} as const;

export const PLUGIN_DOM_NAMES = {
  statusBarClass: 'git-commands-status',
  statusBarIconClass: 'git-commands-status-icon',
  statusBarTextClass: 'git-commands-status-text',
  statusBarRunningClass: 'git-commands-status--running',
  statusBarErrorClass: 'git-commands-status--error',
  statusBarConflictClass: 'git-commands-status--conflict',
  buttonRole: 'button',
  initialTabIndex: '0',
  roleAttribute: 'role',
  tabIndexAttribute: 'tabindex',
  ariaLabelAttribute: 'aria-label',
  titleAttribute: 'title',
  typeAttribute: 'type',
  buttonType: 'button',
  disabledAttribute: 'disabled',
  ariaDisabledAttribute: 'aria-disabled',
  clickEvent: 'click',
  keydownEvent: 'keydown',
  keyEnter: STATUS_BAR_KEYBOARD_KEYS.Enter,
  keySpace: STATUS_BAR_KEYBOARD_KEYS.Space,
  keyEscape: STATUS_BAR_KEYBOARD_KEYS.Escape,
} as const;

export const STATUS_BAR_ICONS = {
  branch: 'git-branch',
  spinner: 'refresh-cw',
  error: 'alert-circle',
  warning: 'alert-triangle',
  ribbon: 'git-branch',
} as const;

export const PLUGIN_FORMAT = {
  emptyString: '',
  posixPathSeparator: '/',
  windowsPathSeparator: '\\',
  edgeSlashesPattern: /^\/+|\/+$/g,
  datetimeToken: '{datetime}',
  datetimePadWidth: 2,
  datetimePadCharacter: '0',
  datetimeDateSeparator: '-',
  datetimeTimeSeparator: ':',
  datetimeDateTimeSeparator: ' ',
  monthIndexOffset: 1,
  secondsPerMinute: 60,
  millisecondsPerSecond: 1_000,
  errorNoticeDurationMs: 8_000,
  errorMessageMaxLength: 500,
  errorMessageEllipsisLength: 3,
  errorMessageStart: 0,
} as const;
