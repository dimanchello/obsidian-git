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

enum FileStatusCode {
  Unchanged = '.',
  Untracked = '?',
  Unmerged = 'U',
  Added = 'A',
  Deleted = 'D',
  Renamed = 'R',
  Modified = 'M',
  TypeChanged = 'T',
}

const STATUS_FORMAT = {
  branchHeader: '# branch.head ',
  aheadBehindPattern: /^# branch\.ab \+(\d+) -(\d+)$/,
  untrackedPrefix: StatusRecordType.Untracked + ' ',
  fieldSeparator: ' ',
  lineBreakPattern: /\r?\n/,
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
} as const;

export const STATUS_COUNT_DEFAULTS = {
  none: 0,
} as const;

const EMPTY_STRING = '';

const MODIFIED_STATUS_CODES = new Set<string>([
  FileStatusCode.Modified,
  FileStatusCode.TypeChanged,
]);

export interface GitFileChange {
  readonly kind: ChangeKind;
  readonly indexStatus: string;
  readonly worktreeStatus: string;
  readonly path: string;
  readonly staged: boolean;
}

export interface GitStatus {
  readonly branch: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly files: readonly GitFileChange[];
}

export function parseGitStatus(output: string): GitStatus {
  let branch: string | null = null;
  let ahead: number = STATUS_COUNT_DEFAULTS.none;
  let behind: number = STATUS_COUNT_DEFAULTS.none;
  const files: GitFileChange[] = [];

  for (const line of output.split(STATUS_FORMAT.lineBreakPattern)) {
    if (line.startsWith(STATUS_FORMAT.branchHeader)) {
      branch = line.slice(STATUS_FORMAT.branchHeader.length);
      continue;
    }

    const aheadBehind = line.match(STATUS_FORMAT.aheadBehindPattern);
    if (aheadBehind !== null) {
      ahead = Number(aheadBehind[STATUS_FIELD_INDEX.branchAhead]);
      behind = Number(aheadBehind[STATUS_FIELD_INDEX.branchBehind]);
      continue;
    }

    const file = parseFileLine(line);
    if (file !== null) files.push(file);
  }

  return { branch, ahead, behind, files };
}

function parseFileLine(line: string): GitFileChange | null {
  const recordType = line[STATUS_FIELD_INDEX.recordType];
  if (recordType === StatusRecordType.Untracked && line.startsWith(STATUS_FORMAT.untrackedPrefix)) {
    return {
      kind: ChangeKind.Untracked,
      indexStatus: FileStatusCode.Untracked,
      worktreeStatus: FileStatusCode.Untracked,
      path: line.slice(STATUS_FORMAT.untrackedPrefix.length),
      staged: false,
    };
  }

  if (
    recordType !== StatusRecordType.Ordinary &&
    recordType !== StatusRecordType.Renamed &&
    recordType !== StatusRecordType.Unmerged
  ) {
    return null;
  }

  const fields = line.split(STATUS_FORMAT.fieldSeparator);
  const status = fields[STATUS_FIELD_INDEX.status];
  if (status === undefined) return null;

  const pathStart = getPathStart(recordType);
  const path = fields.slice(pathStart).join(STATUS_FORMAT.fieldSeparator);
  if (path.length === EMPTY_STRING.length) return null;

  const indexStatus = status[STATUS_FIELD_INDEX.firstCharacter] ?? FileStatusCode.Unchanged;
  const worktreeStatus = status[STATUS_FIELD_INDEX.secondCharacter] ?? FileStatusCode.Unchanged;

  return {
    kind: classifyChange(recordType, indexStatus, worktreeStatus),
    indexStatus,
    worktreeStatus,
    path,
    staged: indexStatus !== FileStatusCode.Unchanged && indexStatus !== FileStatusCode.Untracked,
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

function classifyChange(
  recordType: StatusRecordType,
  indexStatus: string,
  worktreeStatus: string,
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
