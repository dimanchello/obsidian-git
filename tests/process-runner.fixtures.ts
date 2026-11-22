import { GIT_CLI_EXPECTED_ARGUMENTS, GIT_CLI_TEST_VALUES } from './git-cli.fixtures';

const TEST_INTERVALS = {
  sleepMs: 60_000,
} as const;

export const PROCESS_RUNNER_TEST_VALUES = {
  nonZeroExitCode: 7,
  evalFlag: '-e',
  shellLikeArgument: '$(echo not-executed); echo unsafe &',
  stdout: GIT_CLI_TEST_VALUES.stdout,
  stderr: GIT_CLI_TEST_VALUES.stderr,
  sleepMs: TEST_INTERVALS.sleepMs,
} as const;

export const PROCESS_RUNNER_TEST_PROGRAMS = {
  writeArgument:
    'process.stdout.write(process.argv[1] ?? ' +
    JSON.stringify(GIT_CLI_TEST_VALUES.emptyString) +
    ')',
  writeOutputAndFail:
    'process.stdout.write(' +
    JSON.stringify(PROCESS_RUNNER_TEST_VALUES.stdout) +
    '); process.stderr.write(' +
    JSON.stringify(PROCESS_RUNNER_TEST_VALUES.stderr) +
    '); process.exitCode = ' +
    PROCESS_RUNNER_TEST_VALUES.nonZeroExitCode,
  sleep: 'setTimeout(() => {}, ' + String(TEST_INTERVALS.sleepMs) + ')',
} as const;

export const PROCESS_RUNNER_TEST_COMMANDS = {
  versionCheck: GIT_CLI_EXPECTED_ARGUMENTS.version,
} as const;
