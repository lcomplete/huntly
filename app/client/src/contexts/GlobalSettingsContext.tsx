import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SettingControllerApiFactory } from '../api';

interface GlobalSettingsContextType {
  markReadOnScroll: boolean;
  setMarkReadOnScroll: (value: boolean) => void;
  refreshSettings: () => void;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextType | undefined>(undefined);

interface GlobalSettingsProviderProps {
  children: ReactNode;
}

export const GlobalSettingsProvider: React.FC<GlobalSettingsProviderProps> = ({ children }) => {
  const [markReadOnScroll, setMarkReadOnScroll] = useState(false);

  const refreshSettings = async () => {
    try {
      const res = await SettingControllerApiFactory().getGlobalSettingUsingGET();
      setMarkReadOnScroll((res.data as any).markReadOnScroll || false);
    } catch (err) {
      console.error('Failed to load global settings:', err);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const value: GlobalSettingsContextType = {
    markReadOnScroll,
    setMarkReadOnScroll,
    refreshSettings,
  };

  return (
    <GlobalSettingsContext.Provider value={value}>
      {children}
    </GlobalSettingsContext.Provider>
  );
};

export const useGlobalSettings = (): GlobalSettingsContextType => {
  const context = useContext(GlobalSettingsContext);
  if (context === undefined) {
    throw new Error('useGlobalSettings must be used within a GlobalSettingsProvider');
  }
  return context;
}; 