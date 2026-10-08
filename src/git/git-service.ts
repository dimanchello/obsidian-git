import { GitCli, type GitCommand } from './git-cli';
import { GIT_EXIT_CODES, GitCommandType } from './git-constants';
import { ProcessTermination } from './process-runner';
import { parseGitStatus, type GitStatus } from './status-parser';

const GIT_SERVICE_TEXT = {
  unknownFailure: 'Git завершился с кодом ',
  emptyString: '',
} as const;

const GIT_COMMAND_SUCCESS_CODE = GIT_EXIT_CODES.success;
const PROCESS_TERMINATION_EXITED = ProcessTermination.Exited;

export enum CommitOutcomeKind {
  Committed = 'committed',
  NoChanges = 'no-changes',
}

export class GitCommandError extends Error {
  public constructor(public readonly command: GitCommand) {
    const { result } = command;
    const outputMessage = [result.stderr, result.stdout, result.errorMessage ?? GIT_SERVICE_TEXT.emptyString]
      .map((value) => value.trim())
      .find((value) => value.length > GIT_SERVICE_TEXT.emptyString.length);
    const message =
      outputMessage ?? GIT_SERVICE_TEXT.unknownFailure + String(result.exitCode);
    super(message);
    this.name = GitCommandError.name;
  }
}

export type CommitOutcome =
  | { readonly kind: CommitOutcomeKind.Committed; readonly command: GitCommand }
  | { readonly kind: CommitOutcomeKind.NoChanges; readonly command: GitCommand };

export class GitService {
  public constructor(private readonly git: GitCli) {}

  public async status(): Promise<{ readonly status: GitStatus; readonly command: GitCommand }> {
    const command = await this.git.status();
    this.ensureSuccess(command);
    return { status: parseGitStatus(command.result.stdout), command };
  }

  public async fetch(signal?: AbortSignal): Promise<GitCommand> {
    return this.ensureSuccess(await this.git.fetch(signal));
  }

  public async pull(signal?: AbortSignal): Promise<GitCommand> {
    return this.ensureSuccess(await this.git.pull(signal));
  }

  public async push(signal?: AbortSignal): Promise<GitCommand> {
    return this.ensureSuccess(await this.git.push(signal));
  }

  public async commitAll(message: string, signal?: AbortSignal): Promise<CommitOutcome> {
    const command = await this.git.commitAll(message, signal);
    if (
      command.kind === GitCommandType.CachedDiff &&
      command.result.exitCode === GIT_COMMAND_SUCCESS_CODE
    ) {
      return { kind: CommitOutcomeKind.NoChanges, command };
    }
    this.ensureSuccess(command);
    return { kind: CommitOutcomeKind.Committed, command };
  }

  private ensureSuccess(command: GitCommand): GitCommand {
    if (
      command.result.exitCode !== GIT_COMMAND_SUCCESS_CODE ||
      command.result.termination !== PROCESS_TERMINATION_EXITED
    ) {
      throw new GitCommandError(command);
    }
    return command;
  }
}
