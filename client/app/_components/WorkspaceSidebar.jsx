'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import SlackSidebarSection from './SlackSidebarSection';
import {
  LayoutDashboard,
  GitBranch,
  MessagesSquare,
  ListTodo,
  BarChart,
  Users,
  UserPlus,
  FileText,
  Ticket,
  Puzzle,
  Key,
  FolderKanban,
} from 'lucide-react';

export default function WorkspaceSidebar({ workspaceId, role }) {
  const pathname = usePathname();
  const base = `/workspace/${workspaceId}`;
  const userRole = (role || '').toLowerCase();
  const canManageTeam = ['owner', 'admin', 'maintainer'].includes(userRole);

  const items = [
    { href: base, label: 'Overview', matchExact: true, icon: LayoutDashboard },
    { href: `${base}/projects`, label: 'Workspace', icon: FolderKanban },
    { href: `${base}/repositories`, label: 'Repositories', icon: GitBranch },
    { href: `${base}/communication`, label: 'Communication', icon: MessagesSquare },
    { href: `${base}/reports`, label: 'Reports', icon: FileText },
    { href: `${base}/analytics`, label: 'Analytics', icon: BarChart },
    { href: `${base}/developers`, label: 'Developers', icon: Users },
    { href: `${base}/tasks`, label: 'Tasks', icon: ListTodo },
    { href: `${base}/tickets`, label: 'Tickets', icon: Ticket },
    { href: `${base}/integrations`, label: 'Integrations', icon: Puzzle },
    ...(canManageTeam
      ? [{ href: `${base}/invitations`, label: 'Team', icon: UserPlus }]
      : []),
  ];

  const isActive = (item) =>
    item.matchExact
      ? pathname === item.href || pathname === `${item.href}/`
      : pathname.startsWith(item.href);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 md:w-64 flex-col bg-white border-r border-slate-200/80 shadow-xs transition-all duration-300">
      {/* ------------ Brand Header (Matching Login/Auth Pages Exactly) ------------ */}
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-200/80 px-4 md:px-5 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm shrink-0">
          <div className="flex items-center gap-0.5">
            <span className="w-1 h-3.5 bg-white rounded-full"></span>
            <span className="w-1 h-5 bg-white rounded-full"></span>
            <span className="w-1 h-3.5 bg-white rounded-full"></span>
          </div>
        </div>
        <span className="hidden md:inline-block text-xl font-bold tracking-tight text-slate-900 truncate">
          PulseOps
        </span>
      </div>

      {/* ------------ Light-Themed Navigation List ------------ */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 md:px-3 py-4">
        {items.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              title={item.label}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active
                  ? 'bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900'
                }`}
            >
              {Icon && (
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                />
              )}
              <span className="hidden md:inline-block truncate">{item.label}</span>
            </Link>
          );
        })}

        <div className="hidden md:block pt-2">
          <SlackSidebarSection workspaceId={workspaceId} />
        </div>
      </nav>
    </aside>
  );
}