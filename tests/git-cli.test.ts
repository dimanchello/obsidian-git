import { describe, expect, it } from 'vitest';
import { PullStrategy } from '../src/git/git-constants';
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

    expect(git.cwd).toBe(GIT_TEST_ENVIRONMENT.vaultPath);
    expect(runner.requests).toEqual([
      {
        executable: GIT_TEST_ENVIRONMENT.absoluteExecutable,
        args: GIT_CLI_EXPECTED_ARGUMENTS.status,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      },
    ]);
  });

  it('keeps commit messages as a single argument and runs stage/diff/commit individually', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });

    await git.stageAll();
    await git.cachedDiff();
    await git.commit(GIT_CLI_TEST_VALUES.unsafeCommitMessage);

    expect(runner.requests.map(({ args }) => args)).toEqual([
      GIT_CLI_EXPECTED_ARGUMENTS.stageAll,
      GIT_CLI_EXPECTED_ARGUMENTS.cachedDiff,
      [...GIT_CLI_EXPECTED_ARGUMENTS.commit, GIT_CLI_TEST_VALUES.unsafeCommitMessage],
    ]);
  });

  it('passes network, init, version, and pull strategy commands as individual arguments', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });

    await git.version();
    await git.init();
    await git.fetch();
    await git.pull();
    await git.pull(PullStrategy.Rebase);
    await git.pull(PullStrategy.FastForwardOnly);
    await git.push();

    expect(runner.requests.map(({ args }) => args)).toEqual([
      GIT_CLI_EXPECTED_ARGUMENTS.version,
      GIT_CLI_EXPECTED_ARGUMENTS.init,
      GIT_CLI_EXPECTED_ARGUMENTS.fetch,
      GIT_CLI_EXPECTED_ARGUMENTS.pullMerge,
      GIT_CLI_EXPECTED_ARGUMENTS.pullRebase,
      GIT_CLI_EXPECTED_ARGUMENTS.pullFfOnly,
      GIT_CLI_EXPECTED_ARGUMENTS.push,
    ]);
  });

  it('passes file-scoped staging, unstaging, discard, clean, diff, and ls-files arguments', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });
    const paths = [GIT_CLI_TEST_VALUES.samplePathOne, GIT_CLI_TEST_VALUES.samplePathTwo];

    await git.stageFiles(paths);
    await git.unstageFiles(paths);
    await git.unstageFilesUnborn(paths);
    await git.discardFiles(paths);
    await git.cleanFiles(paths);
    await git.diff(GIT_CLI_TEST_VALUES.samplePathOne, false);
    await git.diff(GIT_CLI_TEST_VALUES.samplePathOne, true);
    await git.lsFiles(paths);

    expect(runner.requests.map(({ args }) => args)).toEqual([
      [...GIT_CLI_EXPECTED_ARGUMENTS.stageFilesPrefix, ...paths],
      [...GIT_CLI_EXPECTED_ARGUMENTS.unstageFilesPrefix, ...paths],
      [...GIT_CLI_EXPECTED_ARGUMENTS.unstageFilesUnbornPrefix, ...paths],
      [...GIT_CLI_EXPECTED_ARGUMENTS.discardFilesPrefix, ...paths],
      [...GIT_CLI_EXPECTED_ARGUMENTS.cleanFilesPrefix, ...paths],
      [...GIT_CLI_EXPECTED_ARGUMENTS.diffWorktreePrefix, GIT_CLI_TEST_VALUES.samplePathOne],
      [...GIT_CLI_EXPECTED_ARGUMENTS.diffCachedPrefix, GIT_CLI_TEST_VALUES.samplePathOne],
      [...GIT_CLI_EXPECTED_ARGUMENTS.lsFilesPrefix, ...paths],
    ]);
  });

  it('passes rev-parse and log commands with structured format arguments', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });

    await git.log(GIT_CLI_TEST_VALUES.expectedTenLogLimit);
    await git.revParsePrefix();
    await git.revParseGitPath(GIT_CLI_TEST_VALUES.sampleGitMarkerFile);
    await git.revParseVerifyHead();

    expect(runner.requests.map(({ args }) => args)).toEqual([
      GIT_CLI_EXPECTED_ARGUMENTS.logForTen,
      GIT_CLI_EXPECTED_ARGUMENTS.revParsePrefix,
      [...GIT_CLI_EXPECTED_ARGUMENTS.revParseGitPathPrefix, GIT_CLI_TEST_VALUES.sampleGitMarkerFile],
      GIT_CLI_EXPECTED_ARGUMENTS.revParseVerifyHead,
    ]);
  });

  it('forwards AbortSignal to process runner', async () => {
    const runner = new RecordingRunner();
    const git = new GitCli(runner, {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: GIT_TEST_ENVIRONMENT.vaultPath,
    });
    const controller = new AbortController();

    await git.fetch(controller.signal);

    expect(runner.requests[GIT_CLI_TEST_VALUES.firstRequestIndex]?.signal).toBe(controller.signal);
  });
});
