import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GitCli } from '../src/git/git-cli';
import { GIT_CONFLICT_MARKER_FILES, GitCommandType, PullStrategy } from '../src/git/git-constants';
import {
  CommitFileChangeKind,
  CommitOutcomeKind,
  GitCommandError,
  GitConflictInProgressError,
  GitService,
  isGitCommandAborted,
} from '../src/git/git-service';
import { ProcessTermination, type ProcessRequest, type ProcessResult, type ProcessRunner } from '../src/git/process-runner';
import { ChangeKind } from '../src/git/status-parser';
import { GIT_TEST_ENVIRONMENT } from './git-test-context';
import {
  GIT_CLI_EXPECTED_ARGUMENTS,
  GIT_CLI_PROCESS_RESULTS,
  GIT_CLI_TEST_VALUES,
} from './git-cli.fixtures';

const GIT_SERVICE_TEST_VALUES = {
  zeroCount: 0,
  oneCount: 1,
  twoCount: 2,
  firstIndex: 0,
  secondIndex: 1,
  logLimitTen: 10,
  negativeLogLimit: -5,
  tempDirPrefix: 'obsidian-git-service-test-',
  gitDirName: '.git',
  mergeHeadName: 'MERGE_HEAD',
  mergeHeadContent: 'abc123\n',
  rebaseHeadName: 'REBASE_HEAD',
  rebaseHeadContent: 'def456\n',
  vaultPrefix: 'vault/\n',
  sampleGitMarkerStdout: '.git/MERGE_HEAD\n',
  newline: '\n',
  expectedBranch: 'main',
  expectedInsidePath: 'note.md',
  expectedOutsidePath: 'outside.md',
  statusCleanNoConflictOutput: ['# branch.oid abc123', '# branch.head main', ''].join('\0'),
  statusWithModifiedOutput: [
    '# branch.oid abc123',
    '# branch.head main',
    '1 .M N... 100644 100644 100644 abc123 def456 note.md',
    '',
  ].join('\0'),
  statusWithPrefixOutput: [
    '# branch.oid abc123',
    '# branch.head main',
    '1 .M N... 100644 100644 100644 abc123 def456 vault/note.md',
    '1 .M N... 100644 100644 100644 abc123 def456 outside.md',
    '',
  ].join('\0'),
  statusWithConflictOutput: [
    '# branch.oid abc123',
    '# branch.head main',
    'u UU N... 100644 100644 100644 100644 abc123 def456 ghi789 note.md',
    '',
  ].join('\0'),
  neutralErrorFallback: 'Git exited with code 1',
  neutralNullExitFallback: 'Git exited with code null',
  sampleCommitHashOne: '1111111111111111111111111111111111111111',
  sampleShortHashOne: '1111111',
  sampleAuthorOne: 'Jane "Obsidian" Doe',
  sampleDateOne: '2026-11-26T10:00:00+03:00',
  sampleSubjectOne: 'Add "quotes" and spaces: $(ok)',
  sampleCommitHashTwo: '2222222222222222222222222222222222222222',
  sampleShortHashTwo: '2222222',
  sampleAuthorTwo: 'John Doe',
  sampleDateTwo: '2026-11-25T09:00:00+03:00',
  sampleSubjectTwo: 'Initial vault commit',
  sampleCommitHashThree: '3333333333333333333333333333333333333333',
  sampleShortHashThree: '3333333',
  sampleAuthorThree: 'Merge User',
  sampleDateThree: '2026-11-24T08:00:00+03:00',
  sampleSubjectThree: 'Merge branch main',
  sampleAddedPath: 'notes/new note.md',
  sampleRenamedOrigPath: 'notes/old-name.md',
  sampleRenamedTargetPath: 'notes/new-name.md',
  sampleDeletedPath: 'notes/obsolete.md',
  logOutput:
    '\x1e' +
    [
      '1111111111111111111111111111111111111111',
      '1111111',
      'Jane "Obsidian" Doe',
      '2026-11-26T10:00:00+03:00',
      'Add "quotes" and spaces: $(ok)',
      '\0\nM\0note.md\0R100\0notes/old-name.md\0notes/new-name.md\0',
    ].join('\x1f') +
    '\x1e' +
    [
      '2222222222222222222222222222222222222222',
      '2222222',
      'John Doe',
      '2026-11-25T09:00:00+03:00',
      'Initial vault commit',
      '\0\nA\0notes/new note.md\0D\0notes/obsolete.md\0',
    ].join('\x1f') +
    '\x1e' +
    [
      '3333333333333333333333333333333333333333',
      '3333333',
      'Merge User',
      '2026-11-24T08:00:00+03:00',
      'Merge branch main',
      '\0',
    ].join('\x1f'),
  unbornBranchLogError: "fatal: your current branch 'main' does not have any commits yet\n",
  badDefaultRevisionLogError: "fatal: bad default revision 'HEAD'\n",
  lsFilesOutput: [
    'notes/first note.md',
    '"notes/\\320\\227\\320\\260\\320\\274\\320\\265\\321\\202\\320\\272\\320\\260.md"',
    '',
  ].join('\n'),
  expectedUnquotedCyrillicPath: 'notes/Заметка.md',
  diffWithLeadingSpaces: ' context line\n-old\n+new\n',
} as const;

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

function createNoMarkerResults(): ProcessResult[] {
  return GIT_CONFLICT_MARKER_FILES.map(() => GIT_CLI_PROCESS_RESULTS.success);
}

describe('GitService', () => {
  let tempDir: string | undefined;

  beforeEach(() => {
    tempDir = undefined;
  });

  afterEach(async () => {
    if (tempDir !== undefined) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns trimmed git version output', async () => {
    const runner = new QueueRunner([GIT_CLI_PROCESS_RESULTS.versionSuccess]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const version = await service.version();

    expect(version).toBe(GIT_CLI_TEST_VALUES.versionOutput.trim());
    expect(runner.requests.map(({ args }) => args)).toEqual([GIT_CLI_EXPECTED_ARGUMENTS.version]);
  });

  it('parses status and translates paths using rev-parse --show-prefix', async () => {
    const runner = new QueueRunner([
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.statusWithPrefixOutput,
      },
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.vaultPrefix,
      },
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const { status } = await service.status();

    expect(status.branch).toBe(GIT_SERVICE_TEST_VALUES.expectedBranch);
    expect(status.files[GIT_SERVICE_TEST_VALUES.firstIndex]).toMatchObject({
      path: GIT_SERVICE_TEST_VALUES.expectedInsidePath,
      inVault: true,
    });
    expect(status.files[GIT_SERVICE_TEST_VALUES.secondIndex]).toMatchObject({
      path: GIT_SERVICE_TEST_VALUES.expectedOutsidePath,
      inVault: false,
    });
  });

  it('ignores rev-parse prefix failure if status succeeded', async () => {
    const runner = new QueueRunner([
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.statusWithModifiedOutput,
      },
      GIT_CLI_PROCESS_RESULTS.failedCommand,
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const { status } = await service.status();

    expect(status.files[GIT_SERVICE_TEST_VALUES.firstIndex]).toMatchObject({
      path: GIT_SERVICE_TEST_VALUES.expectedInsidePath,
      inVault: true,
    });
  });

  it('reports an empty index without creating a commit', async () => {
    const runner = new QueueRunner([
      ...createNoMarkerResults(),
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.statusCleanNoConflictOutput,
      },
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
      ...GIT_CONFLICT_MARKER_FILES.map((marker) => [
        ...GIT_CLI_EXPECTED_ARGUMENTS.revParseGitPathPrefix,
        marker,
      ]),
      GIT_CLI_EXPECTED_ARGUMENTS.status,
      GIT_CLI_EXPECTED_ARGUMENTS.stageAll,
      GIT_CLI_EXPECTED_ARGUMENTS.cachedDiff,
    ]);
  });

  it('stages all changes and creates a commit when cachedDiff detects modifications', async () => {
    const runner = new QueueRunner([
      ...createNoMarkerResults(),
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.statusWithModifiedOutput,
      },
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.diffHasChanges,
      GIT_CLI_PROCESS_RESULTS.commitSuccess,
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const outcome = await service.commitAll(GIT_CLI_TEST_VALUES.unsafeCommitMessage);

    expect(outcome.kind).toBe(CommitOutcomeKind.Committed);
    expect(outcome.command.args).toEqual([
      ...GIT_CLI_EXPECTED_ARGUMENTS.commit,
      GIT_CLI_TEST_VALUES.unsafeCommitMessage,
    ]);
  });

  it('refuses commitAll with GitConflictInProgressError when status contains conflicts', async () => {
    const runner = new QueueRunner([
      ...createNoMarkerResults(),
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.statusWithConflictOutput,
      },
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    await expect(service.commitAll(GIT_CLI_TEST_VALUES.noChangesMessage)).rejects.toBeInstanceOf(
      GitConflictInProgressError,
    );
    expect(runner.requests).toHaveLength(
      GIT_CONFLICT_MARKER_FILES.length + GIT_SERVICE_TEST_VALUES.oneCount,
    );
  });

  it('refuses commitAll with GitConflictInProgressError when MERGE_HEAD marker exists on disk', async () => {
    tempDir = await mkdtemp(join(tmpdir(), GIT_SERVICE_TEST_VALUES.tempDirPrefix));
    const gitDir = join(tempDir, GIT_SERVICE_TEST_VALUES.gitDirName);
    await mkdir(gitDir);
    await writeFile(
      join(gitDir, GIT_SERVICE_TEST_VALUES.mergeHeadName),
      GIT_SERVICE_TEST_VALUES.mergeHeadContent,
    );

    const runner = new QueueRunner([
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.sampleGitMarkerStdout,
      },
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: tempDir,
      }),
    );

    await expect(service.commitAll(GIT_CLI_TEST_VALUES.noChangesMessage)).rejects.toBeInstanceOf(
      GitConflictInProgressError,
    );
    expect(runner.requests).toHaveLength(GIT_SERVICE_TEST_VALUES.oneCount);
  });

  it('allows commitAll when only a leftover REBASE_HEAD file exists on disk', async () => {
    tempDir = await mkdtemp(join(tmpdir(), GIT_SERVICE_TEST_VALUES.tempDirPrefix));
    const gitDir = join(tempDir, GIT_SERVICE_TEST_VALUES.gitDirName);
    await mkdir(gitDir);
    await writeFile(
      join(gitDir, GIT_SERVICE_TEST_VALUES.rebaseHeadName),
      GIT_SERVICE_TEST_VALUES.rebaseHeadContent,
    );

    const runner = new QueueRunner([
      ...createNoMarkerResults(),
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.statusWithModifiedOutput,
      },
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.diffHasChanges,
      GIT_CLI_PROCESS_RESULTS.commitSuccess,
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: tempDir,
      }),
    );

    expect(GIT_CONFLICT_MARKER_FILES).not.toContain(GIT_SERVICE_TEST_VALUES.rebaseHeadName);
    const outcome = await service.commitAll(GIT_CLI_TEST_VALUES.unsafeCommitMessage);

    expect(outcome.kind).toBe(CommitOutcomeKind.Committed);
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
      exitCode: GIT_CLI_TEST_VALUES.exitHasChanges,
      termination: ProcessTermination.Exited,
      hasOutput: true,
    });
    await expect(status).rejects.toBeInstanceOf(GitCommandError);
  });

  it('combines distinct stderr and stdout in GitCommandError and deduplicates identical streams', () => {
    const combinedError = new GitCommandError({
      kind: GitCommandType.Pull,
      args: GIT_CLI_EXPECTED_ARGUMENTS.pullMerge,
      result: {
        exitCode: GIT_CLI_TEST_VALUES.exitHasChanges,
        stderr: GIT_CLI_TEST_VALUES.pullFetchStderr,
        stdout: GIT_CLI_TEST_VALUES.pullConflictStdout,
        termination: ProcessTermination.Exited,
      },
    });
    expect(combinedError.message).toBe(
      GIT_CLI_TEST_VALUES.pullFetchStderr +
        GIT_SERVICE_TEST_VALUES.newline +
        GIT_CLI_TEST_VALUES.pullConflictStdout,
    );
    expect(combinedError.hasOutput).toBe(true);
    expect(combinedError.exitCode).toBe(GIT_CLI_TEST_VALUES.exitHasChanges);
    expect(combinedError.termination).toBe(ProcessTermination.Exited);

    const deduplicatedError = new GitCommandError({
      kind: GitCommandType.Fetch,
      args: GIT_CLI_EXPECTED_ARGUMENTS.fetch,
      result: {
        exitCode: GIT_CLI_TEST_VALUES.exitHasChanges,
        stderr: GIT_CLI_TEST_VALUES.identicalErrorOutput,
        stdout: GIT_CLI_TEST_VALUES.identicalErrorOutput,
        termination: ProcessTermination.Exited,
      },
    });
    expect(deduplicatedError.message).toBe(GIT_CLI_TEST_VALUES.identicalErrorOutput);
    expect(deduplicatedError.hasOutput).toBe(true);
  });

  it('falls back to errorMessage and then neutral English fallback with hasOutput false', () => {
    const runnerFallbackError = new GitCommandError({
      kind: GitCommandType.Fetch,
      args: GIT_CLI_EXPECTED_ARGUMENTS.fetch,
      result: {
        exitCode: null,
        stderr: GIT_CLI_TEST_VALUES.emptyString,
        stdout: GIT_CLI_TEST_VALUES.emptyString,
        termination: ProcessTermination.LaunchError,
        errorMessage: GIT_CLI_TEST_VALUES.failedCommandMessage,
      },
    });
    expect(runnerFallbackError.message).toBe(GIT_CLI_TEST_VALUES.failedCommandMessage);
    expect(runnerFallbackError.hasOutput).toBe(true);

    const neutralExitedError = new GitCommandError({
      kind: GitCommandType.Push,
      args: GIT_CLI_EXPECTED_ARGUMENTS.push,
      result: {
        exitCode: GIT_CLI_TEST_VALUES.exitHasChanges,
        stderr: GIT_CLI_TEST_VALUES.emptyString,
        stdout: GIT_CLI_TEST_VALUES.emptyString,
        termination: ProcessTermination.Exited,
      },
    });
    expect(neutralExitedError.message).toBe(GIT_SERVICE_TEST_VALUES.neutralErrorFallback);
    expect(neutralExitedError.hasOutput).toBe(false);

    const neutralNullError = new GitCommandError({
      kind: GitCommandType.Push,
      args: GIT_CLI_EXPECTED_ARGUMENTS.push,
      result: {
        exitCode: null,
        stderr: GIT_CLI_TEST_VALUES.emptyString,
        stdout: GIT_CLI_TEST_VALUES.emptyString,
        termination: ProcessTermination.Timeout,
      },
    });
    expect(neutralNullError.message).toBe(GIT_SERVICE_TEST_VALUES.neutralNullExitFallback);
    expect(neutralNullError.hasOutput).toBe(false);
  });

  it('identifies an aborted command and rejects with an aborted GitCommandError', async () => {
    const runner = new QueueRunner([GIT_CLI_PROCESS_RESULTS.aborted]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const controller = new AbortController();
    controller.abort();
    const fetchPromise = service.fetch(controller.signal);

    await expect(fetchPromise).rejects.toSatisfy((error) => isGitCommandAborted(error));
  });

  it('forwards pull strategies and init through GitCli', async () => {
    const runner = new QueueRunner([
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.success,
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    await service.init();
    await service.pull(PullStrategy.Rebase);
    await service.pull(PullStrategy.FastForwardOnly);

    expect(runner.requests.map(({ args }) => args)).toEqual([
      GIT_CLI_EXPECTED_ARGUMENTS.init,
      GIT_CLI_EXPECTED_ARGUMENTS.pullRebase,
      GIT_CLI_EXPECTED_ARGUMENTS.pullFfOnly,
    ]);
  });

  it('handles stageFiles, unstageFiles on born/unborn repos, and discardFiles with empty guards', async () => {
    const paths = [GIT_CLI_TEST_VALUES.samplePathOne, GIT_CLI_TEST_VALUES.samplePathTwo];
    const runner = new QueueRunner([
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.unbornHead,
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.success,
      GIT_CLI_PROCESS_RESULTS.success,
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    await service.stageFiles([]);
    await service.stageFiles(paths);
    await service.unstageFiles([]);
    await service.unstageFiles(paths);
    await service.unstageFiles(paths);
    await service.discardFiles([], []);
    await service.discardFiles(
      [GIT_CLI_TEST_VALUES.samplePathOne],
      [GIT_CLI_TEST_VALUES.samplePathTwo],
    );

    expect(runner.requests.map(({ args }) => args)).toEqual([
      [...GIT_CLI_EXPECTED_ARGUMENTS.stageFilesPrefix, ...paths],
      GIT_CLI_EXPECTED_ARGUMENTS.revParseVerifyHead,
      [...GIT_CLI_EXPECTED_ARGUMENTS.unstageFilesPrefix, ...paths],
      GIT_CLI_EXPECTED_ARGUMENTS.revParseVerifyHead,
      [...GIT_CLI_EXPECTED_ARGUMENTS.unstageFilesUnbornPrefix, ...paths],
      [...GIT_CLI_EXPECTED_ARGUMENTS.discardFilesPrefix, GIT_CLI_TEST_VALUES.samplePathOne],
      [...GIT_CLI_EXPECTED_ARGUMENTS.cleanFilesPrefix, GIT_CLI_TEST_VALUES.samplePathTwo],
    ]);
  });

  it('returns raw diff output and unquoted tracked files from ls-files', async () => {
    const runner = new QueueRunner([
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.diffWithLeadingSpaces,
      },
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.lsFilesOutput,
      },
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const diffText = await service.diff(GIT_CLI_TEST_VALUES.samplePathOne, false);
    const emptyTracked = await service.listTrackedFiles([]);
    const tracked = await service.listTrackedFiles([
      GIT_CLI_TEST_VALUES.samplePathOne,
      GIT_SERVICE_TEST_VALUES.expectedUnquotedCyrillicPath,
    ]);

    expect(diffText).toBe(GIT_SERVICE_TEST_VALUES.diffWithLeadingSpaces);
    expect(emptyTracked).toEqual([]);
    expect(tracked).toEqual([
      GIT_CLI_TEST_VALUES.samplePathOne,
      GIT_SERVICE_TEST_VALUES.expectedUnquotedCyrillicPath,
    ]);
  });

  it('parses structured commit log entries and handles unborn repositories gracefully', async () => {
    const runner = new QueueRunner([
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.logOutput,
      },
      {
        ...GIT_CLI_PROCESS_RESULTS.unbornHead,
        stderr: GIT_SERVICE_TEST_VALUES.unbornBranchLogError,
      },
      {
        ...GIT_CLI_PROCESS_RESULTS.unbornHead,
        stderr: GIT_SERVICE_TEST_VALUES.badDefaultRevisionLogError,
      },
      GIT_CLI_PROCESS_RESULTS.failedCommand,
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    expect(await service.log(GIT_SERVICE_TEST_VALUES.zeroCount)).toEqual([]);
    expect(await service.log(GIT_SERVICE_TEST_VALUES.negativeLogLimit)).toEqual([]);

    const entries = await service.log(GIT_SERVICE_TEST_VALUES.logLimitTen);
    expect(entries).toEqual([
      {
        hash: GIT_SERVICE_TEST_VALUES.sampleCommitHashOne,
        shortHash: GIT_SERVICE_TEST_VALUES.sampleShortHashOne,
        author: GIT_SERVICE_TEST_VALUES.sampleAuthorOne,
        date: GIT_SERVICE_TEST_VALUES.sampleDateOne,
        subject: GIT_SERVICE_TEST_VALUES.sampleSubjectOne,
        files: [
          {
            kind: CommitFileChangeKind.Modified,
            path: GIT_SERVICE_TEST_VALUES.expectedInsidePath,
          },
          {
            kind: CommitFileChangeKind.Renamed,
            path: GIT_SERVICE_TEST_VALUES.sampleRenamedTargetPath,
            origPath: GIT_SERVICE_TEST_VALUES.sampleRenamedOrigPath,
          },
        ],
      },
      {
        hash: GIT_SERVICE_TEST_VALUES.sampleCommitHashTwo,
        shortHash: GIT_SERVICE_TEST_VALUES.sampleShortHashTwo,
        author: GIT_SERVICE_TEST_VALUES.sampleAuthorTwo,
        date: GIT_SERVICE_TEST_VALUES.sampleDateTwo,
        subject: GIT_SERVICE_TEST_VALUES.sampleSubjectTwo,
        files: [
          {
            kind: CommitFileChangeKind.Added,
            path: GIT_SERVICE_TEST_VALUES.sampleAddedPath,
          },
          {
            kind: CommitFileChangeKind.Deleted,
            path: GIT_SERVICE_TEST_VALUES.sampleDeletedPath,
          },
        ],
      },
      {
        hash: GIT_SERVICE_TEST_VALUES.sampleCommitHashThree,
        shortHash: GIT_SERVICE_TEST_VALUES.sampleShortHashThree,
        author: GIT_SERVICE_TEST_VALUES.sampleAuthorThree,
        date: GIT_SERVICE_TEST_VALUES.sampleDateThree,
        subject: GIT_SERVICE_TEST_VALUES.sampleSubjectThree,
        files: [],
      },
    ]);

    expect(await service.log(GIT_SERVICE_TEST_VALUES.logLimitTen)).toEqual([]);
    expect(await service.log(GIT_SERVICE_TEST_VALUES.logLimitTen)).toEqual([]);
    await expect(service.log(GIT_SERVICE_TEST_VALUES.logLimitTen)).rejects.toBeInstanceOf(
      GitCommandError,
    );
  });

  it('re-exports ChangeKind usage via status conflict assertion', async () => {
    const runner = new QueueRunner([
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_SERVICE_TEST_VALUES.statusWithConflictOutput,
      },
      {
        ...GIT_CLI_PROCESS_RESULTS.success,
        stdout: GIT_CLI_TEST_VALUES.emptyString,
      },
    ]);
    const service = new GitService(
      new GitCli(runner, {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: GIT_TEST_ENVIRONMENT.vaultPath,
      }),
    );

    const { status } = await service.status();

    expect(status.files[GIT_SERVICE_TEST_VALUES.firstIndex]?.kind).toBe(ChangeKind.Conflict);
    expect(status.files[GIT_SERVICE_TEST_VALUES.firstIndex]?.staged).toBe(false);
    expect(status.files[GIT_SERVICE_TEST_VALUES.firstIndex]?.unstaged).toBe(false);
  });
});
