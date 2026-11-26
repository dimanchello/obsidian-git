import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  GitExecutableLocator,
  NodeGitExecutableProbe,
  type GitExecutableProbe,
} from '../src/git/git-executable-locator';
import { GIT_LOCATOR_TEST_VALUES as TEST } from './git-executable-locator.fixtures';
import {
  ProcessTermination,
  type ProcessRequest,
  type ProcessResult,
  type ProcessRunner,
} from '../src/git/process-runner';
import { GIT_ARGUMENTS, GIT_EXIT_CODES } from '../src/git/git-constants';

class RecordingGitProbe implements GitExecutableProbe {
  public readonly candidates: string[] = [];

  public constructor(private readonly validExecutable: string) {}

  public async isGitExecutable(executable: string): Promise<boolean> {
    this.candidates.push(executable);
    return executable === this.validExecutable;
  }
}

class RecordingVersionProbe implements GitExecutableProbe {
  public readonly candidates: string[] = [];

  public constructor(
    private readonly validExecutable: string,
    private readonly version: string,
  ) {}

  public async isGitExecutable(executable: string, cwd: string): Promise<boolean> {
    return (await this.probeVersion(executable, cwd)) !== null;
  }

  public async probeVersion(executable: string, _cwd: string): Promise<string | null> {
    this.candidates.push(executable);
    return executable === this.validExecutable ? this.version : null;
  }
}

class QueueProcessRunner implements ProcessRunner {
  public readonly requests: ProcessRequest[] = [];
  private readonly queue: ProcessResult[];

  public constructor(results: readonly ProcessResult[]) {
    this.queue = [...results];
  }

  public run(request: ProcessRequest): Promise<ProcessResult> {
    this.requests.push(request);
    const next = this.queue.shift();
    if (next === undefined) {
      throw new Error(TEST.unexpectedRunnerInvocation);
    }
    return Promise.resolve(next);
  }
}

const alwaysExecutable = (): Promise<boolean> => Promise.resolve(true);
const neverExecutable = (): Promise<boolean> => Promise.resolve(false);

describe('GitExecutableLocator', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    while (tempDirectories.length > TEST.zeroRequests) {
      const directory = tempDirectories.pop();
      if (directory !== undefined) {
        await rm(directory, { recursive: true, force: true });
      }
    }
  });

  it('finds an installed Git executable and version in the current environment', async () => {
    const locator = new GitExecutableLocator();

    const located = await locator.locateWithVersion(TEST.defaultExecutable, process.cwd());
    expect(located).not.toBeNull();
    expect(located?.executable).toBeTruthy();
    expect(located?.version).toBeTruthy();
  });

  it('searches PATH before system defaults on Linux', async () => {
    const probe = new RecordingGitProbe(TEST.linuxPathCandidate);
    const locator = new GitExecutableLocator({
      platform: TEST.linuxPlatform,
      environment: { [TEST.envPathKey]: TEST.linuxPathEnvironment },
      homeDirectory: TEST.linuxHomeDirectory,
      probe,
    });

    await expect(locator.locate(TEST.defaultExecutable, TEST.vaultPath)).resolves.toBe(
      TEST.linuxPathCandidate,
    );
    expect(probe.candidates[TEST.firstIndex]).toBe(TEST.linuxPathCandidate);
  });

  it('checks common Homebrew locations when macOS GUI PATH is incomplete', async () => {
    const probe = new RecordingGitProbe(TEST.macOSHomebrewCandidate);
    const locator = new GitExecutableLocator({
      platform: TEST.macOSPlatform,
      environment: { [TEST.envPathKey]: TEST.macOSPathEnvironment },
      homeDirectory: TEST.macOSHomeDirectory,
      probe,
    });

    await expect(locator.locate(TEST.defaultExecutable, TEST.vaultPath)).resolves.toBe(
      TEST.macOSHomebrewCandidate,
    );
    expect(probe.candidates).toContain(TEST.macOSHomebrewCandidate);
  });

  it('checks standard Windows Git installation directories', async () => {
    const probe = new RecordingGitProbe(TEST.windowsGitCandidate);
    const locator = new GitExecutableLocator({
      platform: TEST.windowsPlatform,
      environment: {
        [TEST.envPathKey]: TEST.windowsPathEnvironment,
        [TEST.envProgramFilesKey]: TEST.windowsProgramFiles,
      },
      homeDirectory: TEST.windowsHomeDirectory,
      probe,
    });

    await expect(locator.locate(TEST.defaultExecutable, TEST.vaultPath)).resolves.toBe(
      TEST.windowsGitCandidate,
    );
    expect(probe.candidates).toContain(TEST.windowsGitCandidate);
  });

  it('prefers HOME over USERPROFILE on non-Windows and falls back to USERPROFILE', async () => {
    const homeProbe = new RecordingGitProbe(TEST.linuxHomebrewCandidate);
    const linuxWithBoth = new GitExecutableLocator({
      platform: TEST.linuxPlatform,
      environment: {
        [TEST.envHomeKey]: TEST.linuxHomeDirectory,
        [TEST.envUserProfileKey]: TEST.linuxFallbackHomeDirectory,
      },
      probe: homeProbe,
    });

    await expect(linuxWithBoth.locate(TEST.defaultExecutable, TEST.vaultPath)).resolves.toBe(
      TEST.linuxHomebrewCandidate,
    );

    const fallbackProbe = new RecordingGitProbe(TEST.linuxFallbackHomebrewCandidate);
    const linuxWithUserProfileOnly = new GitExecutableLocator({
      platform: TEST.linuxPlatform,
      environment: {
        [TEST.envUserProfileKey]: TEST.linuxFallbackHomeDirectory,
      },
      probe: fallbackProbe,
    });

    await expect(
      linuxWithUserProfileOnly.locate(TEST.defaultExecutable, TEST.vaultPath),
    ).resolves.toBe(TEST.linuxFallbackHomebrewCandidate);
  });

  it('prefers USERPROFILE over HOME on Windows and falls back to HOME', async () => {
    const userProfileProbe = new RecordingGitProbe(TEST.windowsScoopGitCandidate);
    const windowsWithBoth = new GitExecutableLocator({
      platform: TEST.windowsPlatform,
      environment: {
        [TEST.envUserProfileKey]: TEST.windowsHomeDirectory,
        [TEST.envHomeKey]: TEST.windowsFallbackHomeDirectory,
      },
      probe: userProfileProbe,
    });

    await expect(windowsWithBoth.locate(TEST.defaultExecutable, TEST.vaultPath)).resolves.toBe(
      TEST.windowsScoopGitCandidate,
    );

    const homeFallbackProbe = new RecordingGitProbe(TEST.windowsFallbackScoopGitCandidate);
    const windowsWithHomeOnly = new GitExecutableLocator({
      platform: TEST.windowsPlatform,
      environment: {
        [TEST.envHomeKey]: TEST.windowsFallbackHomeDirectory,
      },
      probe: homeFallbackProbe,
    });

    await expect(
      windowsWithHomeOnly.locate(TEST.defaultExecutable, TEST.vaultPath),
    ).resolves.toBe(TEST.windowsFallbackScoopGitCandidate);
  });

  it('uses a configured executable path directly', async () => {
    const probe = new RecordingGitProbe(TEST.customExecutablePath);
    const locator = new GitExecutableLocator({ probe });

    await expect(locator.locate(TEST.customExecutablePath, TEST.vaultPath)).resolves.toBe(
      TEST.customExecutablePath,
    );
    expect(probe.candidates).toEqual([TEST.customExecutablePath]);
  });

  it('returns executable and version from locateWithVersion and falls back to null version for legacy probes', async () => {
    const versionProbe = new RecordingVersionProbe(
      TEST.linuxPathCandidate,
      TEST.expectedGitVersion,
    );
    const locatorWithVersion = new GitExecutableLocator({
      platform: TEST.linuxPlatform,
      environment: { [TEST.envPathKey]: TEST.linuxPathEnvironment },
      probe: versionProbe,
    });

    await expect(
      locatorWithVersion.locateWithVersion(TEST.defaultExecutable, TEST.vaultPath),
    ).resolves.toEqual({
      executable: TEST.linuxPathCandidate,
      version: TEST.expectedGitVersion,
    });

    const legacyProbe = new RecordingGitProbe(TEST.linuxPathCandidate);
    const legacyLocator = new GitExecutableLocator({
      platform: TEST.linuxPlatform,
      environment: { [TEST.envPathKey]: TEST.linuxPathEnvironment },
      probe: legacyProbe,
    });

    await expect(
      legacyLocator.locateWithVersion(TEST.defaultExecutable, TEST.vaultPath),
    ).resolves.toEqual({
      executable: TEST.linuxPathCandidate,
      version: null,
    });
  });

  it('validates candidates with the Git version command and extracts version string', async () => {
    const runner = new QueueProcessRunner([
      {
        exitCode: GIT_EXIT_CODES.success,
        stdout: TEST.gitVersionOutput,
        stderr: TEST.emptyString,
        termination: ProcessTermination.Exited,
      },
    ]);
    const probe = new NodeGitExecutableProbe(runner, {
      platform: TEST.linuxPlatform,
      canExecuteFile: alwaysExecutable,
    });

    await expect(
      probe.probeVersion(TEST.customExecutablePath, TEST.vaultPath),
    ).resolves.toBe(TEST.expectedGitVersion);
    expect(runner.requests).toHaveLength(TEST.oneRequest);
    expect(runner.requests[TEST.firstIndex]?.args).toEqual(GIT_ARGUMENTS.version);
  });

  it('rejects a non-Git executable or empty version output even when it exits successfully', async () => {
    const nonGitRunner = new QueueProcessRunner([
      {
        exitCode: GIT_EXIT_CODES.success,
        stdout: TEST.nonGitVersionOutput,
        stderr: TEST.emptyString,
        termination: ProcessTermination.Exited,
      },
    ]);
    const nonGitProbe = new NodeGitExecutableProbe(nonGitRunner, {
      platform: TEST.linuxPlatform,
      canExecuteFile: alwaysExecutable,
    });

    await expect(
      nonGitProbe.isGitExecutable(TEST.customExecutablePath, TEST.vaultPath),
    ).resolves.toBe(false);

    const emptyVersionRunner = new QueueProcessRunner([
      {
        exitCode: GIT_EXIT_CODES.success,
        stdout: TEST.emptyVersionOutput,
        stderr: TEST.emptyString,
        termination: ProcessTermination.Exited,
      },
    ]);
    const emptyVersionProbe = new NodeGitExecutableProbe(emptyVersionRunner, {
      platform: TEST.linuxPlatform,
      canExecuteFile: alwaysExecutable,
    });

    await expect(
      emptyVersionProbe.probeVersion(TEST.customExecutablePath, TEST.vaultPath),
    ).resolves.toBeNull();
  });

  it('skips missing files and directory paths without spawning a child process', async () => {
    const tempDirectory = await mkdtemp(path.join(tmpdir(), TEST.tempDirPrefix));
    tempDirectories.push(tempDirectory);
    const missingExecutable = path.join(tempDirectory, TEST.missingFileName);

    const runner = new QueueProcessRunner([]);
    const probe = new NodeGitExecutableProbe(runner);

    await expect(probe.probeVersion(missingExecutable, TEST.vaultPath)).resolves.toBeNull();
    await expect(probe.probeVersion(tempDirectory, TEST.vaultPath)).resolves.toBeNull();
    expect(runner.requests).toHaveLength(TEST.zeroRequests);

    const gatedProbe = new NodeGitExecutableProbe(runner, {
      platform: TEST.linuxPlatform,
      canExecuteFile: neverExecutable,
    });
    await expect(
      gatedProbe.isGitExecutable(TEST.customExecutablePath, TEST.vaultPath),
    ).resolves.toBe(false);
    expect(runner.requests).toHaveLength(TEST.zeroRequests);
  });

  it('guards macOS /usr/bin/git with xcode-select -p before running git --version', async () => {
    const missingCltRunner = new QueueProcessRunner([
      {
        exitCode: TEST.macOSXcodeSelectErrorExitCode,
        stdout: TEST.emptyString,
        stderr: TEST.emptyString,
        termination: ProcessTermination.Exited,
      },
    ]);
    const missingCltProbe = new NodeGitExecutableProbe(missingCltRunner, {
      platform: TEST.macOSPlatform,
      canExecuteFile: alwaysExecutable,
    });

    await expect(
      missingCltProbe.probeVersion(TEST.macOSSystemGitCandidate, TEST.vaultPath),
    ).resolves.toBeNull();
    expect(missingCltRunner.requests).toHaveLength(TEST.oneRequest);
    expect(missingCltRunner.requests[TEST.firstIndex]).toMatchObject({
      executable: TEST.macOSXcodeSelectExecutable,
      args: TEST.macOSXcodeSelectArgs,
    });

    const installedCltRunner = new QueueProcessRunner([
      {
        exitCode: GIT_EXIT_CODES.success,
        stdout: TEST.macOSDeveloperDirOutput,
        stderr: TEST.emptyString,
        termination: ProcessTermination.Exited,
      },
      {
        exitCode: GIT_EXIT_CODES.success,
        stdout: TEST.appleGitVersionOutput,
        stderr: TEST.emptyString,
        termination: ProcessTermination.Exited,
      },
    ]);
    const installedCltProbe = new NodeGitExecutableProbe(installedCltRunner, {
      platform: TEST.macOSPlatform,
      canExecuteFile: alwaysExecutable,
    });

    await expect(
      installedCltProbe.probeVersion(TEST.macOSSystemGitCandidate, TEST.vaultPath),
    ).resolves.toBe(TEST.expectedAppleGitVersion);
    expect(installedCltRunner.requests).toHaveLength(TEST.twoRequests);
    expect(installedCltRunner.requests[TEST.firstIndex]).toMatchObject({
      executable: TEST.macOSXcodeSelectExecutable,
      args: TEST.macOSXcodeSelectArgs,
    });
    expect(installedCltRunner.requests[TEST.secondIndex]).toMatchObject({
      executable: TEST.macOSSystemGitCandidate,
      args: GIT_ARGUMENTS.version,
    });

    const homebrewRunner = new QueueProcessRunner([
      {
        exitCode: GIT_EXIT_CODES.success,
        stdout: TEST.gitVersionOutput,
        stderr: TEST.emptyString,
        termination: ProcessTermination.Exited,
      },
    ]);
    const homebrewProbe = new NodeGitExecutableProbe(homebrewRunner, {
      platform: TEST.macOSPlatform,
      canExecuteFile: alwaysExecutable,
    });

    await expect(
      homebrewProbe.probeVersion(TEST.macOSHomebrewCandidate, TEST.vaultPath),
    ).resolves.toBe(TEST.expectedGitVersion);
    expect(homebrewRunner.requests).toHaveLength(TEST.oneRequest);
    expect(homebrewRunner.requests[TEST.firstIndex]?.executable).toBe(
      TEST.macOSHomebrewCandidate,
    );
  });

  it('returns null when the configured executable is unavailable', async () => {
    const probe = new RecordingGitProbe(TEST.customExecutablePath);
    const locator = new GitExecutableLocator({ probe });

    await expect(locator.locate(TEST.missingExecutablePath, TEST.vaultPath)).resolves.toBeNull();
  });
});
