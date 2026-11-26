import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  MOCK_DOM_CONSTANTS,
  MockElement,
  MockModal,
  MockNotice,
  noticeCalls,
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
    inputEvent: 'input',
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
    public hidden = false;
    public removed = false;

    public constructor(public readonly tagName: string) {}

    public remove(): void {
      this.removed = true;
      if (this.parentElement !== null) {
        const index = this.parentElement.children.indexOf(this);
        if (index >= MOCK_DOM_CONSTANTS.emptyString.length) {
          this.parentElement.children.splice(index, 1);
        }
      }
    }

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

    public input(value: string): void {
      this.value = value;
      this.dispatchDomEvent(MOCK_DOM_CONSTANTS.inputEvent, {});
    }

    public keydown(
      key: string,
      modifiers?: { readonly ctrlKey?: boolean; readonly metaKey?: boolean },
    ): { defaultPrevented: boolean } {
      return this.dispatchDomEvent(MOCK_DOM_CONSTANTS.keydownEvent, { key, ...modifiers });
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
      (this as unknown as { onOpen?: () => void }).onOpen?.();
    }

    public close(): void {
      this.isOpen = false;
      (this as unknown as { onClose?: () => void }).onClose?.();
    }
  }

  const noticeCalls: string[] = [];

  class MockNotice {
    public constructor(message: string) {
      noticeCalls.push(message);
    }
  }

  const mockSetIcon = vi.fn();

  return {
    MOCK_DOM_CONSTANTS,
    MockElement,
    MockModal,
    MockNotice,
    noticeCalls,
    mockSetIcon,
  };
});

vi.mock('obsidian', () => ({
  Modal: MockModal,
  Notice: MockNotice,
  setIcon: mockSetIcon,
}));

import type { App } from 'obsidian';
import { CommitFileChangeKind, type GitCommitEntry } from '../src/git/git-service';
import {
  CommitMessageModal,
  ConfirmModal,
  formatCommitFilesCount,
  GitDiffModal,
  GitErrorModal,
  GitHistoryModal,
  type GitLastErrorInfo,
} from '../src/git-modals';
import { ENGLISH_MESSAGES } from '../src/i18n/en';
import { RUSSIAN_MESSAGES } from '../src/i18n/ru';

const GIT_MODALS_TEST_CONSTANTS = {
  emptyString: '',
  whitespaceOnly: '   \n  ',
  initialCommitMessage: 'Vault backup',
  editedCommitMessage: '  feat: update notes  ',
  trimmedCommitMessage: 'feat: update notes',
  secondCommitMessage: 'ctrl enter commit',
  thirdCommitMessage: 'cmd enter commit',
  enterKey: 'Enter',
  navigatorGlobal: 'navigator',
  diffFilePath: 'notes/journal.md',
  sampleDiff: [
    'diff --git a/notes/journal.md b/notes/journal.md',
    'index 1111111..2222222 100644',
    '--- a/notes/journal.md',
    '+++ b/notes/journal.md',
    '@@ -1,3 +1,3 @@',
    ' unchanged line',
    '-removed line',
    '+added line',
    '',
  ].join('\n'),
  diffExpectedLineCount: 8,
  diffExpectedMetaCount: 4,
  diffExpectedHunkCount: 1,
  diffExpectedAddCount: 1,
  diffExpectedRemoveCount: 1,
  errorMetaRowCount: 3,
  firstIndex: 0,
  singleCallCount: 1,
  emptyCount: 0,
  twoItemsCount: 2,
  confirmTitle: 'Confirm action',
  confirmDescription: 'Proceed with destructive change?',
  confirmActionLabel: 'Proceed',
  confirmCancelLabel: 'Abort',
  selectorCommitTextarea: 'git-commit-modal-textarea',
  selectorCommitError: 'git-commit-modal-error',
  selectorDiffBadge: 'git-diff-badge',
  selectorDiffBadgeStaged: 'git-diff-badge--staged',
  selectorDiffBadgeWorking: 'git-diff-badge--working',
  selectorDiffEmpty: 'git-diff-empty',
  selectorDiffLine: 'git-diff-line',
  selectorDiffMeta: 'git-diff-line--meta',
  selectorDiffHunk: 'git-diff-line--hunk',
  selectorDiffAdd: 'git-diff-line--add',
  selectorDiffRemove: 'git-diff-line--remove',
  selectorHistoryEmpty: 'git-history-empty',
  selectorHistoryItem: 'git-history-item',
  selectorHistoryHash: 'git-history-hash',
  selectorHistorySubject: 'git-history-subject',
  selectorHistoryAuthor: 'git-history-author',
  selectorHistoryDate: 'git-history-date',
  selectorHistoryFilesToggle: 'git-history-files-toggle',
  selectorHistoryFiles: 'git-history-files',
  selectorHistoryFileRow: 'git-history-file-row',
  selectorHistoryFileBadge: 'git-history-file-badge',
  selectorHistoryFileBadgeRenamed: 'git-history-file-badge--renamed',
  selectorHistoryFileOrig: 'git-history-file-orig',
  selectorHistoryShowMoreBtn: 'git-history-show-more-btn',
  ariaExpandedAttribute: 'aria-expanded',
  ariaTrue: 'true',
  ariaFalse: 'false',
  renamedFileNewPath: 'notes/new-daily.md',
  renamedFileOrigPath: 'notes/old-daily.md',
  addedFilePath: 'README.md',
  expectedOneFileEn: '1 file',
  expectedTwoFilesEn: '2 files',
  expectedOneFileRu: '1 файл',
  expectedTwoFilesRu: '2 файла',
  expectedFiveFilesRu: '5 файлов',
  expectedElevenFilesRu: '11 файлов',
  expectedTwentyOneFilesRu: '21 файл',
  oneFileCount: 1,
  twoFilesCount: 2,
  fiveFilesCount: 5,
  elevenFilesCount: 11,
  twentyOneFilesCount: 21,
  fiftyTwoFilesCount: 52,
  fiftyFilesCount: 50,
  generatedFilePrefix: 'notes/file-',
  generatedFileExtension: '.md',
  selectorErrorMessage: 'git-error-message',
  selectorErrorMetaRow: 'git-error-meta-row',
  selectorErrorMetaValue: 'git-error-meta-value',
  selectorErrorPre: 'git-error-pre',
  selectorErrorPreEmpty: 'git-error-pre--empty',
  selectorConfirmDescription: 'git-confirm-description',
  selectorModWarning: 'mod-warning',
  clipboardErrorText: 'clipboard denied',
  nullExitTermination: 'timed-out',
  nullExitCommand: 'git fetch',
  nullExitTimestamp: '2026-11-26 17:25:00',
  xssDiffText: '+<script>alert(1)</script>',
} as const;

const SAMPLE_HISTORY_ENTRIES: readonly GitCommitEntry[] = [
  {
    hash: 'abcdef1234567890',
    shortHash: 'abcdef1',
    author: 'Ada Lovelace',
    date: '2026-11-26T12:00:00+00:00',
    subject: 'Initial vault commit',
    files: [
      {
        kind: CommitFileChangeKind.Added,
        path: GIT_MODALS_TEST_CONSTANTS.addedFilePath,
      },
      {
        kind: CommitFileChangeKind.Renamed,
        path: GIT_MODALS_TEST_CONSTANTS.renamedFileNewPath,
        origPath: GIT_MODALS_TEST_CONSTANTS.renamedFileOrigPath,
      },
    ],
  },
  {
    hash: '1234567890abcdef',
    shortHash: '1234567',
    author: 'Grace Hopper',
    date: '2026-11-26T13:30:00+00:00',
    subject: 'Merge remote branch',
    files: [],
  },
];

const SAMPLE_ERROR_INFO: GitLastErrorInfo = {
  commandLine: 'git push origin main',
  exitCode: 128,
  termination: 'exited',
  timestamp: '2026-11-26 17:20:00',
  stderr: 'fatal: remote rejected',
  stdout: '',
  message: 'remote rejected push',
};

const MOCK_APP = {} as unknown as App;

function getContent(modal: unknown): InstanceType<typeof MockElement> {
  return (modal as { contentEl: InstanceType<typeof MockElement> }).contentEl;
}

function getIsOpen(modal: unknown): boolean {
  return (modal as { isOpen: boolean }).isOpen;
}

afterEach(() => {
  noticeCalls.length = GIT_MODALS_TEST_CONSTANTS.emptyCount;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CommitMessageModal', () => {
  it('prefills initial message, validates empty input inline, and submits trimmed text', () => {
    const onSubmit = vi.fn();
    const modal = new CommitMessageModal(
      MOCK_APP,
      ENGLISH_MESSAGES,
      GIT_MODALS_TEST_CONSTANTS.initialCommitMessage,
      onSubmit,
    );
    modal.open();

    const content = getContent(modal);
    const textarea = content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorCommitTextarea);
    const errorEl = content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorCommitError);
    expect(textarea?.value).toBe(GIT_MODALS_TEST_CONSTANTS.initialCommitMessage);
    expect(textarea?.focus).toHaveBeenCalledTimes(GIT_MODALS_TEST_CONSTANTS.singleCallCount);

    textarea?.input(GIT_MODALS_TEST_CONSTANTS.whitespaceOnly);
    content.findButtonByText(ENGLISH_MESSAGES.modals.commitMessage.submitButton)?.click();

    expect(errorEl?.getFullText()).toBe(ENGLISH_MESSAGES.modals.commitMessage.emptyError);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(getIsOpen(modal)).toBe(true);

    textarea?.input(GIT_MODALS_TEST_CONSTANTS.editedCommitMessage);
    expect(errorEl?.getFullText()).toBe(GIT_MODALS_TEST_CONSTANTS.emptyString);

    content.findButtonByText(ENGLISH_MESSAGES.modals.commitMessage.submitButton)?.click();
    expect(onSubmit).toHaveBeenCalledWith(GIT_MODALS_TEST_CONSTANTS.trimmedCommitMessage);
    expect(getIsOpen(modal)).toBe(false);
  });

  it('supports Ctrl+Enter and Cmd+Enter submit shortcuts and Cancel closing', () => {
    const onCtrlSubmit = vi.fn();
    const ctrlModal = new CommitMessageModal(
      MOCK_APP,
      ENGLISH_MESSAGES,
      GIT_MODALS_TEST_CONSTANTS.secondCommitMessage,
      onCtrlSubmit,
    );
    ctrlModal.open();
    const ctrlTextarea = getContent(ctrlModal).findByClass(
      GIT_MODALS_TEST_CONSTANTS.selectorCommitTextarea,
    );
    const ctrlKeyResult = ctrlTextarea?.keydown(GIT_MODALS_TEST_CONSTANTS.enterKey, {
      ctrlKey: true,
    });
    expect(ctrlKeyResult?.defaultPrevented).toBe(true);
    expect(onCtrlSubmit).toHaveBeenCalledWith(GIT_MODALS_TEST_CONSTANTS.secondCommitMessage);
    expect(getIsOpen(ctrlModal)).toBe(false);

    const onCmdSubmit = vi.fn();
    const cmdModal = new CommitMessageModal(
      MOCK_APP,
      ENGLISH_MESSAGES,
      GIT_MODALS_TEST_CONSTANTS.thirdCommitMessage,
      onCmdSubmit,
    );
    cmdModal.open();
    const cmdTextarea = getContent(cmdModal).findByClass(
      GIT_MODALS_TEST_CONSTANTS.selectorCommitTextarea,
    );
    cmdTextarea?.keydown(GIT_MODALS_TEST_CONSTANTS.enterKey, { metaKey: true });
    expect(onCmdSubmit).toHaveBeenCalledWith(GIT_MODALS_TEST_CONSTANTS.thirdCommitMessage);

    const onCancelledSubmit = vi.fn();
    const cancelModal = new CommitMessageModal(
      MOCK_APP,
      ENGLISH_MESSAGES,
      GIT_MODALS_TEST_CONSTANTS.initialCommitMessage,
      onCancelledSubmit,
    );
    cancelModal.open();
    getContent(cancelModal)
      .findButtonByText(ENGLISH_MESSAGES.modals.commitMessage.cancelButton)
      ?.click();
    expect(onCancelledSubmit).not.toHaveBeenCalled();
    expect(getIsOpen(cancelModal)).toBe(false);
  });
});

describe('GitDiffModal', () => {
  it('renders staged badge and syntax-highlighted unified diff lines safely', () => {
    const modal = new GitDiffModal(
      MOCK_APP,
      GIT_MODALS_TEST_CONSTANTS.diffFilePath,
      GIT_MODALS_TEST_CONSTANTS.sampleDiff,
      true,
      ENGLISH_MESSAGES,
    );
    modal.open();

    const content = getContent(modal);
    const badge = content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffBadge);
    expect(badge?.hasClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffBadgeStaged)).toBe(true);
    expect(badge?.getFullText()).toBe(ENGLISH_MESSAGES.modals.diff.stagedLabel);

    expect(content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffLine)).toHaveLength(
      GIT_MODALS_TEST_CONSTANTS.diffExpectedLineCount,
    );
    expect(content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffMeta)).toHaveLength(
      GIT_MODALS_TEST_CONSTANTS.diffExpectedMetaCount,
    );
    expect(content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffHunk)).toHaveLength(
      GIT_MODALS_TEST_CONSTANTS.diffExpectedHunkCount,
    );
    expect(content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffAdd)).toHaveLength(
      GIT_MODALS_TEST_CONSTANTS.diffExpectedAddCount,
    );
    expect(content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffRemove)).toHaveLength(
      GIT_MODALS_TEST_CONSTANTS.diffExpectedRemoveCount,
    );
  });

  it('renders working tree badge and empty state when diff text is blank', () => {
    const modal = new GitDiffModal(
      MOCK_APP,
      GIT_MODALS_TEST_CONSTANTS.diffFilePath,
      GIT_MODALS_TEST_CONSTANTS.whitespaceOnly,
      false,
      ENGLISH_MESSAGES,
    );
    modal.open();

    const content = getContent(modal);
    const badge = content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffBadge);
    expect(badge?.hasClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffBadgeWorking)).toBe(true);
    expect(badge?.getFullText()).toBe(ENGLISH_MESSAGES.modals.diff.workingTreeLabel);
    expect(content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffEmpty)?.getFullText()).toBe(
      ENGLISH_MESSAGES.modals.diff.emptyDiff,
    );

    content.findButtonByText(ENGLISH_MESSAGES.modals.diff.closeButton)?.click();
    expect(getIsOpen(modal)).toBe(false);
  });

  it('escapes HTML-like diff content using text nodes without creating child elements', () => {
    const modal = new GitDiffModal(
      MOCK_APP,
      GIT_MODALS_TEST_CONSTANTS.diffFilePath,
      GIT_MODALS_TEST_CONSTANTS.xssDiffText,
      false,
      ENGLISH_MESSAGES,
    );
    modal.open();

    const lineEl = getContent(modal).findByClass(GIT_MODALS_TEST_CONSTANTS.selectorDiffAdd);
    expect(lineEl?.children).toHaveLength(GIT_MODALS_TEST_CONSTANTS.emptyCount);
    expect(lineEl?.textContent).toBe(GIT_MODALS_TEST_CONSTANTS.xssDiffText);
  });
});

describe('GitHistoryModal', () => {
  it('renders empty state when commit history is empty', () => {
    const modal = new GitHistoryModal(MOCK_APP, [], ENGLISH_MESSAGES);
    modal.open();

    const content = getContent(modal);
    expect(content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryEmpty)?.getFullText()).toBe(
      ENGLISH_MESSAGES.modals.history.emptyHistory,
    );
  });

  it('renders commit hash, subject, author, and date collapsed by default and toggles affected files on click', () => {
    const modal = new GitHistoryModal(MOCK_APP, SAMPLE_HISTORY_ENTRIES, ENGLISH_MESSAGES);
    modal.open();

    const content = getContent(modal);
    const items = content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryItem);
    expect(items).toHaveLength(GIT_MODALS_TEST_CONSTANTS.twoItemsCount);

    const firstItem = items[GIT_MODALS_TEST_CONSTANTS.firstIndex];
    const firstEntry = SAMPLE_HISTORY_ENTRIES[GIT_MODALS_TEST_CONSTANTS.firstIndex];
    expect(firstItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryHash)?.getFullText()).toBe(
      firstEntry?.shortHash,
    );
    expect(
      firstItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistorySubject)?.getFullText(),
    ).toBe(firstEntry?.subject);
    expect(
      firstItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryAuthor)?.getFullText(),
    ).toBe(firstEntry?.author);
    expect(firstItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryDate)?.getFullText()).toBe(
      firstEntry?.date,
    );

    const secondItem = items[GIT_MODALS_TEST_CONSTANTS.oneFileCount];
    expect(
      secondItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFilesToggle),
    ).toBeUndefined();

    const toggleBtn = firstItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFilesToggle);
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn?.getAttribute(GIT_MODALS_TEST_CONSTANTS.ariaExpandedAttribute)).toBe(
      GIT_MODALS_TEST_CONSTANTS.ariaFalse,
    );
    expect(toggleBtn?.getFullText()).toBe(GIT_MODALS_TEST_CONSTANTS.expectedTwoFilesEn);
    expect(firstItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFiles)).toBeUndefined();

    toggleBtn?.click();
    expect(toggleBtn?.getAttribute(GIT_MODALS_TEST_CONSTANTS.ariaExpandedAttribute)).toBe(
      GIT_MODALS_TEST_CONSTANTS.ariaTrue,
    );

    const drawer = firstItem?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFiles);
    expect(drawer).toBeDefined();
    expect(drawer?.hidden).toBe(false);

    const fileRows = drawer?.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFileRow) ?? [];
    expect(fileRows).toHaveLength(GIT_MODALS_TEST_CONSTANTS.twoFilesCount);
    expect(fileRows[GIT_MODALS_TEST_CONSTANTS.firstIndex]?.getFullText()).toContain(
      GIT_MODALS_TEST_CONSTANTS.addedFilePath,
    );
    const renamedRow = fileRows[GIT_MODALS_TEST_CONSTANTS.oneFileCount];
    expect(
      renamedRow
        ?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFileBadge)
        ?.hasClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFileBadgeRenamed),
    ).toBe(true);
    expect(
      renamedRow?.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFileOrig)?.getFullText(),
    ).toBe(
      ENGLISH_MESSAGES.modals.history.renamedFromPrefix +
        GIT_MODALS_TEST_CONSTANTS.renamedFileOrigPath,
    );

    toggleBtn?.click();
    expect(toggleBtn?.getAttribute(GIT_MODALS_TEST_CONSTANTS.ariaExpandedAttribute)).toBe(
      GIT_MODALS_TEST_CONSTANTS.ariaFalse,
    );
    expect(drawer?.hidden).toBe(true);

    content.findButtonByText(ENGLISH_MESSAGES.modals.history.closeButton)?.click();
    expect(getIsOpen(modal)).toBe(false);
  });

  it('caps initially rendered commit files and reveals all when Show all is clicked', () => {
    const manyFiles = Array.from(
      { length: GIT_MODALS_TEST_CONSTANTS.fiftyTwoFilesCount },
      (_unused, idx) => ({
        kind: CommitFileChangeKind.Modified,
        path:
          GIT_MODALS_TEST_CONSTANTS.generatedFilePrefix +
          String(idx) +
          GIT_MODALS_TEST_CONSTANTS.generatedFileExtension,
      }),
    );
    const largeEntry: GitCommitEntry = {
      hash: '9999999999999999999999999999999999999999',
      shortHash: '9999999',
      author: 'Linus Torvalds',
      date: '2026-11-26T15:00:00+00:00',
      subject: 'Large vault import',
      files: manyFiles,
    };

    const modal = new GitHistoryModal(MOCK_APP, [largeEntry], ENGLISH_MESSAGES);
    modal.open();

    const content = getContent(modal);
    content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFilesToggle)?.click();

    const drawer = content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFiles);
    expect(
      drawer?.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFileRow),
    ).toHaveLength(GIT_MODALS_TEST_CONSTANTS.fiftyFilesCount);

    const showMoreBtn = content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryShowMoreBtn);
    expect(showMoreBtn).toBeDefined();
    showMoreBtn?.click();

    expect(
      drawer?.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryFileRow),
    ).toHaveLength(GIT_MODALS_TEST_CONSTANTS.fiftyTwoFilesCount);
    expect(content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorHistoryShowMoreBtn)).toBeUndefined();
  });

  it('formats affected file counts with localized English and Russian plural rules', () => {
    expect(
      formatCommitFilesCount(GIT_MODALS_TEST_CONSTANTS.oneFileCount, ENGLISH_MESSAGES.modals.history),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.expectedOneFileEn);
    expect(
      formatCommitFilesCount(GIT_MODALS_TEST_CONSTANTS.twoFilesCount, ENGLISH_MESSAGES.modals.history),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.expectedTwoFilesEn);
    expect(
      formatCommitFilesCount(GIT_MODALS_TEST_CONSTANTS.oneFileCount, RUSSIAN_MESSAGES.modals.history),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.expectedOneFileRu);
    expect(
      formatCommitFilesCount(GIT_MODALS_TEST_CONSTANTS.twoFilesCount, RUSSIAN_MESSAGES.modals.history),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.expectedTwoFilesRu);
    expect(
      formatCommitFilesCount(GIT_MODALS_TEST_CONSTANTS.fiveFilesCount, RUSSIAN_MESSAGES.modals.history),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.expectedFiveFilesRu);
    expect(
      formatCommitFilesCount(
        GIT_MODALS_TEST_CONSTANTS.elevenFilesCount,
        RUSSIAN_MESSAGES.modals.history,
      ),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.expectedElevenFilesRu);
    expect(
      formatCommitFilesCount(
        GIT_MODALS_TEST_CONSTANTS.twentyOneFilesCount,
        RUSSIAN_MESSAGES.modals.history,
      ),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.expectedTwentyOneFilesRu);
  });
});

describe('GitErrorModal', () => {
  it('renders error metadata, output sections, and copies formatted details to clipboard', async () => {
    const writeText = vi.fn(async (_text: string) => {});
    vi.stubGlobal(GIT_MODALS_TEST_CONSTANTS.navigatorGlobal, {
      clipboard: { writeText },
    });

    const modal = new GitErrorModal(MOCK_APP, SAMPLE_ERROR_INFO, ENGLISH_MESSAGES);
    modal.open();

    const content = getContent(modal);
    expect(content.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorErrorMessage)?.getFullText()).toBe(
      SAMPLE_ERROR_INFO.message,
    );
    expect(content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorErrorMetaRow)).toHaveLength(
      GIT_MODALS_TEST_CONSTANTS.errorMetaRowCount,
    );
    const preBlocks = content.findAllByClass(GIT_MODALS_TEST_CONSTANTS.selectorErrorPre);
    expect(preBlocks[GIT_MODALS_TEST_CONSTANTS.firstIndex]?.getFullText()).toBe(
      SAMPLE_ERROR_INFO.stderr,
    );
    expect(
      preBlocks[GIT_MODALS_TEST_CONSTANTS.singleCallCount]?.hasClass(
        GIT_MODALS_TEST_CONSTANTS.selectorErrorPreEmpty,
      ),
    ).toBe(true);
    expect(preBlocks[GIT_MODALS_TEST_CONSTANTS.singleCallCount]?.getFullText()).toBe(
      ENGLISH_MESSAGES.modals.errorLog.emptyOutput,
    );

    content.findButtonByText(ENGLISH_MESSAGES.modals.errorLog.copyButton)?.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(GIT_MODALS_TEST_CONSTANTS.singleCallCount);
    expect(
      writeText.mock.calls[GIT_MODALS_TEST_CONSTANTS.firstIndex]?.[
        GIT_MODALS_TEST_CONSTANTS.firstIndex
      ],
    ).toContain(SAMPLE_ERROR_INFO.commandLine);
    expect(noticeCalls).toEqual([ENGLISH_MESSAGES.ui.copiedToClipboard]);

    const failingWriteText = vi.fn(async (_text: string) => {
      throw new Error(GIT_MODALS_TEST_CONSTANTS.clipboardErrorText);
    });
    vi.stubGlobal(GIT_MODALS_TEST_CONSTANTS.navigatorGlobal, {
      clipboard: { writeText: failingWriteText },
    });
    content.findButtonByText(ENGLISH_MESSAGES.modals.errorLog.copyButton)?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(failingWriteText).toHaveBeenCalledTimes(GIT_MODALS_TEST_CONSTANTS.singleCallCount);

    content.findButtonByText(ENGLISH_MESSAGES.modals.errorLog.closeButton)?.click();
    expect(getIsOpen(modal)).toBe(false);
  });

  it('displays termination alone when exitCode is null', () => {
    const modal = new GitErrorModal(
      MOCK_APP,
      {
        commandLine: GIT_MODALS_TEST_CONSTANTS.nullExitCommand,
        exitCode: null,
        termination: GIT_MODALS_TEST_CONSTANTS.nullExitTermination,
        timestamp: GIT_MODALS_TEST_CONSTANTS.nullExitTimestamp,
        stderr: GIT_MODALS_TEST_CONSTANTS.emptyString,
        stdout: GIT_MODALS_TEST_CONSTANTS.emptyString,
        message: GIT_MODALS_TEST_CONSTANTS.emptyString,
      },
      ENGLISH_MESSAGES,
    );
    modal.open();

    const metaValues = getContent(modal).findAllByClass(
      GIT_MODALS_TEST_CONSTANTS.selectorErrorMetaValue,
    );
    expect(metaValues[GIT_MODALS_TEST_CONSTANTS.singleCallCount]?.getFullText()).toBe(
      GIT_MODALS_TEST_CONSTANTS.nullExitTermination,
    );
  });
});

describe('ConfirmModal', () => {
  it('invokes onConfirm only when confirmed and closes on cancel', () => {
    const onConfirm = vi.fn();
    const cancelModal = new ConfirmModal(
      MOCK_APP,
      GIT_MODALS_TEST_CONSTANTS.confirmTitle,
      GIT_MODALS_TEST_CONSTANTS.confirmDescription,
      GIT_MODALS_TEST_CONSTANTS.confirmActionLabel,
      GIT_MODALS_TEST_CONSTANTS.confirmCancelLabel,
      onConfirm,
    );
    cancelModal.open();

    const cancelContent = getContent(cancelModal);
    expect(
      cancelContent.findByClass(GIT_MODALS_TEST_CONSTANTS.selectorConfirmDescription)?.getFullText(),
    ).toBe(GIT_MODALS_TEST_CONSTANTS.confirmDescription);
    cancelContent.findButtonByText(GIT_MODALS_TEST_CONSTANTS.confirmCancelLabel)?.click();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(getIsOpen(cancelModal)).toBe(false);

    const confirmModal = new ConfirmModal(
      MOCK_APP,
      GIT_MODALS_TEST_CONSTANTS.confirmTitle,
      GIT_MODALS_TEST_CONSTANTS.confirmDescription,
      GIT_MODALS_TEST_CONSTANTS.confirmActionLabel,
      GIT_MODALS_TEST_CONSTANTS.confirmCancelLabel,
      onConfirm,
    );
    confirmModal.open();
    const confirmBtn = getContent(confirmModal).findByClass(
      GIT_MODALS_TEST_CONSTANTS.selectorModWarning,
    );
    expect(confirmBtn?.getFullText()).toBe(GIT_MODALS_TEST_CONSTANTS.confirmActionLabel);
    confirmBtn?.click();
    expect(onConfirm).toHaveBeenCalledTimes(GIT_MODALS_TEST_CONSTANTS.singleCallCount);
    expect(getIsOpen(confirmModal)).toBe(false);
  });
});
