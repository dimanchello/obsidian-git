import { describe, expect, it } from 'vitest';
import {
  GitExecutableLocator,
  NodeGitExecutableProbe,
  type GitExecutableProbe,
} from '../src/git/git-executable-locator';
import { GIT_LOCATOR_TEST_VALUES as TEST } from './git-executable-locator.fixtures';
import { ProcessTermination, type ProcessRequest, type ProcessResult, type ProcessRunner } from '../src/git/process-runner';
import { GIT_ARGUMENTS, GIT_EXIT_CODES } from '../src/git/git-constants';

class RecordingGitProbe implements GitExecutableProbe {
  public readonly candidates: string[] = [];

  public constructor(private readonly validExecutable: string) {}

  public async isGitExecutable(executable: string): Promise<boolean> {
    this.candidates.push(executable);
    return executable === this.validExecutable;
  }
}


class StaticProcessRunner implements ProcessRunner {
  public request: ProcessRequest | null = null;

  public constructor(private readonly result: ProcessResult) {}

  public run(request: ProcessRequest): Promise<ProcessResult> {
    this.request = request;
    return Promise.resolve(this.result);
  }
}

describe('GitExecutableLocator', () => {
  it('finds an installed Git executable in the current environment', async () => {
    const locator = new GitExecutableLocator();

    await expect(
      locator.locate(TEST.defaultExecutable, process.cwd()),
    ).resolves.not.toBeNull();
  });

  it('searches PATH before system defaults on Linux', async () => {
    const probe = new RecordingGitProbe(TEST.linuxPathCandidate);
    const locator = new GitExecutableLocator({
      platform: TEST.linuxPlatform,
      environment: { PATH: TEST.linuxPathEnvironment },
      homeDirectory: '/home/example',
      probe,
    });

    await expect(locator.locate(TEST.defaultExecutable, TEST.vaultPath)).resolves.toBe(
      TEST.linuxPathCandidate,
    );
    expect(probe.candidates[0]).toBe(TEST.linuxPathCandidate);
  });

  it('checks common Homebrew locations when macOS GUI PATH is incomplete', async () => {
    const probe = new RecordingGitProbe(TEST.macOSHomebrewCandidate);
    const locator = new GitExecutableLocator({
      platform: TEST.macOSPlatform,
      environment: { PATH: TEST.macOSPathEnvironment },
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
        PATH: TEST.windowsPathEnvironment,
        ProgramFiles: TEST.windowsProgramFiles,
      },
      homeDirectory: TEST.windowsHomeDirectory,
      probe,
    });

    await expect(locator.locate(TEST.defaultExecutable, TEST.vaultPath)).resolves.toBe(
      TEST.windowsGitCandidate,
    );
    expect(probe.candidates).toContain(TEST.windowsGitCandidate);
  });

  it('uses a configured executable path directly', async () => {
    const probe = new RecordingGitProbe(TEST.customExecutablePath);
    const locator = new GitExecutableLocator({ probe });

    await expect(locator.locate(TEST.customExecutablePath, TEST.vaultPath)).resolves.toBe(
      TEST.customExecutablePath,
    );
    expect(probe.candidates).toEqual([TEST.customExecutablePath]);
  });

  it('validates candidates with the Git version command', async () => {
    const runner = new StaticProcessRunner({
      exitCode: GIT_EXIT_CODES.success,
      stdout: TEST.gitVersionOutput,
      stderr: '',
      termination: ProcessTermination.Exited,
    });
    const probe = new NodeGitExecutableProbe(runner);

    await expect(
      probe.isGitExecutable(TEST.customExecutablePath, TEST.vaultPath),
    ).resolves.toBe(true);
    expect(runner.request?.args).toEqual(GIT_ARGUMENTS.version);
  });

  it('rejects a non-Git executable even when it exits successfully', async () => {
    const runner = new StaticProcessRunner({
      exitCode: GIT_EXIT_CODES.success,
      stdout: TEST.nonGitVersionOutput,
      stderr: '',
      termination: ProcessTermination.Exited,
    });
    const probe = new NodeGitExecutableProbe(runner);

    await expect(
      probe.isGitExecutable(TEST.customExecutablePath, TEST.vaultPath),
    ).resolves.toBe(false);
  });

  it('returns null when the configured executable is unavailable', async () => {
    const probe = new RecordingGitProbe(TEST.customExecutablePath);
    const locator = new GitExecutableLocator({ probe });

    await expect(locator.locate(TEST.missingExecutablePath, TEST.vaultPath)).resolves.toBeNull();
  });
});
