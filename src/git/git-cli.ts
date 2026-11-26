import type { ProcessRequest, ProcessResult, ProcessRunner } from './process-runner';
import {
  createGitLogArguments,
  GIT_ARGUMENTS,
  GitCommandType,
  PULL_STRATEGY_ARGUMENTS,
  PullStrategy,
} from './git-constants';

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

/** Maps individual Git operations to argument vectors executed through a ProcessRunner. */
export class GitCli {
  public constructor(
    private readonly runner: ProcessRunner,
    private readonly options: GitCliOptions,
  ) {}

  public get cwd(): string {
    return this.options.cwd;
  }

  public version(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Version, GIT_ARGUMENTS.version, signal);
  }

  public status(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Status, GIT_ARGUMENTS.status, signal);
  }

  public fetch(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Fetch, GIT_ARGUMENTS.fetch, signal);
  }

  public pull(
    strategy: PullStrategy = PullStrategy.Merge,
    signal?: AbortSignal,
  ): Promise<GitCommand> {
    return this.execute(GitCommandType.Pull, PULL_STRATEGY_ARGUMENTS[strategy], signal);
  }

  public push(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Push, GIT_ARGUMENTS.push, signal);
  }

  public stageAll(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.StageAll, GIT_ARGUMENTS.stageAll, signal);
  }

  public stageFiles(paths: readonly string[], signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.StageFiles, [...GIT_ARGUMENTS.stageFiles, ...paths], signal);
  }

  public unstageFiles(paths: readonly string[], signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(
      GitCommandType.UnstageFiles,
      [...GIT_ARGUMENTS.unstageFiles, ...paths],
      signal,
    );
  }

  public unstageFilesUnborn(paths: readonly string[], signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(
      GitCommandType.UnstageFilesUnborn,
      [...GIT_ARGUMENTS.unstageFilesUnborn, ...paths],
      signal,
    );
  }

  public discardFiles(paths: readonly string[], signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(
      GitCommandType.DiscardFiles,
      [...GIT_ARGUMENTS.discardFiles, ...paths],
      signal,
    );
  }

  public cleanFiles(paths: readonly string[], signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.CleanFiles, [...GIT_ARGUMENTS.cleanFiles, ...paths], signal);
  }

  public cachedDiff(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.CachedDiff, GIT_ARGUMENTS.cachedDiff, signal);
  }

  public diff(filePath: string, cached: boolean, signal?: AbortSignal): Promise<GitCommand> {
    const baseArgs = cached ? GIT_ARGUMENTS.diffCached : GIT_ARGUMENTS.diffWorktree;
    return this.execute(GitCommandType.Diff, [...baseArgs, filePath], signal);
  }

  public commit(message: string, signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Commit, [...GIT_ARGUMENTS.commit, message], signal);
  }

  public log(limit: number, signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Log, createGitLogArguments(limit), signal);
  }

  public init(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.Init, GIT_ARGUMENTS.init, signal);
  }

  public revParsePrefix(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.RevParse, GIT_ARGUMENTS.revParsePrefix, signal);
  }

  public revParseGitPath(gitFile: string, signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(
      GitCommandType.RevParse,
      [...GIT_ARGUMENTS.revParseGitPathPrefix, gitFile],
      signal,
    );
  }

  public revParseVerifyHead(signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.RevParse, GIT_ARGUMENTS.revParseVerifyHead, signal);
  }

  public lsFiles(paths: readonly string[], signal?: AbortSignal): Promise<GitCommand> {
    return this.execute(GitCommandType.LsFiles, [...GIT_ARGUMENTS.lsFiles, ...paths], signal);
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
