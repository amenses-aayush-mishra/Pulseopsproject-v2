'use client';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    const user = session?.user as any;
    if (user?.themeSettings) {
      const root = document.documentElement;
      root.style.setProperty('--primary-color', user.themeSettings.primaryColor || '#3B82F6');
      root.style.setProperty('--sidebar-bg', user.themeSettings.sidebarBg || '#1F2937');
      root.style.setProperty('--accent-color', user.themeSettings.accentColor || '#F59E0B');
    }
  }, [session]);

  return <>{children}</>;
}