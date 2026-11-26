export enum ChangeKind {
  Conflict = 'conflict',
  Untracked = 'untracked',
  Added = 'added',
  Deleted = 'deleted',
  Renamed = 'renamed',
  Modified = 'modified',
  Other = 'other',
}

enum StatusRecordType {
  Ordinary = '1',
  Renamed = '2',
  Unmerged = 'u',
  Untracked = '?',
}

export enum FileStatusCode {
  Unchanged = '.',
  Untracked = '?',
  Unmerged = 'U',
  Added = 'A',
  Deleted = 'D',
  Renamed = 'R',
  Modified = 'M',
  TypeChanged = 'T',
  Other = '!',
}

const STATUS_FORMAT = {
  branchHeader: '# branch.head ',
  upstreamHeader: '# branch.upstream ',
  detachedHead: '(detached)',
  aheadBehindPattern: /^# branch\.ab \+(\d+) -(\d+)$/,
  untrackedPrefix: StatusRecordType.Untracked + ' ',
  fieldSeparator: ' ',
  tabSeparator: '\t',
  nullDelimiter: '\0',
  pathSeparator: '/',
  lineBreakPattern: /\r?\n/,
  leadingSlashesPattern: /^\/+/,
  trailingSlashesPattern: /\/+$/,
  trailingLineBreakPattern: /\r?\n$/,
} as const;

const STATUS_FIELD_INDEX = {
  recordType: 0,
  status: 1,
  firstCharacter: 0,
  secondCharacter: 1,
  branchAhead: 1,
  branchBehind: 2,
  ordinaryPathStart: 8,
  renamedPathStart: 9,
  unmergedPathStart: 10,
  notFound: -1,
} as const;

const STATUS_RECORD_STEP = {
  next: 1,
} as const;

const QUOTED_PATH_FORMAT = {
  quoteCharacter: '"',
  escapeCharacter: '\\',
  minimumLength: 2,
  firstInnerIndex: 1,
  quoteLength: 1,
  startIndex: 0,
  singleStep: 1,
  octalDigitCount: 3,
  octalRadix: 8,
  octalPattern: /^[0-7]{3}$/,
} as const;

const GIT_ESCAPE_BYTES: Readonly<Record<string, number>> = {
  a: 0x07,
  b: 0x08,
  t: 0x09,
  n: 0x0a,
  v: 0x0b,
  f: 0x0c,
  r: 0x0d,
  [QUOTED_PATH_FORMAT.quoteCharacter]: 0x22,
  [QUOTED_PATH_FORMAT.escapeCharacter]: 0x5c,
};

export const STATUS_COUNT_DEFAULTS = {
  none: 0,
} as const;

const EMPTY_STRING = '';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

const MODIFIED_STATUS_CODES = new Set<FileStatusCode>([
  FileStatusCode.Modified,
  FileStatusCode.TypeChanged,
]);

export interface GitFileChange {
  readonly kind: ChangeKind;
  readonly indexStatus: FileStatusCode;
  readonly worktreeStatus: FileStatusCode;
  readonly path: string;
  readonly origPath?: string;
  readonly staged: boolean;
  readonly unstaged: boolean;
  readonly inVault: boolean;
}

export interface GitStatus {
  readonly branch: string | null;
  readonly upstream: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly files: readonly GitFileChange[];
}

/** Decode a C-style quoted Git pathname into UTF-8 text when surrounded by double quotes. */
export function unquoteGitPath(rawPath: string): string {
  if (
    rawPath.length < QUOTED_PATH_FORMAT.minimumLength ||
    !rawPath.startsWith(QUOTED_PATH_FORMAT.quoteCharacter) ||
    !rawPath.endsWith(QUOTED_PATH_FORMAT.quoteCharacter)
  ) {
    return rawPath;
  }

  const inner = rawPath.slice(
    QUOTED_PATH_FORMAT.firstInnerIndex,
    rawPath.length - QUOTED_PATH_FORMAT.quoteLength,
  );
  const bytes: number[] = [];
  let unescapedStart: number = QUOTED_PATH_FORMAT.startIndex;

  for (let index: number = QUOTED_PATH_FORMAT.startIndex; index < inner.length; index++) {
    if (inner[index] !== QUOTED_PATH_FORMAT.escapeCharacter) {
      continue;
    }

    if (index > unescapedStart) {
      appendEncodedSlice(bytes, inner.slice(unescapedStart, index));
    }

    const nextIndex = index + QUOTED_PATH_FORMAT.singleStep;
    const escaped = inner[nextIndex];
    if (escaped === undefined) {
      appendEncodedSlice(bytes, QUOTED_PATH_FORMAT.escapeCharacter);
      unescapedStart = inner.length;
      break;
    }

    const octalSlice = inner.slice(nextIndex, nextIndex + QUOTED_PATH_FORMAT.octalDigitCount);
    if (QUOTED_PATH_FORMAT.octalPattern.test(octalSlice)) {
      bytes.push(parseInt(octalSlice, QUOTED_PATH_FORMAT.octalRadix));
      index += QUOTED_PATH_FORMAT.octalDigitCount;
      unescapedStart = index + QUOTED_PATH_FORMAT.singleStep;
      continue;
    }

    const escapedByte = GIT_ESCAPE_BYTES[escaped];
    if (escapedByte !== undefined) {
      bytes.push(escapedByte);
    } else {
      appendEncodedSlice(bytes, escaped);
    }
    index = nextIndex;
    unescapedStart = index + QUOTED_PATH_FORMAT.singleStep;
  }

  if (unescapedStart < inner.length) {
    appendEncodedSlice(bytes, inner.slice(unescapedStart));
  }

  return UTF8_DECODER.decode(Uint8Array.from(bytes));
}

function appendEncodedSlice(bytes: number[], text: string): void {
  for (const byte of UTF8_ENCODER.encode(text)) {
    bytes.push(byte);
  }
}

/** Parse Git porcelain v2 `--branch` status output in either `-z` NUL-delimited or line-delimited form. */
export function parseGitStatus(output: string, repoPrefix?: string): GitStatus {
  let branch: string | null = null;
  let upstream: string | null = null;
  let ahead: number = STATUS_COUNT_DEFAULTS.none;
  let behind: number = STATUS_COUNT_DEFAULTS.none;
  const files: GitFileChange[] = [];
  const normalizedPrefix = normalizeRepoPrefix(repoPrefix);
  const isNullDelimited = output.includes(STATUS_FORMAT.nullDelimiter);
  const records = output.split(
    isNullDelimited ? STATUS_FORMAT.nullDelimiter : STATUS_FORMAT.lineBreakPattern,
  );

  for (let index = STATUS_COUNT_DEFAULTS.none; index < records.length; index++) {
    const record = records[index];
    if (record === undefined || record.length === EMPTY_STRING.length) {
      continue;
    }

    if (record.startsWith(STATUS_FORMAT.branchHeader)) {
      const rawBranch = record.slice(STATUS_FORMAT.branchHeader.length);
      branch = rawBranch === STATUS_FORMAT.detachedHead ? null : rawBranch;
      continue;
    }

    if (record.startsWith(STATUS_FORMAT.upstreamHeader)) {
      const rawUpstream = record.slice(STATUS_FORMAT.upstreamHeader.length);
      upstream = rawUpstream.length > EMPTY_STRING.length ? rawUpstream : null;
      continue;
    }

    const aheadBehind = record.match(STATUS_FORMAT.aheadBehindPattern);
    if (aheadBehind !== null) {
      ahead = Number(aheadBehind[STATUS_FIELD_INDEX.branchAhead]);
      behind = Number(aheadBehind[STATUS_FIELD_INDEX.branchBehind]);
      continue;
    }

    const recordType = toStatusRecordType(record[STATUS_FIELD_INDEX.recordType]);
    let nextOrigPath: string | undefined;
    if (isNullDelimited && recordType === StatusRecordType.Renamed) {
      const nextToken = records[index + STATUS_RECORD_STEP.next];
      if (nextToken !== undefined) {
        nextOrigPath = nextToken;
        index += STATUS_RECORD_STEP.next;
      }
    }

    const file = parseFileRecord(record, isNullDelimited, normalizedPrefix, nextOrigPath);
    if (file !== null) {
      files.push(file);
    }
  }

  return { branch, upstream, ahead, behind, files };
}

function normalizeRepoPrefix(repoPrefix?: string): string {
  if (repoPrefix === undefined) return EMPTY_STRING;
  const withoutTrailingLineBreak = repoPrefix.replace(
    STATUS_FORMAT.trailingLineBreakPattern,
    EMPTY_STRING,
  );
  const stripped = withoutTrailingLineBreak
    .replace(STATUS_FORMAT.leadingSlashesPattern, EMPTY_STRING)
    .replace(STATUS_FORMAT.trailingSlashesPattern, EMPTY_STRING);
  if (stripped.length === EMPTY_STRING.length) return EMPTY_STRING;
  return stripped + STATUS_FORMAT.pathSeparator;
}

function resolveVaultPath(
  rawPath: string,
  normalizedPrefix: string,
): { readonly path: string; readonly inVault: boolean } {
  if (normalizedPrefix.length === EMPTY_STRING.length) {
    return { path: rawPath, inVault: true };
  }
  if (!rawPath.startsWith(normalizedPrefix)) {
    return { path: rawPath, inVault: false };
  }
  const stripped = rawPath.slice(normalizedPrefix.length);
  return {
    path: stripped.length > EMPTY_STRING.length ? stripped : rawPath,
    inVault: true,
  };
}

function parseFileRecord(
  record: string,
  isNullDelimited: boolean,
  normalizedPrefix: string,
  nextOrigPath?: string,
): GitFileChange | null {
  const recordType = toStatusRecordType(record[STATUS_FIELD_INDEX.recordType]);
  if (recordType === StatusRecordType.Untracked && record.startsWith(STATUS_FORMAT.untrackedPrefix)) {
    const rawPath = record.slice(STATUS_FORMAT.untrackedPrefix.length);
    const decodedPath = isNullDelimited ? rawPath : unquoteGitPath(rawPath);
    if (decodedPath.length === EMPTY_STRING.length) return null;
    const resolved = resolveVaultPath(decodedPath, normalizedPrefix);
    return {
      kind: ChangeKind.Untracked,
      indexStatus: FileStatusCode.Untracked,
      worktreeStatus: FileStatusCode.Untracked,
      path: resolved.path,
      staged: false,
      unstaged: false,
      inVault: resolved.inVault,
    };
  }

  if (
    recordType !== StatusRecordType.Ordinary &&
    recordType !== StatusRecordType.Renamed &&
    recordType !== StatusRecordType.Unmerged
  ) {
    return null;
  }

  const fields = record.split(STATUS_FORMAT.fieldSeparator);
  const status = fields[STATUS_FIELD_INDEX.status];
  if (status === undefined) return null;

  const pathStart = getPathStart(recordType);
  const pathPayload = fields.slice(pathStart).join(STATUS_FORMAT.fieldSeparator);
  if (pathPayload.length === EMPTY_STRING.length) return null;

  const { targetPath, origPath: decodedOrigPath } = extractRecordPaths(
    recordType,
    pathPayload,
    isNullDelimited,
    nextOrigPath,
  );
  if (targetPath.length === EMPTY_STRING.length) return null;

  const resolvedTarget = resolveVaultPath(targetPath, normalizedPrefix);
  const resolvedOrigPath =
    decodedOrigPath !== undefined && decodedOrigPath.length > EMPTY_STRING.length
      ? resolveVaultPath(decodedOrigPath, normalizedPrefix).path
      : undefined;

  const indexStatus = toFileStatusCode(status[STATUS_FIELD_INDEX.firstCharacter]);
  const worktreeStatus = toFileStatusCode(status[STATUS_FIELD_INDEX.secondCharacter]);
  const kind = classifyChange(recordType, indexStatus, worktreeStatus);
  const isConflictOrUntracked = kind === ChangeKind.Conflict || kind === ChangeKind.Untracked;
  const staged =
    !isConflictOrUntracked &&
    indexStatus !== FileStatusCode.Unchanged &&
    indexStatus !== FileStatusCode.Untracked;
  const unstaged =
    !isConflictOrUntracked &&
    worktreeStatus !== FileStatusCode.Unchanged &&
    worktreeStatus !== FileStatusCode.Untracked;

  return {
    kind,
    indexStatus,
    worktreeStatus,
    path: resolvedTarget.path,
    ...(resolvedOrigPath === undefined ? {} : { origPath: resolvedOrigPath }),
    staged,
    unstaged,
    inVault: resolvedTarget.inVault,
  };
}

function extractRecordPaths(
  recordType: StatusRecordType,
  pathPayload: string,
  isNullDelimited: boolean,
  nextOrigPath?: string,
): { readonly targetPath: string; readonly origPath?: string } {
  if (recordType !== StatusRecordType.Renamed) {
    return {
      targetPath: isNullDelimited ? pathPayload : unquoteGitPath(pathPayload),
    };
  }

  if (isNullDelimited) {
    return {
      targetPath: pathPayload,
      ...(nextOrigPath === undefined ? {} : { origPath: nextOrigPath }),
    };
  }

  const tabIndex = pathPayload.indexOf(STATUS_FORMAT.tabSeparator);
  if (tabIndex === STATUS_FIELD_INDEX.notFound) {
    return { targetPath: unquoteGitPath(pathPayload) };
  }

  return {
    targetPath: unquoteGitPath(pathPayload.slice(STATUS_FIELD_INDEX.firstCharacter, tabIndex)),
    origPath: unquoteGitPath(pathPayload.slice(tabIndex + STATUS_RECORD_STEP.next)),
  };
}

function getPathStart(recordType: StatusRecordType): number {
  switch (recordType) {
    case StatusRecordType.Ordinary:
      return STATUS_FIELD_INDEX.ordinaryPathStart;
    case StatusRecordType.Renamed:
      return STATUS_FIELD_INDEX.renamedPathStart;
    case StatusRecordType.Unmerged:
      return STATUS_FIELD_INDEX.unmergedPathStart;
    default:
      return STATUS_FIELD_INDEX.ordinaryPathStart;
  }
}

function toStatusRecordType(char: string | undefined): StatusRecordType | null {
  switch (char) {
    case StatusRecordType.Ordinary:
      return StatusRecordType.Ordinary;
    case StatusRecordType.Renamed:
      return StatusRecordType.Renamed;
    case StatusRecordType.Unmerged:
      return StatusRecordType.Unmerged;
    case StatusRecordType.Untracked:
      return StatusRecordType.Untracked;
    default:
      return null;
  }
}

function toFileStatusCode(char: string | undefined): FileStatusCode {
  switch (char) {
    case FileStatusCode.Untracked:
      return FileStatusCode.Untracked;
    case FileStatusCode.Unmerged:
      return FileStatusCode.Unmerged;
    case FileStatusCode.Added:
      return FileStatusCode.Added;
    case FileStatusCode.Deleted:
      return FileStatusCode.Deleted;
    case FileStatusCode.Renamed:
      return FileStatusCode.Renamed;
    case FileStatusCode.Modified:
      return FileStatusCode.Modified;
    case FileStatusCode.TypeChanged:
      return FileStatusCode.TypeChanged;
    case FileStatusCode.Unchanged:
      return FileStatusCode.Unchanged;
    default:
      return FileStatusCode.Other;
  }
}

function classifyChange(
  recordType: StatusRecordType,
  indexStatus: FileStatusCode,
  worktreeStatus: FileStatusCode,
): ChangeKind {
  if (
    recordType === StatusRecordType.Unmerged ||
    indexStatus === FileStatusCode.Unmerged ||
    worktreeStatus === FileStatusCode.Unmerged ||
    (indexStatus === FileStatusCode.Added && worktreeStatus === FileStatusCode.Added) ||
    (indexStatus === FileStatusCode.Deleted && worktreeStatus === FileStatusCode.Deleted)
  ) {
    return ChangeKind.Conflict;
  }
  if (indexStatus === FileStatusCode.Untracked && worktreeStatus === FileStatusCode.Untracked) {
    return ChangeKind.Untracked;
  }
  if (indexStatus === FileStatusCode.Added || worktreeStatus === FileStatusCode.Added) {
    return ChangeKind.Added;
  }
  if (indexStatus === FileStatusCode.Deleted || worktreeStatus === FileStatusCode.Deleted) {
    return ChangeKind.Deleted;
  }
  if (
    indexStatus === FileStatusCode.Renamed ||
    worktreeStatus === FileStatusCode.Renamed ||
    recordType === StatusRecordType.Renamed
  ) {
    return ChangeKind.Renamed;
  }
  if (MODIFIED_STATUS_CODES.has(indexStatus) || MODIFIED_STATUS_CODES.has(worktreeStatus)) {
    return ChangeKind.Modified;
  }
  return ChangeKind.Other;
}
