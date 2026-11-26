import { describe, expect, it } from 'vitest';
import { getPluginMessages } from '../src/i18n';
import { PullStrategy } from '../src/git/git-constants';
import { ChangeKind } from '../src/git/status-parser';
import {
  GIT_ACTION_COMMAND_IDS,
  GIT_ACTION_ICONS,
  GIT_ACTION_ORDER,
  GitAction,
  PLUGIN_FORMAT,
} from '../src/plugin-constants';
import { AutoSyncNotificationMode, StatusBarClickAction } from '../src/settings';
import { I18N_TEST_VALUES } from './i18n.fixtures';

function expectAllStringsNonEmpty(values: readonly string[]): void {
  for (const text of values) {
    expect(text.length).toBeGreaterThan(I18N_TEST_VALUES.emptyLength);
  }
}

describe('getPluginMessages', () => {
  it('selects Russian for Obsidian Russian language codes with hyphen or underscore separators', () => {
    for (const code of [
      I18N_TEST_VALUES.russianCode,
      I18N_TEST_VALUES.russianRegionalCode,
      I18N_TEST_VALUES.russianUnderscoreCode,
      I18N_TEST_VALUES.russianUntrimmedCode,
    ]) {
      const messages = getPluginMessages(code);

      expect(messages.actions.labels[GitAction.Status]).toBe(I18N_TEST_VALUES.russianAction);
      expect(messages.actions.labels[GitAction.CommitWithMessage]).toBe(
        I18N_TEST_VALUES.russianCommitWithMessage,
      );
      expect(messages.actions.labels[GitAction.PushOnly]).toBe(I18N_TEST_VALUES.russianPushOnly);
      expect(messages.actions.labels[GitAction.History]).toBe(I18N_TEST_VALUES.russianHistory);
      expect(messages.actions.labels[GitAction.ShowLastError]).toBe(
        I18N_TEST_VALUES.russianShowLastError,
      );
      expect(messages.actions.labels[GitAction.Init]).toBe(I18N_TEST_VALUES.russianInit);
      expect(messages.actions.labels[GitAction.Abort]).toBe(I18N_TEST_VALUES.russianAbortAction);
      expect(messages.ui.operationAborted).toBe(I18N_TEST_VALUES.russianOperationAborted);
      expect(messages.ui.exitCodeFallback).toBe(I18N_TEST_VALUES.russianExitCodeFallback);
      expect(messages.statusModal.cleanWorkingTree).toBe(I18N_TEST_VALUES.russianCleanTitle);
      expect(messages.statusModal.upToDate).toBe(I18N_TEST_VALUES.russianUpToDate);
      expect(messages.statusModal.noUpstream).toBe(I18N_TEST_VALUES.russianNoUpstream);
      expect(messages.statusModal.renamedFromPrefix).toBe(
        I18N_TEST_VALUES.russianRenamedFromPrefix,
      );
      expect(messages.statusModal.sectionStaged).toBe(I18N_TEST_VALUES.russianSectionStaged);
      expect(messages.modals.commitMessage.title).toBe(I18N_TEST_VALUES.russianCommitModalTitle);
      expect(messages.modals.diff.emptyDiff).toBe(I18N_TEST_VALUES.russianDiffEmpty);
      expect(messages.modals.errorLog.title).toBe(I18N_TEST_VALUES.russianErrorLogTitle);
      expect(messages.modals.confirmDiscard.title).toBe(I18N_TEST_VALUES.russianConfirmDiscardTitle);
    }
  });

  it('selects English for English and unsupported language codes', () => {
    for (const code of [
      I18N_TEST_VALUES.englishRegionalCode,
      I18N_TEST_VALUES.englishUnderscoreCode,
      I18N_TEST_VALUES.unsupportedLanguageCode,
      I18N_TEST_VALUES.emptyLanguageCode,
    ]) {
      const messages = getPluginMessages(code);

      expect(messages.actions.labels[GitAction.Status]).toBe(I18N_TEST_VALUES.englishAction);
      expect(messages.actions.labels[GitAction.CommitWithMessage]).toBe(
        I18N_TEST_VALUES.englishCommitWithMessage,
      );
      expect(messages.actions.labels[GitAction.PushOnly]).toBe(I18N_TEST_VALUES.englishPushOnly);
      expect(messages.actions.labels[GitAction.History]).toBe(I18N_TEST_VALUES.englishHistory);
      expect(messages.actions.labels[GitAction.ShowLastError]).toBe(
        I18N_TEST_VALUES.englishShowLastError,
      );
      expect(messages.actions.labels[GitAction.Init]).toBe(I18N_TEST_VALUES.englishInit);
      expect(messages.actions.labels[GitAction.Abort]).toBe(I18N_TEST_VALUES.englishAbortAction);
      expect(messages.ui.operationAborted).toBe(I18N_TEST_VALUES.englishOperationAborted);
      expect(messages.ui.exitCodeFallback).toBe(I18N_TEST_VALUES.englishExitCodeFallback);
      expect(messages.statusModal.cleanWorkingTree).toBe(I18N_TEST_VALUES.englishCleanTitle);
      expect(messages.statusModal.upToDate).toBe(I18N_TEST_VALUES.englishUpToDate);
      expect(messages.statusModal.noUpstream).toBe(I18N_TEST_VALUES.englishNoUpstream);
      expect(messages.statusModal.renamedFromPrefix).toBe(
        I18N_TEST_VALUES.englishRenamedFromPrefix,
      );
      expect(messages.statusModal.sectionStaged).toBe(I18N_TEST_VALUES.englishSectionStaged);
      expect(messages.modals.commitMessage.title).toBe(I18N_TEST_VALUES.englishCommitModalTitle);
      expect(messages.modals.diff.emptyDiff).toBe(I18N_TEST_VALUES.englishDiffEmpty);
      expect(messages.modals.errorLog.title).toBe(I18N_TEST_VALUES.englishErrorLogTitle);
      expect(messages.modals.confirmDiscard.title).toBe(I18N_TEST_VALUES.englishConfirmDiscardTitle);
    }
  });

  it('covers all GitAction constants, option labels, and modal keys in both locales', () => {
    const allActions = Object.values(GitAction);
    expect(new Set(GIT_ACTION_ORDER)).toEqual(new Set(allActions));
    expect(GIT_ACTION_ORDER.length).toBe(allActions.length);

    for (const localeCode of [I18N_TEST_VALUES.englishRegionalCode, I18N_TEST_VALUES.russianCode]) {
      const messages = getPluginMessages(localeCode);

      for (const action of allActions) {
        expect(GIT_ACTION_COMMAND_IDS[action].length).toBeGreaterThan(I18N_TEST_VALUES.emptyLength);
        expect(GIT_ACTION_ICONS[action].length).toBeGreaterThan(I18N_TEST_VALUES.emptyLength);
        expect(messages.actions.labels[action].length).toBeGreaterThan(
          I18N_TEST_VALUES.emptyLength,
        );
      }

      expect(messages.actions.success[GitAction.Status]).toBe(PLUGIN_FORMAT.emptyString);
      expect(messages.actions.progress[GitAction.Abort]).toBe(PLUGIN_FORMAT.emptyString);

      for (const strategy of Object.values(PullStrategy)) {
        expect(messages.settings.pullStrategyOptions[strategy].length).toBeGreaterThan(
          I18N_TEST_VALUES.emptyLength,
        );
      }
      for (const mode of Object.values(AutoSyncNotificationMode)) {
        expect(messages.settings.autoSyncNotificationOptions[mode].length).toBeGreaterThan(
          I18N_TEST_VALUES.emptyLength,
        );
      }
      for (const clickAction of Object.values(StatusBarClickAction)) {
        expect(messages.settings.statusBarClickActionOptions[clickAction].length).toBeGreaterThan(
          I18N_TEST_VALUES.emptyLength,
        );
      }

      for (const changeKind of Object.values(ChangeKind)) {
        expect(messages.changeLabels[changeKind].length).toBeGreaterThan(
          I18N_TEST_VALUES.emptyLength,
        );
      }

      expectAllStringsNonEmpty(Object.values(messages.ui));
      expectAllStringsNonEmpty(Object.values(messages.statusModal));
      expectAllStringsNonEmpty(Object.values(messages.modals.commitMessage));
      expectAllStringsNonEmpty(Object.values(messages.modals.diff));
      expectAllStringsNonEmpty(Object.values(messages.modals.history));
      expectAllStringsNonEmpty(Object.values(messages.modals.errorLog));
      expectAllStringsNonEmpty(Object.values(messages.modals.confirmDiscard));
      expect(messages.defaultCommitMessageTemplate.length).toBeGreaterThan(
        I18N_TEST_VALUES.emptyLength,
      );
    }
  });
});
