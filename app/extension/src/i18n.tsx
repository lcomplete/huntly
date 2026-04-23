import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DisplayLanguage } from "./displayLanguage";
import { getBrowserDisplayLanguage } from "./displayLanguage";
import { getDisplayLanguage, saveDisplayLanguage } from "./storage";
import {
  type TranslationKey,
  type TranslationValues,
  translateUi,
} from "./uiMessages";

type I18nContextValue = {
  language: DisplayLanguage;
  setLanguage: (language: DisplayLanguage) => void;
  t: (key: TranslationKey, values?: TranslationValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export const ExtensionI18nProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [language, setLanguageState] = useState<DisplayLanguage>(
    getBrowserDisplayLanguage()
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getDisplayLanguage().then((nextLanguage) => {
      if (cancelled) {
        return;
      }
      setLanguageState(nextLanguage);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback((nextLanguage: DisplayLanguage) => {
    setLanguageState(nextLanguage);
    void saveDisplayLanguage(nextLanguage);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    return {
      language,
      setLanguage,
      t: (key, values) => translateUi(language, key, values),
    };
  }, [language, setLanguage]);

  if (!ready) {
    return null;
  }

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within ExtensionI18nProvider");
  }
  return context;
}