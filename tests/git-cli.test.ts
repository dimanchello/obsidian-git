import { describe, expect, it } from 'vitest';
import type { ProcessRequest, ProcessResult, ProcessRunner } from '../src/git/process-runner';
import { GitCli } from '../src/git/git-cli';
import { GIT_TEST_ENVIRONMENT } from './git-test-context';
import {
  GIT_CLI_EXPECTED_ARGUMENTS,
  GIT_CLI_PROCESS_RESULTS,
  GIT_CLI_TEST_VALUES,
} from './git-cli.fixtures';

class RecordingRunner implements ProcessRunner {
  public readonly requests: ProcessRequest[] = [];
  public readonly results: ProcessResult[] = [];

  public run(request: ProcessRequest): Promise<ProcessResult> {
    this.requests.push(request);
    return Promise.resolve(this.results.shift() ?? GIT_CLI_PROCESS_RESULTS.success);
  }
}

describe('GitCli', () => {
  it('runs Git with an executable, argument vector, and vault working directory', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.absoluteExecutable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });

    await git.status();

    expect(runner.requests).toEqual([
      {
        executable: GIT_TEST_ENVIRONMENT.absoluteExecutable,
        args: GIT_CLI_EXPECTED_ARGUMENTS.status,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      },
    ]);
  });

  it('keeps commit messages as a single argument and stages all vault changes', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });
    runner.results.push(
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.diffHasChanges,
      GIT_CLI_PROCESS_RESULTS.commitSuccess,
    );

    await git.commitAll(GIT_CLI_TEST_VALUES.unsafeCommitMessage);

    expect(runner.requests.map(({ args }) => args)).toEqual([
      GIT_CLI_EXPECTED_ARGUMENTS.stageAll,
      GIT_CLI_EXPECTED_ARGUMENTS.cachedDiff,
      [...GIT_CLI_EXPECTED_ARGUMENTS.commit, GIT_CLI_TEST_VALUES.unsafeCommitMessage],
    ]);
  });

  it('does not create an empty commit when the index has no changes', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });
    runner.results.push(GIT_CLI_PROCESS_RESULTS.success, GIT_CLI_PROCESS_RESULTS.success);

    const result = await git.commitAll(GIT_CLI_TEST_VALUES.noChangesMessage);

    expect(result.args).toEqual(GIT_CLI_EXPECTED_ARGUMENTS.cachedDiff);
    expect(runner.requests).toHaveLength(GIT_CLI_TEST_VALUES.expectedTwoCommands);
  });

  it('passes network and history commands as individual arguments', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });

    await git.fetch();
    await git.pull();
    await git.push();

    expect(runner.requests.map(({ args }) => args)).toEqual([
      GIT_CLI_EXPECTED_ARGUMENTS.fetch,
      GIT_CLI_EXPECTED_ARGUMENTS.pull,
      GIT_CLI_EXPECTED_ARGUMENTS.push,
    ]);
  });
});
