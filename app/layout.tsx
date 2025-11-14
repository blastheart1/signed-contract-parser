import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Calimingo Contract Parser',
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
      <body>{children}</body>
    </html>
  );
}

