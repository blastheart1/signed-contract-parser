/**
 * Theme configuration for the application
 * Defines three themes: Original, Calimingo, and Apple
 */

export type ThemeId = 'original' | 'calimingo' | 'apple';

export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  radius: string;
}

export interface ThemeTypography {
  bodyFont: string;
  headingFont: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: ThemeColors;
  darkColors: ThemeColors;
  typography: ThemeTypography;
}

/**
 * Original Theme (Pre-Calimingo)
 * Neutral grays, system fonts, clean and minimal
 */
export const originalTheme: Theme = {
  id: 'original',
  name: 'Original',
  description: 'The original design with system fonts and neutral colors',
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
    radius: '0.5rem',
  },
  darkColors: {
    primary: '0 0% 98%',
    primaryForeground: '0 0% 9%',
    background: '0 0% 3.9%',
    foreground: '0 0% 98%',
    card: '0 0% 3.9%',
    cardForeground: '0 0% 98%',
    popover: '0 0% 3.9%',
    popoverForeground: '0 0% 98%',
    secondary: '0 0% 14.9%',
    secondaryForeground: '0 0% 98%',
    muted: '0 0% 14.9%',
    mutedForeground: '0 0% 63.9%',
    accent: '0 0% 14.9%',
    accentForeground: '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '0 0% 98%',
    border: '0 0% 14.9%',
    input: '0 0% 14.9%',
    ring: '0 0% 83.1%',
    radius: '0.5rem',
  },
  typography: {
    bodyFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    headingFont: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
};

/**
 * Calimingo Theme (Current)
 * Navy blue primary, warm tones, Oswald/Poppins fonts
 */
export const calimingoTheme: Theme = {
  id: 'calimingo',
  name: 'Calimingo',
  description: 'Navy blue design with luxury pool builder aesthetic',
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
    radius: '0.5rem',
  },
  darkColors: {
    primary: '220 50% 40%',
    primaryForeground: '0 0% 98%',
    background: '210 20% 12%',
    foreground: '0 0% 98%',
    card: '210 15% 18%',
    cardForeground: '0 0% 98%',
    popover: '210 15% 18%',
    popoverForeground: '0 0% 98%',
    secondary: '210 15% 25%',
    secondaryForeground: '0 0% 98%',
    muted: '210 15% 20%',
    mutedForeground: '0 0% 65%',
    accent: '220 30% 25%',
    accentForeground: '0 0% 98%',
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '0 0% 98%',
    border: '210 15% 25%',
    input: '210 15% 25%',
    ring: '220 50% 40%',
    radius: '0.5rem',
  },
  typography: {
    bodyFont: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headingFont: '"Oswald", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
};

/**
 * Apple Theme (New)
 * Clean, minimal aesthetic inspired by Apple's Human Interface Guidelines
 * SF Pro typography with Regular/Medium/Semibold weights
 * Blue text on grey backgrounds for selections (Apple's signature style)
 */
export const appleTheme: Theme = {
  id: 'apple',
  name: 'Apple',
  description: 'Clean, minimal design inspired by Apple\'s Human Interface Guidelines',
  colors: {
    primary: '210 100% 50%', // Modern macOS systemBlue (#007AFF) for buttons
    primaryForeground: '0 0% 100%', // White text on blue buttons
    background: '0 0% 100%', // Pure white
    foreground: '0 0% 3.9%', // Near black text
    card: '0 0% 100%', // White cards
    cardForeground: '0 0% 3.9%',
    popover: '0 0% 100%',
    popoverForeground: '0 0% 3.9%',
    secondary: '0 0% 96%', // Light grey background for selections
    secondaryForeground: '210 100% 50%', // Blue text on grey (Apple's signature)
    muted: '0 0% 98%', // Very light grey for subtle backgrounds
    mutedForeground: '0 0% 45%', // Medium grey text
    accent: '0 0% 96%', // Light grey for hover states
    accentForeground: '210 100% 50%', // Blue text on grey accents
    destructive: '0 84.2% 60.2%',
    destructiveForeground: '0 0% 100%',
    border: '0 0% 88%', // Subtle borders
    input: '0 0% 88%',
    ring: '210 100% 50%', // Modern macOS blue focus ring
    radius: '0.75rem', // More rounded corners (Apple style)
  },
  darkColors: {
    primary: '210 100% 55%', // Slightly lighter blue for dark mode buttons
    primaryForeground: '0 0% 100%', // White text on blue buttons
    background: '0 0% 8%', // Very dark grey
    foreground: '0 0% 98%', // White text
    card: '0 0% 10%', // Slightly lighter than background
    cardForeground: '0 0% 98%', // White text
    popover: '0 0% 10%',
    popoverForeground: '0 0% 98%', // White text
    secondary: '0 0% 18%', // Dark grey for selections
    secondaryForeground: '210 100% 60%', // Blue text on dark grey
    muted: '0 0% 15%', // Dark grey backgrounds
    mutedForeground: '0 0% 75%', // Lighter grey text for better contrast
    accent: '0 0% 18%', // Dark grey for hover
    accentForeground: '210 100% 60%', // Blue text
    destructive: '0 62.8% 30.6%',
    destructiveForeground: '0 0% 98%', // White text
    border: '0 0% 25%', // Subtle dark borders
    input: '0 0% 25%',
    ring: '210 100% 55%', // Modern macOS blue focus ring
    radius: '0.75rem',
  },
  typography: {
    // SF Pro Regular (400) for body, Medium (500) for emphasis, Semibold (600) for headings
    bodyFont: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
    headingFont: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
};

/**
 * All available themes
 */
export const themes: Record<ThemeId, Theme> = {
  original: originalTheme,
  calimingo: calimingoTheme,
  apple: appleTheme,
};

/**
 * Default theme ID
 */
export const defaultThemeId: ThemeId = 'calimingo';

/**
 * Get theme by ID
 */
export function getTheme(themeId: ThemeId): Theme {
  return themes[themeId] || themes[defaultThemeId];
}

/**
 * Get all theme IDs
 */
export function getAllThemeIds(): ThemeId[] {
  return Object.keys(themes) as ThemeId[];
}
