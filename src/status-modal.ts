import { Modal, TFile, type App } from 'obsidian';
import { ChangeKind, type GitFileChange, type GitStatus } from './git/status-parser';
import { ConfirmModal } from './git-modals';
import type { PluginMessages } from './i18n/types';
import { GitAction, PLUGIN_DOM_NAMES, PLUGIN_FORMAT } from './plugin-constants';
import {
  bindKeyboardActivation,
  createModalButton,
  JAVASCRIPT_TYPE_NAMES,
  MODAL_BUTTON_CLASSES,
  MODAL_SHARED_TAGS,
  safeSetIcon,
  splitFilePath,
  type SplitPathResult,
} from './ui-helpers';

const STATUS_MODAL_CLASSES = {
  modal: 'git-status-modal',
  content: 'git-status-modal-content',
  headerCard: 'git-status-header-card',
  branchContainer: 'git-status-branch-container',
  branchIcon: 'git-status-branch-icon',
  branchName: 'git-status-branch-name',
  detachedBadge: 'git-status-detached-badge',
  headerControls: 'git-status-header-controls',
  headerPills: 'git-status-header-pills',
  pill: 'git-status-pill',
  pillAhead: 'git-status-pill--ahead',
  pillBehind: 'git-status-pill--behind',
  pillSynced: 'git-status-pill--synced',
  pillNoUpstream: 'git-status-pill--no-upstream',
  pillSummary: 'git-status-pill--summary',
  refreshButton: 'git-status-refresh-btn',
  refreshButtonIcon: 'git-status-refresh-btn-icon',
  conflictBanner: 'git-status-conflict-banner',
  conflictBannerIcon: 'git-status-conflict-banner-icon',
  conflictBannerBody: 'git-status-conflict-banner-body',
  conflictBannerTitle: 'git-status-conflict-banner-title',
  conflictBannerDescription: 'git-status-conflict-banner-description',
  cleanContainer: 'git-status-clean-container',
  cleanIcon: 'git-status-clean-icon',
  cleanTitle: 'git-status-clean-title',
  cleanDescription: 'git-status-clean-description',
  sectionsContainer: 'git-status-sections',
  section: 'git-status-section',
  sectionHeader: 'git-status-section-header',
  sectionHeaderMeta: 'git-status-section-header-meta',
  sectionTitle: 'git-status-section-title',
  sectionTitleConflicts: 'git-status-section-title--conflicts',
  sectionCount: 'git-status-section-count',
  sectionAction: 'git-status-section-action',
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
  fileInfo: 'git-status-file-info',
  filePathLine: 'git-status-file-path-line',
  filePath: 'git-status-file-path',
  fileFolder: 'git-status-file-folder',
  fileName: 'git-status-file-name',
  fileOrigPath: 'git-status-file-orig-path',
  fileExternalBadge: 'git-status-file-external-badge',
  fileHint: 'git-status-file-hint',
  fileActions: 'git-status-file-actions',
  actionButton: 'git-status-action-btn',
  actionButtonDiff: 'git-status-action-btn--diff',
  actionButtonStage: 'git-status-action-btn--stage',
  actionButtonUnstage: 'git-status-action-btn--unstage',
  actionButtonDiscard: 'git-status-action-btn--discard',
  footer: 'git-status-footer',
  footerSummary: 'git-status-footer-summary',
  footerActions: 'git-status-footer-actions',
} as const;

const STATUS_MODAL_ICONS = {
  branch: 'git-branch',
  checkCircle: 'check-circle-2',
  fileOpen: 'arrow-up-right',
  refresh: 'refresh-cw',
  warning: 'alert-triangle',
} as const;

const STATUS_MODAL_COUNTS = {
  none: 0,
} as const;

const CLASS_SEPARATOR = ' ';
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

export enum StatusSectionKind {
  Conflict = 'conflict',
  Staged = 'staged',
  Unstaged = 'unstaged',
  Untracked = 'untracked',
}

export interface StatusFileGroup {
  readonly kind: StatusSectionKind;
  readonly title: string;
  readonly files: readonly GitFileChange[];
  readonly isConflict?: boolean;
}

export { splitFilePath, type SplitPathResult };

export interface GitStatusModalCallbacks {
  readonly onAction?: (action: GitAction) => void;
  readonly onRefresh?: () => Promise<GitStatus | null>;
  readonly onStageFile?: (file: GitFileChange) => Promise<GitStatus | null>;
  readonly onUnstageFile?: (file: GitFileChange) => Promise<GitStatus | null>;
  readonly onDiscardFile?: (file: GitFileChange) => Promise<GitStatus | null>;
  readonly onStageAll?: () => Promise<GitStatus | null>;
  readonly onUnstageAll?: () => Promise<GitStatus | null>;
  readonly onViewDiff?: (file: GitFileChange, staged: boolean) => void;
}

/** Group changed files into ordered modal sections, placing dual-state entries in both staged and unstaged. */
export function groupStatusFiles(
  files: readonly GitFileChange[],
  messages: PluginMessages['statusModal'],
): readonly StatusFileGroup[] {
  const conflicts: GitFileChange[] = [];
  const staged: GitFileChange[] = [];
  const unstaged: GitFileChange[] = [];
  const untracked: GitFileChange[] = [];

  for (const file of files) {
    if (file.kind === ChangeKind.Conflict) {
      conflicts.push(file);
      continue;
    }

    if (file.staged) {
      staged.push(file);
    }

    if (file.unstaged) {
      unstaged.push(file);
    }

    if (!file.staged && !file.unstaged) {
      if (file.kind === ChangeKind.Untracked) {
        untracked.push(file);
      } else {
        unstaged.push(file);
      }
    }
  }

  const groups: StatusFileGroup[] = [];

  if (conflicts.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      kind: StatusSectionKind.Conflict,
      title: messages.sectionConflicts,
      files: conflicts,
      isConflict: true,
    });
  }

  if (staged.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      kind: StatusSectionKind.Staged,
      title: messages.sectionStaged,
      files: staged,
    });
  }

  if (unstaged.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      kind: StatusSectionKind.Unstaged,
      title: messages.sectionUnstaged,
      files: unstaged,
    });
  }

  if (untracked.length > STATUS_MODAL_COUNTS.none) {
    groups.push({
      kind: StatusSectionKind.Untracked,
      title: messages.sectionUntracked,
      files: untracked,
    });
  }

  return groups;
}

/** Interactive repository status modal showing branch tracking, grouped file changes, and Git actions. */
export class GitStatusModal extends Modal {
  private currentStatus: GitStatus;
  private busy = false;
  private readonly callbacks: GitStatusModalCallbacks;

  public constructor(
    app: App,
    status: GitStatus,
    private readonly messages: PluginMessages,
    callbacksOrOnAction?: GitStatusModalCallbacks | ((action: GitAction) => void),
  ) {
    super(app);
    this.currentStatus = status;
    this.callbacks = normalizeCallbacks(callbacksOrOnAction);
  }

  public onOpen(): void {
    const { modalEl, titleEl } = this;
    modalEl.addClass(STATUS_MODAL_CLASSES.modal);
    titleEl.setText(this.messages.statusModal.title);
    this.render();
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass(STATUS_MODAL_CLASSES.content);

    this.renderHeaderCard(contentEl);

    if (this.hasConflicts()) {
      this.renderConflictBanner(contentEl);
    }

    if (this.currentStatus.files.length === STATUS_MODAL_COUNTS.none) {
      this.renderCleanState(contentEl);
    } else {
      this.renderSections(contentEl);
    }

    this.renderFooter(contentEl);
  }

  private hasConflicts(): boolean {
    return this.currentStatus.files.some((file) => file.kind === ChangeKind.Conflict);
  }

  private async runStatusUpdate(operation: () => Promise<GitStatus | null>): Promise<void> {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.render();
    try {
      const nextStatus = await operation();
      if (nextStatus !== null) {
        this.currentStatus = nextStatus;
      }
    } finally {
      this.busy = false;
      this.render();
    }
  }

  private renderHeaderCard(container: HTMLElement): void {
    const { statusModal } = this.messages;
    const card = container.createDiv({ cls: STATUS_MODAL_CLASSES.headerCard });

    const branchContainer = card.createDiv({ cls: STATUS_MODAL_CLASSES.branchContainer });
    const branchIconEl = branchContainer.createSpan({ cls: STATUS_MODAL_CLASSES.branchIcon });
    safeSetIcon(branchIconEl, STATUS_MODAL_ICONS.branch);

    if (this.currentStatus.branch !== null) {
      branchContainer.createSpan({
        cls: STATUS_MODAL_CLASSES.branchName,
        text: this.currentStatus.branch,
      });
    } else {
      branchContainer.createSpan({
        cls: STATUS_MODAL_CLASSES.detachedBadge,
        text: statusModal.detachedBranch,
      });
    }

    const controlsContainer = card.createDiv({ cls: STATUS_MODAL_CLASSES.headerControls });
    const pillsContainer = controlsContainer.createDiv({ cls: STATUS_MODAL_CLASSES.headerPills });

    if (this.currentStatus.ahead > STATUS_MODAL_COUNTS.none) {
      this.createPill(
        pillsContainer,
        STATUS_MODAL_CLASSES.pillAhead,
        statusModal.aheadPrefix + this.currentStatus.ahead,
      );
    }

    if (this.currentStatus.behind > STATUS_MODAL_COUNTS.none) {
      this.createPill(
        pillsContainer,
        STATUS_MODAL_CLASSES.pillBehind,
        statusModal.behindPrefix + this.currentStatus.behind,
      );
    }

    if (this.currentStatus.upstream === null) {
      this.createPill(
        pillsContainer,
        STATUS_MODAL_CLASSES.pillNoUpstream,
        statusModal.noUpstream,
      );
    } else if (
      this.currentStatus.ahead === STATUS_MODAL_COUNTS.none &&
      this.currentStatus.behind === STATUS_MODAL_COUNTS.none
    ) {
      this.createPill(pillsContainer, STATUS_MODAL_CLASSES.pillSynced, statusModal.upToDate);
    }

    if (this.currentStatus.files.length > STATUS_MODAL_COUNTS.none) {
      this.createPill(
        pillsContainer,
        STATUS_MODAL_CLASSES.pillSummary,
        this.currentStatus.files.length + statusModal.changesCountSuffix,
      );
    }

    const { onRefresh } = this.callbacks;
    if (onRefresh !== undefined) {
      createModalButton(controlsContainer, {
        text: statusModal.refreshButton,
        cls: STATUS_MODAL_CLASSES.refreshButton,
        title: statusModal.refreshButton,
        ariaLabel: statusModal.refreshButton,
        icon: STATUS_MODAL_ICONS.refresh,
        iconCls: STATUS_MODAL_CLASSES.refreshButtonIcon,
        disabled: this.busy,
        onClick: () => {
          void this.runStatusUpdate(onRefresh);
        },
      });
    }
  }

  private createPill(container: HTMLElement, modifierClass: string, text: string): void {
    const pill = container.createSpan({ cls: STATUS_MODAL_CLASSES.pill });
    pill.addClass(modifierClass);
    pill.setText(text);
  }

  private renderConflictBanner(container: HTMLElement): void {
    const { statusModal } = this.messages;
    const banner = container.createDiv({ cls: STATUS_MODAL_CLASSES.conflictBanner });
    const iconEl = banner.createSpan({ cls: STATUS_MODAL_CLASSES.conflictBannerIcon });
    safeSetIcon(iconEl, STATUS_MODAL_ICONS.warning);

    const bodyEl = banner.createDiv({ cls: STATUS_MODAL_CLASSES.conflictBannerBody });
    bodyEl.createDiv({
      cls: STATUS_MODAL_CLASSES.conflictBannerTitle,
      text: statusModal.conflictBannerTitle,
    });
    bodyEl.createDiv({
      cls: STATUS_MODAL_CLASSES.conflictBannerDescription,
      text: statusModal.conflictBannerDescription,
    });
  }

  private renderCleanState(container: HTMLElement): void {
    const { statusModal } = this.messages;
    const cleanContainer = container.createDiv({ cls: STATUS_MODAL_CLASSES.cleanContainer });
    const iconEl = cleanContainer.createDiv({ cls: STATUS_MODAL_CLASSES.cleanIcon });
    safeSetIcon(iconEl, STATUS_MODAL_ICONS.checkCircle);

    cleanContainer.createEl(MODAL_SHARED_TAGS.heading, {
      cls: STATUS_MODAL_CLASSES.cleanTitle,
      text: statusModal.cleanWorkingTree,
    });

    cleanContainer.createEl(MODAL_SHARED_TAGS.paragraph, {
      cls: STATUS_MODAL_CLASSES.cleanDescription,
      text: statusModal.cleanWorkingTreeDescription,
    });
  }

  private renderSections(container: HTMLElement): void {
    const sectionsContainer = container.createDiv({
      cls: STATUS_MODAL_CLASSES.sectionsContainer,
    });
    const groups = groupStatusFiles(this.currentStatus.files, this.messages.statusModal);

    for (const group of groups) {
      const sectionEl = sectionsContainer.createDiv({ cls: STATUS_MODAL_CLASSES.section });
      this.renderSectionHeader(sectionEl, group);

      const listEl = sectionEl.createDiv({ cls: STATUS_MODAL_CLASSES.fileList });
      for (const file of group.files) {
        this.renderFileRow(listEl, file, group.kind);
      }
    }
  }

  private renderSectionHeader(sectionEl: HTMLElement, group: StatusFileGroup): void {
    const { statusModal } = this.messages;
    const headerEl = sectionEl.createDiv({ cls: STATUS_MODAL_CLASSES.sectionHeader });
    const metaEl = headerEl.createDiv({ cls: STATUS_MODAL_CLASSES.sectionHeaderMeta });

    const titleSpan = metaEl.createSpan({ cls: STATUS_MODAL_CLASSES.sectionTitle });
    if (group.isConflict) {
      titleSpan.addClass(STATUS_MODAL_CLASSES.sectionTitleConflicts);
    }
    titleSpan.setText(group.title);

    metaEl.createSpan({
      cls: STATUS_MODAL_CLASSES.sectionCount,
      text: String(group.files.length),
    });

    const { onStageAll, onUnstageAll } = this.callbacks;
    if (group.kind === StatusSectionKind.Staged && onUnstageAll !== undefined) {
      createModalButton(headerEl, {
        text: statusModal.unstageAllButton,
        cls: STATUS_MODAL_CLASSES.sectionAction,
        disabled: this.busy,
        onClick: () => {
          void this.runStatusUpdate(onUnstageAll);
        },
      });
    } else if (
      (group.kind === StatusSectionKind.Unstaged || group.kind === StatusSectionKind.Untracked) &&
      onStageAll !== undefined
    ) {
      createModalButton(headerEl, {
        text: statusModal.stageAllButton,
        cls: STATUS_MODAL_CLASSES.sectionAction,
        disabled: this.busy,
        onClick: () => {
          void this.runStatusUpdate(onStageAll);
        },
      });
    }
  }

  private renderFileRow(
    container: HTMLElement,
    file: GitFileChange,
    sectionKind: StatusSectionKind,
  ): void {
    const { statusModal, changeLabels } = this.messages;
    const row = container.createDiv({ cls: STATUS_MODAL_CLASSES.fileRow });

    const badgeCls = CHANGE_KIND_BADGE_CLASSES[file.kind] ?? STATUS_MODAL_CLASSES.badgeOther;
    const badgeEl = row.createSpan({ cls: STATUS_MODAL_CLASSES.badge });
    badgeEl.addClass(badgeCls);
    badgeEl.setText(changeLabels[file.kind] ?? statusModal.fallbackChangeLabel);

    const fileInfoEl = row.createDiv({ cls: STATUS_MODAL_CLASSES.fileInfo });
    const pathLineEl = fileInfoEl.createDiv({ cls: STATUS_MODAL_CLASSES.filePathLine });
    const pathEl = pathLineEl.createDiv({ cls: STATUS_MODAL_CLASSES.filePath });
    const { folder, name } = splitFilePath(file.path);
    if (folder.length > STATUS_MODAL_COUNTS.none) {
      pathEl.createSpan({ cls: STATUS_MODAL_CLASSES.fileFolder, text: folder });
    }
    pathEl.createSpan({ cls: STATUS_MODAL_CLASSES.fileName, text: name });
    pathEl.setAttribute(PLUGIN_DOM_NAMES.titleAttribute, file.path);

    if (!file.inVault) {
      pathLineEl.createSpan({
        cls: STATUS_MODAL_CLASSES.fileExternalBadge,
        text: statusModal.externalFileBadge,
      });
    }

    if (file.origPath !== undefined && file.origPath.length > STATUS_MODAL_COUNTS.none) {
      fileInfoEl.createDiv({
        cls: STATUS_MODAL_CLASSES.fileOrigPath,
        text: statusModal.renamedFromPrefix + file.origPath,
      });
    }

    if (file.inVault) {
      const abstractFile = this.app.vault.getAbstractFileByPath(file.path);
      if (abstractFile instanceof TFile) {
        row.addClass(STATUS_MODAL_CLASSES.fileRowClickable);
        row.setAttribute(PLUGIN_DOM_NAMES.titleAttribute, statusModal.openFileTooltip);
        row.setAttribute(PLUGIN_DOM_NAMES.roleAttribute, PLUGIN_DOM_NAMES.buttonRole);
        row.setAttribute(PLUGIN_DOM_NAMES.tabIndexAttribute, PLUGIN_DOM_NAMES.initialTabIndex);

        const hintEl = row.createSpan({ cls: STATUS_MODAL_CLASSES.fileHint });
        safeSetIcon(hintEl, STATUS_MODAL_ICONS.fileOpen);

        bindKeyboardActivation(row, () => {
          this.openVaultFile(abstractFile, file.path);
        });
      }
    }

    this.renderFileRowActions(row, file, sectionKind);
  }

  private renderFileRowActions(
    row: HTMLElement,
    file: GitFileChange,
    sectionKind: StatusSectionKind,
  ): void {
    const { statusModal, modals } = this.messages;
    const { onViewDiff, onStageFile, onUnstageFile, onDiscardFile } = this.callbacks;

    const canViewDiff = onViewDiff !== undefined && file.kind !== ChangeKind.Untracked;
    const canUnstage = sectionKind === StatusSectionKind.Staged && onUnstageFile !== undefined;
    const isWorkingSection =
      sectionKind === StatusSectionKind.Unstaged || sectionKind === StatusSectionKind.Untracked;
    const canStage = isWorkingSection && onStageFile !== undefined;
    const canDiscard = isWorkingSection && onDiscardFile !== undefined;

    if (!canViewDiff && !canUnstage && !canStage && !canDiscard) {
      return;
    }

    const actionsEl = row.createDiv({ cls: STATUS_MODAL_CLASSES.fileActions });

    if (onViewDiff !== undefined && file.kind !== ChangeKind.Untracked) {
      createModalButton(actionsEl, {
        text: statusModal.diffButton,
        cls:
          STATUS_MODAL_CLASSES.actionButton +
          CLASS_SEPARATOR +
          STATUS_MODAL_CLASSES.actionButtonDiff,
        title: statusModal.diffButton,
        ariaLabel: statusModal.diffButton,
        stopPropagation: true,
        onClick: () => {
          onViewDiff(file, sectionKind === StatusSectionKind.Staged);
        },
      });
    }

    if (sectionKind === StatusSectionKind.Staged && onUnstageFile !== undefined) {
      createModalButton(actionsEl, {
        text: statusModal.unstageButton,
        cls:
          STATUS_MODAL_CLASSES.actionButton +
          CLASS_SEPARATOR +
          STATUS_MODAL_CLASSES.actionButtonUnstage,
        title: statusModal.unstageButton,
        ariaLabel: statusModal.unstageButton,
        disabled: this.busy,
        stopPropagation: true,
        onClick: () => {
          void this.runStatusUpdate(() => onUnstageFile(file));
        },
      });
    }

    if (isWorkingSection && onStageFile !== undefined) {
      createModalButton(actionsEl, {
        text: statusModal.stageButton,
        cls:
          STATUS_MODAL_CLASSES.actionButton +
          CLASS_SEPARATOR +
          STATUS_MODAL_CLASSES.actionButtonStage,
        title: statusModal.stageButton,
        ariaLabel: statusModal.stageButton,
        disabled: this.busy,
        stopPropagation: true,
        onClick: () => {
          void this.runStatusUpdate(() => onStageFile(file));
        },
      });
    }

    if (isWorkingSection && onDiscardFile !== undefined) {
      createModalButton(actionsEl, {
        text: statusModal.discardButton,
        cls:
          STATUS_MODAL_CLASSES.actionButton +
          CLASS_SEPARATOR +
          STATUS_MODAL_CLASSES.actionButtonDiscard,
        title: statusModal.discardButton,
        ariaLabel: statusModal.discardButton,
        disabled: this.busy,
        stopPropagation: true,
        onClick: () => {
          new ConfirmModal(
            this.app,
            modals.confirmDiscard.title,
            modals.confirmDiscard.descriptionPrefix + file.path,
            modals.confirmDiscard.confirmButton,
            modals.confirmDiscard.cancelButton,
            () => {
              void this.runStatusUpdate(() => onDiscardFile(file));
            },
          ).open();
        },
      });
    }
  }

  private openVaultFile(abstractFile: TFile, filePath: string): void {
    this.close();
    if (typeof this.app.workspace.getLeaf === JAVASCRIPT_TYPE_NAMES.function) {
      const leaf = this.app.workspace.getLeaf(OPEN_LINK_LEAF_DEFAULT);
      if (
        leaf !== null &&
        leaf !== undefined &&
        typeof leaf.openFile === JAVASCRIPT_TYPE_NAMES.function
      ) {
        void leaf.openFile(abstractFile);
        return;
      }
    }
    void this.app.workspace.openLinkText(
      filePath,
      PLUGIN_FORMAT.emptyString,
      OPEN_LINK_LEAF_DEFAULT,
    );
  }

  private renderFooter(container: HTMLElement): void {
    const { statusModal } = this.messages;
    const footer = container.createDiv({ cls: STATUS_MODAL_CLASSES.footer });

    const summaryEl = footer.createDiv({ cls: STATUS_MODAL_CLASSES.footerSummary });
    const totalCount = this.currentStatus.files.length;
    let stagedCount = STATUS_MODAL_COUNTS.none;
    for (const file of this.currentStatus.files) {
      if (file.kind !== ChangeKind.Conflict && file.staged) {
        stagedCount++;
      }
    }

    if (totalCount > STATUS_MODAL_COUNTS.none) {
      let summaryText = totalCount + statusModal.changesCountSuffix;
      if (stagedCount > STATUS_MODAL_COUNTS.none) {
        summaryText += statusModal.separator + stagedCount + statusModal.stagedSummarySuffix;
      }
      summaryEl.setText(summaryText);
    }

    const actionsEl = footer.createDiv({ cls: STATUS_MODAL_CLASSES.footerActions });
    const { onAction } = this.callbacks;
    const hasConflicts = this.hasConflicts();

    if (onAction !== undefined) {
      if (totalCount > STATUS_MODAL_COUNTS.none) {
        createModalButton(actionsEl, {
          text: statusModal.commitButton,
          cls: MODAL_BUTTON_CLASSES.cta,
          disabled: hasConflicts || this.busy,
          onClick: () => {
            this.close();
            onAction(GitAction.CommitAll);
          },
        });

        createModalButton(actionsEl, {
          text: statusModal.commitWithMessageButton,
          disabled: hasConflicts || this.busy,
          onClick: () => {
            this.close();
            onAction(GitAction.CommitWithMessage);
          },
        });
      }

      createModalButton(actionsEl, {
        text: statusModal.pullButton,
        disabled: this.busy,
        onClick: () => {
          this.close();
          onAction(GitAction.Pull);
        },
      });

      createModalButton(actionsEl, {
        text: statusModal.pushButton,
        disabled: this.busy,
        onClick: () => {
          this.close();
          onAction(GitAction.PushOnly);
        },
      });

      createModalButton(actionsEl, {
        text: statusModal.syncButton,
        disabled: hasConflicts || this.busy,
        onClick: () => {
          this.close();
          onAction(GitAction.Sync);
        },
      });
    }

    createModalButton(actionsEl, {
      text: statusModal.closeButton,
      onClick: () => {
        this.close();
      },
    });
  }
}

function normalizeCallbacks(
  callbacksOrOnAction?: GitStatusModalCallbacks | ((action: GitAction) => void),
): GitStatusModalCallbacks {
  if (isActionCallback(callbacksOrOnAction)) {
    return { onAction: callbacksOrOnAction };
  }
  return callbacksOrOnAction ?? {};
}

function isActionCallback(
  value: GitStatusModalCallbacks | ((action: GitAction) => void) | undefined,
): value is (action: GitAction) => void {
  return typeof value === JAVASCRIPT_TYPE_NAMES.function;
}
