import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import moment from 'moment';
import 'moment/locale/zh-cn';

import enCommon from './locales/en/common.json';
import enNavigation from './locales/en/navigation.json';
import enSettings from './locales/en/settings.json';
import enPage from './locales/en/page.json';
import enAuth from './locales/en/auth.json';
import enHome from './locales/en/home.json';
import enSearch from './locales/en/search.json';

import zhCommon from './locales/zh-CN/common.json';
import zhNavigation from './locales/zh-CN/navigation.json';
import zhSettings from './locales/zh-CN/settings.json';
import zhPage from './locales/zh-CN/page.json';
import zhAuth from './locales/zh-CN/auth.json';
import zhHome from './locales/zh-CN/home.json';
import zhSearch from './locales/zh-CN/search.json';

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
        home: enHome,
        search: enSearch,
      },
      'zh-CN': {
        common: zhCommon,
        navigation: zhNavigation,
        settings: zhSettings,
        page: zhPage,
        auth: zhAuth,
        home: zhHome,
        search: zhSearch,
      },
    },
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'navigation', 'settings', 'page', 'auth', 'home', 'search'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    },
  });

const toMomentLocale = (lng?: string) => (lng?.startsWith('zh') ? 'zh-cn' : 'en');

moment.locale(toMomentLocale(i18n.language));
i18n.on('languageChanged', (lng) => {
  moment.locale(toMomentLocale(lng));
});

export default i18n;
