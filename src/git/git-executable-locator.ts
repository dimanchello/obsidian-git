import { homedir } from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner, ProcessTermination, type ProcessRunner } from './process-runner';
import { DEFAULT_GIT_EXECUTABLE, GIT_ARGUMENTS, GIT_EXIT_CODES } from './git-constants';

const NODE_PLATFORMS = {
  windows: 'win32',
  macOS: 'darwin',
} as const;

const PATH_SYNTAX = {
  forwardSlash: '/',
  backslash: '\\',
  windowsExecutableSuffix: '.exe',
} as const;

const ENVIRONMENT_VARIABLES = {
  path: 'PATH',
  windowsPath: 'Path',
  programFiles: 'ProgramFiles',
  programFilesX86: 'ProgramFiles(x86)',
  localAppData: 'LOCALAPPDATA',
  programData: 'ProgramData',
  systemDrive: 'SystemDrive',
  userProfile: 'USERPROFILE',
  chocolateyInstall: 'ChocolateyInstall',
} as const;

const WINDOWS_INSTALLATION_PATHS = {
  programFiles: 'C:\\Program Files',
  programFilesX86: 'C:\\Program Files (x86)',
  systemDrive: 'C:',
  gitDirectory: 'Git',
  commandDirectory: 'cmd',
  binaryDirectory: 'bin',
  executableName: 'git.exe',
  programsDirectory: 'Programs',
  applicationDataDirectory: 'AppData',
  localDirectory: 'Local',
  scoopDirectory: 'scoop',
  applicationsDirectory: 'apps',
  currentVersionDirectory: 'current',
  chocolateyBinaryDirectory: 'bin',
  programDataDirectory: 'ProgramData',
  chocolateyDirectory: 'chocolatey',
  scoopGitDirectory: 'git',
} as const;

const LINUX_INSTALLATION_PATHS = {
  homebrewDirectory: '.linuxbrew',
  binaryDirectory: 'bin',
} as const;

const POSIX_GIT_EXECUTABLES = {
  linux: [
    '/usr/bin/git',
    '/usr/local/bin/git',
    '/bin/git',
    '/snap/bin/git',
    '/home/linuxbrew/.linuxbrew/bin/git',
  ],
  macOS: [
    '/opt/homebrew/bin/git',
    '/usr/local/bin/git',
    '/opt/local/bin/git',
  ],
  macOSSystemGitFallback: '/usr/bin/git',
} as const;

const GIT_VERSION_PROBE = {
  outputPrefix: 'git version ',
  timeoutMs: 5_000,
} as const;

const EMPTY_STRING = '';

export const GIT_EXECUTABLE_RESOLUTION_STATE = {
  firstGeneration: 0,
} as const;

export interface GitExecutableProbe {
  isGitExecutable(executable: string, cwd: string): Promise<boolean>;
}

export interface GitExecutableLocatorOptions {
  readonly platform?: NodeJS.Platform;
  readonly environment?: NodeJS.ProcessEnv;
  readonly homeDirectory?: string;
  readonly probe?: GitExecutableProbe;
}

export class NodeGitExecutableProbe implements GitExecutableProbe {
  public constructor(private readonly runner: ProcessRunner = new NodeProcessRunner()) {}

  public async isGitExecutable(executable: string, cwd: string): Promise<boolean> {
    const result = await this.runner.run({
      executable,
      args: GIT_ARGUMENTS.version,
      cwd,
      timeoutMs: GIT_VERSION_PROBE.timeoutMs,
    });
    return (
      result.exitCode === GIT_EXIT_CODES.success &&
      result.termination === ProcessTermination.Exited &&
      result.stdout.trim().startsWith(GIT_VERSION_PROBE.outputPrefix)
    );
  }
}

export class GitExecutableLocator {
  private readonly platform: NodeJS.Platform;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly homeDirectory: string;
  private readonly probe: GitExecutableProbe;

  public constructor(options: GitExecutableLocatorOptions = {}) {
    this.platform = options.platform ?? process.platform;
    this.environment = options.environment ?? process.env;
    this.homeDirectory =
      options.homeDirectory ??
      this.environment[ENVIRONMENT_VARIABLES.userProfile] ??
      homedir();
    this.probe = options.probe ?? new NodeGitExecutableProbe();
  }

  public async locate(configuredExecutable: string, cwd: string): Promise<string | null> {
    for (const candidate of this.getCandidates(configuredExecutable)) {
      if (await this.probe.isGitExecutable(candidate, cwd)) return candidate;
    }
    return null;
  }

  private getCandidates(configuredExecutable: string): readonly string[] {
    const executable = configuredExecutable.trim();
    if (executable.length === EMPTY_STRING.length) return [];

    const pathApi = this.platform === NODE_PLATFORMS.windows ? path.win32 : path.posix;
    const executableNames = this.getExecutableNames(executable, pathApi);
    if (this.isPathLike(executable, pathApi)) {
      return this.unique(executableNames);
    }

    const environmentPath =
      this.environment[ENVIRONMENT_VARIABLES.path] ??
      this.environment[ENVIRONMENT_VARIABLES.windowsPath] ??
      EMPTY_STRING;
    const pathCandidates = environmentPath
      .split(pathApi.delimiter)
      .filter((directory) => directory.length > EMPTY_STRING.length)
      .flatMap((directory) =>
        executableNames.map((name) => pathApi.join(directory, name)),
      );
    const knownCandidates = this.isDefaultGitCommand(executable, pathApi)
      ? this.getKnownInstallationPaths(pathApi)
      : [];

    const candidates = [...pathCandidates, ...knownCandidates];
    if (this.platform === NODE_PLATFORMS.macOS) {
      const systemGit = POSIX_GIT_EXECUTABLES.macOSSystemGitFallback;
      return this.unique([
        ...candidates.filter((candidate) => candidate !== systemGit),
        systemGit,
      ]);
    }
    return this.unique(candidates);
  }

  private getExecutableNames(
    executable: string,
    pathApi: path.PlatformPath,
  ): readonly string[] {
    if (
      this.platform !== NODE_PLATFORMS.windows ||
      pathApi.extname(executable).length > EMPTY_STRING.length
    ) {
      return [executable];
    }
    return [executable + PATH_SYNTAX.windowsExecutableSuffix, executable];
  }

  private isPathLike(
    executable: string,
    pathApi: path.PlatformPath,
  ): boolean {
    return (
      pathApi.isAbsolute(executable) ||
      executable.includes(PATH_SYNTAX.forwardSlash) ||
      executable.includes(PATH_SYNTAX.backslash)
    );
  }

  private isDefaultGitCommand(
    executable: string,
    pathApi: path.PlatformPath,
  ): boolean {
    const basename = pathApi.basename(executable);
    const normalizedName =
      this.platform === NODE_PLATFORMS.windows ? basename.toLowerCase() : basename;
    return (
      normalizedName === DEFAULT_GIT_EXECUTABLE ||
      (this.platform === NODE_PLATFORMS.windows &&
        normalizedName === WINDOWS_INSTALLATION_PATHS.executableName)
    );
  }

  private getKnownInstallationPaths(
    pathApi: path.PlatformPath,
  ): readonly string[] {
    if (this.platform === NODE_PLATFORMS.windows) {
      return this.getWindowsInstallationPaths(path.win32);
    }
    if (this.platform === NODE_PLATFORMS.macOS) return POSIX_GIT_EXECUTABLES.macOS;
    return [
      ...POSIX_GIT_EXECUTABLES.linux,
      pathApi.join(
        this.homeDirectory,
        LINUX_INSTALLATION_PATHS.homebrewDirectory,
        LINUX_INSTALLATION_PATHS.binaryDirectory,
        DEFAULT_GIT_EXECUTABLE,
      ),
    ];
  }

  private getWindowsInstallationPaths(pathApi: typeof path.win32): readonly string[] {
    const programFiles =
      this.environment[ENVIRONMENT_VARIABLES.programFiles] ??
      WINDOWS_INSTALLATION_PATHS.programFiles;
    const programFilesX86 =
      this.environment[ENVIRONMENT_VARIABLES.programFilesX86] ??
      WINDOWS_INSTALLATION_PATHS.programFilesX86;
    const localAppData =
      this.environment[ENVIRONMENT_VARIABLES.localAppData] ??
      pathApi.join(
        this.homeDirectory,
        WINDOWS_INSTALLATION_PATHS.applicationDataDirectory,
        WINDOWS_INSTALLATION_PATHS.localDirectory,
      );
    const systemDrive =
      this.environment[ENVIRONMENT_VARIABLES.systemDrive] ??
      WINDOWS_INSTALLATION_PATHS.systemDrive;
    const programData =
      this.environment[ENVIRONMENT_VARIABLES.programData] ??
      pathApi.join(systemDrive, WINDOWS_INSTALLATION_PATHS.programDataDirectory);
    const chocolateyInstall =
      this.environment[ENVIRONMENT_VARIABLES.chocolateyInstall] ??
      pathApi.join(programData, WINDOWS_INSTALLATION_PATHS.chocolateyDirectory);

    return [
      pathApi.join(
        programFiles,
        WINDOWS_INSTALLATION_PATHS.gitDirectory,
        WINDOWS_INSTALLATION_PATHS.commandDirectory,
        WINDOWS_INSTALLATION_PATHS.executableName,
      ),
      pathApi.join(
        programFiles,
        WINDOWS_INSTALLATION_PATHS.gitDirectory,
        WINDOWS_INSTALLATION_PATHS.binaryDirectory,
        WINDOWS_INSTALLATION_PATHS.executableName,
      ),
      pathApi.join(
        programFilesX86,
        WINDOWS_INSTALLATION_PATHS.gitDirectory,
        WINDOWS_INSTALLATION_PATHS.commandDirectory,
        WINDOWS_INSTALLATION_PATHS.executableName,
      ),
      pathApi.join(
        localAppData,
        WINDOWS_INSTALLATION_PATHS.programsDirectory,
        WINDOWS_INSTALLATION_PATHS.gitDirectory,
        WINDOWS_INSTALLATION_PATHS.commandDirectory,
        WINDOWS_INSTALLATION_PATHS.executableName,
      ),
      pathApi.join(
        this.homeDirectory,
        WINDOWS_INSTALLATION_PATHS.scoopDirectory,
        WINDOWS_INSTALLATION_PATHS.applicationsDirectory,
        WINDOWS_INSTALLATION_PATHS.scoopGitDirectory,
        WINDOWS_INSTALLATION_PATHS.currentVersionDirectory,
        WINDOWS_INSTALLATION_PATHS.commandDirectory,
        WINDOWS_INSTALLATION_PATHS.executableName,
      ),
      pathApi.join(
        chocolateyInstall,
        WINDOWS_INSTALLATION_PATHS.chocolateyBinaryDirectory,
        WINDOWS_INSTALLATION_PATHS.executableName,
      ),
    ];
  }

  private unique(candidates: readonly string[]): readonly string[] {
    const seen = new Set<string>();
    return candidates.filter((candidate) => {
      const normalized =
        this.platform === NODE_PLATFORMS.windows ? candidate.toLowerCase() : candidate;
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  }
}
