import { PluginSettingTab, Setting } from 'obsidian';
import type GitCommandsPlugin from './main';
import { DEFAULT_SETTINGS, SETTING_VALIDATION } from './settings';
import { PLUGIN_FORMAT } from './plugin-constants';

export class GitSettingsTab extends PluginSettingTab {
  private readonly gitPlugin: GitCommandsPlugin;

  public constructor(plugin: GitCommandsPlugin) {
    super(plugin.app, plugin);
    this.gitPlugin = plugin;
  }

  public display(): void {
    const { containerEl } = this;
    const { messages } = this.gitPlugin;
    containerEl.empty();

    new Setting(containerEl)
      .setName(messages.settings.executableName)
      .setDesc(messages.settings.executableDescription)
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.gitExecutable)
          .setValue(this.gitPlugin.settings.gitExecutable)
          .onChange(async (value) => {
            await this.gitPlugin.updateGitExecutable(
              value.trim() || DEFAULT_SETTINGS.gitExecutable,
            );
          }),
      );

    new Setting(containerEl)
      .setName(messages.settings.fetchIntervalName)
      .setDesc(messages.settings.fetchIntervalDescription)
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.autoFetchIntervalSeconds))
          .setValue(String(this.gitPlugin.settings.autoFetchIntervalSeconds))
          .onChange(async (value) => {
            const seconds = Number(value);
            if (
              Number.isFinite(seconds) &&
              seconds >= SETTING_VALIDATION.minimumFetchIntervalSeconds
            ) {
              this.gitPlugin.settings.autoFetchIntervalSeconds = Math.floor(seconds);
              await this.gitPlugin.saveSettings();
              this.gitPlugin.restartAutoFetch();
            }
          }),
      );

    new Setting(containerEl)
      .setName(messages.settings.syncIntervalName)
      .setDesc(messages.settings.syncIntervalDescription)
      .addText((text) =>
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.autoSyncIntervalMinutes))
          .setValue(String(this.gitPlugin.settings.autoSyncIntervalMinutes))
          .onChange(async (value) => {
            const minutes = Number(value);
            if (
              Number.isFinite(minutes) &&
              minutes >= SETTING_VALIDATION.minimumSyncIntervalMinutes
            ) {
              this.gitPlugin.settings.autoSyncIntervalMinutes = Math.floor(minutes);
              await this.gitPlugin.saveSettings();
              this.gitPlugin.restartAutoSync();
            }
          }),
      );

    new Setting(containerEl)
      .setName(messages.settings.commitTemplateName)
      .setDesc(messages.settings.commitTemplateDescription)
      .addText((text) =>
        text
          .setPlaceholder(messages.defaultCommitMessageTemplate)
          .setValue(this.gitPlugin.settings.commitMessageTemplate)
          .onChange(async (value) => {
            this.gitPlugin.settings.commitMessageTemplate = value || PLUGIN_FORMAT.emptyString;
            await this.gitPlugin.saveSettings();
          }),
      );
  }
}
