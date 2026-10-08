import { FileSystemAdapter, getLanguage, Menu, Notice, Plugin, setIcon } from 'obsidian';
import { GitCli } from './git/git-cli';
import { CommitOutcomeKind, GitService } from './git/git-service';
import { NodeProcessRunner } from './git/process-runner';
import {
  GitExecutableLocator,
  GIT_EXECUTABLE_RESOLUTION_STATE,
} from './git/git-executable-locator';
import type { GitStatus } from './git/status-parser';
import { STATUS_COUNT_DEFAULTS } from './git/status-parser';
import { createDefaultSettings, parseSettings, SETTING_VALIDATION } from './settings';
import type { GitPluginSettings } from './settings';
import { GitSettingsTab } from './settings-tab';
import { GitStatusModal } from './status-modal';
import {
  GIT_ACTION_COMMAND_IDS,
  GIT_ACTION_ICONS,
  GIT_ACTION_ORDER,
  GitAction,
  PLUGIN_DOM_NAMES,
  PLUGIN_FORMAT,
  STATUS_BAR_ICONS,
  STATUS_BAR_KEYBOARD_KEYS,
} from './plugin-constants';
import { getPluginMessages } from './i18n';
import { PluginLanguage } from './i18n/language';
import type { PluginMessages } from './i18n/types';

function safeSetIcon(element: HTMLElement, iconId: string): void {
  if (typeof setIcon === 'function') {
    setIcon(element, iconId);
  }
}

export default class GitCommandsPlugin extends Plugin {
  public settings: GitPluginSettings = createDefaultSettings();
  public messages: PluginMessages = getPluginMessages(PluginLanguage.English);
  private readonly gitExecutableLocator = new GitExecutableLocator();
  private resolvedGitExecutable: string | null = null;
  private gitExecutableResolutionGeneration =
    GIT_EXECUTABLE_RESOLUTION_STATE.firstGeneration;
  private readonly processRunner = new NodeProcessRunner();
  private statusBarItem: HTMLElement | null = null;
  private statusBarIcon: HTMLElement | null = null;
  private statusBarText: HTMLElement | null = null;
  private operationRunning = false;
  private statusSummary: GitStatus | null = null;
  private autoFetchTimer: number | null = null;
  private autoSyncTimer: number | null = null;

  public async onload(): Promise<void> {
    this.messages = getPluginMessages(getLanguage());
    const defaults = createDefaultSettings(this.messages.defaultCommitMessageTemplate);
    this.settings = parseSettings(await this.loadData(), defaults);
    this.addSettingTab(new GitSettingsTab(this));
    this.registerCommands();
    this.registerStatusBarItem();
    await this.resolveGitExecutable(this.settings.gitExecutable);
    this.restartAutoFetch();
    this.restartAutoSync();
    await this.refreshStatus();
  }

  public async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  public async updateGitExecutable(executable: string): Promise<void> {
    this.settings.gitExecutable = executable;
    await this.resolveGitExecutable(executable);
    await this.saveSettings();
    if (this.resolvedGitExecutable === null) {
      this.setStatusBarError();
      this.setStatusText(this.messages.ui.statusBarUnavailable);
      this.setStatusTitle(this.messages.ui.gitExecutableNotFound);
    } else {
      await this.refreshStatus();
    }
  }

  public restartAutoFetch(): void {
    if (this.autoFetchTimer !== null) {
      window.clearInterval(this.autoFetchTimer);
      this.autoFetchTimer = null;
    }

    const intervalSeconds = this.settings.autoFetchIntervalSeconds;
    if (
      intervalSeconds > SETTING_VALIDATION.minimumFetchIntervalSeconds &&
      this.statusBarItem !== null
    ) {
      this.autoFetchTimer = window.setInterval(() => {
        void this.autoFetch();
      }, intervalSeconds * PLUGIN_FORMAT.millisecondsPerSecond);
      this.registerInterval(this.autoFetchTimer);
    }
  }

  public restartAutoSync(): void {
    if (this.autoSyncTimer !== null) {
      window.clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }

    const intervalMinutes = this.settings.autoSyncIntervalMinutes;
    if (
      intervalMinutes > SETTING_VALIDATION.minimumSyncIntervalMinutes &&
      this.statusBarItem !== null
    ) {
      this.autoSyncTimer = window.setInterval(() => {
        void this.autoSync();
      }, intervalMinutes * PLUGIN_FORMAT.secondsPerMinute * PLUGIN_FORMAT.millisecondsPerSecond);
      this.registerInterval(this.autoSyncTimer);
    }
  }

  private async resolveGitExecutable(configuredExecutable: string): Promise<void> {
    const generation = ++this.gitExecutableResolutionGeneration;
    this.resolvedGitExecutable = null;
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return;

    const executable = await this.gitExecutableLocator.locate(
      configuredExecutable,
      adapter.getBasePath(),
    );
    if (generation === this.gitExecutableResolutionGeneration) {
      this.resolvedGitExecutable = executable;
    }
  }

  private createService(): GitService {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error(this.messages.ui.localVaultRequired);
    }

    if (this.resolvedGitExecutable === null) {
      throw new Error(this.messages.ui.gitExecutableNotFound);
    }

    return new GitService(
      new GitCli(this.processRunner, {
        executable: this.resolvedGitExecutable,
        cwd: adapter.getBasePath(),
      }),
    );
  }

  private registerStatusBarItem(): void {
    const item = this.addStatusBarItem();
    item.addClass(PLUGIN_DOM_NAMES.statusBarClass);
    item.setAttribute(PLUGIN_DOM_NAMES.roleAttribute, PLUGIN_DOM_NAMES.buttonRole);
    item.setAttribute(PLUGIN_DOM_NAMES.tabIndexAttribute, PLUGIN_DOM_NAMES.initialTabIndex);
    const iconEl = item.createSpan({ cls: PLUGIN_DOM_NAMES.statusBarIconClass });
    const textEl = item.createSpan({ cls: PLUGIN_DOM_NAMES.statusBarTextClass });
    textEl.textContent = this.messages.ui.statusBarLoading;
    safeSetIcon(iconEl, STATUS_BAR_ICONS.spinner);
    item.addClass(PLUGIN_DOM_NAMES.statusBarRunningClass);

    this.statusBarItem = item;
    this.statusBarIcon = iconEl;
    this.statusBarText = textEl;

    this.registerDomEvent(item, PLUGIN_DOM_NAMES.clickEvent, (event) => this.openMenu(event));
    this.registerDomEvent(item, PLUGIN_DOM_NAMES.keydownEvent, (event) => {
      if (
        event.key === STATUS_BAR_KEYBOARD_KEYS.Enter ||
        event.key === STATUS_BAR_KEYBOARD_KEYS.Space
      ) {
        event.preventDefault();
        void this.showStatus();
      }
    });
  }

  private registerCommands(): void {
    for (const action of GIT_ACTION_ORDER) {
      this.addCommand({
        id: GIT_ACTION_COMMAND_IDS[action],
        name: this.messages.ui.commandNamePrefix + this.messages.actions.labels[action],
        callback: () => this.executeAction(action),
      });
    }
  }

  private openMenu(event: MouseEvent): void {
    const menu = new Menu();
    for (const action of GIT_ACTION_ORDER) {
      if (action === GitAction.Fetch) menu.addSeparator();
      menu.addItem((item) =>
        item
          .setTitle(this.messages.actions.labels[action])
          .setIcon(GIT_ACTION_ICONS[action])
          .onClick(() => this.executeAction(action)),
      );
    }
    menu.showAtMouseEvent(event);
  }

  private executeAction(action: GitAction): void {
    if (action === GitAction.Status) {
      void this.showStatus();
      return;
    }

    if (action === GitAction.CommitAll) {
      void this.commitAll();
      return;
    }

    void this.runAction(this.messages.actions.progress[action], async (git) => {
      switch (action) {
        case GitAction.Fetch:
          await git.fetch();
          break;
        case GitAction.Pull:
          await git.pull();
          break;
        case GitAction.Push:
          await this.saveAll(git);
          await git.push();
          break;
        case GitAction.Sync:
          await this.saveAll(git);
          await git.pull();
          await git.push();
          break;
      }
      new Notice(this.messages.actions.success[action]);
    });
  }

  private async showStatus(): Promise<void> {
    try {
      const { status } = await this.createService().status();
      this.statusSummary = status;
      new GitStatusModal(this.app, status, this.messages, (action) => {
        this.executeAction(action);
      }).open();
      this.renderStatus();
    } catch (error) {
      this.showError(error);
    }
  }

  private async commitAll(): Promise<void> {
    await this.runAction(this.messages.actions.progress[GitAction.CommitAll], async (git) => {
      const outcome = await this.saveAll(git);
      const successMessage =
        outcome === CommitOutcomeKind.NoChanges
          ? this.messages.ui.noChangesToCommit
          : this.messages.actions.success[GitAction.CommitAll];
      new Notice(successMessage);
    });
  }

  private async saveAll(git: GitService): Promise<CommitOutcomeKind> {
    const outcome = await git.commitAll(this.makeCommitMessage());
    return outcome.kind;
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
    return template.replace(PLUGIN_FORMAT.datetimeToken, timestamp);
  }

  private padDatePart(value: number): string {
    return String(value).padStart(
      PLUGIN_FORMAT.datetimePadWidth,
      PLUGIN_FORMAT.datetimePadCharacter,
    );
  }

  private async runAction(
    label: string,
    action: (git: GitService) => Promise<void>,
  ): Promise<void> {
    if (this.operationRunning) {
      new Notice(this.messages.ui.busyNotice);
      return;
    }

    this.operationRunning = true;
    this.setStatusBarRunning(true);
    this.setStatusText(this.messages.ui.statusBarBrand + this.messages.ui.statusBarSeparator + label);
    try {
      await action(this.createService());
    } catch (error) {
      this.showError(error);
    } finally {
      this.operationRunning = false;
      this.setStatusBarRunning(false);
      await this.refreshStatus();
    }
  }

  private async autoFetch(): Promise<void> {
    if (this.operationRunning) return;
    this.operationRunning = true;
    this.setStatusBarRunning(true);
    try {
      await this.createService().fetch();
      await this.refreshStatus();
    } catch (error) {
      this.setStatusTitle(this.messages.ui.autoFetchErrorPrefix + this.errorMessage(error));
    } finally {
      this.operationRunning = false;
      this.setStatusBarRunning(false);
    }
  }

  private async autoSync(): Promise<void> {
    if (this.operationRunning) return;
    this.operationRunning = true;
    this.setStatusBarRunning(true);
    this.setStatusText(
      this.messages.ui.statusBarBrand +
        this.messages.ui.statusBarSeparator +
        this.messages.actions.progress[GitAction.Sync],
    );
    try {
      const git = this.createService();
      await this.saveAll(git);
      await git.pull();
      await git.push();
    } catch (error) {
      this.setStatusTitle(this.messages.ui.autoSyncErrorPrefix + this.errorMessage(error));
      console.error(this.messages.ui.gitErrorConsoleLabel, error);
    } finally {
      this.operationRunning = false;
      this.setStatusBarRunning(false);
      await this.refreshStatus();
    }
  }

  private async refreshStatus(): Promise<void> {
    try {
      const { status } = await this.createService().status();
      this.statusSummary = status;
      this.renderStatus();
    } catch (error) {
      this.statusSummary = null;
      this.setStatusBarError();
      this.setStatusText(this.messages.ui.statusBarUnavailable);
      this.setStatusTitle(this.errorMessage(error));
    }
  }

  private renderStatus(): void {
    const status = this.statusSummary;
    if (status === null) return;

    this.setStatusBarRunning(false);

    const parts = [
      this.messages.ui.statusBarBrand,
      status.branch ?? this.messages.ui.statusBarDetachedBranch,
    ];
    if (status.files.length > STATUS_COUNT_DEFAULTS.none) {
      parts.push(String(status.files.length) + this.messages.ui.statusBarChangeSuffix);
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

  private setStatusBarRunning(running: boolean, icon: string = STATUS_BAR_ICONS.spinner): void {
    if (this.statusBarItem === null || this.statusBarIcon === null) return;

    if (running) {
      this.statusBarItem.addClass(PLUGIN_DOM_NAMES.statusBarRunningClass);
      this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarErrorClass);
      safeSetIcon(this.statusBarIcon, icon);
    } else {
      this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarRunningClass);
      this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarErrorClass);
      safeSetIcon(this.statusBarIcon, STATUS_BAR_ICONS.branch);
    }
  }

  private setStatusBarError(): void {
    if (this.statusBarItem === null || this.statusBarIcon === null) return;
    this.statusBarItem.removeClass(PLUGIN_DOM_NAMES.statusBarRunningClass);
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

  private showError(error: unknown): void {
    const message = this.errorMessage(error);
    new Notice(this.messages.ui.gitErrorPrefix + message, PLUGIN_FORMAT.errorNoticeDurationMs);
    console.error(this.messages.ui.gitErrorConsoleLabel, error);
  }

  private errorMessage(error: unknown): string {
    const raw = error instanceof Error ? error.message : String(error);
    const message = raw.trim() || this.messages.ui.errorFallback;
    if (message.length <= PLUGIN_FORMAT.errorMessageMaxLength) return message;

    const retainedLength =
      PLUGIN_FORMAT.errorMessageMaxLength - PLUGIN_FORMAT.errorMessageEllipsisLength;
    const shortened = message.slice(PLUGIN_FORMAT.errorMessageStart, retainedLength);
    return shortened + this.messages.ui.errorEllipsis;
  }
}
