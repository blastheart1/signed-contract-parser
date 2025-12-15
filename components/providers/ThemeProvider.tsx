'use client';

import { ThemeProvider as BaseThemeProvider } from '@/lib/themes/themeContext';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Theme Provider wrapper component
 * Wraps the app to provide theme context
 */
export default function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <BaseThemeProvider>
      {children}
    </BaseThemeProvider>
  );
}
