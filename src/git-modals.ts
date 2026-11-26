import { Modal, Notice, type App } from 'obsidian';
import {
  CommitFileChangeKind,
  type GitCommitEntry,
  type GitCommitFileChange,
} from './git/git-service';
import type { PluginMessages } from './i18n/types';
import { PLUGIN_DOM_NAMES, PLUGIN_FORMAT } from './plugin-constants';
import {
  ARIA_BOOLEAN_VALUES,
  createModalButton,
  JAVASCRIPT_TYPE_NAMES,
  MODAL_BUTTON_CLASSES,
  MODAL_SHARED_TAGS,
  safeSetIcon,
  splitFilePath,
} from './ui-helpers';

const GIT_MODALS_TAGS = {
  textarea: 'textarea',
  heading3: 'h3',
} as const;

const GIT_MODALS_ATTRIBUTES = {
  rows: 'rows',
  placeholder: 'placeholder',
} as const;

const GIT_MODALS_EVENTS = {
  input: 'input',
} as const;

const GIT_MODALS_CLASSES = {
  commitModal: 'git-commit-modal',
  commitForm: 'git-commit-modal-form',
  commitTextarea: 'git-commit-modal-textarea',
  commitError: 'git-commit-modal-error',
  commitFooter: 'git-commit-modal-footer',
  diffModal: 'git-diff-modal',
  diffHeader: 'git-diff-header',
  diffFilePath: 'git-diff-file-path',
  diffBadge: 'git-diff-badge',
  diffBadgeStaged: 'git-diff-badge--staged',
  diffBadgeWorking: 'git-diff-badge--working',
  diffEmpty: 'git-diff-empty',
  diffLines: 'git-diff-lines',
  diffLine: 'git-diff-line',
  diffLineAdd: 'git-diff-line--add',
  diffLineRemove: 'git-diff-line--remove',
  diffLineHunk: 'git-diff-line--hunk',
  diffLineMeta: 'git-diff-line--meta',
  diffFooter: 'git-diff-footer',
  historyModal: 'git-history-modal',
  historyEmpty: 'git-history-empty',
  historyList: 'git-history-list',
  historyItem: 'git-history-item',
  historyItemExpanded: 'git-history-item--expanded',
  historyItemHeader: 'git-history-item-header',
  historyHash: 'git-history-hash',
  historySubject: 'git-history-subject',
  historyMeta: 'git-history-meta',
  historyAuthor: 'git-history-author',
  historyMetaRight: 'git-history-meta-right',
  historyDate: 'git-history-date',
  historyFilesToggle: 'git-history-files-toggle',
  historyFilesToggleIcon: 'git-history-files-toggle-icon',
  historyFilesToggleLabel: 'git-history-files-toggle-label',
  historyFiles: 'git-history-files',
  historyFileRow: 'git-history-file-row',
  historyFileBadge: 'git-history-file-badge',
  historyFileBadgeAdded: 'git-history-file-badge--added',
  historyFileBadgeModified: 'git-history-file-badge--modified',
  historyFileBadgeDeleted: 'git-history-file-badge--deleted',
  historyFileBadgeRenamed: 'git-history-file-badge--renamed',
  historyFileBadgeCopied: 'git-history-file-badge--copied',
  historyFileBadgeOther: 'git-history-file-badge--other',
  historyFileInfo: 'git-history-file-info',
  historyFilePath: 'git-history-file-path',
  historyFileFolder: 'git-history-file-folder',
  historyFileName: 'git-history-file-name',
  historyFileOrig: 'git-history-file-orig',
  historyShowMoreBtn: 'git-history-show-more-btn',
  historyFooter: 'git-history-footer',
  errorModal: 'git-error-modal',
  errorMessage: 'git-error-message',
  errorMeta: 'git-error-meta',
  errorMetaRow: 'git-error-meta-row',
  errorMetaLabel: 'git-error-meta-label',
  errorMetaValue: 'git-error-meta-value',
  errorSection: 'git-error-section',
  errorSectionLabel: 'git-error-section-label',
  errorPre: 'git-error-pre',
  errorPreEmpty: 'git-error-pre--empty',
  errorFooter: 'git-error-footer',
  confirmModal: 'git-confirm-modal',
  confirmDescription: 'git-confirm-description',
  confirmFooter: 'git-confirm-footer',
} as const;

const COMMIT_MODAL_DEFAULTS = {
  textareaRows: 4,
  emptyLength: 0,
} as const;

const DIFF_SYNTAX = {
  lineBreakPattern: /\r?\n/,
  trailingLineBreakPattern: /\r?\n$/,
  diffHeaderPrefix: 'diff ',
  indexPrefix: 'index ',
  oldFilePrefix: '---',
  newFilePrefix: '+++',
  hunkPrefix: '@@',
  addedPrefix: '+',
  removedPrefix: '-',
  classSeparator: ' ',
} as const;

const ERROR_MODAL_FORMAT = {
  exitCodePrefix: ' (',
  exitCodeSuffix: ')',
  labelValueSeparator: ': ',
  lineSeparator: '\n',
  sectionSeparator: '\n\n',
  copyIcon: 'copy',
} as const;

const HISTORY_MODAL_CONSTANTS = {
  chevronCollapsedIcon: 'chevron-right',
  chevronExpandedIcon: 'chevron-down',
  ariaExpandedAttribute: 'aria-expanded',
  countSeparator: ' ',
  initialVisibleFilesLimit: 50,
  firstIndex: 0,
  pluralModTen: 10,
  pluralModHundred: 100,
  pluralSingular: 1,
  pluralFewMin: 2,
  pluralFewMax: 4,
  pluralTeenMin: 11,
  pluralTeenMax: 14,
} as const;

const COMMIT_FILE_BADGE_CODES: Record<CommitFileChangeKind, string> = {
  [CommitFileChangeKind.Added]: 'A',
  [CommitFileChangeKind.Modified]: 'M',
  [CommitFileChangeKind.Deleted]: 'D',
  [CommitFileChangeKind.Renamed]: 'R',
  [CommitFileChangeKind.Copied]: 'C',
  [CommitFileChangeKind.TypeChanged]: 'T',
  [CommitFileChangeKind.Other]: '?',
};

const COMMIT_FILE_BADGE_CLASSES: Record<CommitFileChangeKind, string> = {
  [CommitFileChangeKind.Added]: GIT_MODALS_CLASSES.historyFileBadgeAdded,
  [CommitFileChangeKind.Modified]: GIT_MODALS_CLASSES.historyFileBadgeModified,
  [CommitFileChangeKind.Deleted]: GIT_MODALS_CLASSES.historyFileBadgeDeleted,
  [CommitFileChangeKind.Renamed]: GIT_MODALS_CLASSES.historyFileBadgeRenamed,
  [CommitFileChangeKind.Copied]: GIT_MODALS_CLASSES.historyFileBadgeCopied,
  [CommitFileChangeKind.TypeChanged]: GIT_MODALS_CLASSES.historyFileBadgeModified,
  [CommitFileChangeKind.Other]: GIT_MODALS_CLASSES.historyFileBadgeOther,
};

const DIFF_META_PREFIXES = [
  DIFF_SYNTAX.diffHeaderPrefix,
  DIFF_SYNTAX.indexPrefix,
  DIFF_SYNTAX.oldFilePrefix,
  DIFF_SYNTAX.newFilePrefix,
] as const;

export interface GitLastErrorInfo {
  readonly commandLine: string;
  readonly exitCode: number | null;
  readonly termination: string;
  readonly timestamp: string;
  readonly stderr: string;
  readonly stdout: string;
  readonly message: string;
}

/** Modal dialog for entering and validating a custom Git commit message. */
export class CommitMessageModal extends Modal {
  public constructor(
    app: App,
    private readonly messages: PluginMessages,
    private readonly initialMessage: string,
    private readonly onSubmit: (message: string) => void,
  ) {
    super(app);
  }

  public onOpen(): void {
    const { commitMessage } = this.messages.modals;
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(GIT_MODALS_CLASSES.commitModal);
    titleEl.setText(commitMessage.title);
    contentEl.empty();

    const formEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.commitForm });
    const textarea = formEl.createEl(GIT_MODALS_TAGS.textarea, {
      cls: GIT_MODALS_CLASSES.commitTextarea,
      placeholder: commitMessage.placeholder,
      value: this.initialMessage,
    });
    textarea.value = this.initialMessage;
    textarea.setAttribute(GIT_MODALS_ATTRIBUTES.rows, String(COMMIT_MODAL_DEFAULTS.textareaRows));
    textarea.setAttribute(GIT_MODALS_ATTRIBUTES.placeholder, commitMessage.placeholder);

    const errorEl = formEl.createDiv({ cls: GIT_MODALS_CLASSES.commitError });

    const submit = (): void => {
      const trimmed = textarea.value.trim();
      if (trimmed.length === COMMIT_MODAL_DEFAULTS.emptyLength) {
        errorEl.setText(commitMessage.emptyError);
        return;
      }
      this.close();
      this.onSubmit(trimmed);
    };

    textarea.addEventListener(GIT_MODALS_EVENTS.input, () => {
      if (textarea.value.trim().length > COMMIT_MODAL_DEFAULTS.emptyLength) {
        errorEl.setText(PLUGIN_FORMAT.emptyString);
      }
    });

    textarea.addEventListener(PLUGIN_DOM_NAMES.keydownEvent, (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === PLUGIN_DOM_NAMES.keyEnter) {
        event.preventDefault();
        submit();
      }
    });

    const footerEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.commitFooter });
    createModalButton(footerEl, {
      text: commitMessage.submitButton,
      cls: MODAL_BUTTON_CLASSES.cta,
      onClick: submit,
    });
    createModalButton(footerEl, {
      text: commitMessage.cancelButton,
      onClick: () => this.close(),
    });

    if (typeof textarea.focus === JAVASCRIPT_TYPE_NAMES.function) {
      textarea.focus();
    }
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}

/** Modal dialog that displays a unified diff with line-level syntax classification. */
export class GitDiffModal extends Modal {
  public constructor(
    app: App,
    private readonly filePath: string,
    private readonly diffText: string,
    private readonly staged: boolean,
    private readonly messages: PluginMessages,
  ) {
    super(app);
  }

  public onOpen(): void {
    const { diff } = this.messages.modals;
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(GIT_MODALS_CLASSES.diffModal);
    titleEl.setText(diff.titlePrefix + this.filePath);
    contentEl.empty();

    const headerEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.diffHeader });
    headerEl.createSpan({ cls: GIT_MODALS_CLASSES.diffFilePath, text: this.filePath });

    const badgeCls =
      GIT_MODALS_CLASSES.diffBadge +
      DIFF_SYNTAX.classSeparator +
      (this.staged ? GIT_MODALS_CLASSES.diffBadgeStaged : GIT_MODALS_CLASSES.diffBadgeWorking);
    headerEl.createSpan({
      cls: badgeCls,
      text: this.staged ? diff.stagedLabel : diff.workingTreeLabel,
    });

    if (this.diffText.trim().length === COMMIT_MODAL_DEFAULTS.emptyLength) {
      contentEl.createEl(MODAL_SHARED_TAGS.paragraph, {
        cls: GIT_MODALS_CLASSES.diffEmpty,
        text: diff.emptyDiff,
      });
    } else {
      const linesContainer = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.diffLines });
      const normalized = this.diffText.replace(
        DIFF_SYNTAX.trailingLineBreakPattern,
        PLUGIN_FORMAT.emptyString,
      );
      for (const line of normalized.split(DIFF_SYNTAX.lineBreakPattern)) {
        const lineEl = linesContainer.createDiv({ cls: getDiffLineClass(line) });
        lineEl.setText(line);
      }
    }

    const footerEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.diffFooter });
    createModalButton(footerEl, {
      text: diff.closeButton,
      onClick: () => this.close(),
    });
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}

/** Format affected file count using localized singular/few/many plural nouns. */
export function formatCommitFilesCount(
  count: number,
  historyMessages: PluginMessages['modals']['history'],
): string {
  const absCount = Math.abs(count);
  const modHundred = absCount % HISTORY_MODAL_CONSTANTS.pluralModHundred;
  const modTen = absCount % HISTORY_MODAL_CONSTANTS.pluralModTen;

  let noun: string;
  if (
    modHundred >= HISTORY_MODAL_CONSTANTS.pluralTeenMin &&
    modHundred <= HISTORY_MODAL_CONSTANTS.pluralTeenMax
  ) {
    noun = historyMessages.fileCountMany;
  } else if (modTen === HISTORY_MODAL_CONSTANTS.pluralSingular) {
    noun = historyMessages.fileCountOne;
  } else if (
    modTen >= HISTORY_MODAL_CONSTANTS.pluralFewMin &&
    modTen <= HISTORY_MODAL_CONSTANTS.pluralFewMax
  ) {
    noun = historyMessages.fileCountFew;
  } else {
    noun = historyMessages.fileCountMany;
  }

  return String(count) + HISTORY_MODAL_CONSTANTS.countSeparator + noun;
}

/** Modal dialog that displays recent Git commits with expandable per-commit affected file lists. */
export class GitHistoryModal extends Modal {
  public constructor(
    app: App,
    private readonly entries: readonly GitCommitEntry[],
    private readonly messages: PluginMessages,
  ) {
    super(app);
  }

  public onOpen(): void {
    const { history } = this.messages.modals;
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(GIT_MODALS_CLASSES.historyModal);
    titleEl.setText(history.title);
    contentEl.empty();

    if (this.entries.length === COMMIT_MODAL_DEFAULTS.emptyLength) {
      contentEl.createEl(MODAL_SHARED_TAGS.paragraph, {
        cls: GIT_MODALS_CLASSES.historyEmpty,
        text: history.emptyHistory,
      });
    } else {
      const listEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.historyList });
      for (const entry of this.entries) {
        this.renderCommitEntry(listEl, entry);
      }
    }

    const footerEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.historyFooter });
    createModalButton(footerEl, {
      text: history.closeButton,
      onClick: () => this.close(),
    });
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private renderCommitEntry(listEl: HTMLElement, entry: GitCommitEntry): void {
    const { history } = this.messages.modals;
    const itemEl = listEl.createDiv({ cls: GIT_MODALS_CLASSES.historyItem });

    const headerEl = itemEl.createDiv({ cls: GIT_MODALS_CLASSES.historyItemHeader });
    headerEl.createSpan({ cls: GIT_MODALS_CLASSES.historyHash, text: entry.shortHash });
    headerEl.createSpan({ cls: GIT_MODALS_CLASSES.historySubject, text: entry.subject });

    const metaEl = itemEl.createDiv({ cls: GIT_MODALS_CLASSES.historyMeta });
    metaEl.createSpan({ cls: GIT_MODALS_CLASSES.historyAuthor, text: entry.author });

    const metaRightEl = metaEl.createDiv({ cls: GIT_MODALS_CLASSES.historyMetaRight });
    metaRightEl.createSpan({ cls: GIT_MODALS_CLASSES.historyDate, text: entry.date });

    if (entry.files.length === COMMIT_MODAL_DEFAULTS.emptyLength) {
      return;
    }

    let expanded = false;
    let filesDrawerEl: HTMLElement | null = null;

    const toggleBtn = metaRightEl.createEl(MODAL_SHARED_TAGS.button, {
      cls: GIT_MODALS_CLASSES.historyFilesToggle,
      title: history.toggleFilesTooltip,
    });
    toggleBtn.setAttribute(PLUGIN_DOM_NAMES.typeAttribute, PLUGIN_DOM_NAMES.buttonType);
    toggleBtn.setAttribute(
      HISTORY_MODAL_CONSTANTS.ariaExpandedAttribute,
      ARIA_BOOLEAN_VALUES.false,
    );

    const iconEl = toggleBtn.createSpan({ cls: GIT_MODALS_CLASSES.historyFilesToggleIcon });
    safeSetIcon(iconEl, HISTORY_MODAL_CONSTANTS.chevronCollapsedIcon);
    toggleBtn.createSpan({
      cls: GIT_MODALS_CLASSES.historyFilesToggleLabel,
      text: formatCommitFilesCount(entry.files.length, history),
    });

    toggleBtn.addEventListener(PLUGIN_DOM_NAMES.clickEvent, () => {
      expanded = !expanded;
      toggleBtn.setAttribute(
        HISTORY_MODAL_CONSTANTS.ariaExpandedAttribute,
        expanded ? ARIA_BOOLEAN_VALUES.true : ARIA_BOOLEAN_VALUES.false,
      );
      safeSetIcon(
        iconEl,
        expanded
          ? HISTORY_MODAL_CONSTANTS.chevronExpandedIcon
          : HISTORY_MODAL_CONSTANTS.chevronCollapsedIcon,
      );
      if (expanded) {
        itemEl.addClass(GIT_MODALS_CLASSES.historyItemExpanded);
        if (filesDrawerEl === null) {
          filesDrawerEl = this.createFilesDrawer(itemEl, entry.files);
        }
        filesDrawerEl.hidden = false;
      } else {
        itemEl.removeClass(GIT_MODALS_CLASSES.historyItemExpanded);
        if (filesDrawerEl !== null) {
          filesDrawerEl.hidden = true;
        }
      }
    });
  }

  private createFilesDrawer(
    itemEl: HTMLElement,
    files: readonly GitCommitFileChange[],
  ): HTMLElement {
    const drawerEl = itemEl.createDiv({ cls: GIT_MODALS_CLASSES.historyFiles });
    const initialFiles = files.slice(
      HISTORY_MODAL_CONSTANTS.firstIndex,
      HISTORY_MODAL_CONSTANTS.initialVisibleFilesLimit,
    );
    for (const file of initialFiles) {
      this.renderCommitFileRow(drawerEl, file);
    }

    if (files.length > HISTORY_MODAL_CONSTANTS.initialVisibleFilesLimit) {
      const showMoreBtn = createModalButton(drawerEl, {
        cls: GIT_MODALS_CLASSES.historyShowMoreBtn,
        text: this.messages.modals.history.showMoreFilesPrefix + String(files.length),
        onClick: () => {
          showMoreBtn.remove();
          const remainingFiles = files.slice(HISTORY_MODAL_CONSTANTS.initialVisibleFilesLimit);
          for (const file of remainingFiles) {
            this.renderCommitFileRow(drawerEl, file);
          }
        },
      });
    }

    return drawerEl;
  }

  private renderCommitFileRow(container: HTMLElement, file: GitCommitFileChange): void {
    const { history } = this.messages.modals;
    const rowEl = container.createDiv({ cls: GIT_MODALS_CLASSES.historyFileRow });

    const badgeModifier =
      COMMIT_FILE_BADGE_CLASSES[file.kind] ?? GIT_MODALS_CLASSES.historyFileBadgeOther;
    const badgeEl = rowEl.createSpan({
      cls: GIT_MODALS_CLASSES.historyFileBadge + DIFF_SYNTAX.classSeparator + badgeModifier,
      text: COMMIT_FILE_BADGE_CODES[file.kind],
    });
    badgeEl.setAttribute(PLUGIN_DOM_NAMES.titleAttribute, getCommitFileStatusLabel(file.kind, history));

    const infoEl = rowEl.createDiv({ cls: GIT_MODALS_CLASSES.historyFileInfo });
    const pathEl = infoEl.createDiv({
      cls: GIT_MODALS_CLASSES.historyFilePath,
      title: file.path,
    });
    const { folder, name } = splitFilePath(file.path);
    if (folder.length > COMMIT_MODAL_DEFAULTS.emptyLength) {
      pathEl.createSpan({ cls: GIT_MODALS_CLASSES.historyFileFolder, text: folder });
    }
    pathEl.createSpan({ cls: GIT_MODALS_CLASSES.historyFileName, text: name });

    if (file.origPath !== undefined) {
      infoEl.createDiv({
        cls: GIT_MODALS_CLASSES.historyFileOrig,
        text: history.renamedFromPrefix + file.origPath,
        title: file.origPath,
      });
    }
  }
}

/** Modal dialog showing diagnostic details for the most recent Git command failure. */
export class GitErrorModal extends Modal {
  public constructor(
    app: App,
    private readonly errorInfo: GitLastErrorInfo,
    private readonly messages: PluginMessages,
  ) {
    super(app);
  }

  public onOpen(): void {
    const { errorLog } = this.messages.modals;
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(GIT_MODALS_CLASSES.errorModal);
    titleEl.setText(errorLog.title);
    contentEl.empty();

    if (this.errorInfo.message.trim().length > COMMIT_MODAL_DEFAULTS.emptyLength) {
      contentEl.createDiv({
        cls: GIT_MODALS_CLASSES.errorMessage,
        text: this.errorInfo.message,
      });
    }

    const metaEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.errorMeta });
    this.renderMetaRow(metaEl, errorLog.commandLabel, this.errorInfo.commandLine);
    this.renderMetaRow(metaEl, errorLog.exitCodeLabel, formatExitStatus(this.errorInfo));
    this.renderMetaRow(metaEl, errorLog.timestampLabel, this.errorInfo.timestamp);

    this.renderOutputSection(contentEl, errorLog.stderrLabel, this.errorInfo.stderr);
    this.renderOutputSection(contentEl, errorLog.stdoutLabel, this.errorInfo.stdout);

    const footerEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.errorFooter });
    createModalButton(footerEl, {
      text: errorLog.copyButton,
      icon: ERROR_MODAL_FORMAT.copyIcon,
      cls: MODAL_BUTTON_CLASSES.cta,
      onClick: () => {
        void this.copyErrorDetails();
      },
    });
    createModalButton(footerEl, {
      text: errorLog.closeButton,
      onClick: () => this.close(),
    });
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private renderMetaRow(container: HTMLElement, label: string, value: string): void {
    const rowEl = container.createDiv({ cls: GIT_MODALS_CLASSES.errorMetaRow });
    rowEl.createSpan({ cls: GIT_MODALS_CLASSES.errorMetaLabel, text: label });
    rowEl.createSpan({ cls: GIT_MODALS_CLASSES.errorMetaValue, text: value });
  }

  private renderOutputSection(container: HTMLElement, label: string, output: string): void {
    const { errorLog } = this.messages.modals;
    const sectionEl = container.createDiv({ cls: GIT_MODALS_CLASSES.errorSection });
    sectionEl.createEl(GIT_MODALS_TAGS.heading3, {
      cls: GIT_MODALS_CLASSES.errorSectionLabel,
      text: label,
    });

    const isEmpty = output.trim().length === COMMIT_MODAL_DEFAULTS.emptyLength;
    const preCls = isEmpty
      ? GIT_MODALS_CLASSES.errorPre + DIFF_SYNTAX.classSeparator + GIT_MODALS_CLASSES.errorPreEmpty
      : GIT_MODALS_CLASSES.errorPre;
    sectionEl.createEl(MODAL_SHARED_TAGS.pre, {
      cls: preCls,
      text: isEmpty ? errorLog.emptyOutput : output,
    });
  }

  private async copyErrorDetails(): Promise<void> {
    if (
      typeof navigator === JAVASCRIPT_TYPE_NAMES.undefined ||
      typeof navigator.clipboard?.writeText !== JAVASCRIPT_TYPE_NAMES.function
    ) {
      return;
    }

    try {
      await navigator.clipboard.writeText(this.formatErrorDetails());
      new Notice(this.messages.ui.copiedToClipboard);
    } catch {
      // Clipboard writes can fail when the environment denies clipboard access.
    }
  }

  private formatErrorDetails(): string {
    const { errorLog } = this.messages.modals;
    const stderrText =
      this.errorInfo.stderr.trim().length > COMMIT_MODAL_DEFAULTS.emptyLength
        ? this.errorInfo.stderr
        : errorLog.emptyOutput;
    const stdoutText =
      this.errorInfo.stdout.trim().length > COMMIT_MODAL_DEFAULTS.emptyLength
        ? this.errorInfo.stdout
        : errorLog.emptyOutput;

    const lines = [
      errorLog.commandLabel + ERROR_MODAL_FORMAT.labelValueSeparator + this.errorInfo.commandLine,
      errorLog.exitCodeLabel +
        ERROR_MODAL_FORMAT.labelValueSeparator +
        formatExitStatus(this.errorInfo),
      errorLog.timestampLabel + ERROR_MODAL_FORMAT.labelValueSeparator + this.errorInfo.timestamp,
      this.errorInfo.message,
      errorLog.stderrLabel +
        ERROR_MODAL_FORMAT.labelValueSeparator +
        ERROR_MODAL_FORMAT.lineSeparator +
        stderrText,
      errorLog.stdoutLabel +
        ERROR_MODAL_FORMAT.labelValueSeparator +
        ERROR_MODAL_FORMAT.lineSeparator +
        stdoutText,
    ];
    return lines.join(ERROR_MODAL_FORMAT.sectionSeparator);
  }
}

/** Accessible confirmation modal for destructive operations such as discarding local changes. */
export class ConfirmModal extends Modal {
  public constructor(
    app: App,
    private readonly title: string,
    private readonly description: string,
    private readonly confirmLabel: string,
    private readonly cancelLabel: string,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  public onOpen(): void {
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(GIT_MODALS_CLASSES.confirmModal);
    titleEl.setText(this.title);
    contentEl.empty();

    contentEl.createEl(MODAL_SHARED_TAGS.paragraph, {
      cls: GIT_MODALS_CLASSES.confirmDescription,
      text: this.description,
    });

    const footerEl = contentEl.createDiv({ cls: GIT_MODALS_CLASSES.confirmFooter });
    createModalButton(footerEl, {
      text: this.confirmLabel,
      cls: MODAL_BUTTON_CLASSES.warning,
      onClick: () => {
        this.close();
        this.onConfirm();
      },
    });
    createModalButton(footerEl, {
      text: this.cancelLabel,
      onClick: () => this.close(),
    });
  }

  public onClose(): void {
    this.contentEl.empty();
  }
}

function getDiffLineClass(line: string): string {
  const modifier = resolveDiffLineModifier(line);
  if (modifier === null) {
    return GIT_MODALS_CLASSES.diffLine;
  }
  return GIT_MODALS_CLASSES.diffLine + DIFF_SYNTAX.classSeparator + modifier;
}

function resolveDiffLineModifier(line: string): string | null {
  if (DIFF_META_PREFIXES.some((prefix) => line.startsWith(prefix))) {
    return GIT_MODALS_CLASSES.diffLineMeta;
  }
  if (line.startsWith(DIFF_SYNTAX.hunkPrefix)) {
    return GIT_MODALS_CLASSES.diffLineHunk;
  }
  if (line.startsWith(DIFF_SYNTAX.addedPrefix)) {
    return GIT_MODALS_CLASSES.diffLineAdd;
  }
  if (line.startsWith(DIFF_SYNTAX.removedPrefix)) {
    return GIT_MODALS_CLASSES.diffLineRemove;
  }
  return null;
}

function getCommitFileStatusLabel(
  kind: CommitFileChangeKind,
  historyMessages: PluginMessages['modals']['history'],
): string {
  switch (kind) {
    case CommitFileChangeKind.Added:
      return historyMessages.statusAdded;
    case CommitFileChangeKind.Modified:
      return historyMessages.statusModified;
    case CommitFileChangeKind.Deleted:
      return historyMessages.statusDeleted;
    case CommitFileChangeKind.Renamed:
      return historyMessages.statusRenamed;
    case CommitFileChangeKind.Copied:
      return historyMessages.statusCopied;
    case CommitFileChangeKind.TypeChanged:
      return historyMessages.statusTypeChanged;
    case CommitFileChangeKind.Other:
      return historyMessages.statusOther;
  }
}

function formatExitStatus(errorInfo: GitLastErrorInfo): string {
  if (errorInfo.exitCode === null) {
    return errorInfo.termination;
  }
  return (
    String(errorInfo.exitCode) +
    ERROR_MODAL_FORMAT.exitCodePrefix +
    errorInfo.termination +
    ERROR_MODAL_FORMAT.exitCodeSuffix
  );
}
