import { describe, expect, it } from 'vitest';
import {
  createDefaultSettings,
  DEFAULT_SETTINGS,
  parseSettings,
  SETTING_VALIDATION,
} from '../src/settings';
import { SETTINGS_TEST_VALUES } from './settings.fixtures';

describe('createDefaultSettings', () => {
  it('returns default settings and applies an optional commit template', () => {
    const custom = createDefaultSettings(SETTINGS_TEST_VALUES.customTemplate);

    expect(createDefaultSettings()).toEqual(DEFAULT_SETTINGS);
    expect(custom.commitMessageTemplate).toBe(SETTINGS_TEST_VALUES.customTemplate);
    expect(custom.gitExecutable).toBe(DEFAULT_SETTINGS.gitExecutable);
  });
});

describe('parseSettings', () => {
  it('provides defaults for a fresh installation', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('sanitizes invalid stored values and keeps valid settings', () => {
    expect(parseSettings(SETTINGS_TEST_VALUES.validInput)).toEqual(SETTINGS_TEST_VALUES.validOutput);
    expect(parseSettings(SETTINGS_TEST_VALUES.invalidInput)).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps numeric intervals and timeouts at their upper bounds', () => {
    const parsed = parseSettings(SETTINGS_TEST_VALUES.overflowInput);

    expect(parsed.autoFetchIntervalSeconds).toBe(SETTING_VALIDATION.maximumFetchIntervalSeconds);
    expect(parsed.autoSyncIntervalMinutes).toBe(SETTING_VALIDATION.maximumSyncIntervalMinutes);
    expect(parsed.autoBackupAfterEditMinutes).toBe(SETTING_VALIDATION.maximumAutoBackupMinutes);
    expect(parsed.processTimeoutSeconds).toBe(SETTING_VALIDATION.maximumProcessTimeoutSeconds);
  });

  it('clamps fractional positive zero-minimum intervals to 1 instead of disabling', () => {
    const parsed = parseSettings(SETTINGS_TEST_VALUES.fractionalPositiveInput);

    expect(parsed.autoFetchIntervalSeconds).toBe(SETTING_VALIDATION.minimumPositiveInterval);
    expect(parsed.autoSyncIntervalMinutes).toBe(SETTING_VALIDATION.minimumPositiveInterval);
    expect(parsed.autoBackupAfterEditMinutes).toBe(SETTING_VALIDATION.minimumPositiveInterval);
  });

  it('preserves explicit zero intervals without negative zero and enforces minimum timeout', () => {
    const zeroParsed = parseSettings(SETTINGS_TEST_VALUES.zeroInput);
    const minTimeoutParsed = parseSettings(SETTINGS_TEST_VALUES.minimumTimeoutInput);

    expect(Object.is(zeroParsed.autoFetchIntervalSeconds, SETTING_VALIDATION.minimumFetchIntervalSeconds)).toBe(true);
    expect(zeroParsed.autoSyncIntervalMinutes).toBe(SETTING_VALIDATION.minimumSyncIntervalMinutes);
    expect(zeroParsed.autoBackupAfterEditMinutes).toBe(SETTING_VALIDATION.minimumAutoBackupMinutes);
    expect(minTimeoutParsed.processTimeoutSeconds).toBe(SETTINGS_TEST_VALUES.minimumTimeoutExpected);
  });

  it('accepts all supported enum values and preserves custom fallback defaults', () => {
    const parsed = parseSettings(SETTINGS_TEST_VALUES.enumOverrideInput);
    const customDefaults = createDefaultSettings(SETTINGS_TEST_VALUES.customDefaultsTemplate);
    const fallbackParsed = parseSettings(SETTINGS_TEST_VALUES.invalidInput, customDefaults);

    expect(parsed.pullStrategy).toBe(SETTINGS_TEST_VALUES.enumOverrideInput.pullStrategy);
    expect(parsed.autoSyncNotificationMode).toBe(
      SETTINGS_TEST_VALUES.enumOverrideInput.autoSyncNotificationMode,
    );
    expect(parsed.statusBarClickAction).toBe(
      SETTINGS_TEST_VALUES.enumOverrideInput.statusBarClickAction,
    );
    expect(fallbackParsed).toEqual(customDefaults);
  });
});
