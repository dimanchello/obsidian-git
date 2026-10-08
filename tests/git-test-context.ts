export const GIT_TEST_ENVIRONMENT = {
  absoluteExecutable: '/usr/bin/git',
  executable: 'git',
  unavailableExecutable: 'git-executable-that-does-not-exist',
  nodeExecutable: process.execPath,
  vaultPath: '/vault',
} as const;
