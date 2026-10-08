import { describe, expect, it } from 'vitest';
import { getPluginMessages } from '../src/i18n';
import { GitAction } from '../src/plugin-constants';
import { I18N_TEST_VALUES } from './i18n.fixtures';

describe('getPluginMessages', () => {
  it('selects Russian for Obsidian Russian language codes', () => {
    const messages = getPluginMessages(I18N_TEST_VALUES.russianRegionalCode);

    expect(messages.actions.labels[GitAction.Status]).toBe(I18N_TEST_VALUES.russianAction);
    expect(messages.statusModal.cleanWorkingTree).toBe(I18N_TEST_VALUES.russianCleanTitle);
    expect(messages.statusModal.upToDate).toBe(I18N_TEST_VALUES.russianUpToDate);
    expect(messages.statusModal.sectionStaged).toBe(I18N_TEST_VALUES.russianSectionStaged);
  });

  it('selects English for English and unsupported language codes', () => {
    const english = getPluginMessages(I18N_TEST_VALUES.englishRegionalCode);
    const fallback = getPluginMessages(I18N_TEST_VALUES.unsupportedLanguageCode);

    expect(english.actions.labels[GitAction.Status]).toBe(I18N_TEST_VALUES.englishAction);
    expect(english.statusModal.cleanWorkingTree).toBe(I18N_TEST_VALUES.englishCleanTitle);
    expect(english.statusModal.upToDate).toBe(I18N_TEST_VALUES.englishUpToDate);
    expect(english.statusModal.sectionStaged).toBe(I18N_TEST_VALUES.englishSectionStaged);
    expect(fallback.actions.labels[GitAction.Status]).toBe(I18N_TEST_VALUES.englishAction);
    expect(fallback.statusModal.cleanWorkingTree).toBe(I18N_TEST_VALUES.englishCleanTitle);
  });
});
