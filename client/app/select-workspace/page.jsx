'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

const ROLE_COLORS = {
  owner:     { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
  admin:     { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500'  },
  maintainer:{ bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500'     },
  developer: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  viewer:    { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
};

const roleColor = (role) =>
  ROLE_COLORS[role] || { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' };

/** Animated gradient orb for visual depth */
function Orb({ className }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute rounded-full blur-3xl opacity-40 ${className}`}
    />
  );
}

/** Single workspace card */
function WorkspaceCard({ workspace, onSelect, loading }) {
  const color = roleColor(workspace.role);
  const initials = workspace.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <button
      id={`ws-card-${workspace.id}`}
      type="button"
      onClick={() => onSelect(workspace)}
      disabled={loading}
      className="group relative flex w-full flex-col gap-4 rounded-2xl border border-white/60 bg-white/70 p-6 text-left shadow-lg shadow-indigo-500/10 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/80 hover:shadow-xl hover:shadow-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-60"
    >
      {/* Top row: avatar + role badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Workspace avatar */}
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 text-base font-bold text-white shadow-md shadow-indigo-500/30 transition-transform duration-200 group-hover:scale-105">
            {initials || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{workspace.name}</p>
            {workspace.slug && (
              <p className="text-xs text-slate-400 mt-0.5">/{workspace.slug}</p>
            )}
          </div>
        </div>

        {/* Role badge */}
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color.bg} ${color.text}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
          {workspace.role.charAt(0).toUpperCase() + workspace.role.slice(1)}
        </span>
      </div>

      {/* Arrow caret */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">Click to enter workspace</span>
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-indigo-400 transition-transform duration-200 group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Shimmer on hover */}
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-50/0 via-indigo-50/30 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      />
    </button>
  );
}

/** Loading skeleton for a card */
function CardSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-white/60 bg-white/70 p-6 shadow-lg shadow-indigo-500/10 backdrop-blur-xl animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 rounded bg-slate-200" />
            <div className="h-2.5 w-16 rounded bg-slate-100" />
          </div>
        </div>
        <div className="h-5 w-16 rounded-full bg-slate-200" />
      </div>
      <div className="h-3 w-32 rounded bg-slate-100" />
    </div>
  );
}

export default function SelectWorkspacePage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const [workspaces, setWorkspaces] = useState([]);
  const [switching, setSwitching] = useState(null); // id of workspace being entered
  const [error, setError] = useState(null);

  // Populate workspace list from session (already hydrated by authOptions.js)
  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    const wsList = session?.user?.workspaces;
    if (Array.isArray(wsList) && wsList.length > 0) {
      setWorkspaces(wsList);
    }
  }, [status, session, router]);

  const handleSelect = async (workspace) => {
    if (switching) return;
    setSwitching(workspace.id);
    setError(null);

    try {
      const token = (() => {
        try { return localStorage.getItem('pulseops_token'); } catch { return null; }
      })();

      const res = await fetch(`${API_BASE}/api/organizations/switch-org`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ targetOrganizationId: workspace.id }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || `Could not switch workspace (${res.status}). Please try again.`);
        setSwitching(null);
        return;
      }

      // Refresh localStorage token.
      if (data.token) {
        try { localStorage.setItem('pulseops_token', data.token); } catch { /* ignored */ }
      }

      // Sync the NextAuth session so middleware sees the new activeOrganizationId.
      await update({
        accessToken: data.token || token,
        activeOrganizationId: workspace.id,
        role: data.role || workspace.role,
      });

      router.replace(`/workspace/${workspace.id}`);
    } catch (err) {
      setError('Could not reach the server. Please try again.');
      setSwitching(null);
    }
  };

  const isLoading = status === 'loading';
  const userName = session?.user?.name || session?.user?.email || '';

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 p-6 text-slate-900">
      {/* Background */}
      <div aria-hidden="true" className="absolute inset-0" style={GRID_BG} />
      <Orb className="h-[28rem] w-[28rem] -top-40 -left-32 bg-indigo-300" />
      <Orb className="h-[22rem] w-[22rem] -bottom-32 -right-24 bg-violet-300" />
      <Orb className="h-64 w-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-200" />

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            PulseOps
          </h1>
          <p className="mt-2 text-slate-500 text-sm">
            {userName ? `Welcome back, ${userName.split(' ')[0]}. ` : ''}
            Select a workspace to continue.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {error}
          </div>
        )}

        {/* Workspace grid */}
        <div className="space-y-3">
          {isLoading
            ? [1, 2].map((n) => <CardSkeleton key={n} />)
            : workspaces.length > 0
              ? workspaces.map((ws) => (
                  <WorkspaceCard
                    key={ws.id}
                    workspace={ws}
                    onSelect={handleSelect}
                    loading={switching === ws.id}
                  />
                ))
              : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-800">
                  No workspaces found in your session.{' '}
                  <button
                    type="button"
                    onClick={() => router.replace('/onboarding')}
                    className="font-semibold underline underline-offset-2"
                  >
                    Create one now
                  </button>
                </div>
              )}
        </div>

        {/* Divider */}
        {workspaces.length > 0 && (
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>
        )}

        {/* Create new workspace CTA */}
        <button
          id="create-new-workspace-btn"
          type="button"
          onClick={() => router.push('/onboarding')}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-white/60 px-4 py-3 text-sm font-semibold text-indigo-600 backdrop-blur-sm transition-colors hover:border-indigo-400 hover:bg-indigo-50/60"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create New Workspace
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          By continuing you agree to the PulseOps terms of service.
        </p>
      </div>
    </div>
  );
}
