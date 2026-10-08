import { ChangeKind } from '../src/git/status-parser';

export const STATUS_PARSER_TEST_VALUES = {
  expectedAhead: 2,
  expectedBehind: 1,
  firstFileIndex: 0,
  expectedBranch: 'feature/sidebar',
  expectedFilePath: 'notes/Заметка.md',
  expectedUntrackedPath: 'Новый файл.md',
  porcelainOutput: [
    '# branch.oid abc123',
    '# branch.head feature/sidebar',
    '# branch.upstream origin/feature/sidebar',
    '# branch.ab +2 -1',
    '1 M. N... 100644 100644 100644 abc123 def456 notes/Заметка.md',
    '? Новый файл.md',
  ].join('\n'),
  conflictOutput:
    'u UU N... 100644 100644 100644 100644 abc123 def456 ghi789 conflicted.md',
  expectedSummary: {
    branch: 'feature/sidebar',
    ahead: 2,
    behind: 1,
    files: [
      {
        kind: ChangeKind.Modified,
        indexStatus: 'M',
        worktreeStatus: '.',
        path: 'notes/Заметка.md',
        staged: true,
      },
      {
        kind: ChangeKind.Untracked,
        indexStatus: '?',
        worktreeStatus: '?',
        path: 'Новый файл.md',
        staged: false,
      },
    ],
  },
} as const;
