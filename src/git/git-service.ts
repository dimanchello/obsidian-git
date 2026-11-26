import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { GitCli, type GitCommand } from './git-cli';
import {
  GIT_CONFLICT_MARKER_FILES,
  GIT_EXIT_CODES,
  GIT_LOG_FILE_STATUS_PREFIXES,
  GIT_LOG_FORMAT,
  PullStrategy,
} from './git-constants';
import { ProcessTermination, type ProcessResult } from './process-runner';
import { ChangeKind, parseGitStatus, unquoteGitPath, type GitStatus } from './status-parser';

const GIT_SERVICE_TEXT = {
  unknownFailure: 'Git exited with code ',
  conflictInProgress: 'Merge or rebase conflicts must be resolved before committing.',
  emptyString: '',
  newline: '\n',
} as const;

const GIT_SERVICE_COUNTS = {
  none: 0,
} as const;

const GIT_SERVICE_PATTERNS = {
  lineBreak: /\r?\n/,
  trailingLineBreak: /\r?\n$/,
} as const;

const GIT_LOG_RECORD_INDICES = {
  hash: 0,
  shortHash: 1,
  author: 2,
  date: 3,
  subject: 4,
  filesPayloadStart: 5,
  minimumFieldCount: 5,
  firstToken: 0,
  singlePathOffset: 1,
  renameOrigPathOffset: 1,
  renameTargetPathOffset: 2,
  singlePathTokenStride: 2,
  renameTokenStride: 3,
} as const;

const GIT_LOG_UNBORN_PATTERNS = [
  'does not have any commits yet',
  "bad default revision 'HEAD'",
] as const;

const GIT_COMMAND_SUCCESS_CODE = GIT_EXIT_CODES.success;
const PROCESS_TERMINATION_EXITED = ProcessTermination.Exited;

export enum CommitOutcomeKind {
  Committed = 'committed',
  NoChanges = 'no-changes',
}

export enum CommitFileChangeKind {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted',
  Renamed = 'renamed',
  Copied = 'copied',
  TypeChanged = 'type-changed',
  Other = 'other',
}

export interface GitCommitFileChange {
  readonly kind: CommitFileChangeKind;
  readonly path: string;
  readonly origPath?: string;
}

export interface GitCommitEntry {
  readonly hash: string;
  readonly shortHash: string;
  readonly author: string;
  readonly date: string;
  readonly subject: string;
  readonly files: readonly GitCommitFileChange[];
}

/** Raised when a commit is attempted while merge, rebase, or conflict markers remain unresolved. */
export class GitConflictInProgressError extends Error {
  public constructor(message: string = GIT_SERVICE_TEXT.conflictInProgress) {
    super(message);
    this.name = GitConflictInProgressError.name;
  }
}

/** Raised when a Git invocation terminates abnormally or exits with an unexpected status code. */
export class GitCommandError extends Error {
  public readonly exitCode: number | null;
  public readonly termination: ProcessTermination;
  public readonly hasOutput: boolean;

  public constructor(public readonly command: GitCommand) {
    const { result } = command;
    const { message, hasOutput } = formatCommandErrorMessage(result);
    super(message);
    this.name = GitCommandError.name;
    this.exitCode = result.exitCode;
    this.termination = result.termination;
    this.hasOutput = hasOutput;
  }
}

export type CommitOutcome =
  | { readonly kind: CommitOutcomeKind.Committed; readonly command: GitCommand }
  | { readonly kind: CommitOutcomeKind.NoChanges; readonly command: GitCommand };

export function isGitCommandAborted(error: unknown): boolean {
  return (
    error instanceof GitCommandError &&
    error.command.result.termination === ProcessTermination.Aborted
  );
}

/** High-level Git operations that enforce exit semantics, conflict guards, and structured parsing. */
export class GitService {
  public constructor(private readonly git: GitCli) {}

  public async version(signal?: AbortSignal): Promise<string> {
    const command = this.ensureSuccess(await this.git.version(signal));
    return command.result.stdout.trim();
  }

  public async status(
    signal?: AbortSignal,
  ): Promise<{ readonly status: GitStatus; readonly command: GitCommand }> {
    const command = this.ensureSuccess(await this.git.status(signal));
    const repoPrefix = await this.resolveRepoPrefix(signal);
    return { status: parseGitStatus(command.result.stdout, repoPrefix), command };
  }

  public async fetch(signal?: AbortSignal): Promise<GitCommand> {
    return this.ensureSuccess(await this.git.fetch(signal));
  }

  public async pull(
    strategy: PullStrategy = PullStrategy.Merge,
    signal?: AbortSignal,
  ): Promise<GitCommand> {
    return this.ensureSuccess(await this.git.pull(strategy, signal));
  }

  public async push(signal?: AbortSignal): Promise<GitCommand> {
    return this.ensureSuccess(await this.git.push(signal));
  }

  public async commitAll(message: string, signal?: AbortSignal): Promise<CommitOutcome> {
    if (await this.hasMergeOrRebaseInProgress(signal)) {
      throw new GitConflictInProgressError();
    }

    const statusCommand = this.ensureSuccess(await this.git.status(signal));
    const currentStatus = parseGitStatus(statusCommand.result.stdout);
    if (currentStatus.files.some((file) => file.kind === ChangeKind.Conflict)) {
      throw new GitConflictInProgressError();
    }

    this.ensureSuccess(await this.git.stageAll(signal));

    const diffCommand = await this.git.cachedDiff(signal);
    if (
      diffCommand.result.termination === PROCESS_TERMINATION_EXITED &&
      diffCommand.result.exitCode === GIT_COMMAND_SUCCESS_CODE
    ) {
      return { kind: CommitOutcomeKind.NoChanges, command: diffCommand };
    }
    if (
      diffCommand.result.termination !== PROCESS_TERMINATION_EXITED ||
      diffCommand.result.exitCode !== GIT_EXIT_CODES.diffHasChanges
    ) {
      throw new GitCommandError(diffCommand);
    }

    const commitCommand = this.ensureSuccess(await this.git.commit(message, signal));
    return { kind: CommitOutcomeKind.Committed, command: commitCommand };
  }

  public async hasMergeOrRebaseInProgress(signal?: AbortSignal): Promise<boolean> {
    for (const markerFile of GIT_CONFLICT_MARKER_FILES) {
      const command = await this.git.revParseGitPath(markerFile, signal);
      if (command.result.termination !== PROCESS_TERMINATION_EXITED) {
        throw new GitCommandError(command);
      }
      if (command.result.exitCode !== GIT_COMMAND_SUCCESS_CODE) {
        return false;
      }

      const rawPath = command.result.stdout.replace(
        GIT_SERVICE_PATTERNS.trailingLineBreak,
        GIT_SERVICE_TEXT.emptyString,
      );
      if (rawPath.length === GIT_SERVICE_TEXT.emptyString.length) {
        continue;
      }

      const resolvedPath = isAbsolute(rawPath) ? rawPath : resolve(this.git.cwd, rawPath);
      if (existsSync(resolvedPath)) {
        return true;
      }
    }

    return false;
  }

  public async stageFiles(paths: readonly string[], signal?: AbortSignal): Promise<void> {
    if (paths.length === GIT_SERVICE_COUNTS.none) {
      return;
    }
    this.ensureSuccess(await this.git.stageFiles(paths, signal));
  }

  public async unstageFiles(paths: readonly string[], signal?: AbortSignal): Promise<void> {
    if (paths.length === GIT_SERVICE_COUNTS.none) {
      return;
    }

    const headCommand = await this.git.revParseVerifyHead(signal);
    if (headCommand.result.termination !== PROCESS_TERMINATION_EXITED) {
      throw new GitCommandError(headCommand);
    }

    if (headCommand.result.exitCode === GIT_COMMAND_SUCCESS_CODE) {
      this.ensureSuccess(await this.git.unstageFiles(paths, signal));
      return;
    }

    this.ensureSuccess(await this.git.unstageFilesUnborn(paths, signal));
  }

  public async discardFiles(
    trackedPaths: readonly string[],
    untrackedPaths: readonly string[],
    signal?: AbortSignal,
  ): Promise<void> {
    if (trackedPaths.length > GIT_SERVICE_COUNTS.none) {
      this.ensureSuccess(await this.git.discardFiles(trackedPaths, signal));
    }
    if (untrackedPaths.length > GIT_SERVICE_COUNTS.none) {
      this.ensureSuccess(await this.git.cleanFiles(untrackedPaths, signal));
    }
  }

  public async diff(filePath: string, cached: boolean, signal?: AbortSignal): Promise<string> {
    const command = this.ensureSuccess(await this.git.diff(filePath, cached, signal));
    return command.result.stdout;
  }

  public async log(limit: number, signal?: AbortSignal): Promise<readonly GitCommitEntry[]> {
    if (limit <= GIT_SERVICE_COUNTS.none) {
      return [];
    }

    const command = await this.git.log(limit, signal);
    if (
      command.result.termination === PROCESS_TERMINATION_EXITED &&
      command.result.exitCode !== GIT_COMMAND_SUCCESS_CODE &&
      isUnbornRepositoryLogError(command.result.stderr)
    ) {
      return [];
    }

    this.ensureSuccess(command);
    return parseGitLog(command.result.stdout);
  }

  public async init(signal?: AbortSignal): Promise<GitCommand> {
    return this.ensureSuccess(await this.git.init(signal));
  }

  public async listTrackedFiles(
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly string[]> {
    if (paths.length === GIT_SERVICE_COUNTS.none) {
      return [];
    }

    const command = this.ensureSuccess(await this.git.lsFiles(paths, signal));
    const tracked: string[] = [];
    for (const line of command.result.stdout.split(GIT_SERVICE_PATTERNS.lineBreak)) {
      if (line.length === GIT_SERVICE_TEXT.emptyString.length) {
        continue;
      }
      tracked.push(unquoteGitPath(line));
    }
    return tracked;
  }

  private async resolveRepoPrefix(signal?: AbortSignal): Promise<string | undefined> {
    const command = await this.git.revParsePrefix(signal);
    if (command.result.termination === ProcessTermination.Aborted) {
      throw new GitCommandError(command);
    }
    if (
      command.result.termination !== PROCESS_TERMINATION_EXITED ||
      command.result.exitCode !== GIT_COMMAND_SUCCESS_CODE
    ) {
      return undefined;
    }
    return command.result.stdout.replace(
      GIT_SERVICE_PATTERNS.trailingLineBreak,
      GIT_SERVICE_TEXT.emptyString,
    );
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

function formatCommandErrorMessage(
  result: ProcessResult,
): { readonly message: string; readonly hasOutput: boolean } {
  const stderr = result.stderr.trim();
  const stdout = result.stdout.trim();
  const outputParts: string[] = [];

  if (stderr.length > GIT_SERVICE_TEXT.emptyString.length) {
    outputParts.push(stderr);
  }
  if (stdout.length > GIT_SERVICE_TEXT.emptyString.length && stdout !== stderr) {
    outputParts.push(stdout);
  }
  if (outputParts.length > GIT_SERVICE_COUNTS.none) {
    return {
      message: outputParts.join(GIT_SERVICE_TEXT.newline),
      hasOutput: true,
    };
  }

  const errorMessage = (result.errorMessage ?? GIT_SERVICE_TEXT.emptyString).trim();
  if (errorMessage.length > GIT_SERVICE_TEXT.emptyString.length) {
    return {
      message: errorMessage,
      hasOutput: true,
    };
  }

  return {
    message: GIT_SERVICE_TEXT.unknownFailure + String(result.exitCode),
    hasOutput: false,
  };
}

function isUnbornRepositoryLogError(stderr: string): boolean {
  return GIT_LOG_UNBORN_PATTERNS.some((pattern) => stderr.includes(pattern));
}

function parseGitLog(output: string): readonly GitCommitEntry[] {
  const entries: GitCommitEntry[] = [];
  for (const rawRecord of output.split(GIT_LOG_FORMAT.recordSeparator)) {
    if (rawRecord.length === GIT_SERVICE_TEXT.emptyString.length) {
      continue;
    }

    const fields = rawRecord.split(GIT_LOG_FORMAT.fieldSeparator);
    if (fields.length < GIT_LOG_RECORD_INDICES.minimumFieldCount) {
      continue;
    }

    const hash = fields[GIT_LOG_RECORD_INDICES.hash];
    const shortHash = fields[GIT_LOG_RECORD_INDICES.shortHash];
    const author = fields[GIT_LOG_RECORD_INDICES.author];
    const date = fields[GIT_LOG_RECORD_INDICES.date];
    const rawSubject = fields[GIT_LOG_RECORD_INDICES.subject];
    if (
      hash === undefined ||
      hash.length === GIT_SERVICE_TEXT.emptyString.length ||
      shortHash === undefined ||
      author === undefined ||
      date === undefined ||
      rawSubject === undefined
    ) {
      continue;
    }

    const hasFilesPayload = fields.length > GIT_LOG_RECORD_INDICES.minimumFieldCount;
    const subject = hasFilesPayload
      ? rawSubject
      : rawSubject.replace(GIT_SERVICE_PATTERNS.trailingLineBreak, GIT_SERVICE_TEXT.emptyString);
    const files = hasFilesPayload
      ? parseCommitFiles(
          fields
            .slice(GIT_LOG_RECORD_INDICES.filesPayloadStart)
            .join(GIT_LOG_FORMAT.fieldSeparator),
        )
      : [];

    entries.push({ hash, shortHash, author, date, subject, files });
  }
  return entries;
}

function parseCommitFiles(payload: string): readonly GitCommitFileChange[] {
  if (!payload.includes(GIT_LOG_FORMAT.nulSeparator)) {
    return [];
  }

  const tokens = payload.split(GIT_LOG_FORMAT.nulSeparator);
  const files: GitCommitFileChange[] = [];
  let index: number = GIT_LOG_RECORD_INDICES.firstToken;

  while (index < tokens.length) {
    const statusToken = (tokens[index] ?? GIT_SERVICE_TEXT.emptyString).trim();
    if (statusToken.length === GIT_SERVICE_TEXT.emptyString.length) {
      index++;
      continue;
    }

    const kind = toCommitFileChangeKind(statusToken);
    if (kind === CommitFileChangeKind.Renamed || kind === CommitFileChangeKind.Copied) {
      const origPath = tokens[index + GIT_LOG_RECORD_INDICES.renameOrigPathOffset];
      const nextPath = tokens[index + GIT_LOG_RECORD_INDICES.renameTargetPathOffset];
      if (
        origPath !== undefined &&
        nextPath !== undefined &&
        nextPath.length > GIT_SERVICE_TEXT.emptyString.length
      ) {
        files.push({ kind, path: nextPath, origPath });
      }
      index += GIT_LOG_RECORD_INDICES.renameTokenStride;
      continue;
    }

    const filePath = tokens[index + GIT_LOG_RECORD_INDICES.singlePathOffset];
    if (filePath !== undefined && filePath.length > GIT_SERVICE_TEXT.emptyString.length) {
      files.push({ kind, path: filePath });
    }
    index += GIT_LOG_RECORD_INDICES.singlePathTokenStride;
  }

  return files;
}

function toCommitFileChangeKind(statusToken: string): CommitFileChangeKind {
  if (statusToken.startsWith(GIT_LOG_FILE_STATUS_PREFIXES.added)) {
    return CommitFileChangeKind.Added;
  }
  if (statusToken.startsWith(GIT_LOG_FILE_STATUS_PREFIXES.modified)) {
    return CommitFileChangeKind.Modified;
  }
  if (statusToken.startsWith(GIT_LOG_FILE_STATUS_PREFIXES.deleted)) {
    return CommitFileChangeKind.Deleted;
  }
  if (statusToken.startsWith(GIT_LOG_FILE_STATUS_PREFIXES.renamed)) {
    return CommitFileChangeKind.Renamed;
  }
  if (statusToken.startsWith(GIT_LOG_FILE_STATUS_PREFIXES.copied)) {
    return CommitFileChangeKind.Copied;
  }
  if (statusToken.startsWith(GIT_LOG_FILE_STATUS_PREFIXES.typeChanged)) {
    return CommitFileChangeKind.TypeChanged;
  }
  return CommitFileChangeKind.Other;
}
