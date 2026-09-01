import './globals.css';
import { ThemeProvider } from 'next-themes';
import Providers from './providers';

export const metadata = {
  title: 'PulseOps',
  description: 'PulseOps MVP',
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning is REQUIRED: next-themes modifies the `class`
    // attribute on <html> before React mounts (to prevent FOUC), which would
    // otherwise trigger a hydration mismatch warning.
    <html lang="en" suppressHydrationWarning>
      <body>
        {/*
          ThemeProvider from next-themes:
          - attribute="class"   → writes class="dark" on <html> (Tailwind darkMode: 'class')
          - defaultTheme="system" → respects OS preference as initial default
          - enableSystem        → actively tracks prefers-color-scheme changes
          - storageKey          → localStorage key (default: "theme")
        */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="pulseops-theme"
        >
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
