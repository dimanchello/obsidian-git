import { SETTING_PROPERTY_KEYS } from '../src/settings';

export const SETTINGS_TAB_TEST_CONSTANTS = {
  definitionsCount: 4,
  testExecutable: '/usr/local/bin/git',
  trimmedExecutable: '/opt/git/bin/git',
  whitespaceExecutable: '  /opt/git/bin/git  ',
  testFetchInterval: 60,
  testSyncInterval: 30,
  invalidInterval: -10,
  testCommitTemplate: 'chore: update {datetime}',
} as const;

export const SETTINGS_TAB_EXPECTED_KEYS = [
  SETTING_PROPERTY_KEYS.gitExecutable,
  SETTING_PROPERTY_KEYS.autoFetchIntervalSeconds,
  SETTING_PROPERTY_KEYS.autoSyncIntervalMinutes,
  SETTING_PROPERTY_KEYS.commitMessageTemplate,
] as const;
