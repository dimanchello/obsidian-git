import { PluginLanguage } from './language';
import { ENGLISH_MESSAGES } from './en';
import { RUSSIAN_MESSAGES } from './ru';
import type { PluginMessages } from './types';

const LOCALE_TAG_SEPARATOR = '-';

const LOCALE_MESSAGES: Readonly<Record<PluginLanguage, PluginMessages>> = {
  [PluginLanguage.English]: ENGLISH_MESSAGES,
  [PluginLanguage.Russian]: RUSSIAN_MESSAGES,
};

export function getPluginMessages(languageCode: string): PluginMessages {
  const primaryLanguageCode = languageCode.trim().toLowerCase().split(LOCALE_TAG_SEPARATOR)[0];
  const language =
    primaryLanguageCode === PluginLanguage.Russian
      ? PluginLanguage.Russian
      : PluginLanguage.English;
  return LOCALE_MESSAGES[language];
}
