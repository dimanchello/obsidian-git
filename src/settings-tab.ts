import {
  PluginSettingTab,
  requireApiVersion,
  Setting,
  type ButtonComponent,
  type DropdownComponent,
  type SettingDefinitionItem,
  type SettingNumberControl,
  type SettingTextControl,
  type TextComponent,
  type ToggleComponent,
} from 'obsidian';
import { PullStrategy } from './git/git-constants';
import type { PluginMessages } from './i18n/types';
import type GitCommandsPlugin from './main';
import { PLUGIN_FORMAT, SETTINGS_DEBOUNCE_MS } from './plugin-constants';
import {
  AutoSyncNotificationMode,
  DEFAULT_SETTINGS,
  SETTING_PROPERTY_KEYS,
  SETTING_VALIDATION,
  StatusBarClickAction,
  type GitPluginSettings,
} from './settings';

const OBSIDIAN_API_VERSIONS = {
  settingErrorMessage: '1.13.0',
} as const;

const SETTING_CONTROL_TYPES = {
  text: 'text',
  number: 'number',
  toggle: 'toggle',
  dropdown: 'dropdown',
} as const;

const JAVASCRIPT_TYPE_NAMES = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  function: 'function',
} as const;

const SETTINGS_TAB_CLASSES = {
  invalid: 'is-invalid',
  validationError: 'git-settings-validation-error',
  description: 'setting-item-description',
  warning: 'mod-warning',
} as const;

const SETTINGS_TAB_DOM = {
  roleAttribute: 'role',
  alertRole: 'alert',
  ariaInvalidAttribute: 'aria-invalid',
  ariaTrue: 'true',
  classSeparator: ' ',
} as const;

const VALIDATION_ERROR_CLASSES = [
  SETTINGS_TAB_CLASSES.description,
  SETTINGS_TAB_CLASSES.warning,
  SETTINGS_TAB_CLASSES.validationError,
].join(SETTINGS_TAB_DOM.classSeparator);

const SETTINGS_TAB_NUMERIC = {
  emptyLength: 0,
  zeroValue: 0,
  integerStep: 1,
  minDebounceMs: 0,
} as const;

const INTEGER_INPUT_PATTERN = /^-?\d+$/;

const VALID_PULL_STRATEGIES: ReadonlySet<string> = new Set(Object.values(PullStrategy));
const VALID_NOTIFICATION_MODES: ReadonlySet<string> = new Set(
  Object.values(AutoSyncNotificationMode),
);
const VALID_STATUS_BAR_CLICK_ACTIONS: ReadonlySet<string> = new Set(
  Object.values(StatusBarClickAction),
);

enum SettingRowKind {
  Text = 'text',
  BoundedInteger = 'bounded-integer',
  Toggle = 'toggle',
  Dropdown = 'dropdown',
  Button = 'button',
}

type TextSettingKey =
  | typeof SETTING_PROPERTY_KEYS.gitExecutable
  | typeof SETTING_PROPERTY_KEYS.commitMessageTemplate;

type BoundedIntegerSettingKey =
  | typeof SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds
  | typeof SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes
  | typeof SETTING_PROPERTY_KEYS.autoBackupAfterEditMinutes
  | typeof SETTING_PROPERTY_KEYS.processTimeoutSeconds;

type ToggleSettingKey =
  | typeof SETTING_PROPERTY_KEYS.autoPullOnLoad
  | typeof SETTING_PROPERTY_KEYS.showRibbonIcon;

type EnumSettingKey =
  | typeof SETTING_PROPERTY_KEYS.pullStrategy
  | typeof SETTING_PROPERTY_KEYS.autoSyncNotificationMode
  | typeof SETTING_PROPERTY_KEYS.statusBarClickAction;

interface IntegerBoundsSpec {
  readonly min: number;
  readonly max: number;
  readonly useTimeoutMessage: boolean;
}

interface TextSettingRow {
  readonly kind: SettingRowKind.Text;
  readonly key: TextSettingKey;
  readonly defaultValue: string;
  readonly getName: (messages: PluginMessages) => string;
  readonly getDesc: (messages: PluginMessages) => string;
  readonly getPlaceholder: (messages: PluginMessages) => string;
  readonly requireNonEmpty: boolean;
  readonly debouncedExecutableUpdate: boolean;
}

interface BoundedIntegerSettingRow {
  readonly kind: SettingRowKind.BoundedInteger;
  readonly key: BoundedIntegerSettingKey;
  readonly defaultValue: number;
  readonly bounds: IntegerBoundsSpec;
  readonly getName: (messages: PluginMessages) => string;
  readonly getDesc: (messages: PluginMessages) => string;
  readonly onAfterSave?: (plugin: GitCommandsPlugin) => void;
}

interface ToggleSettingRow {
  readonly kind: SettingRowKind.Toggle;
  readonly key: ToggleSettingKey;
  readonly defaultValue: boolean;
  readonly getName: (messages: PluginMessages) => string;
  readonly getDesc: (messages: PluginMessages) => string;
  readonly onAfterSave?: (plugin: GitCommandsPlugin) => void;
}

interface DropdownSettingRow {
  readonly kind: SettingRowKind.Dropdown;
  readonly key: EnumSettingKey;
  readonly defaultValue: string;
  readonly validValues: ReadonlySet<string>;
  readonly getName: (messages: PluginMessages) => string;
  readonly getDesc: (messages: PluginMessages) => string;
  readonly getOptions: (messages: PluginMessages) => Record<string, string>;
  readonly assign: (settings: GitPluginSettings, value: string) => void;
}

interface ButtonSettingRow {
  readonly kind: SettingRowKind.Button;
  readonly getName: (messages: PluginMessages) => string;
  readonly getDesc: (messages: PluginMessages) => string;
  readonly getButtonText: (messages: PluginMessages) => string;
  readonly onClick: (plugin: GitCommandsPlugin) => void;
}

type SettingRowDescriptor =
  | TextSettingRow
  | BoundedIntegerSettingRow
  | ToggleSettingRow
  | DropdownSettingRow
  | ButtonSettingRow;

type KeyedSettingRow = Exclude<SettingRowDescriptor, ButtonSettingRow>;

interface ParsedIntegerResult {
  readonly parsedValue: number | undefined;
  readonly errorMessage: string | undefined;
}

interface PendingExecutableUpdate {
  value: string;
  timer: number;
  readonly resolvers: Array<{
    readonly resolve: () => void;
    readonly reject: (reason?: unknown) => void;
  }>;
}

export interface GitSettingsTabOptions {
  readonly executableDebounceMs?: number | undefined;
}

const SETTING_ROWS: readonly SettingRowDescriptor[] = [
  {
    kind: SettingRowKind.Text,
    key: SETTING_PROPERTY_KEYS.gitExecutable,
    defaultValue: DEFAULT_SETTINGS.gitExecutable,
    getName: (messages) => messages.settings.executableName,
    getDesc: (messages) => messages.settings.executableDescription,
    getPlaceholder: () => DEFAULT_SETTINGS.gitExecutable,
    requireNonEmpty: true,
    debouncedExecutableUpdate: true,
  },
  {
    kind: SettingRowKind.Button,
    getName: (messages) => messages.settings.testGitName,
    getDesc: (messages) => messages.settings.testGitDescription,
    getButtonText: (messages) => messages.settings.testGitButton,
    onClick: (plugin) => {
      void plugin.testGitExecutable();
    },
  },
  {
    kind: SettingRowKind.BoundedInteger,
    key: SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
    defaultValue: DEFAULT_SETTINGS.autoFetchIntervalSeconds,
    bounds: {
      min: SETTING_VALIDATION.minimumFetchIntervalSeconds,
      max: SETTING_VALIDATION.maximumFetchIntervalSeconds,
      useTimeoutMessage: false,
    },
    getName: (messages) => messages.settings.fetchIntervalName,
    getDesc: (messages) => messages.settings.fetchIntervalDescription,
    onAfterSave: (plugin) => {
      plugin.restartAutoFetch();
    },
  },
  {
    kind: SettingRowKind.BoundedInteger,
    key: SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes,
    defaultValue: DEFAULT_SETTINGS.autoSyncIntervalMinutes,
    bounds: {
      min: SETTING_VALIDATION.minimumSyncIntervalMinutes,
      max: SETTING_VALIDATION.maximumSyncIntervalMinutes,
      useTimeoutMessage: false,
    },
    getName: (messages) => messages.settings.syncIntervalName,
    getDesc: (messages) => messages.settings.syncIntervalDescription,
    onAfterSave: (plugin) => {
      plugin.restartAutoSync();
    },
  },
  {
    kind: SettingRowKind.BoundedInteger,
    key: SETTING_PROPERTY_KEYS.autoBackupAfterEditMinutes,
    defaultValue: DEFAULT_SETTINGS.autoBackupAfterEditMinutes,
    bounds: {
      min: SETTING_VALIDATION.minimumAutoBackupMinutes,
      max: SETTING_VALIDATION.maximumAutoBackupMinutes,
      useTimeoutMessage: false,
    },
    getName: (messages) => messages.settings.autoBackupAfterEditName,
    getDesc: (messages) => messages.settings.autoBackupAfterEditDescription,
    onAfterSave: (plugin) => {
      plugin.restartAutoBackup();
    },
  },
  {
    kind: SettingRowKind.Toggle,
    key: SETTING_PROPERTY_KEYS.autoPullOnLoad,
    defaultValue: DEFAULT_SETTINGS.autoPullOnLoad,
    getName: (messages) => messages.settings.autoPullOnLoadName,
    getDesc: (messages) => messages.settings.autoPullOnLoadDescription,
  },
  {
    kind: SettingRowKind.Dropdown,
    key: SETTING_PROPERTY_KEYS.pullStrategy,
    defaultValue: DEFAULT_SETTINGS.pullStrategy,
    validValues: VALID_PULL_STRATEGIES,
    getName: (messages) => messages.settings.pullStrategyName,
    getDesc: (messages) => messages.settings.pullStrategyDescription,
    getOptions: (messages) => ({ ...messages.settings.pullStrategyOptions }),
    assign: (settings, value) => {
      settings.pullStrategy = value as PullStrategy;
    },
  },
  {
    kind: SettingRowKind.BoundedInteger,
    key: SETTING_PROPERTY_KEYS.processTimeoutSeconds,
    defaultValue: DEFAULT_SETTINGS.processTimeoutSeconds,
    bounds: {
      min: SETTING_VALIDATION.minimumProcessTimeoutSeconds,
      max: SETTING_VALIDATION.maximumProcessTimeoutSeconds,
      useTimeoutMessage: true,
    },
    getName: (messages) => messages.settings.processTimeoutName,
    getDesc: (messages) => messages.settings.processTimeoutDescription,
  },
  {
    kind: SettingRowKind.Dropdown,
    key: SETTING_PROPERTY_KEYS.autoSyncNotificationMode,
    defaultValue: DEFAULT_SETTINGS.autoSyncNotificationMode,
    validValues: VALID_NOTIFICATION_MODES,
    getName: (messages) => messages.settings.autoSyncNotificationName,
    getDesc: (messages) => messages.settings.autoSyncNotificationDescription,
    getOptions: (messages) => ({ ...messages.settings.autoSyncNotificationOptions }),
    assign: (settings, value) => {
      settings.autoSyncNotificationMode = value as AutoSyncNotificationMode;
    },
  },
  {
    kind: SettingRowKind.Dropdown,
    key: SETTING_PROPERTY_KEYS.statusBarClickAction,
    defaultValue: DEFAULT_SETTINGS.statusBarClickAction,
    validValues: VALID_STATUS_BAR_CLICK_ACTIONS,
    getName: (messages) => messages.settings.statusBarClickActionName,
    getDesc: (messages) => messages.settings.statusBarClickActionDescription,
    getOptions: (messages) => ({ ...messages.settings.statusBarClickActionOptions }),
    assign: (settings, value) => {
      settings.statusBarClickAction = value as StatusBarClickAction;
    },
  },
  {
    kind: SettingRowKind.Toggle,
    key: SETTING_PROPERTY_KEYS.showRibbonIcon,
    defaultValue: DEFAULT_SETTINGS.showRibbonIcon,
    getName: (messages) => messages.settings.showRibbonIconName,
    getDesc: (messages) => messages.settings.showRibbonIconDescription,
    onAfterSave: (plugin) => {
      plugin.updateRibbonIcon();
    },
  },
  {
    kind: SettingRowKind.Text,
    key: SETTING_PROPERTY_KEYS.commitMessageTemplate,
    defaultValue: DEFAULT_SETTINGS.commitMessageTemplate,
    getName: (messages) => messages.settings.commitTemplateName,
    getDesc: (messages) => messages.settings.commitTemplateDescription,
    getPlaceholder: (messages) => messages.defaultCommitMessageTemplate,
    requireNonEmpty: false,
    debouncedExecutableUpdate: false,
  },
];

const SETTING_ROWS_BY_KEY: ReadonlyMap<string, KeyedSettingRow> = new Map(
  SETTING_ROWS.filter(
    (row): row is KeyedSettingRow => row.kind !== SettingRowKind.Button,
  ).map((row) => [row.key, row]),
);

export class GitSettingsTab extends PluginSettingTab {
  private readonly gitPlugin: GitCommandsPlugin;
  private readonly executableDebounceMs: number;
  private pendingExecutableUpdate: PendingExecutableUpdate | null = null;

  public constructor(plugin: GitCommandsPlugin, options?: GitSettingsTabOptions) {
    super(plugin.app, plugin);
    this.gitPlugin = plugin;
    this.executableDebounceMs = Math.max(
      SETTINGS_TAB_NUMERIC.minDebounceMs,
      options?.executableDebounceMs ?? SETTINGS_DEBOUNCE_MS,
    );
  }

  public override getSettingDefinitions(): SettingDefinitionItem[] {
    const { messages } = this.gitPlugin;
    return SETTING_ROWS.map((row) => this.buildSettingDefinition(row, messages));
  }

  public override getControlValue(key: string): unknown {
    const row = SETTING_ROWS_BY_KEY.get(key);
    if (row === undefined) {
      return undefined;
    }
    return this.gitPlugin.settings[row.key];
  }

  public override async setControlValue(key: string, value: unknown): Promise<void> {
    const row = SETTING_ROWS_BY_KEY.get(key);
    if (row === undefined) {
      return;
    }

    switch (row.kind) {
      case SettingRowKind.Text: {
        if (!isStringValue(value)) {
          return;
        }
        const errorMessage = this.validateTextRow(row, value);
        if (errorMessage !== undefined) {
          if (row.debouncedExecutableUpdate) {
            this.cancelPendingExecutableUpdate();
          }
          return;
        }
        await this.applyTextRow(row, value);
        return;
      }
      case SettingRowKind.BoundedInteger: {
        const result = this.validateBoundedInteger(value, row.bounds);
        if (result.parsedValue === undefined) {
          return;
        }
        await this.applyBoundedIntegerRow(row, result.parsedValue);
        return;
      }
      case SettingRowKind.Toggle: {
        if (!isBooleanValue(value)) {
          return;
        }
        await this.applyToggleRow(row, value);
        return;
      }
      case SettingRowKind.Dropdown: {
        if (!isStringValue(value) || !row.validValues.has(value)) {
          return;
        }
        await this.applyDropdownRow(row, value);
        return;
      }
    }
  }

  public override display(): void {
    const { containerEl } = this;
    const { messages } = this.gitPlugin;
    containerEl.empty();

    for (const row of SETTING_ROWS) {
      const setting = new Setting(containerEl)
        .setName(row.getName(messages))
        .setDesc(row.getDesc(messages));
      this.renderDisplayRow(setting, row, messages);
    }
  }

  public override hide(): void {
    void this.executePendingExecutableUpdate();
    if (typeof super.hide === JAVASCRIPT_TYPE_NAMES.function) {
      super.hide();
    }
  }

  private buildSettingDefinition(
    row: SettingRowDescriptor,
    messages: PluginMessages,
  ): SettingDefinitionItem {
    switch (row.kind) {
      case SettingRowKind.Text: {
        const control: SettingTextControl = {
          type: SETTING_CONTROL_TYPES.text,
          key: row.key,
          defaultValue: row.defaultValue,
          placeholder: row.getPlaceholder(messages),
        };
        if (row.requireNonEmpty) {
          control.validate = (value) => this.validateTextRow(row, value);
        }
        return {
          name: row.getName(messages),
          desc: row.getDesc(messages),
          control,
        };
      }
      case SettingRowKind.BoundedInteger: {
        const control: SettingNumberControl = {
          type: SETTING_CONTROL_TYPES.number,
          key: row.key,
          defaultValue: row.defaultValue,
          placeholder: String(row.defaultValue),
          min: row.bounds.min,
          max: row.bounds.max,
          step: SETTINGS_TAB_NUMERIC.integerStep,
          validate: (value) => this.validateBoundedInteger(value, row.bounds).errorMessage,
        };
        return {
          name: row.getName(messages),
          desc: row.getDesc(messages),
          control,
        };
      }
      case SettingRowKind.Toggle:
        return {
          name: row.getName(messages),
          desc: row.getDesc(messages),
          control: {
            type: SETTING_CONTROL_TYPES.toggle,
            key: row.key,
            defaultValue: row.defaultValue,
          },
        };
      case SettingRowKind.Dropdown:
        return {
          name: row.getName(messages),
          desc: row.getDesc(messages),
          control: {
            type: SETTING_CONTROL_TYPES.dropdown,
            key: row.key,
            defaultValue: row.defaultValue,
            options: row.getOptions(messages),
          },
        };
      case SettingRowKind.Button:
        return {
          name: row.getName(messages),
          desc: row.getDesc(messages),
          render: (setting) => {
            this.configureButtonSetting(setting, row, this.gitPlugin.messages);
          },
        };
    }
  }

  private renderDisplayRow(
    setting: Setting,
    row: SettingRowDescriptor,
    messages: PluginMessages,
  ): void {
    switch (row.kind) {
      case SettingRowKind.Button:
        this.configureButtonSetting(setting, row, messages);
        return;
      case SettingRowKind.Toggle:
        setting.addToggle((toggle: ToggleComponent) => {
          toggle.setValue(this.gitPlugin.settings[row.key]).onChange((value) => {
            void this.applyToggleRow(row, value);
          });
        });
        return;
      case SettingRowKind.Dropdown:
        setting.addDropdown((dropdown: DropdownComponent) => {
          dropdown
            .addOptions(row.getOptions(messages))
            .setValue(this.gitPlugin.settings[row.key])
            .onChange((value) => {
              if (row.validValues.has(value)) {
                void this.applyDropdownRow(row, value);
              }
            });
        });
        return;
      case SettingRowKind.Text: {
        const currentValue = this.gitPlugin.settings[row.key];
        this.renderValidatedTextInput(setting, {
          placeholder: row.getPlaceholder(messages),
          initialDisplayValue: currentValue,
          validateInitial: () => this.validateTextRow(row, currentValue),
          onInput: (value) => {
            const errorMessage = this.validateTextRow(row, value);
            if (errorMessage !== undefined) {
              if (row.debouncedExecutableUpdate) {
                this.cancelPendingExecutableUpdate();
              }
              return errorMessage;
            }
            void this.applyTextRow(row, value);
            return undefined;
          },
        });
        return;
      }
      case SettingRowKind.BoundedInteger: {
        const currentValue = this.gitPlugin.settings[row.key];
        this.renderValidatedTextInput(setting, {
          placeholder: String(row.defaultValue),
          initialDisplayValue: String(currentValue),
          validateInitial: () => this.validateBoundedInteger(currentValue, row.bounds).errorMessage,
          onInput: (value) => {
            const result = this.validateBoundedInteger(value, row.bounds);
            if (result.parsedValue === undefined) {
              return result.errorMessage;
            }
            void this.applyBoundedIntegerRow(row, result.parsedValue);
            return undefined;
          },
        });
        return;
      }
    }
  }

  private renderValidatedTextInput(
    setting: Setting,
    options: {
      readonly placeholder: string;
      readonly initialDisplayValue: string;
      readonly validateInitial: () => string | undefined;
      readonly onInput: (value: string) => string | undefined;
    },
  ): void {
    let errorEl: HTMLElement | null = null;
    setting.addText((text: TextComponent) => {
      text
        .setPlaceholder(options.placeholder)
        .setValue(options.initialDisplayValue)
        .onChange((value) => {
          const errorMessage = options.onInput(value);
          errorEl = this.updateValidationDisplay(setting, text.inputEl, errorEl, errorMessage);
        });

      const initialError = options.validateInitial();
      if (initialError !== undefined) {
        errorEl = this.updateValidationDisplay(setting, text.inputEl, errorEl, initialError);
      }
    });
  }

  private configureButtonSetting(
    setting: Setting,
    row: ButtonSettingRow,
    messages: PluginMessages,
  ): void {
    setting.addButton((button: ButtonComponent) => {
      button.setButtonText(row.getButtonText(messages)).onClick(() => {
        row.onClick(this.gitPlugin);
      });
    });
  }

  private validateTextRow(row: TextSettingRow, value: string): string | undefined {
    if (!row.requireNonEmpty) {
      return undefined;
    }
    if (value.trim().length === SETTINGS_TAB_NUMERIC.emptyLength) {
      return this.gitPlugin.messages.settings.invalidExecutableEmpty;
    }
    return undefined;
  }

  private validateBoundedInteger(rawValue: unknown, bounds: IntegerBoundsSpec): ParsedIntegerResult {
    const parsed = this.parseIntegerCandidate(rawValue);
    if (parsed === undefined) {
      return {
        parsedValue: undefined,
        errorMessage: this.getIntegerFormatError(bounds),
      };
    }

    if (parsed < bounds.min) {
      return {
        parsedValue: undefined,
        errorMessage: this.getIntegerFormatError(bounds),
      };
    }

    if (parsed > bounds.max) {
      return {
        parsedValue: undefined,
        errorMessage: this.getIntegerRangeError(bounds),
      };
    }

    return {
      parsedValue:
        parsed === SETTINGS_TAB_NUMERIC.zeroValue ? SETTINGS_TAB_NUMERIC.zeroValue : parsed,
      errorMessage: undefined,
    };
  }

  private parseIntegerCandidate(rawValue: unknown): number | undefined {
    if (isNumberValue(rawValue)) {
      return Number.isFinite(rawValue) && Number.isInteger(rawValue) ? rawValue : undefined;
    }
    if (!isStringValue(rawValue)) {
      return undefined;
    }
    const trimmed = rawValue.trim();
    if (
      trimmed.length === SETTINGS_TAB_NUMERIC.emptyLength ||
      !INTEGER_INPUT_PATTERN.test(trimmed)
    ) {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : undefined;
  }

  private getIntegerFormatError(bounds: IntegerBoundsSpec): string {
    const { settings } = this.gitPlugin.messages;
    return bounds.useTimeoutMessage
      ? settings.invalidTimeoutRange
      : settings.invalidNonNegativeInteger;
  }

  private getIntegerRangeError(bounds: IntegerBoundsSpec): string {
    const { settings } = this.gitPlugin.messages;
    return bounds.useTimeoutMessage ? settings.invalidTimeoutRange : settings.invalidIntervalRange;
  }

  private async applyTextRow(row: TextSettingRow, value: string): Promise<void> {
    if (row.debouncedExecutableUpdate) {
      await this.scheduleGitExecutableUpdate(value.trim());
      return;
    }
    this.gitPlugin.settings[row.key] = value;
    await this.gitPlugin.saveSettings();
  }

  private async applyBoundedIntegerRow(
    row: BoundedIntegerSettingRow,
    parsedValue: number,
  ): Promise<void> {
    this.gitPlugin.settings[row.key] = parsedValue;
    await this.gitPlugin.saveSettings();
    row.onAfterSave?.(this.gitPlugin);
  }

  private async applyToggleRow(row: ToggleSettingRow, value: boolean): Promise<void> {
    this.gitPlugin.settings[row.key] = value;
    await this.gitPlugin.saveSettings();
    row.onAfterSave?.(this.gitPlugin);
  }

  private async applyDropdownRow(row: DropdownSettingRow, value: string): Promise<void> {
    row.assign(this.gitPlugin.settings, value);
    await this.gitPlugin.saveSettings();
  }

  private scheduleGitExecutableUpdate(trimmedExecutable: string): Promise<void> {
    if (this.executableDebounceMs <= SETTINGS_TAB_NUMERIC.minDebounceMs) {
      this.cancelPendingExecutableUpdate();
      return this.gitPlugin.updateGitExecutable(trimmedExecutable);
    }

    return new Promise<void>((resolve, reject) => {
      const existing = this.pendingExecutableUpdate;
      const resolvers = existing?.resolvers ?? [];
      if (existing !== null) {
        window.clearTimeout(existing.timer);
      }
      resolvers.push({ resolve, reject });

      const timer = window.setTimeout(() => {
        void this.executePendingExecutableUpdate();
      }, this.executableDebounceMs);

      this.pendingExecutableUpdate = {
        value: trimmedExecutable,
        timer,
        resolvers,
      };
    });
  }

  private async executePendingExecutableUpdate(): Promise<void> {
    const pending = this.pendingExecutableUpdate;
    if (pending === null) {
      return;
    }
    this.pendingExecutableUpdate = null;
    window.clearTimeout(pending.timer);

    try {
      await this.gitPlugin.updateGitExecutable(pending.value);
      for (const waiter of pending.resolvers) {
        waiter.resolve();
      }
    } catch (error) {
      for (const waiter of pending.resolvers) {
        waiter.reject(error);
      }
    }
  }

  private cancelPendingExecutableUpdate(): void {
    const pending = this.pendingExecutableUpdate;
    if (pending === null) {
      return;
    }
    this.pendingExecutableUpdate = null;
    window.clearTimeout(pending.timer);
    for (const waiter of pending.resolvers) {
      waiter.resolve();
    }
  }

  private updateValidationDisplay(
    setting: Setting,
    inputEl: HTMLInputElement | undefined,
    existingErrorEl: HTMLElement | null,
    errorMessage: string | undefined,
  ): HTMLElement | null {
    const hasError = errorMessage !== undefined;
    this.setElementInvalidState(setting.settingEl, hasError);
    this.setElementInvalidState(inputEl, hasError);

    if (inputEl !== undefined) {
      if (hasError) {
        inputEl.setAttribute(SETTINGS_TAB_DOM.ariaInvalidAttribute, SETTINGS_TAB_DOM.ariaTrue);
      } else {
        inputEl.removeAttribute(SETTINGS_TAB_DOM.ariaInvalidAttribute);
      }
    }

    if (requireApiVersion(OBSIDIAN_API_VERSIONS.settingErrorMessage)) {
      if (typeof setting.setErrorMessage === JAVASCRIPT_TYPE_NAMES.function) {
        setting.setErrorMessage(errorMessage ?? null);
        return existingErrorEl;
      }
    }

    if (!hasError) {
      if (existingErrorEl !== null) {
        existingErrorEl.textContent = PLUGIN_FORMAT.emptyString;
        existingErrorEl.hidden = true;
      }
      return existingErrorEl;
    }

    const errorEl = existingErrorEl ?? this.createValidationErrorElement(setting);
    if (errorEl !== null) {
      errorEl.textContent = errorMessage;
      errorEl.hidden = false;
    }
    return errorEl;
  }

  private setElementInvalidState(element: HTMLElement | undefined, isInvalid: boolean): void {
    if (element === undefined) {
      return;
    }
    if (typeof element.toggleClass === JAVASCRIPT_TYPE_NAMES.function) {
      element.toggleClass(SETTINGS_TAB_CLASSES.invalid, isInvalid);
      return;
    }
    element.classList?.toggle(SETTINGS_TAB_CLASSES.invalid, isInvalid);
  }

  private createValidationErrorElement(setting: Setting): HTMLElement | null {
    const container = setting.infoEl ?? setting.settingEl;
    if (container === undefined || typeof container.createDiv !== JAVASCRIPT_TYPE_NAMES.function) {
      return null;
    }
    const errorEl = container.createDiv({ cls: VALIDATION_ERROR_CLASSES });
    errorEl.setAttribute(SETTINGS_TAB_DOM.roleAttribute, SETTINGS_TAB_DOM.alertRole);
    return errorEl;
  }
}

function isStringValue(value: unknown): value is string {
  return typeof value === JAVASCRIPT_TYPE_NAMES.string;
}

function isNumberValue(value: unknown): value is number {
  return typeof value === JAVASCRIPT_TYPE_NAMES.number;
}

function isBooleanValue(value: unknown): value is boolean {
  return typeof value === JAVASCRIPT_TYPE_NAMES.boolean;
}
