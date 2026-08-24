'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useTheme } from '../theme/ThemeProvider';

// Backend API base — mirror of /login, /onboarding and WorkspaceDashboard.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const ME_ENDPOINT = `${API_BASE}/api/auth/me`;
const SWITCH_ENDPOINT = `${API_BASE}/api/organizations/switch-org`;

/**
 * TASK-107 — workspace shell sidebar. Rendered by the /workspace/[workspaceId]
 * layout. Consumes the theme engine's CSS custom properties so the brand
 * color (--pulse-primary) and sidebar background (--pulse-sidebar-bg) follow
 * the active organization's themeSettings.
 */
export default function WorkspaceSidebar({ workspaceId, role }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const { theme } = useTheme();
  const base = `/workspace/${workspaceId}`;

  const [organizations, setOrganizations] = useState([]);
  const [workspacesError, setWorkspacesError] = useState(null);
  const [switching, setSwitching] = useState(false);

  // Load the user's available workspaces from the existing /api/auth/me source
  // — the same data source the top "Switch workspace" dropdown uses.
  useEffect(() => {
    let cancelled = false;
    const storedToken =
      typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null;
    const bearer = session?.accessToken || storedToken;
    if (!bearer) return undefined;

    (async () => {
      try {
        const res = await fetch(ME_ENDPOINT, {
          headers: { Authorization: `Bearer ${bearer.trim()}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setOrganizations(data?.availableOrganizations || []);
          setWorkspacesError(null);
        } else {
          setWorkspacesError(data?.message || `Could not load workspaces (${res.status}).`);
        }
      } catch {
        if (!cancelled) setWorkspacesError('Could not reach the workspace service.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.accessToken]);

  // Reuses the exact workspace-switching facility used by the top dropdown:
  // POST /api/organizations/switch-org -> session update -> refresh. The edge
  // middleware / layout guard then routes to the newly active workspace.
  const switchWorkspace = async (orgId, orgRole) => {
    if (!orgId || orgId === workspaceId) return;
    setSwitching(true);
    try {
      let storedToken = null;
      try {
        storedToken = localStorage.getItem('pulseops_token');
      } catch {
        // storage unavailable — fall back to the NextAuth accessToken below.
      }
      const bearer = session?.accessToken || storedToken;
      const res = await fetch(SWITCH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer.trim()}` } : {}),
        },
        body: JSON.stringify({ targetOrganizationId: orgId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setWorkspacesError(
          data?.message || 'Forbidden. You are not an active member of this organization.'
        );
        return;
      }
      if (!res.ok) {
        setWorkspacesError(data?.message || `Could not switch workspace (${res.status}).`);
        return;
      }
      if (data.token) {
        try {
          localStorage.setItem('pulseops_token', data.token);
        } catch {
          // the NextAuth session is still synced below.
        }
      }
      await update({
        accessToken: data.token,
        activeOrganizationId: data.activeOrganizationId || orgId,
        role: data.role || orgRole,
      });
      router.refresh();
    } catch {
      setWorkspacesError('Could not reach the workspace server. Please try again.');
    } finally {
      setSwitching(false);
    }
  };

  const items = [
    { href: base, label: 'Overview', matchExact: true },
    { href: `${base}/workspaces`, label: 'Workspaces' },
    { href: `${base}/integrations`, label: 'Integrations' },
    { href: `${base}/invitation`, label: 'Invitation & Password' },
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
            {item.label}
          </Link>
        ))}
        {/* Workspaces */}
        <div className="mt-4">
          <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Workspaces
          </p>
          {workspacesError && (
            <p className="mt-1 px-3 text-xs text-rose-400">{workspacesError}</p>
          )}
          <div className="mt-1 space-y-0.5">
            {organizations.map((org) => {
              const isActive = org.id === workspaceId;
              return (
                <button
                  key={org.id}
                  type="button"
                  disabled={switching}
                  onClick={() => switchWorkspace(org.id, org.role)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isActive
                      ? 'bg-white/10 font-medium text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate">{org.name}</span>
                  {isActive && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                      Active
                    </span>
                  )}
                </button>
              );
            })}
            {organizations.length === 0 && !workspacesError && (
              <p className="px-3 py-1.5 text-xs text-slate-400">No other workspaces.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => router.push('/onboarding')}
            className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
          >
            <span aria-hidden="true">＋</span> Create workspace
          </button>
        </div>

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