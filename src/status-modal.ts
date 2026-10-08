import { Modal, setIcon, TFile, type App } from 'obsidian';
import { ChangeKind, type GitFileChange, type GitStatus } from './git/status-parser';
import { GitAction, PLUGIN_DOM_NAMES, PLUGIN_FORMAT } from './plugin-constants';
import type { PluginMessages } from './i18n/types';

const STATUS_MODAL_TAGS = {
  div: 'div',
  span: 'span',
  button: 'button',
  paragraph: 'p',
  heading: 'h2',
} as const;

const STATUS_MODAL_ATTRIBUTES = {
  title: 'title',
  type: 'type',
} as const;

const BUTTON_TYPES = {
  button: 'button',
} as const;

const STATUS_MODAL_CLASSES = {
  modal: 'git-status-modal',
  content: 'git-status-modal-content',
  headerCard: 'git-status-header-card',
  branchContainer: 'git-status-branch-container',
  branchIcon: 'git-status-branch-icon',
  branchName: 'git-status-branch-name',
  detachedBadge: 'git-status-detached-badge',
  headerPills: 'git-status-header-pills',
  pill: 'git-status-pill',
  pillAhead: 'git-status-pill--ahead',
  pillBehind: 'git-status-pill--behind',
  pillSynced: 'git-status-pill--synced',
  pillSummary: 'git-status-pill--summary',
  cleanContainer: 'git-status-clean-container',
  cleanIcon: 'git-status-clean-icon',
  cleanTitle: 'git-status-clean-title',
  cleanDescription: 'git-status-clean-description',
  sectionsContainer: 'git-status-sections',
  section: 'git-status-section',
  sectionHeader: 'git-status-section-header',
  sectionTitle: 'git-status-section-title',
  sectionTitleConflicts: 'git-status-section-title--conflicts',
  sectionCount: 'git-status-section-count',
  fileList: 'git-status-file-list',
  fileRow: 'git-status-file-row',
  fileRowClickable: 'git-status-file-row--clickable',
  badge: 'git-status-badge',
  badgeConflict: 'git-status-badge--conflict',
  badgeAdded: 'git-status-badge--added',
  badgeDeleted: 'git-status-badge--deleted',
  badgeRenamed: 'git-status-badge--renamed',
  badgeModified: 'git-status-badge--modified',
  badgeUntracked: 'git-status-badge--untracked',
  badgeOther: 'git-status-badge--other',
  filePath: 'git-status-file-path',
  fileFolder: 'git-status-file-folder',
  fileName: 'git-status-file-name',
  fileHint: 'git-status-file-hint',
  footer: 'git-status-footer',
  footerSummary: 'git-status-footer-summary',
  footerActions: 'git-status-footer-actions',
  buttonModCta: 'mod-cta',
} as const;

const STATUS_MODAL_ICONS = {
  branch: 'git-branch',
  checkCircle: 'check-circle-2',
  fileOpen: 'arrow-up-right',
} as const;

const STATUS_MODAL_COUNTS = {
  none: 0,
  pathSeparatorOffset: 1,
  notFoundIndex: -1,
  firstIndex: 0,
} as const;

const PATH_DELIMITER = '/';
const OPEN_LINK_LEAF_DEFAULT = false;

const CHANGE_KIND_BADGE_CLASSES: Record<ChangeKind, string> = {
  [ChangeKind.Conflict]: STATUS_MODAL_CLASSES.badgeConflict,
  [ChangeKind.Added]: STATUS_MODAL_CLASSES.badgeAdded,
  [ChangeKind.Deleted]: STATUS_MODAL_CLASSES.badgeDeleted,
  [ChangeKind.Renamed]: STATUS_MODAL_CLASSES.badgeRenamed,
  [ChangeKind.Modified]: STATUS_MODAL_CLASSES.badgeModified,
  [ChangeKind.Untracked]: STATUS_MODAL_CLASSES.badgeUntracked,
  [ChangeKind.Other]: STATUS_MODAL_CLASSES.badgeOther,
};

interface FileGroup {
  readonly title: string;
  readonly files: readonly GitFileChange[];
  readonly isConflict?: boolean;
}

interface SplitPathResult {
  readonly folder: string;
  readonly name: string;
}

export function splitFilePath(filePath: string): SplitPathResult {
  const lastSlashIndex = filePath.lastIndexOf(PATH_DELIMITER);
  if (lastSlashIndex === STATUS_MODAL_COUNTS.notFoundIndex) {
    return { folder: PLUGIN_FORMAT.emptyString, name: filePath };
  }
  return {
    folder: filePath.slice(
      STATUS_MODAL_COUNTS.firstIndex,
      lastSlashIndex + STATUS_MODAL_COUNTS.pathSeparatorOffset,
    ),
    name: filePath.slice(lastSlashIndex + STATUS_MODAL_COUNTS.pathSeparatorOffset),
  };
}

export function groupStatusFiles(
  files: readonly GitFileChange[],
  messages: PluginMessages['statusModal'],
): readonly FileGroup[] {
  const conflicts: GitFileChange[] = [];
  const staged: GitFileChange[] = [];
  const unstaged: GitFileChange[] = [];
  const untracked: GitFileChange[] = [];

  for (const file of files) {
    if (file.kind === ChangeKind.Conflict) {
      conflicts.push(file);
    } else if (file.staged) {
      staged.push(file);
    } else if (file.kind === ChangeKind.Untracked) {
      untracked.push(file);
    } else {
      unstaged.push(file);
    }
  }

  const groups: FileGroup[] = [];

  if (conflicts.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      title: messages.sectionConflicts,
      files: conflicts,
      isConflict: true,
    });
  }

  if (staged.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      title: messages.sectionStaged,
      files: staged,
    });
  }

  if (unstaged.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      title: messages.sectionUnstaged,
      files: unstaged,
    });
  }

  if (untracked.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      title: messages.sectionUntracked,
      files: untracked,
    });
  }

  return groups;
}

function safeSetIcon(element: HTMLElement, iconId: string): void {
  if (typeof setIcon === 'function') {
    setIcon(element, iconId);
  }
}

export class GitStatusModal extends Modal {
  public constructor(
    app: App,
    private readonly status: GitStatus,
    private readonly messages: PluginMessages,
    private readonly onAction?: (action: GitAction) => void,
  ) {
    super(app);
  }

  public onOpen(): void {
    const { contentEl, modalEl, titleEl } = this;
    modalEl.addClass(STATUS_MODAL_CLASSES.modal);
    titleEl.setText(this.messages.statusModal.title);

    contentEl.empty();
    contentEl.addClass(STATUS_MODAL_CLASSES.content);

    this.renderHeaderCard(contentEl);

    if (this.status.files.length === STATUS_MODAL_COUNTS.none) {
      this.renderCleanState(contentEl);
    } else {
      this.renderSections(contentEl);
    }

    this.renderFooter(contentEl);
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private renderHeaderCard(container: HTMLElement): void {
    const { statusModal } = this.messages;
    const card = container.createDiv({ cls: STATUS_MODAL_CLASSES.headerCard });

    const branchContainer = card.createDiv({ cls: STATUS_MODAL_CLASSES.branchContainer });
    const branchIconEl = branchContainer.createSpan({ cls: STATUS_MODAL_CLASSES.branchIcon });
    safeSetIcon(branchIconEl, STATUS_MODAL_ICONS.branch);

    if (this.status.branch !== null) {
      branchContainer.createSpan({
        cls: STATUS_MODAL_CLASSES.branchName,
        text: this.status.branch,
      });
    } else {
      branchContainer.createSpan({
        cls: STATUS_MODAL_CLASSES.detachedBadge,
        text: statusModal.detachedBranch,
      });
    }

    const pillsContainer = card.createDiv({ cls: STATUS_MODAL_CLASSES.headerPills });

    if (this.status.ahead > STATUS_MODAL_COUNTS.none) {
      const aheadPill = pillsContainer.createSpan({ cls: STATUS_MODAL_CLASSES.pill });
      aheadPill.addClass(STATUS_MODAL_CLASSES.pillAhead);
      aheadPill.setText(statusModal.aheadPrefix + this.status.ahead);
    }

    if (this.status.behind > STATUS_MODAL_COUNTS.none) {
      const behindPill = pillsContainer.createSpan({ cls: STATUS_MODAL_CLASSES.pill });
      behindPill.addClass(STATUS_MODAL_CLASSES.pillBehind);
      behindPill.setText(statusModal.behindPrefix + this.status.behind);
    }

    if (
      this.status.ahead === STATUS_MODAL_COUNTS.none &&
      this.status.behind === STATUS_MODAL_COUNTS.none
    ) {
      const syncedPill = pillsContainer.createSpan({ cls: STATUS_MODAL_CLASSES.pill });
      syncedPill.addClass(STATUS_MODAL_CLASSES.pillSynced);
      syncedPill.setText(statusModal.upToDate);
    }

    if (this.status.files.length > STATUS_MODAL_COUNTS.none) {
      const summaryPill = pillsContainer.createSpan({ cls: STATUS_MODAL_CLASSES.pill });
      summaryPill.addClass(STATUS_MODAL_CLASSES.pillSummary);
      summaryPill.setText(this.status.files.length + statusModal.changesCountSuffix);
    }
  }

  private renderCleanState(container: HTMLElement): void {
    const { statusModal } = this.messages;
    const cleanContainer = container.createDiv({ cls: STATUS_MODAL_CLASSES.cleanContainer });
    const iconEl = cleanContainer.createDiv({ cls: STATUS_MODAL_CLASSES.cleanIcon });
    safeSetIcon(iconEl, STATUS_MODAL_ICONS.checkCircle);

    cleanContainer.createEl(STATUS_MODAL_TAGS.heading, {
      cls: STATUS_MODAL_CLASSES.cleanTitle,
      text: statusModal.cleanWorkingTree,
    });

    cleanContainer.createEl(STATUS_MODAL_TAGS.paragraph, {
      cls: STATUS_MODAL_CLASSES.cleanDescription,
      text: statusModal.cleanWorkingTreeDescription,
    });
  }

  private renderSections(container: HTMLElement): void {
    const sectionsContainer = container.createDiv({
      cls: STATUS_MODAL_CLASSES.sectionsContainer,
    });
    const groups = groupStatusFiles(this.status.files, this.messages.statusModal);

    for (const group of groups) {
      const sectionEl = sectionsContainer.createDiv({ cls: STATUS_MODAL_CLASSES.section });
      const headerEl = sectionEl.createDiv({ cls: STATUS_MODAL_CLASSES.sectionHeader });

      const titleSpan = headerEl.createSpan({ cls: STATUS_MODAL_CLASSES.sectionTitle });
      if (group.isConflict) {
        titleSpan.addClass(STATUS_MODAL_CLASSES.sectionTitleConflicts);
      }
      titleSpan.setText(group.title);

      headerEl.createSpan({
        cls: STATUS_MODAL_CLASSES.sectionCount,
        text: String(group.files.length),
      });

      const listEl = sectionEl.createDiv({ cls: STATUS_MODAL_CLASSES.fileList });
      for (const file of group.files) {
        this.renderFileRow(listEl, file);
      }
    }
  }

  private renderFileRow(container: HTMLElement, file: GitFileChange): void {
    const { statusModal, changeLabels } = this.messages;
    const row = container.createDiv({ cls: STATUS_MODAL_CLASSES.fileRow });

    const badgeCls = CHANGE_KIND_BADGE_CLASSES[file.kind] ?? STATUS_MODAL_CLASSES.badgeOther;
    const badgeEl = row.createSpan({ cls: STATUS_MODAL_CLASSES.badge });
    badgeEl.addClass(badgeCls);
    badgeEl.setText(changeLabels[file.kind] ?? statusModal.fallbackChangeLabel);

    const pathEl = row.createDiv({ cls: STATUS_MODAL_CLASSES.filePath });
    const { folder, name } = splitFilePath(file.path);
    if (folder.length > STATUS_MODAL_COUNTS.none) {
      pathEl.createSpan({ cls: STATUS_MODAL_CLASSES.fileFolder, text: folder });
    }
    pathEl.createSpan({ cls: STATUS_MODAL_CLASSES.fileName, text: name });
    pathEl.setAttribute(STATUS_MODAL_ATTRIBUTES.title, file.path);

    const abstractFile = this.app.vault.getAbstractFileByPath(file.path);
    if (abstractFile instanceof TFile) {
      row.addClass(STATUS_MODAL_CLASSES.fileRowClickable);
      row.setAttribute(STATUS_MODAL_ATTRIBUTES.title, statusModal.openFileTooltip);
      const hintEl = row.createSpan({ cls: STATUS_MODAL_CLASSES.fileHint });
      safeSetIcon(hintEl, STATUS_MODAL_ICONS.fileOpen);

      row.addEventListener(PLUGIN_DOM_NAMES.clickEvent, () => {
        this.close();
        void this.app.workspace.openLinkText(
          file.path,
          PLUGIN_FORMAT.emptyString,
          OPEN_LINK_LEAF_DEFAULT,
        );
      });
    }
  }

  private renderFooter(container: HTMLElement): void {
    const { statusModal } = this.messages;
    const footer = container.createDiv({ cls: STATUS_MODAL_CLASSES.footer });

    const summaryEl = footer.createDiv({ cls: STATUS_MODAL_CLASSES.footerSummary });
    const totalCount = this.status.files.length;
    let stagedCount = STATUS_MODAL_COUNTS.none;
    for (const file of this.status.files) {
      if (file.staged) stagedCount++;
    }

    if (totalCount > STATUS_MODAL_COUNTS.none) {
      let summaryText = totalCount + statusModal.changesCountSuffix;
      if (stagedCount > STATUS_MODAL_COUNTS.none) {
        summaryText += statusModal.separator + stagedCount + statusModal.stagedSummarySuffix;
      }
      summaryEl.setText(summaryText);
    }

    const actionsEl = footer.createDiv({ cls: STATUS_MODAL_CLASSES.footerActions });

    if (this.onAction !== undefined) {
      if (totalCount > STATUS_MODAL_COUNTS.none) {
        const commitBtn = actionsEl.createEl(STATUS_MODAL_TAGS.button, {
          cls: STATUS_MODAL_CLASSES.buttonModCta,
          text: statusModal.commitButton,
        });
        commitBtn.setAttribute(STATUS_MODAL_ATTRIBUTES.type, BUTTON_TYPES.button);
        commitBtn.addEventListener(PLUGIN_DOM_NAMES.clickEvent, () => {
          this.close();
          this.onAction?.(GitAction.CommitAll);
        });
      }

      const syncBtn = actionsEl.createEl(STATUS_MODAL_TAGS.button, {
        text: statusModal.syncButton,
      });
      syncBtn.setAttribute(STATUS_MODAL_ATTRIBUTES.type, BUTTON_TYPES.button);
      syncBtn.addEventListener(PLUGIN_DOM_NAMES.clickEvent, () => {
        this.close();
        this.onAction?.(GitAction.Sync);
      });
    }

    const closeBtn = actionsEl.createEl(STATUS_MODAL_TAGS.button, {
      text: statusModal.closeButton,
    });
    closeBtn.setAttribute(STATUS_MODAL_ATTRIBUTES.type, BUTTON_TYPES.button);
    closeBtn.addEventListener(PLUGIN_DOM_NAMES.clickEvent, () => {
      this.close();
    });
  }
}
