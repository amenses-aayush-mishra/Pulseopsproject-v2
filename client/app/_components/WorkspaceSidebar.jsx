'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useTheme } from '../theme/ThemeProvider';
import SlackSidebarSection from './SlackSidebarSection';
import { LayoutDashboard, GitBranch, MessagesSquare, ListTodo, BarChart, Hash, Users, FileText, Ticket, Puzzle, Key } from 'lucide-react';

/**
 * TASK-107 — workspace shell sidebar. Rendered by the /workspace/[workspaceId]
 * layout. Consumes the theme engine's CSS custom properties so the brand
 * color (--pulse-primary) and sidebar background (--pulse-sidebar-bg) follow
 * the active organization's themeSettings.
 */
export default function WorkspaceSidebar({ workspaceId, role }) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const base = `/workspace/${workspaceId}`;

  const items = [
    { href: base, label: 'Overview', matchExact: true, icon: LayoutDashboard },
    { href: `${base}/repositories`, label: 'Repositories', icon: GitBranch },
    { href: `${base}/communication`, label: 'Communication', icon: MessagesSquare },
    { href: `${base}/tasks`, label: 'Tasks', icon: ListTodo },
    { href: `${base}/analytics`, label: 'Analytics', icon: BarChart },
    { href: `${base}/channels`, label: 'Channels', icon: Hash },
    { href: `${base}/developers`, label: 'Developers', icon: Users },
    { href: `${base}/reports`, label: 'Reports', icon: FileText },
    { href: `${base}/tickets`, label: 'Tickets', icon: Ticket },
    { href: `${base}/integrations`, label: 'Integrations', icon: Puzzle },
    { href: `${base}/invitation`, label: 'Invitation & Password', icon: Key },
  ];

  const isActive = (item) =>
    item.matchExact
      ? pathname === item.href || pathname === `${item.href}/`
      : pathname.startsWith(item.href);

  const onSignOut = async () => {
    try {
      localStorage.removeItem('pulseops_token');
      sessionStorage.clear();
    } catch (err) {
      // storage unavailable — proceed with sign-out anyway
    }
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col shadow-xl"
      style={{ backgroundColor: 'var(--pulse-sidebar-bg, #1E293B)' }}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: 'var(--pulse-primary, #4F46E5)' }}
        >
          P
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">PulseOps</div>
          <div className="truncate text-[11px] capitalize text-slate-400">
            {role || 'member'}
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item) ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(item)
                ? 'bg-white/10 text-white'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            {item.icon && <item.icon className="h-4 w-4" />}
            {item.label}
          </Link>
        ))}
        {typeof theme?.primaryColor === 'string' && (
          <div className="mt-4 rounded-xl border border-white/10 px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Theme
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="h-4 w-4 rounded-full border border-white/20"
                style={{ backgroundColor: 'var(--pulse-primary, #4F46E5)' }}
                aria-label="Primary color"
              />
              <span
                className="h-4 w-4 rounded-full border border-white/20"
                style={{ backgroundColor: 'var(--pulse-accent, #10B981)' }}
                aria-label="Accent color"
              />
              <span className="text-[11px] text-slate-400">workspace theme</span>
            </div>
          </div>
        )}

        <SlackSidebarSection workspaceId={workspaceId} />
      </nav>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onSignOut}
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}