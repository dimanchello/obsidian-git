import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => ({
  PluginSettingTab: class {
    public app: unknown;
    public plugin: unknown;
    public containerEl: { empty: () => void } = { empty: vi.fn() };
    public constructor(app: unknown, plugin: unknown) {
      this.app = app;
      this.plugin = plugin;
    }
  },
  Setting: class {},
}));

import { GitSettingsTab } from '../src/settings-tab';
import { ENGLISH_MESSAGES } from '../src/i18n/en';
import { DEFAULT_SETTINGS, SETTING_PROPERTY_KEYS, type GitPluginSettings } from '../src/settings';
import type GitCommandsPlugin from '../src/main';
import {
  SETTINGS_TAB_EXPECTED_KEYS,
  SETTINGS_TAB_TEST_CONSTANTS,
} from './settings-tab.fixtures';

function createMockPlugin(): GitCommandsPlugin {
  const settings: GitPluginSettings = { ...DEFAULT_SETTINGS };
  return {
    app: {},
    settings,
    messages: ENGLISH_MESSAGES,
    updateGitExecutable: vi.fn(async (exe: string) => {
      settings.gitExecutable = exe;
    }),
    saveSettings: vi.fn(async () => {}),
    restartAutoFetch: vi.fn(),
    restartAutoSync: vi.fn(),
  } as unknown as GitCommandsPlugin;
}

describe('GitSettingsTab declarative settings', () => {
  it('returns valid setting definitions matching plugin settings keys', () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);
    const definitions = tab.getSettingDefinitions();

    expect(definitions).toHaveLength(SETTINGS_TAB_TEST_CONSTANTS.definitionsCount);
    const keys = definitions.map((d) => ('control' in d ? d.control.key : undefined));
    expect(keys).toEqual(SETTINGS_TAB_EXPECTED_KEYS);
  });

  it('reads current control values correctly via getControlValue', () => {
    const plugin = createMockPlugin();
    plugin.settings.gitExecutable = SETTINGS_TAB_TEST_CONSTANTS.testExecutable;
    const tab = new GitSettingsTab(plugin);

    expect(tab.getControlValue(SETTING_PROPERTY_KEYS.gitExecutable)).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testExecutable,
    );
    expect(tab.getControlValue(SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds)).toBe(
      DEFAULT_SETTINGS.autoFetchIntervalSeconds,
    );
  });

  it('updates gitExecutable and trims whitespace via setControlValue', async () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.whitespaceExecutable,
    );

    expect(plugin.updateGitExecutable).toHaveBeenCalledWith(
      SETTINGS_TAB_TEST_CONSTANTS.trimmedExecutable,
    );
  });

  it('updates fetch and sync intervals when valid numbers provided', async () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.testFetchInterval,
    );
    expect(plugin.settings.autoFetchIntervalSeconds).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testFetchInterval,
    );
    expect(plugin.restartAutoFetch).toHaveBeenCalled();

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes,
      SETTINGS_TAB_TEST_CONSTANTS.testSyncInterval,
    );
    expect(plugin.settings.autoSyncIntervalMinutes).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testSyncInterval,
    );
    expect(plugin.restartAutoSync).toHaveBeenCalled();
  });

  it('ignores invalid interval numbers', async () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.invalidInterval,
    );
    expect(plugin.settings.autoFetchIntervalSeconds).toBe(
      DEFAULT_SETTINGS.autoFetchIntervalSeconds,
    );
  });

  it('updates commit message template via setControlValue', async () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.commitMessageTemplate,
      SETTINGS_TAB_TEST_CONSTANTS.testCommitTemplate,
    );
    expect(plugin.settings.commitMessageTemplate).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testCommitTemplate,
    );
    expect(plugin.saveSettings).toHaveBeenCalled();
  });
});
