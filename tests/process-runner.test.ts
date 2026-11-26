import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildProcessEnvironment,
  classifyProcessTermination,
  NodeProcessRunner,
  ProcessTermination,
} from '../src/git/process-runner';
import { GIT_TEST_ENVIRONMENT } from './git-test-context';
import { GIT_CLI_TEST_VALUES } from './git-cli.fixtures';
import {
  PROCESS_RUNNER_TEST_COMMANDS,
  PROCESS_RUNNER_TEST_ENVIRONMENT,
  PROCESS_RUNNER_TEST_PLATFORMS,
  PROCESS_RUNNER_TEST_PROGRAMS,
  PROCESS_RUNNER_TEST_VALUES,
} from './process-runner.fixtures';

interface EnvironmentOutputPayload {
  readonly lcMessages?: string;
  readonly lcAll?: string;
  readonly terminalPrompt?: string;
  readonly pathValue: string;
}

describe('NodeProcessRunner', () => {
  it('passes arguments literally without invoking a shell', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run({
      executable: GIT_TEST_ENVIRONMENT.nodeExecutable,
      args: [
        PROCESS_RUNNER_TEST_VALUES.evalFlag,
        PROCESS_RUNNER_TEST_PROGRAMS.writeArgument,
        PROCESS_RUNNER_TEST_VALUES.shellLikeArgument,
      ],
      cwd: process.cwd(),
    });

    expect(result).toMatchObject({
      exitCode: GIT_CLI_TEST_VALUES.exitSuccess,
      stdout: PROCESS_RUNNER_TEST_VALUES.shellLikeArgument,
      stderr: GIT_CLI_TEST_VALUES.emptyString,
      termination: ProcessTermination.Exited,
    });
  });

  it('returns output and the non-zero exit code instead of throwing', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run({
      executable: GIT_TEST_ENVIRONMENT.nodeExecutable,
      args: [PROCESS_RUNNER_TEST_VALUES.evalFlag, PROCESS_RUNNER_TEST_PROGRAMS.writeOutputAndFail],
      cwd: process.cwd(),
    });

    expect(result).toMatchObject({
      exitCode: PROCESS_RUNNER_TEST_VALUES.nonZeroExitCode,
      stdout: PROCESS_RUNNER_TEST_VALUES.stdout,
      stderr: PROCESS_RUNNER_TEST_VALUES.stderr,
      termination: ProcessTermination.Exited,
    });
  });

  it('distinguishes an executable lookup failure from a Git exit code', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run({
      executable: GIT_TEST_ENVIRONMENT.unavailableExecutable,
      args: PROCESS_RUNNER_TEST_COMMANDS.versionCheck,
      cwd: process.cwd(),
    });

    expect(result.exitCode).toBeNull();
    expect(result.termination).toBe(ProcessTermination.LaunchError);
    expect(result.errorMessage).toContain(GIT_TEST_ENVIRONMENT.unavailableExecutable);
  });

  it('terminates an aborted process with Aborted termination', async () => {
    const runner = new NodeProcessRunner();
    const controller = new AbortController();

    const runPromise = runner.run({
      executable: GIT_TEST_ENVIRONMENT.nodeExecutable,
      args: [PROCESS_RUNNER_TEST_VALUES.evalFlag, PROCESS_RUNNER_TEST_PROGRAMS.sleep],
      cwd: process.cwd(),
      signal: controller.signal,
    });

    controller.abort();
    const result = await runPromise;

    expect(result.termination).toBe(ProcessTermination.Aborted);
    expect(result.exitCode).toBeNull();
  });

  it('terminates a timed-out process with Timeout termination', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run({
      executable: GIT_TEST_ENVIRONMENT.nodeExecutable,
      args: [PROCESS_RUNNER_TEST_VALUES.evalFlag, PROCESS_RUNNER_TEST_PROGRAMS.sleep],
      cwd: process.cwd(),
      timeoutMs: PROCESS_RUNNER_TEST_VALUES.shortTimeoutMs,
    });

    expect(result.termination).toBe(ProcessTermination.Timeout);
    expect(result.exitCode).toBeNull();
  });

  it('classifies output exceeding maxBuffer as BufferOverflow termination', async () => {
    const runner = new NodeProcessRunner();

    const result = await runner.run({
      executable: GIT_TEST_ENVIRONMENT.nodeExecutable,
      args: [PROCESS_RUNNER_TEST_VALUES.evalFlag, PROCESS_RUNNER_TEST_PROGRAMS.writeBufferOverflow],
      cwd: process.cwd(),
    });

    expect(result.termination).toBe(ProcessTermination.BufferOverflow);
    expect(result.exitCode).toBeNull();
  });

  it('sets LC_MESSAGES=C, GIT_TERMINAL_PROMPT=0, and prepends executable dirname and extraPathDirs', async () => {
    const runner = new NodeProcessRunner();
    const extraPathDirectory = path.resolve(
      process.cwd(),
      PROCESS_RUNNER_TEST_VALUES.posixExtraPathDir,
    );

    const result = await runner.run({
      executable: GIT_TEST_ENVIRONMENT.nodeExecutable,
      args: [
        PROCESS_RUNNER_TEST_VALUES.evalFlag,
        PROCESS_RUNNER_TEST_PROGRAMS.writeLocaleAndPathEnvironment,
      ],
      cwd: process.cwd(),
      extraPathDirs: [extraPathDirectory],
    });

    expect(result.termination).toBe(ProcessTermination.Exited);
    expect(result.exitCode).toBe(GIT_CLI_TEST_VALUES.exitSuccess);
    const payload = JSON.parse(result.stdout) as EnvironmentOutputPayload;
    expect(payload.lcMessages).toBe(PROCESS_RUNNER_TEST_ENVIRONMENT.localeCValue);
    expect(payload.terminalPrompt).toBe(PROCESS_RUNNER_TEST_ENVIRONMENT.terminalPromptDisabled);

    const pathSegments = payload.pathValue.split(path.delimiter);
    expect(pathSegments[PROCESS_RUNNER_TEST_VALUES.firstIndex]).toBe(
      path.dirname(GIT_TEST_ENVIRONMENT.nodeExecutable),
    );
    expect(pathSegments[PROCESS_RUNNER_TEST_VALUES.secondIndex]).toBe(extraPathDirectory);
  });
});

describe('buildProcessEnvironment', () => {
  it('sets LC_MESSAGES without forcing LC_ALL and deduplicates POSIX PATH entries', () => {
    const env = buildProcessEnvironment(
      {
        executable: PROCESS_RUNNER_TEST_VALUES.posixExecutablePath,
        extraPathDirs: [
          PROCESS_RUNNER_TEST_VALUES.posixExtraPathDir,
          PROCESS_RUNNER_TEST_VALUES.posixExecutableDir,
        ],
      },
      {
        [PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable]: [
          PROCESS_RUNNER_TEST_VALUES.posixExistingPathDir,
          PROCESS_RUNNER_TEST_VALUES.posixExecutableDir,
          PROCESS_RUNNER_TEST_VALUES.posixSecondaryPathDir,
        ].join(PROCESS_RUNNER_TEST_VALUES.posixPathDelimiter),
      },
      PROCESS_RUNNER_TEST_PLATFORMS.linux,
    );

    expect(env[PROCESS_RUNNER_TEST_ENVIRONMENT.localeMessagesVariable]).toBe(
      PROCESS_RUNNER_TEST_ENVIRONMENT.localeCValue,
    );
    expect(env[PROCESS_RUNNER_TEST_ENVIRONMENT.localeAllVariable]).toBeUndefined();
    expect(env[PROCESS_RUNNER_TEST_ENVIRONMENT.terminalPromptVariable]).toBe(
      PROCESS_RUNNER_TEST_ENVIRONMENT.terminalPromptDisabled,
    );
    expect(env[PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable]).toBe(
      [
        PROCESS_RUNNER_TEST_VALUES.posixExecutableDir,
        PROCESS_RUNNER_TEST_VALUES.posixExtraPathDir,
        PROCESS_RUNNER_TEST_VALUES.posixExistingPathDir,
        PROCESS_RUNNER_TEST_VALUES.posixSecondaryPathDir,
      ].join(PROCESS_RUNNER_TEST_VALUES.posixPathDelimiter),
    );
  });

  it('does not prepend a directory when executable is not path-like', () => {
    const existingPath = [
      PROCESS_RUNNER_TEST_VALUES.posixExistingPathDir,
      PROCESS_RUNNER_TEST_VALUES.posixSecondaryPathDir,
    ].join(PROCESS_RUNNER_TEST_VALUES.posixPathDelimiter);
    const env = buildProcessEnvironment(
      { executable: PROCESS_RUNNER_TEST_VALUES.bareExecutable },
      { [PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable]: existingPath },
      PROCESS_RUNNER_TEST_PLATFORMS.linux,
    );

    expect(env[PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable]).toBe(existingPath);
  });

  it('preserves Windows Path key without duplicating PATH and deduplicates case-insensitively', () => {
    const env = buildProcessEnvironment(
      {
        executable: PROCESS_RUNNER_TEST_VALUES.windowsExecutablePath,
        extraPathDirs: [PROCESS_RUNNER_TEST_VALUES.windowsExtraPathDir],
      },
      {
        [PROCESS_RUNNER_TEST_ENVIRONMENT.windowsPathVariable]: [
          PROCESS_RUNNER_TEST_VALUES.windowsExistingPathDir,
          PROCESS_RUNNER_TEST_VALUES.windowsDuplicateDirLowercase,
        ].join(PROCESS_RUNNER_TEST_VALUES.windowsPathDelimiter),
      },
      PROCESS_RUNNER_TEST_PLATFORMS.windows,
    );

    expect(PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable in env).toBe(false);
    expect(env[PROCESS_RUNNER_TEST_ENVIRONMENT.windowsPathVariable]).toBe(
      [
        PROCESS_RUNNER_TEST_VALUES.windowsExecutableDir,
        PROCESS_RUNNER_TEST_VALUES.windowsExtraPathDir,
        PROCESS_RUNNER_TEST_VALUES.windowsExistingPathDir,
      ].join(PROCESS_RUNNER_TEST_VALUES.windowsPathDelimiter),
    );
  });

  it('collapses mixed PATH and Path keys on Windows into a single entry', () => {
    const env = buildProcessEnvironment(
      {
        executable: PROCESS_RUNNER_TEST_VALUES.windowsExecutablePath,
      },
      {
        [PROCESS_RUNNER_TEST_ENVIRONMENT.windowsPathVariable]:
          PROCESS_RUNNER_TEST_VALUES.windowsDuplicateDirLowercase,
        [PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable]:
          PROCESS_RUNNER_TEST_VALUES.windowsExistingPathDir,
      },
      PROCESS_RUNNER_TEST_PLATFORMS.windows,
    );

    expect(PROCESS_RUNNER_TEST_ENVIRONMENT.windowsPathVariable in env).toBe(false);
    expect(env[PROCESS_RUNNER_TEST_ENVIRONMENT.pathVariable]).toBe(
      [
        PROCESS_RUNNER_TEST_VALUES.windowsExecutableDir,
        PROCESS_RUNNER_TEST_VALUES.windowsExistingPathDir,
      ].join(PROCESS_RUNNER_TEST_VALUES.windowsPathDelimiter),
    );
  });
});

describe('classifyProcessTermination', () => {
  it('distinguishes Aborted, BufferOverflow, Timeout, KilledBySignal, Exited, and LaunchError', () => {
    expect(
      classifyProcessTermination(
        { killed: true, signal: PROCESS_RUNNER_TEST_VALUES.terminatedSignalName },
        null,
        true,
      ),
    ).toBe(ProcessTermination.Aborted);

    expect(
      classifyProcessTermination(
        { code: PROCESS_RUNNER_TEST_VALUES.maxBufferErrorCode, killed: true },
        null,
        false,
      ),
    ).toBe(ProcessTermination.BufferOverflow);

    expect(
      classifyProcessTermination(
        { killed: true, signal: PROCESS_RUNNER_TEST_VALUES.terminatedSignalName },
        null,
        false,
      ),
    ).toBe(ProcessTermination.Timeout);

    expect(
      classifyProcessTermination(
        { killed: false, signal: PROCESS_RUNNER_TEST_VALUES.killedSignalName },
        null,
        false,
      ),
    ).toBe(ProcessTermination.KilledBySignal);

    expect(
      classifyProcessTermination(
        { code: PROCESS_RUNNER_TEST_VALUES.nonZeroExitCode },
        PROCESS_RUNNER_TEST_VALUES.nonZeroExitCode,
        false,
      ),
    ).toBe(ProcessTermination.Exited);

    expect(classifyProcessTermination({}, null, false)).toBe(ProcessTermination.LaunchError);
  });
});
