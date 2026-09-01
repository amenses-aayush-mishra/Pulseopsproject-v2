"use client";

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * ThemeToggle — reusable sun/moon toggle button.
 *
 * Placement: Landing page navbar, AuthShell header, WorkspaceTopBar.
 *
 * The `mounted` guard is REQUIRED for next-themes: on SSR the resolvedTheme
 * is undefined (we don't know if the user prefers dark until the browser
 * runs). Rendering a placeholder div with the same dimensions prevents layout
 * shift during hydration.
 */
export default function ThemeToggle({ className = '' }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Placeholder with same dimensions — prevents layout shift
    return <div className={`w-9 h-9 shrink-0 ${className}`} aria-hidden="true" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`
        relative w-9 h-9 shrink-0 rounded-xl flex items-center justify-center
        border border-slate-200 dark:border-[#3D3F41]
        bg-white dark:bg-[#282A2B]
        text-slate-500 dark:text-[#9CA0A3]
        hover:bg-slate-50 dark:hover:bg-[#333537]
        hover:text-slate-700 dark:hover:text-[#F2F2F3]
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-1
        focus:ring-offset-[var(--bg)]
        shadow-sm
        ${className}
      `}
    >
      {/* Icon container — rotates on theme change for a smooth animation */}
      <span
        className="flex items-center justify-center transition-all duration-300 ease-in-out"
        style={{
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.9)',
          opacity: mounted ? 1 : 0,
        }}
      >
        {isDark ? (
          <Sun className="w-4 h-4" />
        ) : (
          <Moon className="w-4 h-4" />
        )}
      </span>
    </button>
  );
}
