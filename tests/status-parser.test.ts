import { describe, expect, it } from 'vitest';
import { ChangeKind, FileStatusCode, parseGitStatus } from '../src/git/status-parser';
import { STATUS_PARSER_TEST_VALUES } from './status-parser.fixtures';

describe('parseGitStatus', () => {
  it('reads the branch, upstream, ahead/behind counts, and porcelain v2 file records', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.porcelainOutput);

    expect(status).toEqual(STATUS_PARSER_TEST_VALUES.expectedSummary);
    expect(status.branch).toBe(STATUS_PARSER_TEST_VALUES.expectedBranch);
    expect(status.upstream).toBe(STATUS_PARSER_TEST_VALUES.expectedUpstream);
    expect(status.ahead).toBe(STATUS_PARSER_TEST_VALUES.expectedAhead);
    expect(status.behind).toBe(STATUS_PARSER_TEST_VALUES.expectedBehind);
  });

  it('returns null for detached branch and absent upstream', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.detachedNoUpstreamOutput);

    expect(status.branch).toBeNull();
    expect(status.upstream).toBeNull();
    expect(status.files).toHaveLength(STATUS_PARSER_TEST_VALUES.expectedOneFile);
    expect(status.files[STATUS_PARSER_TEST_VALUES.firstFileIndex]).toEqual({
      kind: ChangeKind.Modified,
      indexStatus: FileStatusCode.Unchanged,
      worktreeStatus: FileStatusCode.Modified,
      path: STATUS_PARSER_TEST_VALUES.expectedUnstagedPath,
      staged: false,
      unstaged: true,
      inVault: true,
    });
  });

  it('tracks both staged and unstaged flags independently for MM and A. entries', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.bothStagedAndUnstagedOutput);

    expect(status.files).toHaveLength(STATUS_PARSER_TEST_VALUES.expectedTwoFiles);
    expect(status.files[STATUS_PARSER_TEST_VALUES.firstFileIndex]).toEqual({
      kind: ChangeKind.Modified,
      indexStatus: FileStatusCode.Modified,
      worktreeStatus: FileStatusCode.Modified,
      path: STATUS_PARSER_TEST_VALUES.expectedBothChangedPath,
      staged: true,
      unstaged: true,
      inVault: true,
    });
    expect(status.files[STATUS_PARSER_TEST_VALUES.secondFileIndex]).toEqual({
      kind: ChangeKind.Added,
      indexStatus: FileStatusCode.Added,
      worktreeStatus: FileStatusCode.Unchanged,
      path: STATUS_PARSER_TEST_VALUES.expectedAddedPath,
      staged: true,
      unstaged: false,
      inVault: true,
    });
  });

  it('classifies unresolved merge records as conflicts with staged and unstaged false', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.conflictOutput);

    expect(status.files[STATUS_PARSER_TEST_VALUES.firstFileIndex]).toEqual({
      kind: ChangeKind.Conflict,
      indexStatus: FileStatusCode.Unmerged,
      worktreeStatus: FileStatusCode.Unmerged,
      path: STATUS_PARSER_TEST_VALUES.expectedConflictPath,
      staged: false,
      unstaged: false,
      inVault: true,
    });
  });

  it('parses NUL-delimited (-z) renamed entries including spaces in paths', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.renamedNullDelimitedOutput);

    expect(status.files).toHaveLength(STATUS_PARSER_TEST_VALUES.expectedTwoFiles);
    expect(status.files[STATUS_PARSER_TEST_VALUES.firstFileIndex]).toEqual({
      kind: ChangeKind.Renamed,
      indexStatus: FileStatusCode.Renamed,
      worktreeStatus: FileStatusCode.Unchanged,
      path: STATUS_PARSER_TEST_VALUES.expectedRenamedNewPath,
      origPath: STATUS_PARSER_TEST_VALUES.expectedRenamedOldPath,
      staged: true,
      unstaged: false,
      inVault: true,
    });
    expect(status.files[STATUS_PARSER_TEST_VALUES.secondFileIndex]?.path).toBe(
      STATUS_PARSER_TEST_VALUES.expectedUnstagedPath,
    );
  });

  it('parses tab-separated renamed entries and unquotes C-style escaped paths', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.renamedTabAndQuotedOutput);

    expect(status.files).toHaveLength(STATUS_PARSER_TEST_VALUES.expectedOneFile);
    expect(status.files[STATUS_PARSER_TEST_VALUES.firstFileIndex]).toEqual({
      kind: ChangeKind.Renamed,
      indexStatus: FileStatusCode.Renamed,
      worktreeStatus: FileStatusCode.Modified,
      path: STATUS_PARSER_TEST_VALUES.expectedQuotedNewPath,
      origPath: STATUS_PARSER_TEST_VALUES.expectedQuotedOldPath,
      staged: true,
      unstaged: true,
      inVault: true,
    });
  });

  it('translates vault-relative paths and marks out-of-vault changes using repoPrefix', () => {
    const withSlash = parseGitStatus(
      STATUS_PARSER_TEST_VALUES.repoPrefixOutput,
      STATUS_PARSER_TEST_VALUES.expectedVaultPrefix,
    );
    const withoutSlash = parseGitStatus(
      STATUS_PARSER_TEST_VALUES.repoPrefixOutput,
      STATUS_PARSER_TEST_VALUES.expectedVaultPrefixWithoutSlash,
    );

    expect(withSlash).toEqual(withoutSlash);
    expect(withSlash.files[STATUS_PARSER_TEST_VALUES.firstFileIndex]).toMatchObject({
      path: STATUS_PARSER_TEST_VALUES.expectedRenamedNewPath,
      origPath: STATUS_PARSER_TEST_VALUES.expectedRenamedOldPath,
      inVault: true,
    });
    expect(withSlash.files[STATUS_PARSER_TEST_VALUES.secondFileIndex]).toMatchObject({
      path: STATUS_PARSER_TEST_VALUES.expectedOutsidePath,
      inVault: false,
    });
    expect(withSlash.files[STATUS_PARSER_TEST_VALUES.thirdFileIndex]).toMatchObject({
      path: STATUS_PARSER_TEST_VALUES.expectedPrefixBoundaryPath,
      inVault: false,
    });
    expect(
      withSlash.files[
        STATUS_PARSER_TEST_VALUES.thirdFileIndex + STATUS_PARSER_TEST_VALUES.secondFileIndex
      ],
    ).toMatchObject({
      path: STATUS_PARSER_TEST_VALUES.expectedVaultNestedPath,
      origPath: STATUS_PARSER_TEST_VALUES.expectedOutsidePath,
      inVault: true,
    });
    expect(
      withSlash.files[
        STATUS_PARSER_TEST_VALUES.thirdFileIndex + STATUS_PARSER_TEST_VALUES.thirdFileIndex
      ],
    ).toMatchObject({
      path: STATUS_PARSER_TEST_VALUES.expectedOutsidePath,
      origPath: STATUS_PARSER_TEST_VALUES.expectedVaultNestedPath,
      inVault: false,
    });
  });

  it('returns empty status defaults for empty output', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.emptyOutput);

    expect(status).toEqual({
      branch: null,
      upstream: null,
      ahead: STATUS_PARSER_TEST_VALUES.expectedZero,
      behind: STATUS_PARSER_TEST_VALUES.expectedZero,
      files: [],
    });
  });
});
