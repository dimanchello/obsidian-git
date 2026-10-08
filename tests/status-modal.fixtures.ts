import { ChangeKind, FileStatusCode, type GitFileChange } from '../src/git/status-parser';
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
  groupCountAll: 4,
  groupCountOnlyStaged: 1,
  singleItemCount: 1,
  emptyCount: 0,
} as const;

export const STATUS_MODAL_TEST_FILES: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Conflict,
    indexStatus: FileStatusCode.Unmerged,
    worktreeStatus: FileStatusCode.Unmerged,
    path: 'conflict.txt',
    staged: false,
  },
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Modified,
    worktreeStatus: FileStatusCode.Unchanged,
    path: 'staged.md',
    staged: true,
  },
  {
    kind: ChangeKind.Modified,
    indexStatus: FileStatusCode.Unchanged,
    worktreeStatus: FileStatusCode.Modified,
    path: 'unstaged.md',
    staged: false,
  },
  {
    kind: ChangeKind.Untracked,
    indexStatus: FileStatusCode.Untracked,
    worktreeStatus: FileStatusCode.Untracked,
    path: 'new.txt',
    staged: false,
  },
];

export const STATUS_MODAL_TEST_STAGED_ONLY: readonly GitFileChange[] = [
  {
    kind: ChangeKind.Added,
    indexStatus: FileStatusCode.Added,
    worktreeStatus: FileStatusCode.Unchanged,
    path: 'added.md',
    staged: true,
  },
];

export const STATUS_MODAL_TEST_MESSAGES = ENGLISH_MESSAGES.statusModal;
