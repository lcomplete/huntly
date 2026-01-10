import React, { createContext, useContext, useState, ReactNode } from 'react';

export type PrimaryNavItem = 'home' | 'saved' | 'feeds' | 'x' | 'github' | 'settings';

interface NavigationContextType {
  activeNav: PrimaryNavItem | null;
  setActiveNav: (nav: PrimaryNavItem | null) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeNav, setActiveNav] = useState<PrimaryNavItem | null>('home');

  return (
    <NavigationContext.Provider value={{ activeNav, setActiveNav }}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
