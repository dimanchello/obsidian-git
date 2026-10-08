import { describe, expect, it } from 'vitest';
import { ChangeKind, parseGitStatus } from '../src/git/status-parser';
import { STATUS_PARSER_TEST_VALUES } from './status-parser.fixtures';

describe('parseGitStatus', () => {
  it('reads the branch, ahead/behind counts, and porcelain v2 file records', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.porcelainOutput);

    expect(status).toEqual(STATUS_PARSER_TEST_VALUES.expectedSummary);
    expect(status.branch).toBe(STATUS_PARSER_TEST_VALUES.expectedBranch);
    expect(status.ahead).toBe(STATUS_PARSER_TEST_VALUES.expectedAhead);
    expect(status.behind).toBe(STATUS_PARSER_TEST_VALUES.expectedBehind);
  });

  it('classifies unresolved merge records as conflicts', () => {
    const status = parseGitStatus(STATUS_PARSER_TEST_VALUES.conflictOutput);

    expect(status.files[STATUS_PARSER_TEST_VALUES.firstFileIndex]?.kind).toBe(ChangeKind.Conflict);
  });
});
