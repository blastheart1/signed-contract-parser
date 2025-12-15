/**
 * Theme initialization script
 * This script runs before React hydration to prevent flash of wrong theme
 * Must be a separate file to be imported as a script
 */

export const themeInitScript = `
(function() {
  try {
    const saved = localStorage.getItem('calimingo-theme-preference');
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
