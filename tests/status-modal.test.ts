import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  MOCK_DOM_CONSTANTS,
  MockElement,
  MockModal,
  MockTFile,
  openedModals,
  mockSetIcon,
} = vi.hoisted(() => {
  const MOCK_DOM_CONSTANTS = {
    tagDiv: 'div',
    tagSpan: 'span',
    tagButton: 'button',
    emptyString: '',
    whitespacePattern: /\s+/,
    clickEvent: 'click',
    keydownEvent: 'keydown',
    titleAttr: 'title',
    placeholderAttr: 'placeholder',
    typeString: 'string',
  } as const;

  interface MockDomEvent {
    key?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    stopPropagation: () => void;
    preventDefault: () => void;
  }

  function isStringInfo(value: unknown): value is string {
    return typeof value === MOCK_DOM_CONSTANTS.typeString;
  }

  type MockDomListener = (event: MockDomEvent) => void;

  class MockElement {
    public readonly children: MockElement[] = [];
    public readonly classList = new Set<string>();
    public readonly attributes = new Map<string, string>();
    public readonly listeners = new Map<string, MockDomListener[]>();
    public parentElement: MockElement | null = null;
    public textContent: string = MOCK_DOM_CONSTANTS.emptyString;
    public value: string = MOCK_DOM_CONSTANTS.emptyString;
    public placeholder: string = MOCK_DOM_CONSTANTS.emptyString;
    public disabled = false;

    public constructor(public readonly tagName: string) {}

    public addClass(...classes: string[]): void {
      for (const token of classes) {
        for (const cls of token.split(MOCK_DOM_CONSTANTS.whitespacePattern)) {
          if (cls.length > MOCK_DOM_CONSTANTS.emptyString.length) {
            this.classList.add(cls);
          }
        }
      }
    }

    public removeClass(...classes: string[]): void {
      for (const token of classes) {
        this.classList.delete(token);
      }
    }

    public hasClass(cls: string): boolean {
      return this.classList.has(cls);
    }

    public setText(text: string): void {
      this.children.length = MOCK_DOM_CONSTANTS.emptyString.length;
      this.textContent = text;
    }

    public setAttribute(name: string, value: string): void {
      this.attributes.set(name, value);
    }

    public getAttribute(name: string): string | null {
      return this.attributes.get(name) ?? null;
    }

    public empty(): void {
      this.children.length = MOCK_DOM_CONSTANTS.emptyString.length;
      this.textContent = MOCK_DOM_CONSTANTS.emptyString;
    }

    public createEl(
      tag: string,
      info?:
        | string
        | {
            cls?: string | string[];
            text?: string;
            title?: string;
            placeholder?: string;
            value?: string;
            prepend?: boolean;
            attr?: Record<string, string | number | boolean | null>;
          },
      callback?: (el: MockElement) => void,
    ): MockElement {
      const child = new MockElement(tag);
      child.parentElement = this;

      if (isStringInfo(info)) {
        child.addClass(info);
      } else if (info !== undefined) {
        if (info.cls !== undefined) {
          const classes = Array.isArray(info.cls) ? info.cls : [info.cls];
          child.addClass(...classes);
        }
        if (info.text !== undefined) {
          child.textContent = info.text;
        }
        if (info.title !== undefined) {
          child.setAttribute(MOCK_DOM_CONSTANTS.titleAttr, info.title);
        }
        if (info.placeholder !== undefined) {
          child.placeholder = info.placeholder;
          child.setAttribute(MOCK_DOM_CONSTANTS.placeholderAttr, info.placeholder);
        }
        if (info.value !== undefined) {
          child.value = info.value;
        }
        if (info.attr !== undefined) {
          for (const [key, val] of Object.entries(info.attr)) {
            if (val !== null) {
              child.setAttribute(key, String(val));
            }
          }
        }
      }

      if (!isStringInfo(info) && info?.prepend === true) {
        this.children.unshift(child);
      } else {
        this.children.push(child);
      }

      callback?.(child);
      return child;
    }

    public createDiv(
      info?: string | Record<string, unknown>,
      callback?: (el: MockElement) => void,
    ): MockElement {
      return this.createEl(MOCK_DOM_CONSTANTS.tagDiv, info as never, callback);
    }

    public createSpan(
      info?: string | Record<string, unknown>,
      callback?: (el: MockElement) => void,
    ): MockElement {
      return this.createEl(MOCK_DOM_CONSTANTS.tagSpan, info as never, callback);
    }

    public addEventListener(type: string, listener: MockDomListener): void {
      const existing = this.listeners.get(type) ?? [];
      existing.push(listener);
      this.listeners.set(type, existing);
    }

    public focus = vi.fn();

    public getFullText(): string {
      if (this.children.length === MOCK_DOM_CONSTANTS.emptyString.length) {
        return this.textContent;
      }
      return (
        this.textContent +
        this.children.map((child) => child.getFullText()).join(MOCK_DOM_CONSTANTS.emptyString)
      );
    }

    public findAllByClass(cls: string): MockElement[] {
      const matches: MockElement[] = [];
      if (this.hasClass(cls)) {
        matches.push(this);
      }
      for (const child of this.children) {
        matches.push(...child.findAllByClass(cls));
      }
      return matches;
    }

    public findByClass(cls: string): MockElement | undefined {
      return this.findAllByClass(cls)[MOCK_DOM_CONSTANTS.emptyString.length];
    }

    public findAllByTag(tagName: string): MockElement[] {
      const matches: MockElement[] = [];
      if (this.tagName === tagName) {
        matches.push(this);
      }
      for (const child of this.children) {
        matches.push(...child.findAllByTag(tagName));
      }
      return matches;
    }

    public findByText(text: string): MockElement | undefined {
      for (const child of this.children) {
        const match = child.findByText(text);
        if (match !== undefined) {
          return match;
        }
      }
      if (this.getFullText() === text) {
        return this;
      }
      return undefined;
    }

    public findButtonByText(text: string): MockElement | undefined {
      if (this.tagName === MOCK_DOM_CONSTANTS.tagButton && this.getFullText() === text) {
        return this;
      }
      for (const child of this.children) {
        const match = child.findButtonByText(text);
        if (match !== undefined) {
          return match;
        }
      }
      return undefined;
    }

    public click(): void {
      this.dispatchDomEvent(MOCK_DOM_CONSTANTS.clickEvent, {});
    }

    public keydown(key: string): { defaultPrevented: boolean } {
      return this.dispatchDomEvent(MOCK_DOM_CONSTANTS.keydownEvent, { key });
    }

    private dispatchDomEvent(
      type: string,
      init: { key?: string; ctrlKey?: boolean; metaKey?: boolean },
    ): { defaultPrevented: boolean } {
      let stopped = false;
      let defaultPrevented = false;
      const event: MockDomEvent = {
        ...init,
        stopPropagation: () => {
          stopped = true;
        },
        preventDefault: () => {
          defaultPrevented = true;
        },
      };

      let current: MockElement | null = this;
      while (current !== null && !stopped) {
        const listeners = current.listeners.get(type) ?? [];
        for (const listener of listeners) {
          listener(event);
        }
        current = current.parentElement;
      }
      return { defaultPrevented };
    }
  }

  const openedModals: MockModal[] = [];

  class MockModal {
    public app: unknown;
    public modalEl = new MockElement(MOCK_DOM_CONSTANTS.tagDiv);
    public titleEl = new MockElement(MOCK_DOM_CONSTANTS.tagDiv);
    public contentEl = new MockElement(MOCK_DOM_CONSTANTS.tagDiv);
    public isOpen = false;

    public constructor(app: unknown) {
      this.app = app;
    }

    public open(): void {
      this.isOpen = true;
      openedModals.push(this);
      (this as unknown as { onOpen?: () => void }).onOpen?.();
    }

    public close(): void {
      this.isOpen = false;
      (this as unknown as { onClose?: () => void }).onClose?.();
    }
  }

  class MockTFile {
    public constructor(public readonly path: string) {}
  }

  const mockSetIcon = vi.fn();

  return {
    MOCK_DOM_CONSTANTS,
    MockElement,
    MockModal,
    MockTFile,
    openedModals,
    mockSetIcon,
  };
});

vi.mock('obsidian', () => ({
  Modal: MockModal,
  Notice: vi.fn(),
  setIcon: mockSetIcon,
  TFile: MockTFile,
}));

import type { App } from 'obsidian';
import { GitAction, PLUGIN_DOM_NAMES } from '../src/plugin-constants';
import {
  GitStatusModal,
  groupStatusFiles,
  splitFilePath,
  StatusSectionKind,
} from '../src/status-modal';
import {
  STATUS_MODAL_AHEAD_BEHIND,
  STATUS_MODAL_DETACHED_NO_UPSTREAM,
  STATUS_MODAL_FULL_MESSAGES,
  STATUS_MODAL_INTERACTIVE_FILES,
  STATUS_MODAL_REFRESHED_STATUS,
  STATUS_MODAL_TEST_CONFLICT_WITH_STAGED_FLAG,
  STATUS_MODAL_TEST_CONSTANTS,
  STATUS_MODAL_TEST_DUAL_STATE,
  STATUS_MODAL_TEST_FALLBACK,
  STATUS_MODAL_TEST_FILES,
  STATUS_MODAL_TEST_MESSAGES,
  STATUS_MODAL_TEST_STAGED_ONLY,
  STATUS_MODAL_UP_TO_DATE,
} from './status-modal.fixtures';

function createMockApp(options?: {
  readonly vaultPaths?: readonly string[];
  readonly supportGetLeaf?: boolean;
}) {
  const vaultSet = new Set(options?.vaultPaths ?? []);
  const openFile = vi.fn(async (_file: unknown) => {});
  const openLinkText = vi.fn(
    async (_path: string, _sourcePath: string, _newLeaf: boolean) => {},
  );
  const getLeaf = vi.fn(() => ({ openFile }));
  const getAbstractFileByPath = vi.fn((filePath: string) =>
    vaultSet.has(filePath) ? new MockTFile(filePath) : null,
  );

  const workspace =
    options?.supportGetLeaf === false
      ? { openLinkText }
      : { getLeaf, openLinkText };

  const app = {
    vault: { getAbstractFileByPath },
    workspace,
  } as unknown as App;

  return { app, openFile, openLinkText, getLeaf, getAbstractFileByPath };
}

function getModalContent(modal: GitStatusModal): InstanceType<typeof MockElement> {
  return (modal as unknown as { contentEl: InstanceType<typeof MockElement> }).contentEl;
}

function getButtonByText(
  root: InstanceType<typeof MockElement>,
  label: string,
): InstanceType<typeof MockElement> | undefined {
  return root.findButtonByText(label);
}

afterEach(() => {
  openedModals.length = STATUS_MODAL_TEST_CONSTANTS.emptyCount;
  vi.clearAllMocks();
});

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

    const conflictGroup = groups[STATUS_MODAL_TEST_CONSTANTS.firstIndex];
    expect(conflictGroup?.kind).toBe(StatusSectionKind.Conflict);
    expect(conflictGroup?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionConflicts);
    expect(conflictGroup?.isConflict).toBe(true);
    expect(conflictGroup?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    const stagedGroup = groups[STATUS_MODAL_TEST_CONSTANTS.secondIndex];
    expect(stagedGroup?.kind).toBe(StatusSectionKind.Staged);
    expect(stagedGroup?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionStaged);
    expect(stagedGroup?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    const unstagedGroup = groups[STATUS_MODAL_TEST_CONSTANTS.thirdIndex];
    expect(unstagedGroup?.kind).toBe(StatusSectionKind.Unstaged);
    expect(unstagedGroup?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionUnstaged);
    expect(unstagedGroup?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    const untrackedGroup = groups[STATUS_MODAL_TEST_CONSTANTS.fourthIndex];
    expect(untrackedGroup?.kind).toBe(StatusSectionKind.Untracked);
    expect(untrackedGroup?.title).toBe(STATUS_MODAL_TEST_MESSAGES.sectionUntracked);
    expect(untrackedGroup?.files).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);
  });

  it('omits groups that have no files', () => {
    const groups = groupStatusFiles(
      STATUS_MODAL_TEST_STAGED_ONLY,
      STATUS_MODAL_TEST_MESSAGES,
    );
    expect(groups).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.groupCountOnlyStaged);
    expect(groups[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.kind).toBe(StatusSectionKind.Staged);
    expect(groups[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.title).toBe(
      STATUS_MODAL_TEST_MESSAGES.sectionStaged,
    );
  });

  it('places dual-state MM files in both staged and unstaged sections', () => {
    const groups = groupStatusFiles(
      STATUS_MODAL_TEST_DUAL_STATE,
      STATUS_MODAL_TEST_MESSAGES,
    );
    expect(groups).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.groupCountDualState);
    expect(groups[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.kind).toBe(StatusSectionKind.Staged);
    expect(groups[STATUS_MODAL_TEST_CONSTANTS.secondIndex]?.kind).toBe(
      StatusSectionKind.Unstaged,
    );
    expect(
      groups[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.files[
        STATUS_MODAL_TEST_CONSTANTS.firstIndex
      ]?.path,
    ).toBe(STATUS_MODAL_TEST_CONSTANTS.dualStatePath);
    expect(
      groups[STATUS_MODAL_TEST_CONSTANTS.secondIndex]?.files[
        STATUS_MODAL_TEST_CONSTANTS.firstIndex
      ]?.path,
    ).toBe(STATUS_MODAL_TEST_CONSTANTS.dualStatePath);
  });

  it('keeps conflicts out of staged and falls back non-untracked unflagged files to unstaged', () => {
    const conflictGroups = groupStatusFiles(
      STATUS_MODAL_TEST_CONFLICT_WITH_STAGED_FLAG,
      STATUS_MODAL_TEST_MESSAGES,
    );
    expect(conflictGroups[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.kind).toBe(
      StatusSectionKind.Conflict,
    );
    expect(conflictGroups[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.files).toHaveLength(
      STATUS_MODAL_TEST_CONSTANTS.singleItemCount,
    );
    expect(conflictGroups[STATUS_MODAL_TEST_CONSTANTS.secondIndex]?.kind).toBe(
      StatusSectionKind.Staged,
    );
    expect(conflictGroups[STATUS_MODAL_TEST_CONSTANTS.secondIndex]?.files).toHaveLength(
      STATUS_MODAL_TEST_CONSTANTS.singleItemCount,
    );

    const fallbackGroups = groupStatusFiles(
      STATUS_MODAL_TEST_FALLBACK,
      STATUS_MODAL_TEST_MESSAGES,
    );
    expect(fallbackGroups).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.groupCountFallback);
    expect(fallbackGroups[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.kind).toBe(
      StatusSectionKind.Unstaged,
    );
  });
});

describe('GitStatusModal rendering and interactions', () => {
  it('renders detached HEAD badge and no-upstream pill instead of up-to-date when upstream is null', () => {
    const { app } = createMockApp();
    const modal = new GitStatusModal(
      app,
      STATUS_MODAL_DETACHED_NO_UPSTREAM,
      STATUS_MODAL_FULL_MESSAGES,
    );
    modal.open();

    const content = getModalContent(modal);
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorDetachedBadge)?.getFullText()).toBe(
      STATUS_MODAL_TEST_MESSAGES.detachedBranch,
    );
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorBranchName)).toBeUndefined();
    expect(
      content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorNoUpstreamPill)?.getFullText(),
    ).toBe(STATUS_MODAL_TEST_MESSAGES.noUpstream);
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorSyncedPill)).toBeUndefined();
  });

  it('renders up-to-date pill when upstream exists and ahead/behind are zero, and ahead/behind pills otherwise', () => {
    const { app } = createMockApp();
    const syncedModal = new GitStatusModal(
      app,
      STATUS_MODAL_UP_TO_DATE,
      STATUS_MODAL_FULL_MESSAGES,
    );
    syncedModal.open();
    const syncedContent = getModalContent(syncedModal);
    expect(syncedContent.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorBranchName)?.getFullText()).toBe(
      STATUS_MODAL_TEST_CONSTANTS.mainBranch,
    );
    expect(
      syncedContent.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorSyncedPill)?.getFullText(),
    ).toBe(STATUS_MODAL_TEST_MESSAGES.upToDate);
    expect(
      syncedContent.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorNoUpstreamPill),
    ).toBeUndefined();

    const divergedModal = new GitStatusModal(
      app,
      STATUS_MODAL_AHEAD_BEHIND,
      STATUS_MODAL_FULL_MESSAGES,
    );
    divergedModal.open();
    const divergedContent = getModalContent(divergedModal);
    expect(
      divergedContent.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorAheadPill)?.getFullText(),
    ).toBe(STATUS_MODAL_TEST_MESSAGES.aheadPrefix + STATUS_MODAL_TEST_CONSTANTS.aheadTwo);
    expect(
      divergedContent.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorBehindPill)?.getFullText(),
    ).toBe(STATUS_MODAL_TEST_MESSAGES.behindPrefix + STATUS_MODAL_TEST_CONSTANTS.behindOne);
    expect(divergedContent.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorSyncedPill)).toBeUndefined();
  });

  it('renders conflict banner, excludes conflicts from staged count, and disables commit/sync buttons', () => {
    const { app } = createMockApp();
    const onAction = vi.fn();
    const modal = new GitStatusModal(
      app,
      {
        branch: STATUS_MODAL_TEST_CONSTANTS.mainBranch,
        upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
        ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        files: STATUS_MODAL_TEST_CONFLICT_WITH_STAGED_FLAG,
      },
      STATUS_MODAL_FULL_MESSAGES,
      onAction,
    );
    modal.open();

    const content = getModalContent(modal);
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorConflictBanner)).toBeDefined();
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorConflictTitle)?.getFullText()).toBe(
      STATUS_MODAL_TEST_MESSAGES.conflictBannerTitle,
    );
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorConflictDesc)?.getFullText()).toBe(
      STATUS_MODAL_TEST_MESSAGES.conflictBannerDescription,
    );
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorFooterSummary)?.getFullText()).toBe(
      STATUS_MODAL_TEST_CONSTANTS.expectedSummaryTwoChangesOneStaged,
    );

    const commitBtn = getButtonByText(content, STATUS_MODAL_TEST_MESSAGES.commitButton);
    const commitMsgBtn = getButtonByText(
      content,
      STATUS_MODAL_TEST_MESSAGES.commitWithMessageButton,
    );
    const syncBtn = getButtonByText(content, STATUS_MODAL_TEST_MESSAGES.syncButton);
    const pullBtn = getButtonByText(content, STATUS_MODAL_TEST_MESSAGES.pullButton);
    const pushBtn = getButtonByText(content, STATUS_MODAL_TEST_MESSAGES.pushButton);

    expect(commitBtn?.disabled).toBe(true);
    expect(commitBtn?.getAttribute(PLUGIN_DOM_NAMES.ariaDisabledAttribute)).toBe(
      STATUS_MODAL_TEST_CONSTANTS.ariaDisabledTrue,
    );
    expect(commitMsgBtn?.disabled).toBe(true);
    expect(commitMsgBtn?.getAttribute(PLUGIN_DOM_NAMES.ariaDisabledAttribute)).toBe(
      STATUS_MODAL_TEST_CONSTANTS.ariaDisabledTrue,
    );
    expect(syncBtn?.disabled).toBe(true);
    expect(syncBtn?.getAttribute(PLUGIN_DOM_NAMES.ariaDisabledAttribute)).toBe(
      STATUS_MODAL_TEST_CONSTANTS.ariaDisabledTrue,
    );
    expect(pullBtn?.disabled).toBe(false);
    expect(pushBtn?.disabled).toBe(false);

    commitBtn?.click();
    syncBtn?.click();
    expect(onAction).not.toHaveBeenCalled();

    pushBtn?.click();
    expect(onAction).toHaveBeenCalledWith(GitAction.PushOnly);
  });

  it('displays origPath, external badge, keyboard-accessible vault opening, and openLinkText fallback', () => {
    const { app, getLeaf, openFile } = createMockApp({
      vaultPaths: [STATUS_MODAL_TEST_CONSTANTS.unstagedNotePath],
    });
    const modal = new GitStatusModal(
      app,
      {
        branch: STATUS_MODAL_TEST_CONSTANTS.mainBranch,
        upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
        ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        files: STATUS_MODAL_INTERACTIVE_FILES,
      },
      STATUS_MODAL_FULL_MESSAGES,
    );
    modal.open();

    const content = getModalContent(modal);
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorFileOrigPath)?.getFullText()).toBe(
      STATUS_MODAL_TEST_MESSAGES.renamedFromPrefix + STATUS_MODAL_TEST_CONSTANTS.renamedOrigPath,
    );
    expect(
      content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorFileExternalBadge)?.getFullText(),
    ).toBe(STATUS_MODAL_TEST_MESSAGES.externalFileBadge);

    const clickableRows = content.findAllByClass(
      STATUS_MODAL_TEST_CONSTANTS.selectorFileRowClickable,
    );
    expect(clickableRows).toHaveLength(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);
    const vaultRow = clickableRows[STATUS_MODAL_TEST_CONSTANTS.firstIndex];
    expect(vaultRow?.getAttribute(PLUGIN_DOM_NAMES.roleAttribute)).toBe(
      STATUS_MODAL_TEST_CONSTANTS.buttonRole,
    );
    expect(vaultRow?.getAttribute(PLUGIN_DOM_NAMES.tabIndexAttribute)).toBe(
      STATUS_MODAL_TEST_CONSTANTS.tabIndexZero,
    );

    const keyResult = vaultRow?.keydown(STATUS_MODAL_TEST_CONSTANTS.keyEnter);
    expect(keyResult?.defaultPrevented).toBe(true);
    expect(getLeaf).toHaveBeenCalledWith(STATUS_MODAL_TEST_CONSTANTS.leafFalse);
    expect(openFile).toHaveBeenCalledTimes(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    const spaceResult = vaultRow?.keydown(STATUS_MODAL_TEST_CONSTANTS.keySpace);
    expect(spaceResult?.defaultPrevented).toBe(true);
    expect(openFile).toHaveBeenCalledTimes(STATUS_MODAL_TEST_CONSTANTS.twoCallsCount);

    const fallbackMock = createMockApp({
      vaultPaths: [STATUS_MODAL_TEST_CONSTANTS.unstagedNotePath],
      supportGetLeaf: false,
    });
    const fallbackModal = new GitStatusModal(
      fallbackMock.app,
      {
        branch: STATUS_MODAL_TEST_CONSTANTS.mainBranch,
        upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
        ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        files: STATUS_MODAL_INTERACTIVE_FILES,
      },
      STATUS_MODAL_FULL_MESSAGES,
    );
    fallbackModal.open();
    const fallbackRow = getModalContent(fallbackModal).findByClass(
      STATUS_MODAL_TEST_CONSTANTS.selectorFileRowClickable,
    );
    fallbackRow?.click();
    expect(fallbackMock.openLinkText).toHaveBeenCalledWith(
      STATUS_MODAL_TEST_CONSTANTS.unstagedNotePath,
      STATUS_MODAL_TEST_CONSTANTS.emptyString,
      STATUS_MODAL_TEST_CONSTANTS.leafFalse,
    );
  });

  it('handles refresh, diff, stage, unstage, and discard with confirmation modal without propagating row clicks', async () => {
    const { app, openFile } = createMockApp({
      vaultPaths: [
        STATUS_MODAL_TEST_CONSTANTS.renamedPath,
        STATUS_MODAL_TEST_CONSTANTS.unstagedNotePath,
      ],
    });
    const onRefresh = vi.fn(async () => STATUS_MODAL_REFRESHED_STATUS);
    const onViewDiff = vi.fn();
    const onStageFile = vi.fn(async () => STATUS_MODAL_REFRESHED_STATUS);
    const onUnstageFile = vi.fn(async () => STATUS_MODAL_REFRESHED_STATUS);
    const onDiscardFile = vi.fn(async () => STATUS_MODAL_REFRESHED_STATUS);
    const onStageAll = vi.fn(async () => STATUS_MODAL_REFRESHED_STATUS);
    const onUnstageAll = vi.fn(async () => STATUS_MODAL_REFRESHED_STATUS);

    const modal = new GitStatusModal(
      app,
      {
        branch: STATUS_MODAL_TEST_CONSTANTS.mainBranch,
        upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
        ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        files: STATUS_MODAL_INTERACTIVE_FILES,
      },
      STATUS_MODAL_FULL_MESSAGES,
      {
        onRefresh,
        onViewDiff,
        onStageFile,
        onUnstageFile,
        onDiscardFile,
        onStageAll,
        onUnstageAll,
      },
    );
    modal.open();

    const content = getModalContent(modal);
    const diffButtons = content.findAllByClass(STATUS_MODAL_TEST_CONSTANTS.selectorActionDiff);
    diffButtons[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.click();
    diffButtons[STATUS_MODAL_TEST_CONSTANTS.secondIndex]?.click();
    expect(onViewDiff).toHaveBeenNthCalledWith(
      STATUS_MODAL_TEST_CONSTANTS.firstCall,
      STATUS_MODAL_INTERACTIVE_FILES[STATUS_MODAL_TEST_CONSTANTS.firstIndex],
      true,
    );
    expect(onViewDiff).toHaveBeenNthCalledWith(
      STATUS_MODAL_TEST_CONSTANTS.secondCall,
      STATUS_MODAL_INTERACTIVE_FILES[STATUS_MODAL_TEST_CONSTANTS.secondIndex],
      false,
    );
    expect(openFile).not.toHaveBeenCalled();

    const discardButtons = content.findAllByClass(
      STATUS_MODAL_TEST_CONSTANTS.selectorActionDiscard,
    );
    discardButtons[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.click();
    expect(onDiscardFile).not.toHaveBeenCalled();
    expect(openFile).not.toHaveBeenCalled();

    const cancelledConfirmModal =
      openedModals[openedModals.length - STATUS_MODAL_TEST_CONSTANTS.singleItemCount];
    expect(cancelledConfirmModal).toBeDefined();
    cancelledConfirmModal?.contentEl
      .findButtonByText(STATUS_MODAL_FULL_MESSAGES.modals.confirmDiscard.cancelButton)
      ?.click();
    expect(onDiscardFile).not.toHaveBeenCalled();
    expect(cancelledConfirmModal?.isOpen).toBe(false);

    discardButtons[STATUS_MODAL_TEST_CONSTANTS.firstIndex]?.click();
    const confirmModal =
      openedModals[openedModals.length - STATUS_MODAL_TEST_CONSTANTS.singleItemCount];
    expect(confirmModal).toBeDefined();
    confirmModal?.contentEl
      .findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorConfirmWarningBtn)
      ?.click();

    await Promise.resolve();
    await Promise.resolve();

    expect(onDiscardFile).toHaveBeenCalledWith(
      STATUS_MODAL_INTERACTIVE_FILES[STATUS_MODAL_TEST_CONSTANTS.secondIndex],
    );
    expect(content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorBranchName)?.getFullText()).toBe(
      STATUS_MODAL_TEST_CONSTANTS.refreshedBranch,
    );

    content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorRefreshBtn)?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onRefresh).toHaveBeenCalledTimes(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);
  });

  it('triggers stage, unstage, stageAll, unstageAll, and commit-with-message callbacks', async () => {
    const { app } = createMockApp();
    const onAction = vi.fn();
    const onStageFile = vi.fn(async () => null);
    const onUnstageFile = vi.fn(async () => null);
    const onStageAll = vi.fn(async () => null);
    const onUnstageAll = vi.fn(async () => null);

    const modal = new GitStatusModal(
      app,
      {
        branch: STATUS_MODAL_TEST_CONSTANTS.mainBranch,
        upstream: STATUS_MODAL_TEST_CONSTANTS.originUpstream,
        ahead: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        behind: STATUS_MODAL_TEST_CONSTANTS.zeroCount,
        files: STATUS_MODAL_INTERACTIVE_FILES,
      },
      STATUS_MODAL_FULL_MESSAGES,
      {
        onAction,
        onStageFile,
        onUnstageFile,
        onStageAll,
        onUnstageAll,
      },
    );
    modal.open();

    const content = getModalContent(modal);
    content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorActionStage)?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onStageFile).toHaveBeenCalledTimes(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    content.findByClass(STATUS_MODAL_TEST_CONSTANTS.selectorActionUnstage)?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onUnstageFile).toHaveBeenCalledTimes(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    getButtonByText(content, STATUS_MODAL_TEST_MESSAGES.unstageAllButton)?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onUnstageAll).toHaveBeenCalledTimes(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    getButtonByText(content, STATUS_MODAL_TEST_MESSAGES.stageAllButton)?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(onStageAll).toHaveBeenCalledTimes(STATUS_MODAL_TEST_CONSTANTS.singleItemCount);

    getButtonByText(content, STATUS_MODAL_TEST_MESSAGES.commitWithMessageButton)?.click();
    expect(onAction).toHaveBeenCalledWith(GitAction.CommitWithMessage);
  });
});
