import {
  FileSystemAdapter,
  getLanguage,
  MarkdownView,
  Menu,
  Notice,
  Plugin,
  TextFileView,
} from 'obsidian';
import { GitCli } from './git/git-cli';
import {
  CommitOutcomeKind,
  GitCommandError,
  GitConflictInProgressError,
  GitService,
  isGitCommandAborted,
  type GitCommitEntry,
} from './git/git-service';
import { GitExecutableLocator } from './git/git-executable-locator';
import { NodeProcessRunner } from './git/process-runner';
import {
  ChangeKind,
  STATUS_COUNT_DEFAULTS,
  type GitFileChange,
  type GitStatus,
} from './git/status-parser';
import {
  CommitMessageModal,
  GitDiffModal,
  GitErrorModal,
  GitHistoryModal,
  type GitLastErrorInfo,
} from './git-modals';
import { getPluginMessages } from './i18n';
import { PluginLanguage } from './i18n/language';
import type { PluginMessages } from './i18n/types';
import {
  DEFAULT_HISTORY_LIMIT,
  GIT_ACTION_COMMAND_IDS,
  GIT_ACTION_ICONS,
  GIT_ACTION_ORDER,
  GIT_EXECUTABLE_RESOLUTION_STATE,
  GitAction,
  OBSIDIAN_WORKSPACE_FILE_NAMES,
  PLUGIN_DOM_NAMES,
  PLUGIN_FORMAT,
  STATUS_BAR_ICONS,
  STATUS_BAR_KEYBOARD_KEYS,
} from './plugin-constants';
import {
  AutoSyncNotificationMode,
  createDefaultSettings,
  parseSettings,
  SETTING_VALIDATION,
  StatusBarClickAction,
  type GitPluginSettings,
} from './settings';
import { GitSettingsTab } from './settings-tab';
import { GitStatusModal, type GitStatusModalCallbacks } from './status-modal';
import { safeSetIcon } from './ui-helpers';

const PLUGIN_TEXT = {
  commandSeparator: ' ',
  versionPrefix: ' (',
  versionSuffix: ')',
} as const;

const GIT_ERROR_PATTERNS = {
  notGitRepository: 'not a git repository',
} as const;

const GIT_PATHSPEC_PREFIX = {
  repoRoot: ':/',
} as const;

const VAULT_EVENTS = {
  modify: 'modify',
  create: 'create',
  delete: 'delete',
  rename: 'rename',
} as const;

const JS_TYPES = {
  object: 'object',
  function: 'function',
  string: 'string',
} as const;

const MENU_POSITION_FALLBACK = {
  x: 0,
  y: 0,
} as const;

const MENU_SEPARATOR_ACTIONS: ReadonlySet<GitAction> = new Set([
  GitAction.Fetch,
  GitAction.ShowLastError,
  GitAction.Abort,
]);

interface ExclusiveOperationOptions {
  readonly label?: string;
  readonly showRunningText: boolean;
  readonly notifyBusy: boolean;
  readonly notifySuccess?: string;
  readonly notifyErrorPrefix?: string;
  readonly showErrorNotice: boolean;
  readonly logError: boolean;
  readonly refreshAfter: boolean;
  readonly resetStatusOnError?: boolean;
}

interface SaveableView {
  save(): Promise<void> | void;
}

/** Obsidian plugin entry point coordinating Git commands, status bar UI, and background tasks. */
export default class GitCommandsPlugin extends Plugin {
  public settings: GitPluginSettings = createDefaultSettings();
  public messages: PluginMessages = getPluginMessages(PluginLanguage.English);
  private readonly gitExecutableLocator = new GitExecutableLocator();
  private resolvedGitExecutable: string | null = null;
  private gitExecutableResolutionGeneration: number =
    GIT_EXECUTABLE_RESOLUTION_STATE.firstGeneration;
  private readonly processRunner = new NodeProcessRunner();
  private statusBarItem: HTMLElement | null = null;
  private statusBarIcon: HTMLElement | null = null;
  private statusBarText: HTMLElement | null = null;
  private ribbonIconEl: HTMLElement | null = null;
  private operationRunning = false;
  private activeAbortController: AbortController | null = null;
  private statusSummary: GitStatus | null = null;
  private autoFetchTimer: number | null = null;
  private autoSyncTimer: number | null = null;
  private autoBackupTimer: number | null = null;
  private activeStatusModal: GitStatusModal | null = null;
  private lastErrorInfo: GitLastErrorInfo | null = null;
  private workspaceWarningShown = false;
  private unloaded = false;

  public async onload(): Promise<void> {
    this.unloaded = false;
    this.messages = getPluginMessages(getLanguage());
    const defaults = createDefaultSettings(this.messages.defaultCommitMessageTemplate);
    this.settings = parseSettings(await this.loadData(), defaults);
    if (this.unloaded) {
      return;
    }

    this.addSettingTab(new GitSettingsTab(this));
    this.registerCommands();
    this.registerStatusBarItem();
    this.updateRibbonIcon();
    this.registerVaultEditListeners();
    this.register(() => {
      this.clearTimers();
    });

    void this.initializeRuntime();
  }

  public onunload(): void {
    this.unloaded = true;
    this.abortCurrentOperation();
    this.clearTimers();
    if (this.activeStatusModal !== null) {
      this.activeStatusModal.close();
      this.activeStatusModal = null;
    }
    if (this.ribbonIconEl !== null) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
  }

  public async onExternalSettingsChange(): Promise<void> {
    if (this.unloaded) {
      return;
    }

    const previousExecutable = this.settings.gitExecutable;
    const defaults = createDefaultSettings(this.messages.defaultCommitMessageTemplate);
    this.settings = parseSettings(await this.loadData(), defaults);
    if (this.unloaded) {
      return;
    }

    if (this.settings.gitExecutable !== previousExecutable) {
      await this.resolveGitExecutable(this.settings.gitExecutable);
      if (this.unloaded) {
        return;
      }
    }

    this.restartAutoFetch();
    this.restartAutoSync();
    this.restartAutoBackup();
    this.updateRibbonIcon();
    if (!this.operationRunning) {
      await this.refreshStatus();
    }
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  public async updateGitExecutable(executable: string): Promise<void> {
    this.settings.gitExecutable = executable;
    const isLatest = await this.resolveGitExecutable(executable);
    if (!isLatest || this.unloaded) {
      return;
    }

    const generationAfterResolve = this.gitExecutableResolutionGeneration;
    await this.saveSettings();
    if (generationAfterResolve !== this.gitExecutableResolutionGeneration || this.unloaded) {
      return;
    }

    if (this.resolvedGitExecutable === null) {
      this.statusSummary = null;
      this.setStatusBarError();
      this.setStatusText(this.messages.ui.statusBarUnavailable);
      this.setStatusTitle(this.messages.ui.gitExecutableNotFound);
    } else if (!this.operationRunning) {
      await this.refreshStatus();
    }
  }

  public async testGitExecutable(): Promise<void> {
    const basePath = this.getVaultBasePath();
    if (basePath === null) {
      new Notice(this.messages.ui.gitTestFailedPrefix + this.messages.ui.localVaultRequired);
      return;
    }

    const result = await this.gitExecutableLocator.locateWithVersion(
      this.settings.gitExecutable,
      basePath,
    );
    if (this.unloaded) {
      return;
    }

    if (result === null) {
      new Notice(this.messages.ui.gitTestFailedPrefix + this.messages.ui.gitExecutableNotFound);
      return;
    }

    const versionSuffix =
      result.version !== null && result.version.length > PLUGIN_FORMAT.emptyString.length
        ? PLUGIN_TEXT.versionPrefix + result.version + PLUGIN_TEXT.versionSuffix
        : PLUGIN_FORMAT.emptyString;
    new Notice(this.messages.ui.gitTestSuccessPrefix + result.executable + versionSuffix);
  }

  public restartAutoFetch(): void {
    if (this.autoFetchTimer !== null) {
      window.clearInterval(this.autoFetchTimer);
      this.autoFetchTimer = null;
    }

    const intervalSeconds = this.settings.autoFetchIntervalSeconds;
    if (
      !this.unloaded &&
      intervalSeconds > SETTING_VALIDATION.minimumFetchIntervalSeconds &&
      this.statusBarItem !== null
    ) {
      this.autoFetchTimer = window.setInterval(() => {
        void this.autoFetch();
      }, intervalSeconds * PLUGIN_FORMAT.millisecondsPerSecond);
    }
  }

  public restartAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    const intervalMinutes = this.settings.autoSyncIntervalMinutes;
    if (
      !this.unloaded &&
      intervalMinutes > SETTING_VALIDATION.minimumSyncIntervalMinutes &&
      this.statusBarItem !== null
    ) {
      this.autoSyncTimer = window.setInterval(() => {
        void this.autoSync();
      }, intervalMinutes * PLUGIN_FORMAT.secondsPerMinute * PLUGIN_FORMAT.millisecondsPerSecond);
    }
  }

  public restartAutoBackup(): void {
    if (this.autoBackupTimer !== null) {
      window.clearTimeout(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  public updateRibbonIcon(): void {
    if (this.settings.showRibbonIcon) {
      if (this.ribbonIconEl === null && typeof this.addRibbonIcon === JS_TYPES.function) {
        this.ribbonIconEl = this.addRibbonIcon(
          STATUS_BAR_ICONS.ribbon,
          this.messages.ui.ribbonTooltip,
          (event) => {
            this.triggerStatusBarAction(event);
          },
        );
      }
      return;
    }

    if (this.ribbonIconEl !== null) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
  }

  public abortCurrentOperation(): void {
    if (!this.operationRunning || this.activeAbortController === null) {
      return;
    }
    this.activeAbortController.abort();
  }

  public isOperationRunning(): boolean {
    return this.operationRunning;
  }

  private async initializeRuntime(): Promise<void> {
    if (this.unloaded) {
      return;
    }

    await this.resolveGitExecutable(this.settings.gitExecutable);
    if (this.unloaded) {
      return;
    }

    this.restartAutoFetch();
    this.restartAutoSync();
    this.restartAutoBackup();

    let statusRefreshed = false;
    if (this.settings.autoPullOnLoad && this.resolvedGitExecutable !== null) {
      statusRefreshed = await this.autoPullOnLoad();
    }
    if (this.unloaded) {
      return;
    }

    if (!statusRefreshed) {
      await this.refreshStatus();
    }
    if (this.unloaded) {
      return;
    }

    await this.warnIfWorkspaceFilesTracked();
  }

  private registerVaultEditListeners(): void {
    const vault = this.app?.vault;
    if (
      vault === undefined ||
      typeof vault.on !== JS_TYPES.function ||
      typeof this.registerEvent !== JS_TYPES.function
    ) {
      return;
    }

    const onVaultEdit = (): void => {
      this.scheduleAutoBackup();
    };
    this.registerEvent(vault.on(VAULT_EVENTS.modify, onVaultEdit));
    this.registerEvent(vault.on(VAULT_EVENTS.create, onVaultEdit));
    this.registerEvent(vault.on(VAULT_EVENTS.delete, onVaultEdit));
    this.registerEvent(vault.on(VAULT_EVENTS.rename, onVaultEdit));
  }

  private scheduleAutoBackup(): void {
    if (this.unloaded) {
      return;
    }

    this.restartAutoBackup();

    const delayMinutes = this.settings.autoBackupAfterEditMinutes;
    if (
      delayMinutes <= SETTING_VALIDATION.minimumAutoBackupMinutes ||
      this.statusBarItem === null
    ) {
      return;
    }

    this.autoBackupTimer = window.setTimeout(() => {
      this.autoBackupTimer = null;
      void this.autoBackup();
    }, delayMinutes * PLUGIN_FORMAT.secondsPerMinute * PLUGIN_FORMAT.millisecondsPerSecond);
  }

  private clearTimers(): void {
    if (this.autoFetchTimer !== null) {
      window.clearInterval(this.autoFetchTimer);
      this.autoFetchTimer = null;
    }
    if (this.autoSyncTimer !== null) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (this.autoBackupTimer !== null) {
      window.clearTimeout(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  private async resolveGitExecutable(configuredExecutable: string): Promise<boolean> {
    const generation = ++this.gitExecutableResolutionGeneration;
    this.resolvedGitExecutable = null;
    const basePath = this.getVaultBasePath();
    if (basePath === null) {
      return generation === this.gitExecutableResolutionGeneration;
    }

    const executable = await this.gitExecutableLocator.locate(configuredExecutable, basePath);
    if (generation !== this.gitExecutableResolutionGeneration || this.unloaded) {
      return false;
    }
    this.resolvedGitExecutable = executable;
    return true;
  }

  private getVaultBasePath(): string | null {
    const adapter = this.app?.vault?.adapter;
    return adapter instanceof FileSystemAdapter ? adapter.getBasePath() : null;
  }

  private createService(): GitService {
    const basePath = this.getVaultBasePath();
    if (basePath === null) {
      throw new Error(this.messages.ui.localVaultRequired);
    }

    if (this.resolvedGitExecutable === null) {
      throw new Error(this.messages.ui.gitExecutableNotFound);
    }

    return new GitService(
      new GitCli(this.processRunner, {
        executable: this.resolvedGitExecutable,
        cwd: basePath,
        timeoutMs: this.settings.processTimeoutSeconds * PLUGIN_FORMAT.millisecondsPerSecond,
      }),
    );
  }

  private registerStatusBarItem(): void {
    const item = this.addStatusBarItem();
    item.addClass(PLUGIN_DOM_NAMES.statusBarClass);
    item.setAttribute(PLUGIN_DOM_NAMES.roleAttribute, PLUGIN_DOM_NAMES.buttonRole);
    item.setAttribute(PLUGIN_DOM_NAMES.tabIndexAttribute, PLUGIN_DOM_NAMES.initialTabIndex);
    item.setAttribute(PLUGIN_DOM_NAMES.ariaLabelAttribute, this.messages.ui.statusBarAriaLabel);
    const iconEl = item.createSpan({ cls: PLUGIN_DOM_NAMES.statusBarIconClass });
    const textEl = item.createSpan({ cls: PLUGIN_DOM_NAMES.statusBarTextClass });
    textEl.textContent = this.messages.ui.statusBarLoading;
    safeSetIcon(iconEl, STATUS_BAR_ICONS.spinner);
    item.addClass(PLUGIN_DOM_NAMES.statusBarRunningClass);

    this.statusBarItem = item;
    this.statusBarIcon = iconEl;
    this.statusBarText = textEl;

    this.registerDomEvent(item, PLUGIN_DOM_NAMES.clickEvent, (event) => {
      this.triggerStatusBarAction(event);
    });
    this.registerDomEvent(item, PLUGIN_DOM_NAMES.keydownEvent, (event) => {
      if (
        event.key === STATUS_BAR_KEYBOARD_KEYS.Enter ||
        event.key === STATUS_BAR_KEYBOARD_KEYS.Space
      ) {
        event.preventDefault();
        this.triggerStatusBarAction();
      }
    });
  }

  private registerCommands(): void {
    for (const action of GIT_ACTION_ORDER) {
      if (action === GitAction.Abort) {
        this.addCommand({
          id: GIT_ACTION_COMMAND_IDS[action],
          name: this.messages.ui.commandNamePrefix + this.messages.actions.labels[action],
          checkCallback: (checking) => {
            if (checking) {
              return this.operationRunning;
            }
            if (!this.operationRunning) {
              return false;
            }
            this.abortCurrentOperation();
            return true;
          },
        });
      } else {
        this.addCommand({
          id: GIT_ACTION_COMMAND_IDS[action],
          name: this.messages.ui.commandNamePrefix + this.messages.actions.labels[action],
          callback: () => this.executeAction(action),
        });
      }
    }
  }

  private triggerStatusBarAction(event?: MouseEvent): void {
    if (this.settings.statusBarClickAction === StatusBarClickAction.StatusModal) {
      void this.showStatus();
      return;
    }
    this.openMenu(event);
  }

  private openMenu(event?: MouseEvent): void {
    const menu = new Menu();
    for (const action of GIT_ACTION_ORDER) {
      if (MENU_SEPARATOR_ACTIONS.has(action)) {
        menu.addSeparator();
      }
      menu.addItem((item) => {
        item
          .setTitle(this.messages.actions.labels[action])
          .setIcon(GIT_ACTION_ICONS[action]);
        if (action === GitAction.Abort) {
          item.setDisabled(!this.operationRunning);
        }
        item.onClick(() => this.executeAction(action));
      });
    }

    if (event !== undefined) {
      menu.showAtMouseEvent(event);
    } else if (typeof menu.showAtPosition === JS_TYPES.function) {
      const rect = this.statusBarItem?.getBoundingClientRect?.();
      menu.showAtPosition({
        x: rect?.left ?? MENU_POSITION_FALLBACK.x,
        y: rect?.top ?? MENU_POSITION_FALLBACK.y,
      });
    }
  }

  private executeAction(action: GitAction): void {
    switch (action) {
      case GitAction.Abort:
        this.abortCurrentOperation();
        return;
      case GitAction.Status:
        void this.showStatus();
        return;
      case GitAction.History:
        void this.showHistory();
        return;
      case GitAction.ShowLastError:
        this.showLastError();
        return;
      case GitAction.CommitAll:
        void this.runCommitOperation(GitAction.CommitAll);
        return;
      case GitAction.CommitWithMessage:
        this.commitWithMessage();
        return;
      case GitAction.Fetch:
      case GitAction.Pull:
      case GitAction.PushOnly:
      case GitAction.Push:
      case GitAction.Sync:
      case GitAction.Init:
        void this.runAction(action);
        return;
    }
  }

  private async runAction(
    action:
      | GitAction.Fetch
      | GitAction.Pull
      | GitAction.PushOnly
      | GitAction.Push
      | GitAction.Sync
      | GitAction.Init,
  ): Promise<void> {
    await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[action],
        showRunningText: true,
        notifyBusy: true,
        notifySuccess: this.messages.actions.success[action],
        showErrorNotice: true,
        logError: true,
        refreshAfter: true,
      },
      async (git, signal) => {
        switch (action) {
          case GitAction.Fetch:
            await git.fetch(signal);
            break;
          case GitAction.Pull:
            await git.pull(this.settings.pullStrategy, signal);
            break;
          case GitAction.PushOnly:
            await git.push(signal);
            break;
          case GitAction.Push:
            await this.saveAll(git, signal);
            await git.push(signal);
            break;
          case GitAction.Sync:
            await this.saveAll(git, signal);
            await git.pull(this.settings.pullStrategy, signal);
            await git.push(signal);
            break;
          case GitAction.Init:
            await git.init(signal);
            break;
        }
      },
    );
  }

  private async showStatus(): Promise<void> {
    let loadedStatus: GitStatus | null = null;
    const succeeded = await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[GitAction.Status],
        showRunningText: false,
        notifyBusy: true,
        showErrorNotice: true,
        logError: true,
        refreshAfter: false,
        resetStatusOnError: true,
      },
      async (git, signal) => {
        const result = await git.status(signal);
        this.statusSummary = result.status;
        loadedStatus = result.status;
      },
    );
    if (!succeeded || loadedStatus === null || this.unloaded) {
      return;
    }

    this.openStatusModal(loadedStatus);
  }

  private openStatusModal(status: GitStatus): void {
    if (this.activeStatusModal !== null) {
      this.activeStatusModal.close();
      this.activeStatusModal = null;
    }

    const modal = new GitStatusModal(
      this.app,
      status,
      this.messages,
      this.createStatusModalCallbacks(),
    );
    const originalOnClose = modal.onClose.bind(modal);
    modal.onClose = () => {
      if (this.activeStatusModal === modal) {
        this.activeStatusModal = null;
      }
      originalOnClose();
    };
    this.activeStatusModal = modal;
    modal.open();
  }

  private createStatusModalCallbacks(): GitStatusModalCallbacks {
    return {
      onAction: (action) => {
        this.executeAction(action);
      },
      onRefresh: () =>
        this.runModalStatusMutation(
          async (git, signal) => (await git.status(signal)).status,
          true,
        ),
      onStageFile: (file) =>
        this.runModalStatusMutation(async (git, signal) => {
          await git.stageFiles([this.toGitPathspec(file)], signal);
          return (await git.status(signal)).status;
        }),
      onUnstageFile: (file) =>
        this.runModalStatusMutation(async (git, signal) => {
          await git.unstageFiles(this.toUnstagePaths(file), signal);
          return (await git.status(signal)).status;
        }),
      onDiscardFile: (file) =>
        this.runModalStatusMutation(async (git, signal) => {
          await this.discardSingleFile(git, file, signal);
          new Notice(this.messages.ui.discardSuccess);
          return (await git.status(signal)).status;
        }),
      onStageAll: () =>
        this.runModalStatusMutation(async (git, signal) => {
          await this.stageAllChangedFiles(git, signal);
          return (await git.status(signal)).status;
        }),
      onUnstageAll: () =>
        this.runModalStatusMutation(async (git, signal) => {
          await this.unstageAllStagedFiles(git, signal);
          return (await git.status(signal)).status;
        }),
      onViewDiff: (file, staged) => {
        void this.showFileDiff(file, staged);
      },
    };
  }

  private async runModalStatusMutation(
    mutation: (git: GitService, signal: AbortSignal) => Promise<GitStatus>,
    resetStatusOnError = false,
  ): Promise<GitStatus | null> {
    let nextStatus: GitStatus | null = null;
    const succeeded = await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[GitAction.Status],
        showRunningText: false,
        notifyBusy: true,
        showErrorNotice: true,
        logError: true,
        refreshAfter: false,
        resetStatusOnError,
      },
      async (git, signal) => {
        nextStatus = await mutation(git, signal);
        this.statusSummary = nextStatus;
      },
    );
    return succeeded ? nextStatus : null;
  }

  private async showFileDiff(file: GitFileChange, staged: boolean): Promise<void> {
    let diffText: string | null = null;
    const succeeded = await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[GitAction.Status],
        showRunningText: false,
        notifyBusy: true,
        showErrorNotice: true,
        logError: true,
        refreshAfter: false,
      },
      async (git, signal) => {
        diffText = await git.diff(this.toGitPathspec(file), staged, signal);
      },
    );
    if (!succeeded || diffText === null || this.unloaded) {
      return;
    }

    new GitDiffModal(this.app, file.path, diffText, staged, this.messages).open();
  }

  private async showHistory(): Promise<void> {
    let entries: readonly GitCommitEntry[] | null = null;
    const succeeded = await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[GitAction.History],
        showRunningText: true,
        notifyBusy: true,
        showErrorNotice: true,
        logError: true,
        refreshAfter: false,
      },
      async (git, signal) => {
        entries = await git.log(DEFAULT_HISTORY_LIMIT, signal);
      },
    );
    if (!succeeded || entries === null || this.unloaded) {
      return;
    }

    new GitHistoryModal(this.app, entries, this.messages).open();
  }

  private showLastError(): void {
    if (this.lastErrorInfo === null) {
      new Notice(this.messages.ui.noLastError);
      return;
    }
    new GitErrorModal(this.app, this.lastErrorInfo, this.messages).open();
  }

  private commitWithMessage(): void {
    if (this.operationRunning) {
      new Notice(this.messages.ui.busyNotice);
      return;
    }

    new CommitMessageModal(
      this.app,
      this.messages,
      PLUGIN_FORMAT.emptyString,
      (message) => {
        void this.runCommitOperation(GitAction.CommitWithMessage, message);
      },
    ).open();
  }

  private async runCommitOperation(
    action: GitAction.CommitAll | GitAction.CommitWithMessage,
    customMessage?: string,
  ): Promise<void> {
    await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[action],
        showRunningText: true,
        notifyBusy: true,
        showErrorNotice: true,
        logError: true,
        refreshAfter: true,
      },
      async (git, signal) => {
        const outcome = await this.saveAll(git, signal, customMessage);
        const successMessage =
          outcome === CommitOutcomeKind.NoChanges
            ? this.messages.ui.noChangesToCommit
            : this.messages.actions.success[action];
        new Notice(successMessage);
      },
    );
  }

  private async saveAll(
    git: GitService,
    signal?: AbortSignal,
    customMessage?: string,
  ): Promise<CommitOutcomeKind> {
    await this.flushOpenEditors();
    const message = customMessage ?? this.makeCommitMessage();
    const outcome = await git.commitAll(message, signal);
    return outcome.kind;
  }

  private async flushOpenEditors(): Promise<void> {
    const workspace = this.app?.workspace;
    if (workspace === undefined || typeof workspace.iterateAllLeaves !== JS_TYPES.function) {
      return;
    }

    const saves: Promise<void>[] = [];
    workspace.iterateAllLeaves((leaf) => {
      const view = leaf?.view;
      if (this.isSaveableView(view)) {
        saves.push(Promise.resolve(view.save()));
      }
    });
    await Promise.all(saves);
  }

  private isSaveableView(view: unknown): view is SaveableView {
    if (view === null || typeof view !== JS_TYPES.object) {
      return false;
    }
    if (typeof MarkdownView === JS_TYPES.function && view instanceof MarkdownView) {
      return true;
    }
    if (typeof TextFileView === JS_TYPES.function && view instanceof TextFileView) {
      return true;
    }
    const candidate = view as { save?: unknown };
    return typeof candidate.save === JS_TYPES.function;
  }

  private makeCommitMessage(): string {
    const now = new Date();
    const timestampParts = {
      year: String(now.getFullYear()),
      month: this.padDatePart(now.getMonth() + PLUGIN_FORMAT.monthIndexOffset),
      day: this.padDatePart(now.getDate()),
      hour: this.padDatePart(now.getHours()),
      minute: this.padDatePart(now.getMinutes()),
      second: this.padDatePart(now.getSeconds()),
    };
    const timestamp =
      timestampParts.year +
      PLUGIN_FORMAT.datetimeDateSeparator +
      timestampParts.month +
      PLUGIN_FORMAT.datetimeDateSeparator +
      timestampParts.day +
      PLUGIN_FORMAT.datetimeDateTimeSeparator +
      timestampParts.hour +
      PLUGIN_FORMAT.datetimeTimeSeparator +
      timestampParts.minute +
      PLUGIN_FORMAT.datetimeTimeSeparator +
      timestampParts.second;
    const configuredTemplate = this.settings.commitMessageTemplate.trim();
    const template =
      configuredTemplate.length > PLUGIN_FORMAT.emptyString.length
        ? configuredTemplate
        : this.messages.defaultCommitMessageTemplate;
    return template.replaceAll(PLUGIN_FORMAT.datetimeToken, timestamp);
  }

  private padDatePart(value: number): string {
    return String(value).padStart(
      PLUGIN_FORMAT.datetimePadWidth,
      PLUGIN_FORMAT.datetimePadCharacter,
    );
  }

  private async runExclusiveOperation(
    options: ExclusiveOperationOptions,
    operation: (git: GitService, signal: AbortSignal) => Promise<void>,
  ): Promise<boolean> {
    if (this.unloaded) {
      return false;
    }
    if (this.operationRunning) {
      if (options.notifyBusy) {
        new Notice(this.messages.ui.busyNotice);
      }
      return false;
    }

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.operationRunning = true;
    this.setStatusBarRunning(true);
    if (options.showRunningText && options.label !== undefined) {
      this.setStatusText(
        this.messages.ui.statusBarBrand + this.messages.ui.statusBarSeparator + options.label,
      );
    }

    let succeeded = false;
    let caughtError: unknown = null;
    let errorTooltip: string | null = null;

    try {
      await operation(this.createService(), abortController.signal);
      succeeded = true;
      if (
        !this.unloaded &&
        options.notifySuccess !== undefined &&
        options.notifySuccess.length > PLUGIN_FORMAT.emptyString.length
      ) {
        new Notice(options.notifySuccess);
      }
    } catch (error) {
      caughtError = error;
      if (this.isAborted(error, abortController.signal)) {
        errorTooltip = this.messages.ui.operationAborted;
        if (!this.unloaded) {
          new Notice(this.messages.ui.operationAborted);
        }
      } else {
        this.recordLastError(error);
        const formatted = this.formatErrorMessage(error);
        const prefix = options.notifyErrorPrefix ?? this.messages.ui.gitErrorPrefix;
        errorTooltip = prefix + formatted;
        if (options.resetStatusOnError === true) {
          this.statusSummary = null;
        }
        if (!this.unloaded && options.showErrorNotice) {
          new Notice(prefix + formatted, PLUGIN_FORMAT.errorNoticeDurationMs);
        }
        if (options.logError) {
          console.error(this.messages.ui.gitErrorConsoleLabel, error);
        }
      }
    } finally {
      if (this.activeAbortController === abortController) {
        this.activeAbortController = null;
      }
      if (!this.unloaded) {
        if (options.refreshAfter) {
          await this.refreshStatus();
        } else if (this.statusSummary !== null) {
          this.renderStatus();
        } else {
          this.renderUnavailableStatusBar(caughtError);
        }
        if (errorTooltip !== null && this.statusSummary !== null) {
          this.setStatusTitle(errorTooltip);
        }
      }
      this.operationRunning = false;
    }

    return succeeded;
  }

  private async autoFetch(): Promise<void> {
    await this.runExclusiveOperation(
      {
        showRunningText: false,
        notifyBusy: false,
        notifyErrorPrefix: this.messages.ui.autoFetchErrorPrefix,
        showErrorNotice: false,
        logError: false,
        refreshAfter: true,
      },
      async (git, signal) => {
        await git.fetch(signal);
      },
    );
  }

  private async autoSync(): Promise<void> {
    await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[GitAction.Sync],
        showRunningText: true,
        notifyBusy: false,
        ...this.getBackgroundNotificationOptions(
          this.messages.ui.autoSyncSuccess,
          this.messages.ui.autoSyncErrorPrefix,
        ),
        refreshAfter: true,
      },
      async (git, signal) => {
        await this.saveAll(git, signal);
        await git.pull(this.settings.pullStrategy, signal);
        await git.push(signal);
      },
    );
  }

  private async autoBackup(): Promise<void> {
    const mode = this.settings.autoSyncNotificationMode;
    await this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[GitAction.Push],
        showRunningText: true,
        notifyBusy: false,
        notifyErrorPrefix: this.messages.ui.autoBackupErrorPrefix,
        showErrorNotice: mode !== AutoSyncNotificationMode.Silent,
        logError: true,
        refreshAfter: true,
      },
      async (git, signal) => {
        const outcome = await this.saveAll(git, signal);
        if (outcome === CommitOutcomeKind.Committed) {
          await git.push(signal);
          if (mode === AutoSyncNotificationMode.All) {
            new Notice(this.messages.ui.autoBackupSuccess);
          }
        }
      },
    );
  }

  private async autoPullOnLoad(): Promise<boolean> {
    return this.runExclusiveOperation(
      {
        label: this.messages.actions.progress[GitAction.Pull],
        showRunningText: true,
        notifyBusy: false,
        ...this.getBackgroundNotificationOptions(
          this.messages.actions.success[GitAction.Pull],
          this.messages.ui.autoPullErrorPrefix,
        ),
        refreshAfter: true,
      },
      async (git, signal) => {
        await git.pull(this.settings.pullStrategy, signal);
      },
    );
  }

  private getBackgroundNotificationOptions(
    successMessage: string,
    errorPrefix: string,
  ): Pick<
    ExclusiveOperationOptions,
    'notifySuccess' | 'notifyErrorPrefix' | 'showErrorNotice' | 'logError'
  > {
    const mode = this.settings.autoSyncNotificationMode;
    return {
      ...(mode === AutoSyncNotificationMode.All ? { notifySuccess: successMessage } : {}),
      notifyErrorPrefix: errorPrefix,
      showErrorNotice: mode !== AutoSyncNotificationMode.Silent,
      logError: true,
    };
  }

  private getWorkspaceFilePaths(): readonly string[] {
    const rawConfigDir = this.app?.vault?.configDir;
    if (typeof rawConfigDir !== JS_TYPES.string) {
      return [];
    }

    const normalizedConfigDir = rawConfigDir
      .trim()
      .replaceAll(PLUGIN_FORMAT.windowsPathSeparator, PLUGIN_FORMAT.posixPathSeparator)
      .replace(PLUGIN_FORMAT.edgeSlashesPattern, PLUGIN_FORMAT.emptyString);
    if (normalizedConfigDir.length === PLUGIN_FORMAT.emptyString.length) {
      return [];
    }

    return OBSIDIAN_WORKSPACE_FILE_NAMES.map(
      (fileName) => normalizedConfigDir + PLUGIN_FORMAT.posixPathSeparator + fileName,
    );
  }

  private async warnIfWorkspaceFilesTracked(): Promise<void> {
    if (
      this.unloaded ||
      this.workspaceWarningShown ||
      this.resolvedGitExecutable === null ||
      this.statusSummary === null
    ) {
      return;
    }

    const workspaceFiles = this.getWorkspaceFilePaths();
    if (workspaceFiles.length === STATUS_COUNT_DEFAULTS.none) {
      return;
    }

    try {
      const tracked = await this.createService().listTrackedFiles(workspaceFiles);
      if (this.unloaded) {
        return;
      }
      if (tracked.length > STATUS_COUNT_DEFAULTS.none) {
        this.workspaceWarningShown = true;
        new Notice(
          this.messages.ui.workspaceFileTrackedWarning,
          PLUGIN_FORMAT.errorNoticeDurationMs,
        );
      }
    } catch {
      // Non-critical startup check should not surface background errors.
    }
  }

  private isAborted(error: unknown, signal: AbortSignal): boolean {
    if (signal.aborted) {
      return true;
    }
    return isGitCommandAborted(error);
  }

  private async refreshStatus(): Promise<void> {
    try {
      const { status } = await this.createService().status();
      if (this.unloaded) {
        return;
      }
      this.statusSummary = status;
      this.renderStatus();
    } catch (error) {
      if (this.unloaded) {
        return;
      }
      this.recordLastError(error);
      this.statusSummary = null;
      this.renderUnavailableStatusBar(error);
    }
  }

  private renderStatus(): void {
    const status = this.statusSummary;
    if (status === null) {
      return;
    }

    let conflictCount: number = STATUS_COUNT_DEFAULTS.none;
    for (const file of status.files) {
      if (file.kind === ChangeKind.Conflict) {
        conflictCount++;
      }
    }
    const hasConflicts = conflictCount > STATUS_COUNT_DEFAULTS.none;
    const nonConflictCount = status.files.length - conflictCount;

    this.setStatusBarRunning(false, STATUS_BAR_ICONS.branch, hasConflicts);

    const parts = [
      this.messages.ui.statusBarBrand,
      status.branch ?? this.messages.ui.statusBarDetachedBranch,
    ];
    if (nonConflictCount > STATUS_COUNT_DEFAULTS.none) {
      parts.push(String(nonConflictCount) + this.messages.ui.statusBarChangeSuffix);
    }
    if (hasConflicts) {
      parts.push(String(conflictCount) + this.messages.ui.statusBarConflictSuffix);
    }
    if (status.ahead > STATUS_COUNT_DEFAULTS.none) {
      parts.push(this.messages.ui.statusBarAheadPrefix + status.ahead);
    }
    if (status.behind > STATUS_COUNT_DEFAULTS.none) {
      parts.push(this.messages.ui.statusBarBehindPrefix + status.behind);
    }
    if (
      status.files.length === STATUS_COUNT_DEFAULTS.none &&
      status.ahead === STATUS_COUNT_DEFAULTS.none &&
      status.behind === STATUS_COUNT_DEFAULTS.none
    ) {
      parts.push(this.messages.ui.statusBarClean);
    }

    this.setStatusText(parts.join(this.messages.ui.statusBarSeparator));
    this.setStatusTitle(this.messages.ui.statusBarTitle);
  }

  private renderUnavailableStatusBar(error: unknown): void {
    this.setStatusBarError();
    if (this.isNotGitRepositoryError(error)) {
      this.setStatusText(this.messages.ui.statusBarNotRepo);
      this.setStatusTitle(this.messages.ui.notGitRepository);
      return;
    }
    this.setStatusText(this.messages.ui.statusBarUnavailable);
    this.setStatusTitle(this.formatErrorMessage(error));
  }

  private setStatusBarRunning(
    running: boolean,
    icon: string = STATUS_BAR_ICONS.spinner,
    hasConflicts = false,
  ): void {
    if (this.statusBarItem === null || this.statusBarIcon === null) {
      return;
    }

    if (running) {
      this.statusBarItem.addClass(PLUGIN_DOM_NAMES.statusBarRunningClass);
      this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarErrorClass);
      this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarConflictClass);
      safeSetIcon(this.statusBarIcon, icon);
      return;
    }

    this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarRunningClass);
    this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarErrorClass);
    if (hasConflicts) {
      this.statusBarItem.addClass(PLUGIN_DOM_NAMES.statusBarConflictClass);
      safeSetIcon(this.statusBarIcon, STATUS_BAR_ICONS.warning);
    } else {
      this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarConflictClass);
      safeSetIcon(this.statusBarIcon, STATUS_BAR_ICONS.branch);
    }
  }

  private setStatusBarError(): void {
    if (this.statusBarItem === null || this.statusBarIcon === null) {
      return;
    }
    this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarRunningClass);
    this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarConflictClass);
    this.statusBarItem.addClass(PLUGIN_DOM_NAMES.statusBarErrorClass);
    safeSetIcon(this.statusBarIcon, STATUS_BAR_ICONS.error);
  }

  private setStatusText(text: string): void {
    if (this.statusBarText !== null) {
      this.statusBarText.textContent = text;
    } else if (this.statusBarItem !== null) {
      this.statusBarItem.textContent = text;
    }
  }

  private setStatusTitle(text: string): void {
    if (this.statusBarItem !== null) {
      this.statusBarItem.setAttribute(PLUGIN_DOM_NAMES.titleAttribute, text);
    }
  }

  private recordLastError(error: unknown): void {
    if (!(error instanceof GitCommandError)) {
      return;
    }
    const executable = this.resolvedGitExecutable ?? this.settings.gitExecutable;
    this.lastErrorInfo = {
      commandLine: [executable, ...error.command.args].join(PLUGIN_TEXT.commandSeparator),
      exitCode: error.exitCode,
      termination: error.termination,
      timestamp: new Date().toISOString(),
      stderr: error.command.result.stderr,
      stdout: error.command.result.stdout,
      message: this.formatErrorMessage(error),
    };
  }

  private formatErrorMessage(error: unknown): string {
    let raw: string;
    if (error instanceof GitConflictInProgressError) {
      raw = this.messages.ui.conflictInProgressError;
    } else if (error instanceof GitCommandError) {
      if (!error.hasOutput) {
        raw = this.messages.ui.exitCodeFallback + String(error.exitCode);
      } else if (this.isNotGitRepositoryError(error)) {
        raw = this.messages.ui.notGitRepository;
      } else {
        raw = error.message;
      }
    } else if (error instanceof Error) {
      raw = error.message;
    } else {
      raw = String(error);
    }

    const message = raw.trim() || this.messages.ui.errorFallback;
    if (message.length <= PLUGIN_FORMAT.errorMessageMaxLength) {
      return message;
    }

    const retainedLength =
      PLUGIN_FORMAT.errorMessageMaxLength - PLUGIN_FORMAT.errorMessageEllipsisLength;
    const shortened = message.slice(PLUGIN_FORMAT.errorMessageStart, retainedLength);
    return shortened + this.messages.ui.errorEllipsis;
  }

  private isNotGitRepositoryError(error: unknown): boolean {
    return (
      error instanceof GitCommandError &&
      error.message.toLowerCase().includes(GIT_ERROR_PATTERNS.notGitRepository)
    );
  }

  private toGitPathspec(file: GitFileChange): string {
    return this.toGitPathspecPath(file.path, file.inVault);
  }

  private toGitPathspecPath(filePath: string, inVault: boolean): string {
    return inVault ? filePath : GIT_PATHSPEC_PREFIX.repoRoot + filePath;
  }

  private toUnstagePaths(file: GitFileChange): readonly string[] {
    const targetPath = this.toGitPathspec(file);
    if (file.origPath === undefined) {
      return [targetPath];
    }
    return [targetPath, this.toGitPathspecPath(file.origPath, file.inVault)];
  }

  private async discardSingleFile(
    git: GitService,
    file: GitFileChange,
    signal: AbortSignal,
  ): Promise<void> {
    if (file.kind === ChangeKind.Untracked) {
      await git.discardFiles([], [this.toGitPathspec(file)], signal);
      return;
    }
    if (file.kind === ChangeKind.Renamed && file.origPath !== undefined) {
      const targetPath = this.toGitPathspec(file);
      const origPath = this.toGitPathspecPath(file.origPath, file.inVault);
      await git.unstageFiles([targetPath, origPath], signal);
      await git.discardFiles([origPath], [targetPath], signal);
      return;
    }
    await git.discardFiles([this.toGitPathspec(file)], [], signal);
  }

  private async stageAllChangedFiles(git: GitService, signal: AbortSignal): Promise<void> {
    const { status } = await git.status(signal);
    const paths = status.files
      .filter((file) => !file.staged || file.unstaged)
      .map((file) => this.toGitPathspec(file));
    await git.stageFiles(paths, signal);
  }

  private async unstageAllStagedFiles(git: GitService, signal: AbortSignal): Promise<void> {
    const { status } = await git.status(signal);
    const paths: string[] = [];
    for (const file of status.files) {
      if (!file.staged) {
        continue;
      }
      paths.push(...this.toUnstagePaths(file));
    }
    await git.unstageFiles(paths, signal);
  }
}
