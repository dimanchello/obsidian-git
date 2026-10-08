import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { NodeProcessRunner } from '../src/git/process-runner';
import { GitCli } from '../src/git/git-cli';
import { GIT_TEST_ENVIRONMENT } from './git-test-context';
import {
  GIT_INTEGRATION_TEST_COMMANDS,
  GIT_INTEGRATION_TEST_VALUES,
} from './git-cli.integration.fixtures';

const execFileAsync = promisify(execFile);

describe('GitCli integration', () => {
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
    const cleanStatus = await gitCli.status();
    expect(cleanStatus.result.exitCode).toBe(GIT_INTEGRATION_TEST_VALUES.expectedSuccessExitCode);
    expect(cleanStatus.result.stdout).toContain(
      GIT_INTEGRATION_TEST_VALUES.expectedBranchHeader,
    );

    await writeFile(
      join(primary, GIT_INTEGRATION_TEST_VALUES.localFileName),
      GIT_INTEGRATION_TEST_VALUES.localFileContent,
    );
    const commit = await gitCli.commitAll(GIT_INTEGRATION_TEST_VALUES.localCommitMessage);
    expect(commit.result.exitCode).toBe(GIT_INTEGRATION_TEST_VALUES.expectedSuccessExitCode);
    expect((await gitCli.status()).result.stdout).toContain(
      GIT_INTEGRATION_TEST_VALUES.expectedLocalAhead,
    );

    const push = await gitCli.push();
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
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.commitRemote);
    await git(secondary, GIT_INTEGRATION_TEST_COMMANDS.push);

    const fetch = await gitCli.fetch();
    expect(fetch.result.exitCode).toBe(GIT_INTEGRATION_TEST_VALUES.expectedSuccessExitCode);
    expect((await gitCli.status()).result.stdout).toContain(
      GIT_INTEGRATION_TEST_VALUES.expectedRemoteBehind,
    );

    const pull = await gitCli.pull();
    expect(pull.result.exitCode).toBe(GIT_INTEGRATION_TEST_VALUES.expectedSuccessExitCode);
    expect(
      await readFile(
        join(primary, GIT_INTEGRATION_TEST_VALUES.remoteFileName),
        GIT_INTEGRATION_TEST_VALUES.utf8Encoding,
      ),
    ).toBe(GIT_INTEGRATION_TEST_VALUES.remoteFileContent);
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
