export enum GitAction {
  Status = 'status',
  Fetch = 'fetch',
  Pull = 'pull',
  CommitAll = 'commit-all',
  Push = 'push',
  Sync = 'sync',
}

export const GIT_ACTION_ORDER = [
  GitAction.Status,
  GitAction.Fetch,
  GitAction.Pull,
  GitAction.CommitAll,
  GitAction.Push,
  GitAction.Sync,
] as const;

export const GIT_ACTION_COMMAND_IDS: Record<GitAction, string> = {
  [GitAction.Status]: 'show-status',
  [GitAction.Fetch]: 'fetch',
  [GitAction.Pull]: 'pull',
  [GitAction.CommitAll]: 'commit-all',
  [GitAction.Push]: 'push',
  [GitAction.Sync]: 'sync',
};

export const GIT_ACTION_ICONS: Record<GitAction, string> = {
  [GitAction.Status]: 'git-branch',
  [GitAction.Fetch]: 'download',
  [GitAction.Pull]: 'arrow-down',
  [GitAction.CommitAll]: 'git-commit-horizontal',
  [GitAction.Push]: 'arrow-up',
  [GitAction.Sync]: 'refresh-cw',
};

export const PLUGIN_DOM_NAMES = {
  statusBarClass: 'git-commands-status',
  statusBarIconClass: 'git-commands-status-icon',
  statusBarTextClass: 'git-commands-status-text',
  statusBarRunningClass: 'git-commands-status--running',
  statusBarErrorClass: 'git-commands-status--error',
  buttonRole: 'button',
  initialTabIndex: '0',
  roleAttribute: 'role',
  tabIndexAttribute: 'tabindex',
  ariaLabelAttribute: 'aria-label',
  titleAttribute: 'title',
  clickEvent: 'click',
  keydownEvent: 'keydown',
} as const;

export const STATUS_BAR_ICONS = {
  branch: 'git-branch',
  spinner: 'refresh-cw',
  error: 'alert-circle',
} as const;

export const PLUGIN_FORMAT = {
  emptyString: '',
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

export const STATUS_BAR_KEYBOARD_KEYS = {
  Enter: 'Enter',
  Space: ' ',
} as const;
