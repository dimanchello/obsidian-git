export const DEFAULT_GIT_EXECUTABLE = 'git';

export enum PullStrategy {
  Merge = 'merge',
  Rebase = 'rebase',
  FastForwardOnly = 'ff-only',
}

export enum GitCommandType {
  Version = 'version',
  Status = 'status',
  Fetch = 'fetch',
  Pull = 'pull',
  Push = 'push',
  StageAll = 'stage-all',
  StageFiles = 'stage-files',
  UnstageFiles = 'unstage-files',
  UnstageFilesUnborn = 'unstage-files-unborn',
  DiscardFiles = 'discard-files',
  CleanFiles = 'clean-files',
  CachedDiff = 'cached-diff',
  Diff = 'diff',
  Commit = 'commit',
  Log = 'log',
  Init = 'init',
  RevParse = 'rev-parse',
  LsFiles = 'ls-files',
}

export const PULL_STRATEGY_ARGUMENTS = {
  [PullStrategy.Merge]: ['pull', '--no-rebase'],
  [PullStrategy.Rebase]: ['pull', '--rebase'],
  [PullStrategy.FastForwardOnly]: ['pull', '--ff-only'],
} as const satisfies Record<PullStrategy, readonly string[]>;

const GIT_LOG_FORMAT_TOKENS = {
  emptyString: '',
  formatFlagPrefix: '--format=',
  recordSeparatorToken: '%x1e',
  fieldSeparatorToken: '%x1f',
  hash: '%H',
  shortHash: '%h',
  authorName: '%an',
  authorDate: '%ad',
  subject: '%s',
} as const;

const GIT_LOG_TEMPLATE = [
  GIT_LOG_FORMAT_TOKENS.recordSeparatorToken,
  [
    GIT_LOG_FORMAT_TOKENS.hash,
    GIT_LOG_FORMAT_TOKENS.shortHash,
    GIT_LOG_FORMAT_TOKENS.authorName,
    GIT_LOG_FORMAT_TOKENS.authorDate,
    GIT_LOG_FORMAT_TOKENS.subject,
    GIT_LOG_FORMAT_TOKENS.emptyString,
  ].join(GIT_LOG_FORMAT_TOKENS.fieldSeparatorToken),
].join(GIT_LOG_FORMAT_TOKENS.emptyString);

export const GIT_LOG_FORMAT = {
  recordSeparator: '\x1e',
  fieldSeparator: '\x1f',
  nulSeparator: '\0',
  formatArgument: GIT_LOG_FORMAT_TOKENS.formatFlagPrefix + GIT_LOG_TEMPLATE,
} as const;

export const GIT_LOG_FILE_STATUS_PREFIXES = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  typeChanged: 'T',
} as const;

export const GIT_ARGUMENTS = {
  version: ['--version'],
  status: ['-c', 'core.quotepath=false', 'status', '--porcelain=v2', '--branch', '-z'],
  fetch: ['fetch'],
  pull: PULL_STRATEGY_ARGUMENTS[PullStrategy.Merge],
  push: ['push'],
  stageAll: ['add', '--all'],
  stageFiles: ['add', '--'],
  unstageFiles: ['reset', '--'],
  unstageFilesUnborn: ['rm', '--cached', '-r', '--'],
  discardFiles: ['checkout', '--'],
  cleanFiles: ['clean', '-f', '--'],
  cachedDiff: ['diff', '--cached', '--quiet'],
  diffWorktree: ['diff', '--no-color', '--'],
  diffCached: ['diff', '--cached', '--no-color', '--'],
  commit: ['commit', '--message'],
  logPrefix: ['log', '-n'],
  logOptions: ['--date=iso-strict', '--name-status', '-z', '-M', GIT_LOG_FORMAT.formatArgument],
  init: ['init'],
  revParsePrefix: ['rev-parse', '--show-prefix'],
  revParseGitPathPrefix: ['rev-parse', '--git-path'],
  revParseVerifyHead: ['rev-parse', '--verify', 'HEAD'],
  lsFiles: ['ls-files', '--'],
} as const;

export function createGitLogArguments(limit: number): readonly string[] {
  return [...GIT_ARGUMENTS.logPrefix, String(limit), ...GIT_ARGUMENTS.logOptions];
}

export const GIT_EXIT_CODES = {
  success: 0,
  diffHasChanges: 1,
} as const;

export const GIT_CONFLICT_MARKER_FILES = [
  'MERGE_HEAD',
  'REBASE_HEAD',
  'CHERRY_PICK_HEAD',
  'rebase-merge',
  'rebase-apply',
] as const;
