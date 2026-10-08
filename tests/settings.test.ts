import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../src/settings';
import { SETTINGS_TEST_VALUES } from './settings.fixtures';

describe('parseSettings', () => {
  it('provides defaults for a fresh installation', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('sanitizes invalid stored values and keeps valid settings', () => {
    expect(parseSettings(SETTINGS_TEST_VALUES.validInput)).toEqual(SETTINGS_TEST_VALUES.validOutput);
    expect(parseSettings(SETTINGS_TEST_VALUES.invalidInput)).toEqual(DEFAULT_SETTINGS);
  });
});
