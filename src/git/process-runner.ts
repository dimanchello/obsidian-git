import { execFile } from 'node:child_process';
import type { ExecFileException, ExecFileOptions } from 'node:child_process';
import * as path from 'node:path';

export enum ProcessTermination {
  Exited = 'exited',
  LaunchError = 'launch-error',
  Timeout = 'timeout',
  Aborted = 'aborted',
  BufferOverflow = 'buffer-overflow',
  KilledBySignal = 'killed-by-signal',
}

export interface ProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly extraPathDirs?: readonly string[];
}

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly termination: ProcessTermination;
  readonly errorMessage?: string;
}

export interface ProcessTerminationError {
  readonly code?: string | number | null | undefined;
  readonly killed?: boolean | undefined;
  readonly signal?: NodeJS.Signals | null | undefined;
}

export interface ProcessRunner {
  run(request: ProcessRequest): Promise<ProcessResult>;
}

const TIME_UNITS = {
  millisecondsPerSecond: 1_000,
  secondsPerMinute: 60,
} as const;

const DATA_SIZE_UNITS = {
  bytesPerKibibyte: 1_024,
} as const;

const PROCESS_LIMITS = {
  defaultTimeoutSeconds: 120,
  maxOutputMebibytes: 10,
} as const;

const NODE_PLATFORMS = {
  windows: 'win32',
} as const;

const PATH_SYNTAX = {
  forwardSlash: '/',
  backslash: '\\',
  emptyString: '',
} as const;

const COLLECTION_POSITIONS = {
  empty: 0,
  firstIndex: 0,
} as const;

const PROCESS_ENVIRONMENT = {
  localeVariable: 'LC_MESSAGES',
  localeValue: 'C',
  terminalPromptVariable: 'GIT_TERMINAL_PROMPT',
  terminalPromptDisabled: '0',
  pathVariable: 'PATH',
} as const;

const PROCESS_ENCODING = {
  utf8: 'utf8',
} as const;

const PROCESS_SIGNALS = {
  terminated: 'SIGTERM',
} as const;

const PROCESS_ERROR_NAMES = {
  aborted: 'AbortError',
} as const;

const PROCESS_ERROR_CODES = {
  aborted: 'ABORT_ERR',
  maxBufferExceeded: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
} as const;

const JAVASCRIPT_TYPE_NAMES = {
  number: 'number',
} as const;

const PROCESS_EXIT_CODES = {
  success: 0,
} as const;

const PROCESS_TIMEOUT_MS =
  PROCESS_LIMITS.defaultTimeoutSeconds *
  TIME_UNITS.secondsPerMinute *
  TIME_UNITS.millisecondsPerSecond;
const BYTES_PER_MEBIBYTE =
  DATA_SIZE_UNITS.bytesPerKibibyte * DATA_SIZE_UNITS.bytesPerKibibyte;
const MAX_OUTPUT_BYTES = PROCESS_LIMITS.maxOutputMebibytes * BYTES_PER_MEBIBYTE;

export class NodeProcessRunner implements ProcessRunner {
  public run(request: ProcessRequest): Promise<ProcessResult> {
    return new Promise((resolve) => {
      const options: ExecFileOptions = {
        cwd: request.cwd,
        env: buildProcessEnvironment(request),
        encoding: PROCESS_ENCODING.utf8,
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: request.timeoutMs ?? PROCESS_TIMEOUT_MS,
        windowsHide: true,
        shell: false,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
      };

      execFile(request.executable, [...request.args], options, (error, stdout, stderr) => {
        const output = {
          stdout: String(stdout),
          stderr: String(stderr),
        };

        if (error === null) {
          resolve({
            ...output,
            exitCode: PROCESS_EXIT_CODES.success,
            termination: ProcessTermination.Exited,
          });
          return;
        }

        resolve(this.toResult(error, output, request.signal));
      });
    });
  }

  private toResult(
    error: ExecFileException,
    output: { readonly stdout: string; readonly stderr: string },
    signal?: AbortSignal,
  ): ProcessResult {
    const code = isNumericExitCode(error.code) ? error.code : null;
    const isAborted =
      error.name === PROCESS_ERROR_NAMES.aborted ||
      error.code === PROCESS_ERROR_CODES.aborted ||
      signal?.aborted === true;
    const termination = classifyProcessTermination(error, code, isAborted);

    return {
      ...output,
      exitCode: code,
      termination,
      errorMessage: error.message,
    };
  }
}

/**
 * Builds the child-process environment with safe Git defaults and an augmented PATH.
 */
export function buildProcessEnvironment(
  request: Pick<ProcessRequest, 'executable' | 'extraPathDirs'>,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): NodeJS.ProcessEnv {
  const pathApi = platform === NODE_PLATFORMS.windows ? path.win32 : path.posix;
  const environment: NodeJS.ProcessEnv = {
    ...baseEnvironment,
    [PROCESS_ENVIRONMENT.localeVariable]: PROCESS_ENVIRONMENT.localeValue,
    [PROCESS_ENVIRONMENT.terminalPromptVariable]: PROCESS_ENVIRONMENT.terminalPromptDisabled,
  };

  const prependedDirectories = collectPrependedDirectories(request, pathApi);
  if (prependedDirectories.length === COLLECTION_POSITIONS.empty) {
    return environment;
  }

  const isWindows = platform === NODE_PLATFORMS.windows;
  const existingPathKeys = isWindows
    ? Object.keys(environment).filter(
        (key) => key.toUpperCase() === PROCESS_ENVIRONMENT.pathVariable,
      )
    : [PROCESS_ENVIRONMENT.pathVariable];
  const targetPathKey =
    existingPathKeys.find((key) => key === PROCESS_ENVIRONMENT.pathVariable) ??
    existingPathKeys[COLLECTION_POSITIONS.firstIndex] ??
    PROCESS_ENVIRONMENT.pathVariable;

  const existingEntries: string[] = [];
  for (const key of existingPathKeys) {
    const rawValue = environment[key];
    if (rawValue !== undefined) {
      for (const segment of rawValue.split(pathApi.delimiter)) {
        if (segment.length > PATH_SYNTAX.emptyString.length) {
          existingEntries.push(segment);
        }
      }
    }
    if (isWindows) {
      delete environment[key];
    }
  }

  const deduplicatedEntries = deduplicatePathEntries(
    [...prependedDirectories, ...existingEntries],
    isWindows,
  );
  environment[targetPathKey] = deduplicatedEntries.join(pathApi.delimiter);
  return environment;
}

/**
 * Classifies how a child process terminated given its error details and exit code.
 */
export function classifyProcessTermination(
  error: ProcessTerminationError,
  exitCode: number | null,
  isAborted: boolean,
): ProcessTermination {
  if (isAborted) {
    return ProcessTermination.Aborted;
  }
  if (error.code === PROCESS_ERROR_CODES.maxBufferExceeded) {
    return ProcessTermination.BufferOverflow;
  }
  if (error.killed && error.signal === PROCESS_SIGNALS.terminated) {
    return ProcessTermination.Timeout;
  }
  if (error.signal !== undefined && error.signal !== null && exitCode === null) {
    return ProcessTermination.KilledBySignal;
  }
  if (exitCode !== null) {
    return ProcessTermination.Exited;
  }
  return ProcessTermination.LaunchError;
}

function collectPrependedDirectories(
  request: Pick<ProcessRequest, 'executable' | 'extraPathDirs'>,
  pathApi: path.PlatformPath,
): readonly string[] {
  const directories: string[] = [];
  if (isPathLikeExecutable(request.executable, pathApi)) {
    const executableDirectory = pathApi.dirname(request.executable);
    if (executableDirectory.length > PATH_SYNTAX.emptyString.length) {
      directories.push(executableDirectory);
    }
  }

  if (request.extraPathDirs !== undefined) {
    for (const directory of request.extraPathDirs) {
      if (directory.trim().length > PATH_SYNTAX.emptyString.length) {
        directories.push(directory);
      }
    }
  }

  return directories;
}

function isPathLikeExecutable(executable: string, pathApi: path.PlatformPath): boolean {
  return (
    pathApi.isAbsolute(executable) ||
    executable.includes(PATH_SYNTAX.forwardSlash) ||
    executable.includes(PATH_SYNTAX.backslash)
  );
}

function deduplicatePathEntries(
  entries: readonly string[],
  caseInsensitive: boolean,
): readonly string[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const normalized = caseInsensitive ? entry.toLowerCase() : entry;
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function isNumericExitCode(code: ExecFileException['code']): code is number {
  return typeof code === JAVASCRIPT_TYPE_NAMES.number;
}
