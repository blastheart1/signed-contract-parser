'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Theme, ThemeId, getTheme, defaultThemeId } from './themeConfig';
import { getSavedTheme, saveTheme, applyTheme, prefersDarkMode } from './themeUtils';

interface ThemeContextValue {
  theme: Theme;
  themeId: ThemeId;
  setTheme: (themeId: ThemeId) => void;
  isDark: boolean;
  setIsDark: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultThemeId?: ThemeId;
}

export function ThemeProvider({ children, defaultThemeId: providedDefaultThemeId }: ThemeProviderProps) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    // Initialize from localStorage or use default
    if (typeof window !== 'undefined') {
      const saved = getSavedTheme();
      return saved || providedDefaultThemeId || defaultThemeId;
    }
    return providedDefaultThemeId || defaultThemeId;
  });

  // Dark mode disabled - always use light mode
  const [isDark, setIsDarkState] = useState<boolean>(false);

  const theme = getTheme(themeId);

  // Apply theme when themeId or isDark changes
  useEffect(() => {
    applyTheme(theme, isDark);
  }, [theme, isDark]);

  // Dark mode listener removed - dark mode is disabled

  const setTheme = useCallback((newThemeId: ThemeId) => {
    setThemeIdState(newThemeId);
    saveTheme(newThemeId);
  }, []);

  // Dark mode toggle disabled - always keep light mode
  const setIsDark = useCallback((newIsDark: boolean) => {
    // Ignore dark mode changes - always stay in light mode
    // setIsDarkState(newIsDark);
  }, []);

  const value: ThemeContextValue = {
    theme,
    themeId,
    setTheme,
    isDark,
    setIsDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
