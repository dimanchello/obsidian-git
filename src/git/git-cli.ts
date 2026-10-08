import type { ProcessRequest, ProcessResult, ProcessRunner } from './process-runner';
import { GIT_ARGUMENTS, GIT_EXIT_CODES, GitCommandType } from './git-constants';

export interface GitCliOptions {
  readonly executable: string;
  readonly cwd: string;
  readonly timeoutMs?: number;
}

export interface GitCommand {
  readonly kind: GitCommandType;
  readonly args: readonly string[];
  readonly result: ProcessResult;
}

export class GitCli {
  public constructor(
    private readonly runner: ProcessRunner,
    private readonly options: GitCliOptions,
  ) {}

  public version(): Promise<GitCommand> {
    return this.execute(GitCommandType.Version, GIT_ARGUMENTS.version);
  }

  public status(): Promise<GitCommand> {
    return this.execute(GitCommandType.Status, GIT_ARGUMENTS.status);
  }

  public fetch(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Fetch, GIT_ARGUMENTS.fetch, signal);
  }

  public pull(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Pull, GIT_ARGUMENTS.pull, signal);
  }

  public push(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Push, GIT_ARGUMENTS.push, signal);
  }

  public commitAll(message: string, signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.StageAll, GIT_ARGUMENTS.stageAll, signal).then(
      async (stageResult) => {
        if (stageResult.result.exitCode !== GIT_EXIT_CODES.success) return stageResult;

        const diffResult = await this.execute(
          GitCommandType.CachedDiff,
          GIT_ARGUMENTS.cachedDiff,
          signal,
        );
        if (diffResult.result.exitCode === GIT_EXIT_CODES.success) return diffResult;
        if (diffResult.result.exitCode !== GIT_EXIT_CODES.diffHasChanges) return diffResult;

        const commitArguments = [...GIT_ARGUMENTS.commit, message];
        return this.execute(GitCommandType.Commit, commitArguments, signal);
      },
    );
  }

  private execute(
    kind: GitCommandType,
    args: readonly string[],
    signal?: AbortSignal,
  ): Promise<GitCommand> {
    const request: ProcessRequest = {
      executable: this.options.executable,
      args,
      cwd: this.options.cwd,
      ...(this.options.timeoutMs === undefined ? {} : { timeoutMs: this.options.timeoutMs }),
      ...(signal === undefined ? {} : { signal }),
    };

    return this.runner.run(request).then((result) => ({ kind, args, result }));
  }
}
