import {
  ChangeKind,
  FileStatusCode,
  type GitFileChange,
  type GitStatus,
} from '../src/git/status-parser';
import { ENGLISH_MESSAGES } from '../src/i18n/en';

export const STATUS_MODAL_TEST_CONSTANTS = {
  simpleFileName: 'README.md',
  nestedFilePath: 'notes/daily/note.md',
  nestedFileFolder: 'notes/daily/',
  nestedFileName: 'note.md',
  deepFilePath: 'src/sub/deep/file.ts',
  deepFileFolder: 'src/sub/deep/',
  deepFileName: 'file.ts',
  emptyFolder: '',
  emptyString: '',
  groupCountAll: 4,
  groupCountOnlyStaged: 1,
  groupCountDualState: 2,
  groupCountFallback: 1,
  singleItemCount: 1,
  twoCallsCount: 2,
  firstCall: 1,
  secondCall: 2,
  emptyCount: 0,
  firstIndex: 0,
  secondIndex: 1,
  thirdIndex: 2,
  fourthIndex: 3,
  mainBranch: 'main',
  refreshedBranch: 'feature/updated',
  originUpstream: 'origin/main',
  zeroCount: 0,
  aheadTwo: 2,
  behindOne: 1,
  dualStatePath: 'both.md',
  conflictPath: 'conflict.md',
  stagedNotePath: 'staged.md',
  unstagedNotePath: 'notes/unstaged.md',
  untrackedNotePath: 'new.md',
  renamedPath: 'notes/renamed.md',
  renamedOrigPath: 'notes/original.md',
  externalPath: '../outside/external.md',
  fallbackPath: 'fallback.md',
  keyEnter: 'Enter',
  keySpace: ' ',
  leafFalse: false,
  ariaDisabledTrue: 'true',
  tabIndexZero: '0',
  buttonRole: 'button',
  selectorNoUpstreamPill: 'git-status-pill--no-upstream',
  selectorSyncedPill: 'git-status-pill--synced',
  selectorAheadPill: 'git-status-pill--ahead',
  selectorBehindPill: 'git-status-pill--behind',
  selectorDetachedBadge: 'git-status-detached-badge',
  selectorBranchName: 'git-status-branch-name',
  selectorRefreshBtn: 'git-status-refresh-btn',
  selectorConflictBanner: 'git-status-conflict-banner',
  selectorConflictTitle: 'git-status-conflict-banner-title',
  selectorConflictDesc: 'git-status-conflict-banner-description',
  selectorSectionAction: 'git-status-section-action',
  selectorFileRow: 'git-status-file-row',
  selectorFileRowClickable: 'git-status-file-row--clickable',
  selectorFileOrigPath: 'git-status-file-orig-path',
  selectorFileExternalBadge: 'git-status-file-external-badge',
  selectorActionDiff: 'git-status-action-btn--diff',
  selectorActionStage: 'git-status-action-btn--stage',
  selectorActionUnstage: 'git-status-action-btn--unstage',
  selectorActionDiscard: 'git-status-action-btn--discard',
  selectorFooterSummary: 'git-status-footer-summary',
  selectorFooterActions: 'git-status-footer-actions',
  selectorConfirmWarningBtn: 'mod-warning',
  expectedSummaryTwoChangesOneStaged:
    '2' +
    ENGLISH_MESSAGES.statusModal.changesCountSuffix +
    ENGLISH_MESSAGES.statusModal.separator +
    '1' +
    ENGLISH_MESSAGES.statusModal.stagedSummarySuffix,
} as const;

export const STATUS_MODAL_TEST_FILES: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Conflict,
    indexStatus: FileStatusCode.Unmerged,
    worktreeStatus: FileStatusCode.Unmerged,
    path: 'conflict.txt',
    staged: false,
    unstaged: false,
    inVault: true,
  },
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Modified,
    worktreeStatus: FileStatusCode.Unchanged,
    path: 'staged.md',
    staged: true,
    unstaged: false,
    inVault: true,
  },
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Unchanged,
    worktreeStatus: FileStatusCode.Modified,
    path: 'unstaged.md',
    staged: false,
    unstaged: true,
    inVault: true,
  },
  {
    kind: ChangeKind.Untracked,
    indexStatus: FileStatusCode.Untracked,
    worktreeStatus: FileStatusCode.Untracked,
    path: 'new.txt',
    staged: false,
    unstaged: false,
    inVault: true,
  },
];

export const STATUS_MODAL_TEST_STAGED_ONLY: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Added,
    indexStatus: FileStatusCode.Added,
    worktreeStatus: FileStatusCode.Unchanged,
    path: 'added.md',
    staged: true,
    unstaged: false,
    inVault: true,
  },
];

export const STATUS_MODAL_TEST_DUAL_STATE: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Modified,
    worktreeStatus: FileStatusCode.Modified,
    path: STATUS_MODAL_TEST_CONSTANTS.dualStatePath,
    staged: true,
    unstaged: true,
    inVault: true,
  },
];

export const STATUS_MODAL_TEST_FALLBACK: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Unchanged,
    worktreeStatus: FileStatusCode.Unchanged,
    path: STATUS_MODAL_TEST_CONSTANTS.fallbackPath,
    staged: false,
    unstaged: false,
    inVault: true,
  },
];

export const STATUS_MODAL_TEST_CONFLICT_WITH_STAGED_FLAG: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Conflict,
    indexStatus: FileStatusCode.Unmerged,
    worktreeStatus: FileStatusCode.Unmerged,
    path: STATUS_MODAL_TEST_CONSTANTS.conflictPath,
    staged: true,
    unstaged: true,
    inVault: true,
  },
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Modified,
    worktreeStatus: FileStatusCode.Unchanged,
    path: STATUS_MODAL_TEST_CONSTANTS.stagedNotePath,
    staged: true,
    unstaged: false,
    inVault: true,
  },
];

export const STATUS_MODAL_DETACHED_NO_UPSTREAM: GitStatus = {
  branch: null,
  upstream: null,
  ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
  behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
  files: [],
};

export const STATUS_MODAL_UP_TO_DATE: GitStatus = {
  branch: STATUS_MODAL_TEST_CONSTANTS.mainBranch,
  upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
  ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
  behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
  files: [],
};

export const STATUS_MODAL_AHEAD_BEHIND: GitStatus = {
  branch: STATUS_MODAL_TEST_CONSTANTS.mainBranch,
  upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
  ahead: STATUS_MODAL_TEST_CONSTANTS.aheadTwo,
  behind: STATUS_MODAL_TEST_CONSTANTS.behindOne,
  files: [],
};

export const STATUS_MODAL_REFRESHED_STATUS: GitStatus = {
  branch: STATUS_MODAL_TEST_CONSTANTS.refreshedBranch,
  upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
  ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
  behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
  files: [],
};

export const STATUS_MODAL_INTERACTIVE_FILES: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Renamed,
    indexStatus: FileStatusCode.Renamed,
    worktreeStatus: FileStatusCode.Unchanged,
    path: STATUS_MODAL_TEST_CONSTANTS.renamedPath,
    origPath: STATUS_MODAL_TEST_CONSTANTS.renamedOrigPath,
    staged: true,
    unstaged: false,
    inVault: true,
  },
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Unchanged,
    worktreeStatus: FileStatusCode.Modified,
    path: STATUS_MODAL_TEST_CONSTANTS.unstagedNotePath,
    staged: false,
    unstaged: true,
    inVault: true,
  },
  {
    kind: ChangeKind.Untracked,
    indexStatus: FileStatusCode.Untracked,
    worktreeStatus: FileStatusCode.Untracked,
    path: STATUS_MODAL_TEST_CONSTANTS.untrackedNotePath,
    staged: false,
    unstaged: false,
    inVault: true,
  },
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Unchanged,
    worktreeStatus: FileStatusCode.Modified,
    path: STATUS_MODAL_TEST_CONSTANTS.externalPath,
    staged: false,
    unstaged: true,
    inVault: false,
  },
];

export const STATUS_MODAL_TEST_MESSAGES = ENGLISH_MESSAGES.statusModal;
export const STATUS_MODAL_FULL_MESSAGES = ENGLISH_MESSAGES;
