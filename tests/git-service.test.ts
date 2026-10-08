import { describe, expect, it } from 'vitest';
import { GitCli } from '../src/git/git-cli';
import { CommitOutcomeKind, GitCommandError, GitService } from '../src/git/git-service';
import type { ProcessRequest, ProcessResult, ProcessRunner } from '../src/git/process-runner';
import { GIT_TEST_ENVIRONMENT } from './git-test-context';
import {
  GIT_CLI_EXPECTED_ARGUMENTS,
  GIT_CLI_PROCESS_RESULTS,
  GIT_CLI_TEST_VALUES,
} from './git-cli.fixtures';

class QueueRunner implements ProcessRunner {
  public readonly requests: ProcessRequest[] = [];

  public constructor(private readonly results: ProcessResult[]) {}

  public run(request: ProcessRequest): Promise<ProcessResult> {
    this.requests.push(request);
    const result = this.results.shift();
    if (result === undefined) throw new Error(GIT_CLI_TEST_VALUES.missingProcessResult);
    return Promise.resolve(result);
  }
}

describe('GitService', () => {
  it('reports an empty index without creating a commit', async () => {
    const runner = new QueueRunner([
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.success,
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const outcome = await service.commitAll(GIT_CLI_TEST_VALUES.noChangesMessage);

    expect(outcome.kind).toBe(CommitOutcomeKind.NoChanges);
    expect(runner.requests.map(({ args }) => args)).toEqual([
      GIT_CLI_EXPECTED_ARGUMENTS.stageAll,
      GIT_CLI_EXPECTED_ARGUMENTS.cachedDiff,
    ]);
  });

  it('surfaces Git stderr as the useful failure message', async () => {
    const runner = new QueueRunner([GIT_CLI_PROCESS_RESULTS.failedCommand]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const status = service.status();
    await expect(status).rejects.toMatchObject({
      name: GitCommandError.name,
      message: GIT_CLI_TEST_VALUES.noRepositoryMessage,
    });
    await expect(status).rejects.toBeInstanceOf(GitCommandError);
  });
});
