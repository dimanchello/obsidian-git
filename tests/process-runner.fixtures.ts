import { GIT_CLI_EXPECTED_ARGUMENTS, GIT_CLI_TEST_VALUES } from './git-cli.fixtures';

const TEST_INTERVALS = {
  sleepMs: 60_000,
  shortTimeoutMs: 100,
} as const;

const TEST_BUFFER_SIZES = {
  bytesPerKibibyte: 1_024,
  maxOutputMebibytes: 10,
  overflowExtraBytes: 1,
  fillByte: 97,
} as const;

const OVERFLOW_OUTPUT_BYTES =
  TEST_BUFFER_SIZES.maxOutputMebibytes *
    TEST_BUFFER_SIZES.bytesPerKibibyte *
    TEST_BUFFER_SIZES.bytesPerKibibyte +
  TEST_BUFFER_SIZES.overflowExtraBytes;

export const PROCESS_RUNNER_TEST_ENVIRONMENT = {
  localeMessagesVariable: 'LC_MESSAGES',
  localeAllVariable: 'LC_ALL',
  localeCValue: 'C',
  localeUserValue: 'en_US.UTF-8',
  terminalPromptVariable: 'GIT_TERMINAL_PROMPT',
  terminalPromptDisabled: '0',
  pathVariable: 'PATH',
  windowsPathVariable: 'Path',
} as const;

export const PROCESS_RUNNER_TEST_PLATFORMS = {
  linux: 'linux',
  windows: 'win32',
} as const;

export const PROCESS_RUNNER_TEST_VALUES = {
  nonZeroExitCode: 7,
  evalFlag: '-e',
  shellLikeArgument: '$(echo not-executed); echo unsafe &',
  stdout: GIT_CLI_TEST_VALUES.stdout,
  stderr: GIT_CLI_TEST_VALUES.stderr,
  sleepMs: TEST_INTERVALS.sleepMs,
  shortTimeoutMs: TEST_INTERVALS.shortTimeoutMs,
  posixExtraPathDir: '/opt/custom-tools/bin',
  posixExistingPathDir: '/usr/bin',
  posixSecondaryPathDir: '/bin',
  posixExecutablePath: '/opt/homebrew/bin/git',
  posixExecutableDir: '/opt/homebrew/bin',
  posixPathDelimiter: ':',
  bareExecutable: 'git',
  windowsExecutablePath: 'C:\\Program Files\\Git\\cmd\\git.exe',
  windowsExecutableDir: 'C:\\Program Files\\Git\\cmd',
  windowsExtraPathDir: 'C:\\Tools\\bin',
  windowsExistingPathDir: 'C:\\Windows\\System32',
  windowsDuplicateDirLowercase: 'c:\\program files\\git\\cmd',
  windowsPathDelimiter: ';',
  killedSignalName: 'SIGKILL',
  terminatedSignalName: 'SIGTERM',
  maxBufferErrorCode: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
  firstIndex: 0,
  secondIndex: 1,
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
  writeBufferOverflow:
    'process.stdout.write(Buffer.alloc(' +
    String(OVERFLOW_OUTPUT_BYTES) +
    ', ' +
    String(TEST_BUFFER_SIZES.fillByte) +
    '))',
  writeLocaleAndPathEnvironment:
    'process.stdout.write(JSON.stringify({' +
    'lcMessages: process.env[' +
    JSON.stringify(PROCESS_RUNNER_TEST_ENVIRONMENT.localeMessagesVariable) +
    '],' +
    'lcAll: process.env[' +
    JSON.stringify(PROCESS_RUNNER_TEST_ENVIRONMENT.localeAllVariable) +
    '],' +
    'terminalPrompt: process.env[' +
    JSON.stringify(PROCESS_RUNNER_TEST_ENVIRONMENT.terminalPromptVariable) +
    '],' +
    'pathValue: process.env[' +
    JSON.stringify(PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable) +
    '] ?? process.env[' +
    JSON.stringify(PROCESS_RUNNER_TEST_ENVIRONMENT.windowsPathVariable) +
    '] ?? ' +
    JSON.stringify(GIT_CLI_TEST_VALUES.emptyString) +
    '}))',
} as const;

export const PROCESS_RUNNER_TEST_COMMANDS = {
  versionCheck: GIT_CLI_EXPECTED_ARGUMENTS.version,
} as const;
