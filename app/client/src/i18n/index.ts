import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enSettings from './locales/en/settings.json';
import enPage from './locales/en/page.json';
import enAuth from './locales/en/auth.json';

import zhCommon from './locales/zh-CN/common.json';
import zhNavigation from './locales/zh-CN/navigation.json';
import zhSettings from './locales/zh-CN/settings.json';
import zhPage from './locales/zh-CN/page.json';
import zhAuth from './locales/zh-CN/auth.json';

export const supportedLanguages = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        navigation: enNavigation,
        settings: enSettings,
        page: enPage,
        auth: enAuth,
      },
      'zh-CN': {
        common: zhCommon,
        navigation: zhNavigation,
        settings: zhSettings,
        page: zhPage,
        auth: zhAuth,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'settings', 'page', 'auth'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

export default i18n;
