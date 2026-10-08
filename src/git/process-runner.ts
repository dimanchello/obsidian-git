import { execFile } from 'node:child_process';
import type { ExecFileException, ExecFileOptions } from 'node:child_process';

export enum ProcessTermination {
  Exited = 'exited',
  LaunchError = 'launch-error',
  Timeout = 'timeout',
  Aborted = 'aborted',
}

export interface ProcessRequest {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface ProcessResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly termination: ProcessTermination;
  readonly errorMessage?: string;
}

export interface ProcessRunner {
  run(request: ProcessRequest): Promise<ProcessResult>;
}

const TIME_UNITS = {
  millisecondsPerSecond: 1_000,
  secondsPerMinute: 60,
  bytesPerKibibyte: 1_024,
} as const;

const PROCESS_LIMITS = {
  defaultTimeoutSeconds: 120,
  maxOutputMebibytes: 10,
} as const;

const PROCESS_ENVIRONMENT = {
  localeVariable: 'LC_ALL',
  localeValue: 'C',
  terminalPromptVariable: 'GIT_TERMINAL_PROMPT',
  terminalPromptDisabled: '0',
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
const BYTES_PER_MEBIBYTE = TIME_UNITS.bytesPerKibibyte * TIME_UNITS.bytesPerKibibyte;
const MAX_OUTPUT_BYTES = PROCESS_LIMITS.maxOutputMebibytes * BYTES_PER_MEBIBYTE;

export class NodeProcessRunner implements ProcessRunner {
  public run(request: ProcessRequest): Promise<ProcessResult> {
    return new Promise((resolve) => {
      const options: ExecFileOptions = {
        cwd: request.cwd,
        env: {
          ...process.env,
          [PROCESS_ENVIRONMENT.localeVariable]: PROCESS_ENVIRONMENT.localeValue,
          [PROCESS_ENVIRONMENT.terminalPromptVariable]: PROCESS_ENVIRONMENT.terminalPromptDisabled,
        },
        encoding: PROCESS_ENCODING.utf8,
        maxBuffer: MAX_OUTPUT_BYTES,
        timeout: request.timeoutMs ?? PROCESS_TIMEOUT_MS,
        windowsHide: true,
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

        resolve(this.toResult(error, output));
      });
    });
  }

  private toResult(
    error: ExecFileException,
    output: { readonly stdout: string; readonly stderr: string },
  ): ProcessResult {
    const code = isNumericExitCode(error.code) ? error.code : null;
    const termination =
      error.name === PROCESS_ERROR_NAMES.aborted
        ? ProcessTermination.Aborted
        : error.killed && error.signal === PROCESS_SIGNALS.terminated
          ? ProcessTermination.Timeout
          : code !== null
            ? ProcessTermination.Exited
            : ProcessTermination.LaunchError;

    return {
      ...output,
      exitCode: code,
      termination,
      errorMessage: error.message,
    };
  }
}


function isNumericExitCode(code: ExecFileException['code']): code is number {
  return typeof code === JAVASCRIPT_TYPE_NAMES.number;
}
