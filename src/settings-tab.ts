import { PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian';
import type GitCommandsPlugin from './main';
import {
  DEFAULT_SETTINGS,
  SETTING_PROPERTY_KEYS,
  SETTING_VALIDATION,
  type GitPluginSettings,
} from './settings';
import { PLUGIN_FORMAT } from './plugin-constants';

const SETTING_CONTROL_TYPES = {
  text: 'text',
  number: 'number',
} as const;

export class GitSettingsTab extends PluginSettingTab {
  private readonly gitPlugin: GitCommandsPlugin;

  public constructor(plugin: GitCommandsPlugin) {
    super(plugin.app, plugin);
    this.gitPlugin = plugin;
  }

  public override getSettingDefinitions(): SettingDefinitionItem[] {
    const { messages } = this.gitPlugin;
    return [
      {
        name: messages.settings.executableName,
        desc: messages.settings.executableDescription,
        control: {
          type: SETTING_CONTROL_TYPES.text,
          key: SETTING_PROPERTY_KEYS.gitExecutable,
          placeholder: DEFAULT_SETTINGS.gitExecutable,
        },
      },
      {
        name: messages.settings.fetchIntervalName,
        desc: messages.settings.fetchIntervalDescription,
        control: {
          type: SETTING_CONTROL_TYPES.number,
          key: SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
          placeholder: String(DEFAULT_SETTINGS.autoFetchIntervalSeconds),
          min: SETTING_VALIDATION.minimumFetchIntervalSeconds,
        },
      },
      {
        name: messages.settings.syncIntervalName,
        desc: messages.settings.syncIntervalDescription,
        control: {
          type: SETTING_CONTROL_TYPES.number,
          key: SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes,
          placeholder: String(DEFAULT_SETTINGS.autoSyncIntervalMinutes),
          min: SETTING_VALIDATION.minimumSyncIntervalMinutes,
        },
      },
      {
        name: messages.settings.commitTemplateName,
        desc: messages.settings.commitTemplateDescription,
        control: {
          type: SETTING_CONTROL_TYPES.text,
          key: SETTING_PROPERTY_KEYS.commitMessageTemplate,
          placeholder: messages.defaultCommitMessageTemplate,
        },
      },
    ];
  }

  public override getControlValue(key: string): unknown {
    return this.gitPlugin.settings[key as keyof GitPluginSettings];
  }

  public override async setControlValue(key: string, value: unknown): Promise<void> {
    switch (key) {
      case SETTING_PROPERTY_KEYS.gitExecutable: {
        const text = typeof value === 'string' ? value.trim() : DEFAULT_SETTINGS.gitExecutable;
        await this.gitPlugin.updateGitExecutable(text || DEFAULT_SETTINGS.gitExecutable);
        break;
      }
      case SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds: {
        const seconds = Number(value);
        if (
          Number.isFinite(seconds) &&
          seconds >= SETTING_VALIDATION.minimumFetchIntervalSeconds
        ) {
          this.gitPlugin.settings.autoFetchIntervalSeconds = Math.floor(seconds);
          await this.gitPlugin.saveSettings();
          this.gitPlugin.restartAutoFetch();
        }
        break;
      }
      case SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes: {
        const minutes = Number(value);
        if (
          Number.isFinite(minutes) &&
          minutes >= SETTING_VALIDATION.minimumSyncIntervalMinutes
        ) {
          this.gitPlugin.settings.autoSyncIntervalMinutes = Math.floor(minutes);
          await this.gitPlugin.saveSettings();
          this.gitPlugin.restartAutoSync();
        }
        break;
      }
      case SETTING_PROPERTY_KEYS.commitMessageTemplate: {
        this.gitPlugin.settings.commitMessageTemplate =
          typeof value === 'string' ? value : PLUGIN_FORMAT.emptyString;
        await this.gitPlugin.saveSettings();
        break;
      }
    }
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
