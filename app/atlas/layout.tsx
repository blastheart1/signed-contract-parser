import type { Metadata } from 'next';
import AtlasShell from './_shell';

export const metadata: Metadata = {
  title: 'Calimingo Atlas',
  description: 'Calimingo Internal HR & Onboarding Platform',
  icons: {
    icon: '/Calimingo.png',
    shortcut: '/Calimingo.png',
    apple: '/Calimingo.png',
  },
};

export default function AtlasLayout({ children }: { children: React.ReactNode }) {
  return <AtlasShell>{children}</AtlasShell>;
}
