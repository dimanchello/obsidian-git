export const DEFAULT_GIT_EXECUTABLE = 'git';

export enum GitCommandType {
  Version = 'version',
  Status = 'status',
  Fetch = 'fetch',
  Pull = 'pull',
  Push = 'push',
  StageAll = 'stage-all',
  CachedDiff = 'cached-diff',
  Commit = 'commit',
}

export const GIT_ARGUMENTS = {
  version: ['--version'],
  status: ['-c', 'core.quotepath=false', 'status', '--porcelain=v2', '--branch'],
  fetch: ['fetch'],
  pull: ['pull', '--no-rebase'],
  push: ['push'],
  stageAll: ['add', '--all'],
  cachedDiff: ['diff', '--cached', '--quiet'],
  commit: ['commit', '--message'],
} as const;

export const GIT_EXIT_CODES = {
  success: 0,
  diffHasChanges: 1,
} as const;
