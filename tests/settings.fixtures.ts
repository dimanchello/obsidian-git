export const SETTINGS_TEST_VALUES = {
  validInput: {
    gitExecutable: ' /custom/git ',
    autoFetchIntervalSeconds: 45.9,
    autoSyncIntervalMinutes: 15.8,
    commitMessageTemplate: 'Backup {datetime}',
  },
  validOutput: {
    gitExecutable: '/custom/git',
    autoFetchIntervalSeconds: 45,
    autoSyncIntervalMinutes: 15,
    commitMessageTemplate: 'Backup {datetime}',
  },
  invalidInput: {
    gitExecutable: ' ',
    autoFetchIntervalSeconds: -1,
    autoSyncIntervalMinutes: -5,
  },
} as const;
