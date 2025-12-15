import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import ThemeProvider from '@/components/providers/ThemeProvider';
import { themeInitScript } from './theme-init-script';

export const metadata: Metadata = {
  title: 'Contract Parser',
  description: 'Parse build contract .eml files and generate spreadsheets',
  icons: {
    icon: '/App.ico',
    shortcut: '/App.ico',
    apple: '/App.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: themeInitScript,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

