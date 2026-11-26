import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { MockElement, MockSetting, MockPluginSettingTab, mockState } = vi.hoisted(() => {
  const MOCK_DOM_VALUES = {
    emptyString: '',
    classSeparator: ' ',
    emptyLength: 0,
  } as const;

  class HoistedMockElement {
    public textContent = MOCK_DOM_VALUES.emptyString;
    public hidden = false;
    public readonly children: HoistedMockElement[] = [];
    public readonly classes = new Set<string>();
    public readonly attributes = new Map<string, string>();
    public readonly classList = {
      toggle: (cls: string, force?: boolean): boolean => this.toggleClass(cls, force),
      contains: (cls: string): boolean => this.classes.has(cls),
    };

    public empty(): void {
      this.children.length = MOCK_DOM_VALUES.emptyLength;
      this.textContent = MOCK_DOM_VALUES.emptyString;
    }

    public createDiv(options?: { cls?: string }): HoistedMockElement {
      const child = new HoistedMockElement();
      if (options?.cls !== undefined) {
        for (const cls of options.cls.split(MOCK_DOM_VALUES.classSeparator)) {
          if (cls.length > MOCK_DOM_VALUES.emptyLength) {
            child.classes.add(cls);
          }
        }
      }
      this.children.push(child);
      return child;
    }

    public toggleClass(cls: string, force?: boolean): boolean {
      const shouldAdd = force ?? !this.classes.has(cls);
      if (shouldAdd) {
        this.classes.add(cls);
      } else {
        this.classes.delete(cls);
      }
      return shouldAdd;
    }

    public setAttribute(name: string, value: string): void {
      this.attributes.set(name, value);
    }

    public removeAttribute(name: string): void {
      this.attributes.delete(name);
    }

    public getAttribute(name: string): string | null {
      return this.attributes.get(name) ?? null;
    }
  }

  class HoistedMockTextComponent {
    public value: string = MOCK_DOM_VALUES.emptyString;
    public placeholder: string = MOCK_DOM_VALUES.emptyString;
    public readonly inputEl = new HoistedMockElement();
    public changeCallback: ((value: string) => unknown) | null = null;

    public setPlaceholder(placeholder: string): this {
      this.placeholder = placeholder;
      return this;
    }

    public setValue(value: string): this {
      this.value = value;
      return this;
    }

    public onChange(callback: (value: string) => unknown): this {
      this.changeCallback = callback;
      return this;
    }

    public triggerChange(value: string): void {
      this.value = value;
      this.changeCallback?.(value);
    }
  }

  class HoistedMockToggleComponent {
    public value = false;
    public changeCallback: ((value: boolean) => unknown) | null = null;

    public setValue(value: boolean): this {
      this.value = value;
      return this;
    }

    public onChange(callback: (value: boolean) => unknown): this {
      this.changeCallback = callback;
      return this;
    }

    public triggerChange(value: boolean): void {
      this.value = value;
      this.changeCallback?.(value);
    }
  }

  class HoistedMockDropdownComponent {
    public value: string = MOCK_DOM_VALUES.emptyString;
    public readonly options: Record<string, string> = {};
    public changeCallback: ((value: string) => unknown) | null = null;

    public addOptions(options: Record<string, string>): this {
      Object.assign(this.options, options);
      return this;
    }

    public setValue(value: string): this {
      this.value = value;
      return this;
    }

    public onChange(callback: (value: string) => unknown): this {
      this.changeCallback = callback;
      return this;
    }

    public triggerChange(value: string): void {
      this.value = value;
      this.changeCallback?.(value);
    }
  }

  class HoistedMockButtonComponent {
    public buttonText: string = MOCK_DOM_VALUES.emptyString;
    public clickCallback: ((evt: MouseEvent) => unknown) | null = null;

    public setButtonText(name: string): this {
      this.buttonText = name;
      return this;
    }

    public onClick(callback: (evt: MouseEvent) => unknown): this {
      this.clickCallback = callback;
      return this;
    }

    public triggerClick(): void {
      this.clickCallback?.({} as MouseEvent);
    }
  }

  const state = {
    settings: [] as HoistedMockSetting[],
  };

  class HoistedMockSetting {
    public name: string = MOCK_DOM_VALUES.emptyString;
    public desc: string | DocumentFragment = MOCK_DOM_VALUES.emptyString;
    public readonly settingEl = new HoistedMockElement();
    public readonly infoEl = new HoistedMockElement();
    public readonly controlEl = new HoistedMockElement();
    public textComponent: HoistedMockTextComponent | null = null;
    public toggleComponent: HoistedMockToggleComponent | null = null;
    public dropdownComponent: HoistedMockDropdownComponent | null = null;
    public buttonComponent: HoistedMockButtonComponent | null = null;

    public constructor(containerEl: HoistedMockElement) {
      void containerEl;
      state.settings.push(this);
    }

    public setName(name: string): this {
      this.name = name;
      return this;
    }

    public setDesc(desc: string | DocumentFragment): this {
      this.desc = desc;
      return this;
    }

    public addText(cb: (component: HoistedMockTextComponent) => unknown): this {
      const component = new HoistedMockTextComponent();
      this.textComponent = component;
      cb(component);
      return this;
    }

    public addToggle(cb: (component: HoistedMockToggleComponent) => unknown): this {
      const component = new HoistedMockToggleComponent();
      this.toggleComponent = component;
      cb(component);
      return this;
    }

    public addDropdown(cb: (component: HoistedMockDropdownComponent) => unknown): this {
      const component = new HoistedMockDropdownComponent();
      this.dropdownComponent = component;
      cb(component);
      return this;
    }

    public addButton(cb: (component: HoistedMockButtonComponent) => unknown): this {
      const component = new HoistedMockButtonComponent();
      this.buttonComponent = component;
      cb(component);
      return this;
    }
  }

  class HoistedMockPluginSettingTab {
    public app: unknown;
    public plugin: unknown;
    public containerEl = new HoistedMockElement();

    public constructor(app: unknown, plugin: unknown) {
      this.app = app;
      this.plugin = plugin;
    }

    public hide(): void {}
  }

  return {
    MockElement: HoistedMockElement,
    MockSetting: HoistedMockSetting,
    MockPluginSettingTab: HoistedMockPluginSettingTab,
    mockState: state,
  };
});

vi.mock('obsidian', () => ({
  PluginSettingTab: MockPluginSettingTab,
  Setting: MockSetting,
}));

import type {
  SettingControl,
  SettingDefinitionControl,
  SettingDefinitionRender,
} from 'obsidian';
import { ENGLISH_MESSAGES } from '../src/i18n/en';
import type GitCommandsPlugin from '../src/main';
import { SETTINGS_DEBOUNCE_MS } from '../src/plugin-constants';
import {
  DEFAULT_SETTINGS,
  SETTING_PROPERTY_KEYS,
  SETTING_VALIDATION,
  type GitPluginSettings,
} from '../src/settings';
import { GitSettingsTab } from '../src/settings-tab';
import {
  SETTINGS_TAB_EXPECTED_DEFINITION_KEYS,
  SETTINGS_TAB_EXPECTED_KEYS,
  SETTINGS_TAB_TEST_CONSTANTS,
} from './settings-tab.fixtures';

function createMockPlugin(): GitCommandsPlugin {
  const settings: GitPluginSettings = { ...DEFAULT_SETTINGS };
  return {
    app: {},
    settings,
    messages: ENGLISH_MESSAGES,
    saveSettings: vi.fn(async () => {}),
    updateGitExecutable: vi.fn(async (executable: string) => {
      settings.gitExecutable = executable;
    }),
    testGitExecutable: vi.fn(async () => {}),
    restartAutoFetch: vi.fn(),
    restartAutoSync: vi.fn(),
    restartAutoBackup: vi.fn(),
    updateRibbonIcon: vi.fn(),
  } as unknown as GitCommandsPlugin;
}

function resetMockSettings(): void {
  mockState.settings.length = SETTINGS_TAB_TEST_CONSTANTS.noCallsCount;
}

function findControlByType<T extends SettingControl['type']>(
  definitions: ReturnType<GitSettingsTab['getSettingDefinitions']>,
  key: string,
  expectedType: T,
): Extract<SettingControl, { type: T }> {
  const match = definitions.find(
    (item): item is SettingDefinitionControl =>
      'control' in item && item.control !== undefined && item.control.key === key,
  );
  if (match === undefined || match.control.type !== expectedType) {
    throw new Error(SETTINGS_TAB_TEST_CONSTANTS.missingDefinitionErrorPrefix + key);
  }
  return match.control as Extract<SettingControl, { type: T }>;
}

function findRenderDefinition(
  definitions: ReturnType<GitSettingsTab['getSettingDefinitions']>,
  index: number,
): SettingDefinitionRender {
  const item = definitions[index];
  if (item === undefined || !('render' in item) || item.render === undefined) {
    throw new Error(SETTINGS_TAB_TEST_CONSTANTS.missingDefinitionErrorPrefix + String(index));
  }
  return item;
}

function findSettingRowByName(name: string) {
  const row = mockState.settings.find((item) => item.name === name);
  if (row === undefined) {
    throw new Error(SETTINGS_TAB_TEST_CONSTANTS.missingRenderedRowErrorPrefix + name);
  }
  return row;
}

beforeEach(() => {
  vi.stubGlobal(SETTINGS_TAB_TEST_CONSTANTS.windowGlobalName, {
    setTimeout: (...args: Parameters<typeof setTimeout>) => globalThis.setTimeout(...args),
    clearTimeout: (...args: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...args),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  resetMockSettings();
});

describe('GitSettingsTab declarative settings', () => {
  it('returns setting definitions for all plugin settings and Test Git action', () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin, {
      executableDebounceMs: SETTINGS_TAB_TEST_CONSTANTS.immediateDebounceMs,
    });
    const definitions = tab.getSettingDefinitions();

    expect(definitions).toHaveLength(SETTINGS_TAB_TEST_CONSTANTS.definitionsCount);
    const definitionKeys = definitions.map((item) =>
      'control' in item && item.control !== undefined ? item.control.key : undefined,
    );
    expect(definitionKeys).toEqual(SETTINGS_TAB_EXPECTED_DEFINITION_KEYS);

    const controlKeys = definitionKeys.filter(
      (key): key is string => key !== undefined,
    );
    expect(controlKeys).toEqual(SETTINGS_TAB_EXPECTED_KEYS);

    const fetchControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.number,
    );
    expect(fetchControl.defaultValue).toBe(DEFAULT_SETTINGS.autoFetchIntervalSeconds);

    const pullStrategyControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.pullStrategy,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.dropdown,
    );
    expect(pullStrategyControl.options).toEqual(ENGLISH_MESSAGES.settings.pullStrategyOptions);

    const ribbonControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.showRibbonIcon,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.toggle,
    );
    expect(ribbonControl.defaultValue).toBe(DEFAULT_SETTINGS.showRibbonIcon);

    const testGitDef = findRenderDefinition(
      definitions,
      SETTINGS_TAB_TEST_CONSTANTS.testGitRowIndex,
    );
    expect(testGitDef.name).toBe(ENGLISH_MESSAGES.settings.testGitName);
    const setting = new MockSetting(new MockElement());
    testGitDef.render(setting as never, {} as never);
    expect(setting.buttonComponent?.buttonText).toBe(ENGLISH_MESSAGES.settings.testGitButton);
    setting.buttonComponent?.triggerClick();
    expect(plugin.testGitExecutable).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );
  });

  it('validates executable and bounded integer controls via definition validators', () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);
    const definitions = tab.getSettingDefinitions();

    const executableControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.text,
    );
    expect(executableControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.blankExecutable)).toBe(
      ENGLISH_MESSAGES.settings.invalidExecutableEmpty,
    );
    expect(
      executableControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.testExecutable),
    ).toBeUndefined();

    const fetchControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.number,
    );
    expect(fetchControl.validate?.(SETTING_VALIDATION.minimumFetchIntervalSeconds)).toBeUndefined();
    expect(fetchControl.validate?.(SETTING_VALIDATION.maximumFetchIntervalSeconds)).toBeUndefined();
    expect(
      fetchControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidNegativeInterval),
    ).toBe(ENGLISH_MESSAGES.settings.invalidNonNegativeInteger);
    expect(
      fetchControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidFractionalInterval),
    ).toBe(ENGLISH_MESSAGES.settings.invalidNonNegativeInteger);
    expect(fetchControl.validate?.(Number.NaN)).toBe(
      ENGLISH_MESSAGES.settings.invalidNonNegativeInteger,
    );
    expect(
      fetchControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidOverflowFetchInterval),
    ).toBe(ENGLISH_MESSAGES.settings.invalidIntervalRange);

    const syncControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.number,
    );
    expect(
      syncControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidOverflowSyncInterval),
    ).toBe(ENGLISH_MESSAGES.settings.invalidIntervalRange);

    const backupControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.autoBackupAfterEditMinutes,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.number,
    );
    expect(
      backupControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidOverflowAutoBackup),
    ).toBe(ENGLISH_MESSAGES.settings.invalidIntervalRange);

    const timeoutControl = findControlByType(
      definitions,
      SETTING_PROPERTY_KEYS.processTimeoutSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.expectedControlTypes.number,
    );
    expect(
      timeoutControl.validate?.(SETTING_VALIDATION.minimumProcessTimeoutSeconds),
    ).toBeUndefined();
    expect(
      timeoutControl.validate?.(SETTING_VALIDATION.maximumProcessTimeoutSeconds),
    ).toBeUndefined();
    expect(
      timeoutControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidLowTimeout),
    ).toBe(ENGLISH_MESSAGES.settings.invalidTimeoutRange);
    expect(
      timeoutControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidHighTimeout),
    ).toBe(ENGLISH_MESSAGES.settings.invalidTimeoutRange);
    expect(
      timeoutControl.validate?.(SETTINGS_TAB_TEST_CONSTANTS.invalidFractionalInterval),
    ).toBe(ENGLISH_MESSAGES.settings.invalidTimeoutRange);
  });

  it('reads all setting values via getControlValue and returns undefined for unknown keys', () => {
    const plugin = createMockPlugin();
    plugin.settings.gitExecutable = SETTINGS_TAB_TEST_CONSTANTS.testExecutable;
    plugin.settings.autoBackupAfterEditMinutes = SETTINGS_TAB_TEST_CONSTANTS.testAutoBackupMinutes;
    plugin.settings.pullStrategy = SETTINGS_TAB_TEST_CONSTANTS.testPullStrategy;
    plugin.settings.showRibbonIcon = true;

    const tab = new GitSettingsTab(plugin);

    for (const key of SETTINGS_TAB_EXPECTED_KEYS) {
      expect(tab.getControlValue(key)).toBe(plugin.settings[key]);
    }
    expect(tab.getControlValue(SETTINGS_TAB_TEST_CONSTANTS.unknownSettingKey)).toBeUndefined();
  });

  it('updates all settings via setControlValue and rejects invalid values', async () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin, {
      executableDebounceMs: SETTINGS_TAB_TEST_CONSTANTS.immediateDebounceMs,
    });

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.whitespaceExecutable,
    );
    expect(plugin.updateGitExecutable).toHaveBeenCalledWith(
      SETTINGS_TAB_TEST_CONSTANTS.trimmedExecutable,
    );

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.blankExecutable,
    );
    expect(plugin.settings.gitExecutable).toBe(SETTINGS_TAB_TEST_CONSTANTS.trimmedExecutable);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.testFetchInterval,
    );
    expect(plugin.settings.autoFetchIntervalSeconds).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testFetchInterval,
    );
    expect(plugin.restartAutoFetch).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes,
      SETTINGS_TAB_TEST_CONSTANTS.testSyncInterval,
    );
    expect(plugin.settings.autoSyncIntervalMinutes).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testSyncInterval,
    );
    expect(plugin.restartAutoSync).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoBackupAfterEditMinutes,
      SETTINGS_TAB_TEST_CONSTANTS.testAutoBackupMinutes,
    );
    expect(plugin.settings.autoBackupAfterEditMinutes).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testAutoBackupMinutes,
    );
    expect(plugin.restartAutoBackup).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.processTimeoutSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.testProcessTimeout,
    );
    expect(plugin.settings.processTimeoutSeconds).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testProcessTimeout,
    );

    await tab.setControlValue(SETTING_PROPERTY_KEYS.autoPullOnLoad, true);
    expect(plugin.settings.autoPullOnLoad).toBe(true);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.pullStrategy,
      SETTINGS_TAB_TEST_CONSTANTS.testPullStrategy,
    );
    expect(plugin.settings.pullStrategy).toBe(SETTINGS_TAB_TEST_CONSTANTS.testPullStrategy);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoSyncNotificationMode,
      SETTINGS_TAB_TEST_CONSTANTS.testNotificationMode,
    );
    expect(plugin.settings.autoSyncNotificationMode).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testNotificationMode,
    );

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.statusBarClickAction,
      SETTINGS_TAB_TEST_CONSTANTS.testStatusBarClickAction,
    );
    expect(plugin.settings.statusBarClickAction).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testStatusBarClickAction,
    );

    await tab.setControlValue(SETTING_PROPERTY_KEYS.showRibbonIcon, true);
    expect(plugin.settings.showRibbonIcon).toBe(true);
    expect(plugin.updateRibbonIcon).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.commitMessageTemplate,
      SETTINGS_TAB_TEST_CONSTANTS.testCommitTemplate,
    );
    expect(plugin.settings.commitMessageTemplate).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testCommitTemplate,
    );

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.commitMessageTemplate,
      SETTINGS_TAB_TEST_CONSTANTS.emptyCommitTemplate,
    );
    expect(plugin.settings.commitMessageTemplate).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.emptyCommitTemplate,
    );

    const saveCallsBeforeInvalid = vi.mocked(plugin.saveSettings).mock.calls.length;
    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.invalidNegativeInterval,
    );
    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.emptyNumericString,
    );
    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.processTimeoutSeconds,
      SETTINGS_TAB_TEST_CONSTANTS.invalidLowTimeout,
    );
    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.pullStrategy,
      SETTINGS_TAB_TEST_CONSTANTS.invalidEnumValue,
    );
    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.autoPullOnLoad,
      SETTINGS_TAB_TEST_CONSTANTS.invalidNonBooleanValue,
    );
    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.commitMessageTemplate,
      SETTINGS_TAB_TEST_CONSTANTS.invalidNonStringValue,
    );
    await tab.setControlValue(
      SETTINGS_TAB_TEST_CONSTANTS.unknownSettingKey,
      SETTINGS_TAB_TEST_CONSTANTS.testCommitTemplate,
    );

    expect(plugin.saveSettings).toHaveBeenCalledTimes(saveCallsBeforeInvalid);
    expect(plugin.settings.autoFetchIntervalSeconds).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testFetchInterval,
    );
    expect(plugin.settings.processTimeoutSeconds).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testProcessTimeout,
    );
    expect(plugin.settings.pullStrategy).toBe(SETTINGS_TAB_TEST_CONSTANTS.testPullStrategy);
    expect(plugin.settings.autoPullOnLoad).toBe(true);
  });
});

describe('GitSettingsTab executable debouncing and hide cleanup', () => {
  it('debounces rapid gitExecutable updates and only persists the final trimmed path', async () => {
    vi.useFakeTimers();
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    const firstUpdate = tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.intermediateExecutable,
    );
    vi.advanceTimersByTime(SETTINGS_TAB_TEST_CONSTANTS.partialDebounceMs);
    expect(plugin.updateGitExecutable).not.toHaveBeenCalled();

    const secondUpdate = tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.whitespaceExecutable,
    );
    vi.advanceTimersByTime(SETTINGS_TAB_TEST_CONSTANTS.almostFullDebounceMs);
    expect(plugin.updateGitExecutable).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SETTINGS_TAB_TEST_CONSTANTS.finalDebounceStepMs);
    await Promise.all([firstUpdate, secondUpdate]);

    expect(plugin.updateGitExecutable).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );
    expect(plugin.updateGitExecutable).toHaveBeenCalledWith(
      SETTINGS_TAB_TEST_CONSTANTS.trimmedExecutable,
    );
  });

  it('cancels pending debounced executable update when empty value is entered', async () => {
    vi.useFakeTimers();
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    const pendingUpdate = tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.testExecutable,
    );
    vi.advanceTimersByTime(SETTINGS_TAB_TEST_CONSTANTS.partialDebounceMs);

    await tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.blankExecutable,
    );
    await pendingUpdate;
    await vi.advanceTimersByTimeAsync(SETTINGS_TAB_TEST_CONSTANTS.postHideAdvanceMs);

    expect(plugin.updateGitExecutable).not.toHaveBeenCalled();
  });

  it('cleans up pending debounce timer and flushes once on hide()', async () => {
    vi.useFakeTimers();
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    const pendingUpdate = tab.setControlValue(
      SETTING_PROPERTY_KEYS.gitExecutable,
      SETTINGS_TAB_TEST_CONSTANTS.testExecutable,
    );
    vi.advanceTimersByTime(SETTINGS_TAB_TEST_CONSTANTS.partialDebounceMs);
    expect(plugin.updateGitExecutable).not.toHaveBeenCalled();

    tab.hide();
    await pendingUpdate;

    expect(plugin.updateGitExecutable).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );
    expect(plugin.updateGitExecutable).toHaveBeenCalledWith(
      SETTINGS_TAB_TEST_CONSTANTS.testExecutable,
    );

    await vi.advanceTimersByTimeAsync(SETTINGS_TAB_TEST_CONSTANTS.postHideAdvanceMs);
    expect(plugin.updateGitExecutable).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );

    tab.hide();
    expect(plugin.updateGitExecutable).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );
  });
});

describe('GitSettingsTab legacy display() fallback', () => {
  it('renders all controls, Test Git button, dropdowns, and toggles', async () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin, {
      executableDebounceMs: SETTINGS_TAB_TEST_CONSTANTS.immediateDebounceMs,
    });

    tab.display();

    expect(mockState.settings).toHaveLength(SETTINGS_TAB_TEST_CONSTANTS.definitionsCount);

    const testGitRow = findSettingRowByName(ENGLISH_MESSAGES.settings.testGitName);
    expect(testGitRow.buttonComponent?.buttonText).toBe(ENGLISH_MESSAGES.settings.testGitButton);
    testGitRow.buttonComponent?.triggerClick();
    expect(plugin.testGitExecutable).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );

    const pullRow = findSettingRowByName(ENGLISH_MESSAGES.settings.pullStrategyName);
    expect(pullRow.dropdownComponent?.options).toEqual(
      ENGLISH_MESSAGES.settings.pullStrategyOptions,
    );
    expect(pullRow.dropdownComponent?.value).toBe(DEFAULT_SETTINGS.pullStrategy);
    pullRow.dropdownComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.testPullStrategy);

    const notificationRow = findSettingRowByName(
      ENGLISH_MESSAGES.settings.autoSyncNotificationName,
    );
    notificationRow.dropdownComponent?.triggerChange(
      SETTINGS_TAB_TEST_CONSTANTS.testNotificationMode,
    );

    const statusBarRow = findSettingRowByName(ENGLISH_MESSAGES.settings.statusBarClickActionName);
    statusBarRow.dropdownComponent?.triggerChange(
      SETTINGS_TAB_TEST_CONSTANTS.testStatusBarClickAction,
    );

    const autoPullRow = findSettingRowByName(ENGLISH_MESSAGES.settings.autoPullOnLoadName);
    autoPullRow.toggleComponent?.triggerChange(true);

    const ribbonRow = findSettingRowByName(ENGLISH_MESSAGES.settings.showRibbonIconName);
    ribbonRow.toggleComponent?.triggerChange(true);

    const templateRow = findSettingRowByName(ENGLISH_MESSAGES.settings.commitTemplateName);
    templateRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.testCommitTemplate);

    await Promise.resolve();

    expect(plugin.settings.pullStrategy).toBe(SETTINGS_TAB_TEST_CONSTANTS.testPullStrategy);
    expect(plugin.settings.autoSyncNotificationMode).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testNotificationMode,
    );
    expect(plugin.settings.statusBarClickAction).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testStatusBarClickAction,
    );
    expect(plugin.settings.autoPullOnLoad).toBe(true);
    expect(plugin.settings.showRibbonIcon).toBe(true);
    expect(plugin.updateRibbonIcon).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );
    expect(plugin.settings.commitMessageTemplate).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.testCommitTemplate,
    );
  });

  it('shows inline validation errors on invalid inputs without treating empty numeric input as zero', async () => {
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin, {
      executableDebounceMs: SETTINGS_TAB_TEST_CONSTANTS.immediateDebounceMs,
    });

    tab.display();

    const executableRow = findSettingRowByName(ENGLISH_MESSAGES.settings.executableName);
    executableRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.blankExecutable);

    const executableErrorEl = executableRow.infoEl.children[SETTINGS_TAB_TEST_CONSTANTS.firstIndex];
    expect(executableErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidExecutableEmpty);
    expect(executableErrorEl?.hidden).toBe(false);
    expect(
      executableErrorEl?.getAttribute(SETTINGS_TAB_TEST_CONSTANTS.domNames.roleAttribute),
    ).toBe(SETTINGS_TAB_TEST_CONSTANTS.domNames.alertRole);
    expect(
      executableRow.settingEl.classes.has(SETTINGS_TAB_TEST_CONSTANTS.domNames.invalidClass),
    ).toBe(true);
    expect(
      executableRow.textComponent?.inputEl.getAttribute(
        SETTINGS_TAB_TEST_CONSTANTS.domNames.ariaInvalidAttribute,
      ),
    ).toBe(SETTINGS_TAB_TEST_CONSTANTS.domNames.ariaTrue);
    expect(plugin.updateGitExecutable).not.toHaveBeenCalled();

    executableRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.whitespaceExecutable);
    await Promise.resolve();

    expect(executableErrorEl?.hidden).toBe(true);
    expect(
      executableRow.settingEl.classes.has(SETTINGS_TAB_TEST_CONSTANTS.domNames.invalidClass),
    ).toBe(false);
    expect(
      executableRow.textComponent?.inputEl.getAttribute(
        SETTINGS_TAB_TEST_CONSTANTS.domNames.ariaInvalidAttribute,
      ),
    ).toBeNull();
    expect(plugin.updateGitExecutable).toHaveBeenCalledWith(
      SETTINGS_TAB_TEST_CONSTANTS.trimmedExecutable,
    );

    const fetchRow = findSettingRowByName(ENGLISH_MESSAGES.settings.fetchIntervalName);
    fetchRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.emptyNumericString);
    const fetchErrorEl = fetchRow.infoEl.children[SETTINGS_TAB_TEST_CONSTANTS.firstIndex];
    expect(fetchErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidNonNegativeInteger);
    expect(fetchErrorEl?.hidden).toBe(false);
    expect(plugin.settings.autoFetchIntervalSeconds).toBe(
      DEFAULT_SETTINGS.autoFetchIntervalSeconds,
    );

    fetchRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.invalidNumericString);
    expect(fetchErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidNonNegativeInteger);

    fetchRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.invalidNegativeInput);
    expect(fetchErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidNonNegativeInteger);

    fetchRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.invalidFractionalInput);
    expect(fetchErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidNonNegativeInteger);

    fetchRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.invalidOverflowInput);
    expect(fetchErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidIntervalRange);

    expect(plugin.restartAutoFetch).not.toHaveBeenCalled();

    fetchRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.validFetchIntervalInput);
    await Promise.resolve();
    expect(fetchErrorEl?.hidden).toBe(true);
    expect(plugin.settings.autoFetchIntervalSeconds).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.validFetchIntervalValue,
    );
    expect(plugin.restartAutoFetch).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );

    const timeoutRow = findSettingRowByName(ENGLISH_MESSAGES.settings.processTimeoutName);
    timeoutRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.invalidLowTimeoutInput);
    const timeoutErrorEl = timeoutRow.infoEl.children[SETTINGS_TAB_TEST_CONSTANTS.firstIndex];
    expect(timeoutErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidTimeoutRange);
    timeoutRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.invalidHighTimeoutInput);
    expect(timeoutErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidTimeoutRange);
    timeoutRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.emptyNumericString);
    expect(timeoutErrorEl?.textContent).toBe(ENGLISH_MESSAGES.settings.invalidTimeoutRange);
    expect(plugin.settings.processTimeoutSeconds).toBe(DEFAULT_SETTINGS.processTimeoutSeconds);

    timeoutRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.validTimeoutInput);
    await Promise.resolve();
    expect(timeoutErrorEl?.hidden).toBe(true);
    expect(plugin.settings.processTimeoutSeconds).toBe(
      SETTINGS_TAB_TEST_CONSTANTS.validTimeoutValue,
    );
  });

  it('debounces gitExecutable input changes in display() using SETTINGS_DEBOUNCE_MS', async () => {
    vi.useFakeTimers();
    const plugin = createMockPlugin();
    const tab = new GitSettingsTab(plugin);

    tab.display();
    const executableRow = findSettingRowByName(ENGLISH_MESSAGES.settings.executableName);
    executableRow.textComponent?.triggerChange(SETTINGS_TAB_TEST_CONSTANTS.testExecutable);

    expect(plugin.updateGitExecutable).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SETTINGS_DEBOUNCE_MS);
    expect(plugin.updateGitExecutable).toHaveBeenCalledTimes(
      SETTINGS_TAB_TEST_CONSTANTS.singleCallCount,
    );
    expect(plugin.updateGitExecutable).toHaveBeenCalledWith(
      SETTINGS_TAB_TEST_CONSTANTS.testExecutable,
    );
  });
});
