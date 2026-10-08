import { describe, expect, it } from 'vitest';
import { NodeProcessRunner, ProcessTermination } from '../src/git/process-runner';
import { GIT_TEST_ENVIRONMENT } from './git-test-context';
import { GIT_CLI_TEST_VALUES } from './git-cli.fixtures';
import {
  PROCESS_RUNNER_TEST_COMMANDS,
  PROCESS_RUNNER_TEST_PROGRAMS,
  PROCESS_RUNNER_TEST_VALUES,
} from './process-runner.fixtures';

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
});

