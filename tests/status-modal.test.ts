import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  Modal: class {},
  setIcon: vi.fn(),
  TFile: class {},
}));

import { groupStatusFiles, splitFilePath } from '../src/status-modal';
import {
  STATUS_MODAL_TEST_CONSTANTS,
  STATUS_MODAL_TEST_FILES,
  STATUS_MODAL_TEST_MESSAGES,
  STATUS_MODAL_TEST_STAGED_ONLY,
} from './status-modal.fixtures';

describe('splitFilePath', () => {
  it('handles root-level files without directory component', () => {
    const result = splitFilePath(STATUS_MODAL_TEST_CONSTANTS.simpleFileName);
    expect(result.folder).toBe(STATUS_MODAL_TEST_CONSTANTS.emptyFolder);
    expect(result.name).toBe(STATUS_MODAL_TEST_CONSTANTS.simpleFileName);
  });

  it('splits single-level directories correctly', () => {
    const result = splitFilePath(STATUS_MODAL_TEST_CONSTANTS.nestedFilePath);
    expect(result.folder).toBe(STATUS_MODAL_TEST_CONSTANTS.nestedFileFolder);
    expect(result.name).toBe(STATUS_MODAL_TEST_CONSTANTS.nestedFileName);
  });

  it('splits deeply nested directories correctly', () => {
    const result = splitFilePath(STATUS_MODAL_TEST_CONSTANTS.deepFilePath);
    expect(result.folder).toBe(STATUS_MODAL_TEST_CONSTANTS.deepFileFolder);
    expect(result.name).toBe(STATUS_MODAL_TEST_CONSTANTS.deepFileName);
  });
});

describe('groupStatusFiles', () => {
  it('returns empty array when no files are modified', () => {
    const groups = groupStatusFiles([], STATUS_MODAL_TEST_MESSAGES);
    expect(groups).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.emptyCount);
  });

  it('groups all four change categories when present', () => {
    const groups = groupStatusFiles(STATUS_MODAL_TEST_FILES, STATUS_MODAL_TEST_MESSAGES);
    expect(groups).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.groupCountAll);

    expect(groups[0]?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionConflicts);
    expect(groups[0]?.isConflict).toBe(true);
    expect(groups[0]?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    expect(groups[1]?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionStaged);
    expect(groups[1]?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    expect(groups[2]?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionUnstaged);
    expect(groups[2]?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    expect(groups[3]?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionUntracked);
    expect(groups[3]?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);
  });

  it('omits groups that have no files', () => {
    const groups = groupStatusFiles(
      STATUS_MODAL_TEST_STAGED_ONLY,
      STATUS_MODAL_TEST_MESSAGES,
    );
    expect(groups).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.groupCountOnlyStaged);
    expect(groups[0]?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionStaged);
  });
});
