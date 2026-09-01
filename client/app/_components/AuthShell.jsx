'use client';

import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footerLink,
  maxWidth = 'max-w-md',
  handwrittenNote,
}) {
  return (
    <div className="min-h-screen bg-[#FAFAFC] dark:bg-[var(--bg)] text-slate-900 dark:text-[var(--text-primary)] flex flex-col justify-between selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900/40 dark:selection:text-indigo-100 transition-colors duration-200">

      {/* ------------ Minimal Top Header Bar ------------ */}
      <header className="px-6 py-6 max-w-7xl w-full mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-sm group-hover:scale-105 transition-all">
            <div className="flex items-center gap-0.5">
              <span className="w-1 h-3.5 bg-white dark:bg-slate-900 rounded-full"></span>
              <span className="w-1 h-5 bg-white dark:bg-slate-900 rounded-full"></span>
              <span className="w-1 h-3.5 bg-white dark:bg-slate-900 rounded-full"></span>
            </div>
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            PulseOps
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* ------------ Main Form Content ------------ */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:px-6">
        <div className={`w-full ${maxWidth} relative`}>

          {/* Optional Handwritten Annotation */}
          {handwrittenNote && (
            <div className="hidden sm:block absolute -top-5 -right-6 rotate-6 z-10 pointer-events-none">
              <span className="font-handwriting text-slate-700 dark:text-amber-900 text-lg font-bold bg-[#FFFDF7] dark:bg-amber-100/90 border border-amber-200/70 dark:border-amber-300/50 px-2.5 py-1 rounded-lg shadow-sm">
                {handwrittenNote}
              </span>
            </div>
          )}

          {/* Card Container */}
          <div className="bg-white dark:bg-[var(--surface)] border border-slate-200/80 dark:border-[var(--border)] rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-md shadow-slate-900/5 dark:shadow-none transition-colors duration-200">

            {/* Header Content */}
            {(eyebrow || title || subtitle) && (
              <div className="text-center mb-6">
                {eyebrow && (
                  <div className="inline-flex items-center gap-1.5 mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-indigo-400 inline-block"></span>
                    <span className="text-[11px] font-bold tracking-widest text-indigo-600 dark:text-indigo-400 uppercase">
                      {eyebrow}
                    </span>
                  </div>
                )}
                {title && (
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-[var(--text-primary)] tracking-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-[var(--text-secondary)] leading-relaxed">
                    {subtitle}
                  </p>
                )}
              </div>
            )}

            {children}

          </div>

          {/* Optional Footer Link Under Card */}
          {footerLink && (
            <div className="mt-6 text-center text-xs sm:text-sm text-slate-600 dark:text-[var(--text-secondary)]">
              {footerLink}
            </div>
          )}

        </div>
      </main>

      {/* ------------ Bottom Footer Strip ------------ */}
      <footer className="px-6 py-6 text-center text-xs text-slate-400 dark:text-[var(--text-muted)]">
        © {new Date().getFullYear()} PulseOps, Inc. All rights reserved.
      </footer>

    </div>
  );
}
