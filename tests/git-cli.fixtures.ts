import { ProcessTermination, type ProcessResult } from '../src/git/process-runner';

export const GIT_CLI_TEST_VALUES = {
  exitSuccess: 0,
  exitHasChanges: 1,
  expectedTwoCommands: 2,
  emptyString: '',
  unsafeCommitMessage: 'Auto-backup: $(touch injected) ; echo unsafe',
  noChangesMessage: 'Backup',
  stdout: 'out',
  stderr: 'err',
  failedCommandMessage: 'Command failed with exit code 1',
  noRepositoryMessage: 'fatal: not a git repository',
  successfulCommitOutput: '[main abc123] backup',
  missingProcessResult: 'No process result configured for this test.',
} as const;

export const GIT_CLI_EXPECTED_ARGUMENTS = {
  version: ['--version'],
  status: ['-c', 'core.quotepath=false', 'status', '--porcelain=v2', '--branch'],
  fetch: ['fetch'],
  pull: ['pull', '--no-rebase'],
  push: ['push'],
  stageAll: ['add', '--all'],
  cachedDiff: ['diff', '--cached', '--quiet'],
  commit: ['commit', '--message'],
} as const;

export const GIT_CLI_PROCESS_RESULTS = {
  success: {
    exitCode: GIT_CLI_TEST_VALUES.exitSuccess,
    stdout: GIT_CLI_TEST_VALUES.emptyString,
    stderr: GIT_CLI_TEST_VALUES.emptyString,
    termination: ProcessTermination.Exited,
  },
  diffHasChanges: {
    exitCode: GIT_CLI_TEST_VALUES.exitHasChanges,
    stdout: GIT_CLI_TEST_VALUES.emptyString,
    stderr: GIT_CLI_TEST_VALUES.emptyString,
    termination: ProcessTermination.Exited,
  },
  commitSuccess: {
    exitCode: GIT_CLI_TEST_VALUES.exitSuccess,
    stdout: GIT_CLI_TEST_VALUES.successfulCommitOutput,
    stderr: GIT_CLI_TEST_VALUES.emptyString,
    termination: ProcessTermination.Exited,
  },
  failedCommand: {
    exitCode: GIT_CLI_TEST_VALUES.exitHasChanges,
    stdout: GIT_CLI_TEST_VALUES.emptyString,
    stderr: GIT_CLI_TEST_VALUES.noRepositoryMessage,
    termination: ProcessTermination.Exited,
    errorMessage: GIT_CLI_TEST_VALUES.failedCommandMessage,
  },
} as const satisfies Record<string, ProcessResult>;
