/**
 * Utility functions for theme management
 */

import { Theme, ThemeId, getTheme } from './themeConfig';

const THEME_STORAGE_KEY = 'calimingo-theme-preference';

/**
 * Get saved theme preference from localStorage
 */
export function getSavedTheme(): ThemeId | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved && (saved === 'original' || saved === 'calimingo' || saved === 'apple')) {
      return saved as ThemeId;
    }
  } catch (error) {
    console.error('Error reading theme preference:', error);
  }

  return null;
}

/**
 * Save theme preference to localStorage
 */
export function saveTheme(themeId: ThemeId): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch (error) {
    console.error('Error saving theme preference:', error);
  }
}

/**
 * Apply theme to document root via CSS variables
 */
export function applyTheme(theme: Theme, isDark: boolean = false): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const colors = isDark ? theme.darkColors : theme.colors;

  // Apply color variables
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-foreground', colors.primaryForeground);
  root.style.setProperty('--background', colors.background);
  root.style.setProperty('--foreground', colors.foreground);
  root.style.setProperty('--card', colors.card);
  root.style.setProperty('--card-foreground', colors.cardForeground);
  root.style.setProperty('--popover', colors.popover);
  root.style.setProperty('--popover-foreground', colors.popoverForeground);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
  root.style.setProperty('--muted', colors.muted);
  root.style.setProperty('--muted-foreground', colors.mutedForeground);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-foreground', colors.accentForeground);
  root.style.setProperty('--destructive', colors.destructive);
  root.style.setProperty('--destructive-foreground', colors.destructiveForeground);
  root.style.setProperty('--border', colors.border);
  root.style.setProperty('--input', colors.input);
  root.style.setProperty('--ring', colors.ring);
  root.style.setProperty('--radius', colors.radius);

  // Apply typography
  root.style.setProperty('--font-body', theme.typography.bodyFont);
  root.style.setProperty('--font-heading', theme.typography.headingFont);

  // Set data attribute for theme-specific styling
  root.setAttribute('data-theme', theme.id);
}

/**
 * Detect system dark mode preference
 */
export function prefersDarkMode(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Initialize theme on page load (for SSR prevention of flash)
 * Should be called in a script tag in the document head
 */
export function initThemeScript(): string {
  return `
    (function() {
      try {
        const saved = localStorage.getItem('${THEME_STORAGE_KEY}');
        const themeId = saved && (saved === 'original' || saved === 'calimingo' || saved === 'apple') 
          ? saved 
          : 'calimingo';
        
        const themes = {
          original: {
            colors: {
              primary: '0 0% 9%',
              primaryForeground: '0 0% 98%',
              background: '0 0% 100%',
              foreground: '0 0% 3.9%',
              card: '0 0% 100%',
              cardForeground: '0 0% 3.9%',
              popover: '0 0% 100%',
              popoverForeground: '0 0% 3.9%',
              secondary: '0 0% 96.1%',
              secondaryForeground: '0 0% 9%',
              muted: '0 0% 96.1%',
              mutedForeground: '0 0% 45.1%',
              accent: '0 0% 96.1%',
              accentForeground: '0 0% 9%',
              destructive: '0 84.2% 60.2%',
              destructiveForeground: '0 0% 98%',
              border: '0 0% 89.8%',
              input: '0 0% 89.8%',
              ring: '0 0% 3.9%',
              radius: '0.5rem'
            },
            typography: {
              bodyFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
              headingFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
            }
          },
          calimingo: {
            colors: {
              primary: '220 50% 30%',
              primaryForeground: '0 0% 98%',
              background: '210 20% 98%',
              foreground: '0 0% 3.9%',
              card: '0 0% 100%',
              cardForeground: '0 0% 3.9%',
              popover: '0 0% 100%',
              popoverForeground: '0 0% 3.9%',
              secondary: '0 0% 96.1%',
              secondaryForeground: '0 0% 9%',
              muted: '210 20% 96%',
              mutedForeground: '0 0% 45.1%',
              accent: '220 30% 96%',
              accentForeground: '0 0% 9%',
              destructive: '0 84.2% 60.2%',
              destructiveForeground: '0 0% 98%',
              border: '210 15% 85%',
              input: '210 15% 85%',
              ring: '220 50% 30%',
              radius: '0.5rem'
            },
            typography: {
              bodyFont: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              headingFont: '"Oswald", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }
          },
          apple: {
            colors: {
              primary: '210 100% 50%',
              primaryForeground: '0 0% 100%',
              background: '0 0% 100%',
              foreground: '0 0% 3.9%',
              card: '0 0% 100%',
              cardForeground: '0 0% 3.9%',
              popover: '0 0% 100%',
              popoverForeground: '0 0% 3.9%',
              secondary: '0 0% 96%',
              secondaryForeground: '210 100% 50%',
              muted: '0 0% 98%',
              mutedForeground: '0 0% 45%',
              accent: '0 0% 96%',
              accentForeground: '210 100% 50%',
              destructive: '0 84.2% 60.2%',
              destructiveForeground: '0 0% 100%',
              border: '0 0% 88%',
              input: '0 0% 88%',
              ring: '210 100% 50%',
              radius: '0.75rem'
            },
            typography: {
              bodyFont: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
              headingFont: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif'
            }
          }
        };
        
        const theme = themes[themeId];
        const root = document.documentElement;
        
        root.style.setProperty('--primary', theme.colors.primary);
        root.style.setProperty('--primary-foreground', theme.colors.primaryForeground);
        root.style.setProperty('--background', theme.colors.background);
        root.style.setProperty('--foreground', theme.colors.foreground);
        root.style.setProperty('--card', theme.colors.card);
        root.style.setProperty('--card-foreground', theme.colors.cardForeground);
        root.style.setProperty('--popover', theme.colors.popover);
        root.style.setProperty('--popover-foreground', theme.colors.popoverForeground);
        root.style.setProperty('--secondary', theme.colors.secondary);
        root.style.setProperty('--secondary-foreground', theme.colors.secondaryForeground);
        root.style.setProperty('--muted', theme.colors.muted);
        root.style.setProperty('--muted-foreground', theme.colors.mutedForeground);
        root.style.setProperty('--accent', theme.colors.accent);
        root.style.setProperty('--accent-foreground', theme.colors.accentForeground);
        root.style.setProperty('--destructive', theme.colors.destructive);
        root.style.setProperty('--destructive-foreground', theme.colors.destructiveForeground);
        root.style.setProperty('--border', theme.colors.border);
        root.style.setProperty('--input', theme.colors.input);
        root.style.setProperty('--ring', theme.colors.ring);
        root.style.setProperty('--radius', theme.colors.radius);
        root.style.setProperty('--font-body', theme.typography.bodyFont);
        root.style.setProperty('--font-heading', theme.typography.headingFont);
        root.setAttribute('data-theme', themeId);
      } catch (e) {
        console.error('Error initializing theme:', e);
      }
    })();
  `;
}
