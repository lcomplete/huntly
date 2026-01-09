import React, { createContext, useContext, useState, ReactNode } from 'react';

export type PrimaryNavItem = 'home' | 'saved' | 'feeds' | 'x' | 'github';

interface NavigationContextType {
  activeNav: PrimaryNavItem;
  setActiveNav: (nav: PrimaryNavItem) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export const NavigationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeNav, setActiveNav] = useState<PrimaryNavItem>('home');

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
