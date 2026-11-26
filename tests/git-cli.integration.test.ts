import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { NodeProcessRunner } from '../src/git/process-runner';
import { GitCli } from '../src/git/git-cli';
import { PullStrategy } from '../src/git/git-constants';
import {
  CommitFileChangeKind,
  CommitOutcomeKind,
  GitCommandError,
  GitConflictInProgressError,
  GitService,
} from '../src/git/git-service';
import { ChangeKind } from '../src/git/status-parser';
import { GIT_TEST_ENVIRONMENT } from './git-test-context';
import {
  GIT_INTEGRATION_TEST_COMMANDS,
  GIT_INTEGRATION_TEST_VALUES,
} from './git-cli.integration.fixtures';

const execFileAsync = promisify(execFile);

describe('GitCli & GitService integration', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), GIT_INTEGRATION_TEST_VALUES.tempDirectoryPrefix));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('runs real Git operations against a local remote without network access', async () => {
    const bare = join(directory, GIT_INTEGRATION_TEST_VALUES.remoteDirectoryName);
    const primary = join(directory, GIT_INTEGRATION_TEST_VALUES.primaryDirectoryName);
    const secondary = join(directory, GIT_INTEGRATION_TEST_VALUES.secondaryDirectoryName);
    await mkdir(primary);
    await git(directory, GIT_INTEGRATION_TEST_COMMANDS.initBare(bare));
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.initPrimary);
    await configureIdentity(primary);

    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.commitInitial);
    const bareRemoteUrl = pathToFileURL(bare).href;
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.addRemote(bareRemoteUrl));
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.pushUpstream);
    await git(directory, GIT_INTEGRATION_TEST_COMMANDS.clone(bareRemoteUrl, secondary));
    await configureIdentity(secondary);

    const gitCli = new GitCli(new NodeProcessRunner(), {
      executable: GIT_TEST_ENVIRONMENT.executable,
      cwd: primary,
    });
    const service = new GitService(gitCli);

    const cleanStatus = await service.status();
    expect(cleanStatus.status.branch).toBe(GIT_INTEGRATION_TEST_VALUES.initialBranch);
    expect(cleanStatus.status.upstream).toBe(GIT_INTEGRATION_TEST_VALUES.expectedUpstream);
    expect(cleanStatus.status.files).toHaveLength(GIT_INTEGRATION_TEST_VALUES.expectedZeroCount);

    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.localFileContent,
    );
    const worktreeDiff = await service.diff(GIT_INTEGRATION_TEST_VALUES.localFileName, false);
    expect(worktreeDiff).toContain(GIT_INTEGRATION_TEST_VALUES.diffAddedLinePrefix);

    const commitOutcome = await service.commitAll(GIT_INTEGRATION_TEST_VALUES.localCommitMessage);
    expect(commitOutcome.kind).toBe(CommitOutcomeKind.Committed);
    expect((await service.status()).status.ahead).toBe(GIT_INTEGRATION_TEST_VALUES.expectedOneCount);

    const push = await service.push();
    expect(push.result.exitCode).toBe(GIT_INTEGRATION_TEST_VALUES.expectedSuccessExitCode);
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.fetch);
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.pull);
    expect(
      await readFile(
        join(secondary, GIT_INTEGRATION_TEST_VALUES.localFileName),
        GIT_INTEGRATION_TEST_VALUES.utf8Encoding,
      ),
    ).toBe(GIT_INTEGRATION_TEST_VALUES.localFileContent);

    await writeFile(
      join(secondary, GIT_INTEGRATION_TEST_VALUES.remoteFileName),
      GIT_INTEGRATION_TEST_VALUES.remoteFileContent,
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(
      secondary,
      GIT_INTEGRATION_TEST_COMMANDS.commitWithMessage(
        GIT_INTEGRATION_TEST_VALUES.remoteCommitMessage,
      ),
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.push);

    await service.fetch();
    expect((await service.status()).status.behind).toBe(
      GIT_INTEGRATION_TEST_VALUES.expectedOneCount,
    );

    await service.pull(PullStrategy.Merge);
    expect(
      await readFile(
        join(primary, GIT_INTEGRATION_TEST_VALUES.remoteFileName),
        GIT_INTEGRATION_TEST_VALUES.utf8Encoding,
      ),
    ).toBe(GIT_INTEGRATION_TEST_VALUES.remoteFileContent);

    const logEntries = await service.log(GIT_INTEGRATION_TEST_VALUES.logLimitTen);
    const localCommitEntry = logEntries.find(
      (entry) => entry.subject === GIT_INTEGRATION_TEST_VALUES.localCommitMessage,
    );
    expect(localCommitEntry).toBeDefined();
    expect(localCommitEntry?.files).toEqual([
      {
        kind: CommitFileChangeKind.Modified,
        path: GIT_INTEGRATION_TEST_VALUES.localFileName,
      },
    ]);
  });

  it('supports rebase and ff-only pull strategies against a local remote', async () => {
    const bare = join(directory, GIT_INTEGRATION_TEST_VALUES.remoteDirectoryName);
    const primary = join(directory, GIT_INTEGRATION_TEST_VALUES.primaryDirectoryName);
    const secondary = join(directory, GIT_INTEGRATION_TEST_VALUES.secondaryDirectoryName);
    await mkdir(primary);
    await git(directory, GIT_INTEGRATION_TEST_COMMANDS.initBare(bare));
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.initPrimary);
    await configureIdentity(primary);
    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.commitInitial);
    const bareRemoteUrl = pathToFileURL(bare).href;
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.addRemote(bareRemoteUrl));
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.pushUpstream);
    await git(directory, GIT_INTEGRATION_TEST_COMMANDS.clone(bareRemoteUrl, secondary));
    await configureIdentity(secondary);

    const service = new GitService(
      new GitCli(new NodeProcessRunner(), {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: primary,
      }),
    );

    await writeFile(
      join(secondary, GIT_INTEGRATION_TEST_VALUES.remoteFileName),
      GIT_INTEGRATION_TEST_VALUES.remoteFileContent,
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(
      secondary,
      GIT_INTEGRATION_TEST_COMMANDS.commitWithMessage(
        GIT_INTEGRATION_TEST_VALUES.rebaseRemoteCommitMessage,
      ),
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.push);

    await service.pull(PullStrategy.FastForwardOnly);

    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.localFileContent,
    );
    await service.commitAll(GIT_INTEGRATION_TEST_VALUES.rebaseLocalCommitMessage);

    await writeFile(
      join(secondary, GIT_INTEGRATION_TEST_VALUES.remoteFileName),
      GIT_INTEGRATION_TEST_VALUES.localFileContent,
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(
      secondary,
      GIT_INTEGRATION_TEST_COMMANDS.commitWithMessage(
        GIT_INTEGRATION_TEST_VALUES.remoteCommitMessage,
      ),
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.push);

    await expect(service.pull(PullStrategy.FastForwardOnly)).rejects.toBeInstanceOf(GitCommandError);
    await service.pull(PullStrategy.Rebase);

    const logEntries = await service.log(GIT_INTEGRATION_TEST_VALUES.logLimitTen);
    expect(logEntries[GIT_INTEGRATION_TEST_VALUES.firstIndex]?.subject).toBe(
      GIT_INTEGRATION_TEST_VALUES.rebaseLocalCommitMessage,
    );
  });

  it('detects detached HEAD, renames, conflicts, and blocks commitAll during a merge conflict', async () => {
    const bare = join(directory, GIT_INTEGRATION_TEST_VALUES.remoteDirectoryName);
    const primary = join(directory, GIT_INTEGRATION_TEST_VALUES.primaryDirectoryName);
    const secondary = join(directory, GIT_INTEGRATION_TEST_VALUES.secondaryDirectoryName);
    await mkdir(primary);
    await git(directory, GIT_INTEGRATION_TEST_COMMANDS.initBare(bare));
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.initPrimary);
    await configureIdentity(primary);
    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );
    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.renamedOldFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.commitInitial);
    const bareRemoteUrl = pathToFileURL(bare).href;
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.addRemote(bareRemoteUrl));
    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.pushUpstream);
    await git(directory, GIT_INTEGRATION_TEST_COMMANDS.clone(bareRemoteUrl, secondary));
    await configureIdentity(secondary);

    const service = new GitService(
      new GitCli(new NodeProcessRunner(), {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: primary,
      }),
    );

    await git(primary, GIT_INTEGRATION_TEST_COMMANDS.checkoutDetachHead);
    expect((await service.status()).status.branch).toBeNull();
    await git(
      primary,
      GIT_INTEGRATION_TEST_COMMANDS.checkoutBranch(GIT_INTEGRATION_TEST_VALUES.initialBranch),
    );

    await git(
      primary,
      GIT_INTEGRATION_TEST_COMMANDS.moveFile(
        GIT_INTEGRATION_TEST_VALUES.renamedOldFileName,
        GIT_INTEGRATION_TEST_VALUES.renamedNewFileName,
      ),
    );
    const renameStatus = (await service.status()).status;
    expect(renameStatus.files[GIT_INTEGRATION_TEST_VALUES.firstIndex]).toMatchObject({
      kind: ChangeKind.Renamed,
      path: GIT_INTEGRATION_TEST_VALUES.renamedNewFileName,
      origPath: GIT_INTEGRATION_TEST_VALUES.renamedOldFileName,
      staged: true,
    });
    await service.unstageFiles([
      GIT_INTEGRATION_TEST_VALUES.renamedNewFileName,
      GIT_INTEGRATION_TEST_VALUES.renamedOldFileName,
    ]);
    await service.discardFiles(
      [GIT_INTEGRATION_TEST_VALUES.renamedOldFileName],
      [GIT_INTEGRATION_TEST_VALUES.renamedNewFileName],
    );

    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.conflictLinePrimary,
    );
    await service.commitAll(GIT_INTEGRATION_TEST_VALUES.localCommitMessage);

    await writeFile(
      join(secondary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.conflictLineSecondary,
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(
      secondary,
      GIT_INTEGRATION_TEST_COMMANDS.commitWithMessage(
        GIT_INTEGRATION_TEST_VALUES.conflictCommitSecondaryMessage,
      ),
    );
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.push);

    await expect(service.pull(PullStrategy.Merge)).rejects.toBeInstanceOf(GitCommandError);
    expect(await service.hasMergeOrRebaseInProgress()).toBe(true);

    const conflictStatus = (await service.status()).status;
    expect(
      conflictStatus.files.some(
        (file) => file.kind === ChangeKind.Conflict && !file.staged && !file.unstaged,
      ),
    ).toBe(true);
    await expect(
      service.commitAll(GIT_INTEGRATION_TEST_VALUES.localCommitMessage),
    ).rejects.toBeInstanceOf(GitConflictInProgressError);
  });

  it('supports init, unborn log/unstage, selective staging, discardFiles, listTrackedFiles, and vault prefixing', async () => {
    const unbornRepo = join(directory, GIT_INTEGRATION_TEST_VALUES.unbornRepoDirectoryName);
    await mkdir(unbornRepo);
    const unbornService = new GitService(
      new GitCli(new NodeProcessRunner(), {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: unbornRepo,
      }),
    );

    await unbornService.init();
    await configureIdentity(unbornRepo);
    expect(await unbornService.log(GIT_INTEGRATION_TEST_VALUES.logLimitTen)).toEqual([]);

    await writeFile(
      join(unbornRepo, GIT_INTEGRATION_TEST_VALUES.unbornFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );
    await unbornService.stageFiles([GIT_INTEGRATION_TEST_VALUES.unbornFileName]);
    expect(
      await unbornService.listTrackedFiles([
        GIT_INTEGRATION_TEST_VALUES.unbornFileName,
        GIT_INTEGRATION_TEST_VALUES.untrackedFileName,
      ]),
    ).toEqual([GIT_INTEGRATION_TEST_VALUES.unbornFileName]);

    await unbornService.unstageFiles([GIT_INTEGRATION_TEST_VALUES.unbornFileName]);
    const afterUnstage = await unbornService.status();
    expect(afterUnstage.status.files[GIT_INTEGRATION_TEST_VALUES.firstIndex]?.kind).toBe(
      ChangeKind.Untracked,
    );

    await unbornService.discardFiles([], [GIT_INTEGRATION_TEST_VALUES.unbornFileName]);
    await expect(
      access(join(unbornRepo, GIT_INTEGRATION_TEST_VALUES.unbornFileName)),
    ).rejects.toThrow();

    const subRepoRoot = join(directory, GIT_INTEGRATION_TEST_VALUES.subVaultRepoDirectoryName);
    const vaultDir = join(subRepoRoot, GIT_INTEGRATION_TEST_VALUES.vaultDirectoryName);
    await mkdir(vaultDir, { recursive: true });
    await git(subRepoRoot, GIT_INTEGRATION_TEST_COMMANDS.initPrimary);
    await configureIdentity(subRepoRoot);
    await writeFile(
      join(vaultDir, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );
    await git(subRepoRoot, GIT_INTEGRATION_TEST_COMMANDS.addAll);
    await git(subRepoRoot, GIT_INTEGRATION_TEST_COMMANDS.commitInitial);
    await writeFile(
      join(vaultDir, GIT_INTEGRATION_TEST_VALUES.vaultInsideFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );
    await writeFile(
      join(subRepoRoot, GIT_INTEGRATION_TEST_VALUES.outsideFileName),
      GIT_INTEGRATION_TEST_VALUES.initialFileContent,
    );

    const subVaultService = new GitService(
      new GitCli(new NodeProcessRunner(), {
        executable: GIT_TEST_ENVIRONMENT.executable,
        cwd: vaultDir,
      }),
    );
    const subStatus = (await subVaultService.status()).status;
    expect(subStatus.files).toHaveLength(GIT_INTEGRATION_TEST_VALUES.expectedTwoCount);
    const insideFile = subStatus.files.find((file) => file.inVault);
    const outsideFile = subStatus.files.find((file) => !file.inVault);
    expect(insideFile?.path).toBe(GIT_INTEGRATION_TEST_VALUES.vaultInsideFileName);
    expect(outsideFile?.path).toBe(GIT_INTEGRATION_TEST_VALUES.outsideFileName);
  });
});

async function git(cwd: string, args: readonly string[]): Promise<void> {
  await execFileAsync(GIT_TEST_ENVIRONMENT.executable, [...args], { cwd });
}

async function configureIdentity(cwd: string): Promise<void> {
  await git(cwd, GIT_INTEGRATION_TEST_COMMANDS.configName);
  await git(cwd, GIT_INTEGRATION_TEST_COMMANDS.configEmail);
  await git(cwd, GIT_INTEGRATION_TEST_COMMANDS.configAutocrlf);
}
