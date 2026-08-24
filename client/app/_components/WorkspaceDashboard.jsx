'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { Check } from 'lucide-react';

// Backend API base — mirror of /login and /onboarding.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const ME_ENDPOINT = `${API_BASE}/api/auth/me`;
const SWITCH_ENDPOINT = `${API_BASE}/api/organizations/switch-org`;
const INVITE_ENDPOINT = `${API_BASE}/api/organizations/invite`;

// TASK-113 — invitation role options (mirrors the backend ALLOWED_ROLES).
const INVITE_ROLES = [
  { value: 'developer', label: 'Developer' },
  { value: 'maintainer', label: 'Maintainer' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' },
];

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

export default function WorkspaceDashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switchError, setSwitchError] = useState(null);
  // TASK-113 — invite teammate modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('developer');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  const activeOrganizationId = session?.user?.activeOrganizationId || null;
  const role = session?.user?.role || null;

  // Pull the org list from the backend (/api/auth/me) using the Express JWT.
  useEffect(() => {
    let cancelled = false;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null;
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
          setMe(data);
        } else {
          setMeError(data?.message || `Could not load workspace context (${res.status}).`);
        }
      } catch (err) {
        if (!cancelled) setMeError('Could not reach the workspace service.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.accessToken]);

  const onSwitchWorkspace = useCallback(
    async (orgId, orgRole) => {
      if (!orgId || orgId === activeOrganizationId) {
        setShowSwitcher(false);
        return;
      }
      setSwitching(true);
      setSwitchError(null);
      try {
        let storedToken = null;
        try {
          storedToken = localStorage.getItem('pulseops_token');
        } catch (storageErr) {
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

        // 403 = stale/insufficient membership. Keep the active session fully
        // intact (no update, no navigation) and surface an inline banner.
        if (res.status === 403) {
          setSwitchError(
            data?.message ||
              'Forbidden. You are not an active member of this organization.'
          );
          return;
        }
        if (!res.ok) {
          setSwitchError(data?.message || `Could not switch workspace (${res.status}).`);
          return;
        }

        // 1) Rotate the Express JWT in client storage FIRST so raw API calls
        //    outside NextAuth carry the new tenant context immediately.
        if (data.token) {
          try {
            localStorage.setItem('pulseops_token', data.token);
          } catch (storageErr) {
            // storage disabled — the NextAuth session is still synced below.
          }
        }

        // 2) Sync the NextAuth session cookie: accessToken rotation + new
        //    activeOrganizationId/role. Awaited BEFORE any navigation/refresh
        //    so the middleware never sees a stale token (stale-mount guard).
        await update({
          accessToken: data.token,
          activeOrganizationId: data.activeOrganizationId || orgId,
          role: data.role || orgRole,
        });

        // 3) Soft-refresh strictly after update() resolves.
        setShowSwitcher(false);
        router.refresh();
      } catch (err) {
        setSwitchError('Could not reach the workspace server. Please try again.');
      } finally {
        setSwitching(false);
      }
    },
    // activeOrganizationId derives from the session; session.accessToken fuels
    // the switch request, so both are deliberate dependencies.
    [activeOrganizationId, session?.accessToken, update, router]
  );

  const onSignOut = async () => {
    try {
      localStorage.removeItem('pulseops_token');
      sessionStorage.clear();
    } catch (err) {
      // storage unavailable — proceed with the session sign-out anyway
    }
    await signOut({ callbackUrl: '/login' });
  };

  // TASK-113 — send an invitation (owner/admin only; the backend re-checks).
  const onInvite = async (e) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    if (inviteBusy) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Enter a valid email address.');
      return;
    }
    setInviteBusy(true);
    try {
      let storedToken = null;
      try {
        storedToken = localStorage.getItem('pulseops_token');
      } catch (storageErr) {
        // storage unavailable — fall back to the session accessToken
      }
      const bearer = session?.accessToken || storedToken;
      const res = await fetch(INVITE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer.trim()}` } : {}),
        },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data?.message || `Invitation failed (${res.status}).`);
        return;
      }
      setInviteSuccess(`Invitation sent to ${email}.`);
      setInviteEmail('');
      setTimeout(() => setShowInvite(false), 900);
    } catch (err) {
      setInviteError('Could not reach the invitation service. Please try again.');
    } finally {
      setInviteBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50">
        <div aria-hidden="true" className="absolute inset-0" style={GRID_BG} />
        <div className="relative rounded-xl border border-slate-200 bg-white/70 px-6 py-4 text-sm text-slate-500 shadow-sm backdrop-blur-xl">
          Loading your workspace…
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div aria-hidden="true" className="absolute inset-0" style={GRID_BG} />
        <div className="relative w-full max-w-md rounded-2xl border border-white/60 bg-white/70 p-8 text-center shadow-xl shadow-indigo-100/60 backdrop-blur-xl">
          <h1 className="text-xl font-semibold text-slate-900">Not signed in</h1>
          <p className="mt-2 text-sm text-slate-500">Please sign in to view your workspace.</p>
          <a
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const organizations = me?.availableOrganizations || [];
  const activeName = me?.activeOrganization?.name || 'Current workspace';
  const email = session?.user?.email || '—';
  // Owner/admin can invite teammates (the backend enforces this too).
  const canInvite = role === 'owner' || role === 'admin';

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900">
      <div aria-hidden="true" className="absolute inset-0" style={GRID_BG} />
      <div aria-hidden="true" className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-8">
        {/* Top bar */}
        <header className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-5 py-3.5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 text-sm font-bold text-white">
              P
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight text-slate-900">PulseOps</p>
              <p className="text-xs text-slate-500">{activeName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {canInvite && (
              <button
                type="button"
                onClick={() => {
                  setShowInvite(true);
                  setInviteError(null);
                  setInviteSuccess(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-opacity hover:opacity-90"
              >
                <span aria-hidden="true">＋</span> Invite teammate
              </button>
            )}
            <div className="relative z-50">
              <button
                type="button"
                onClick={() => {
                  setShowSwitcher((v) => !v);
                  setSwitchError(null);
                }}
                disabled={switching || !organizations.length}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span aria-hidden="true">⇄</span> Switch workspace
              </button>
              {showSwitcher && (
                <div className="absolute right-0 z-50 mt-2 w-64 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {organizations.map((org) => {
                    const selected = org.id === activeOrganizationId;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        disabled={switching}
                        onClick={() => onSwitchWorkspace(org.id, org.role)}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition ${
                          selected
                            ? 'bg-indigo-50 font-medium text-indigo-800'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {selected ? (
                            <Check className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
                          ) : (
                            <span className="w-4 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate">{org.name}</span>
                        </span>
                        {selected ? (
                          <span className="shrink-0 text-xs font-semibold text-indigo-600">
                            Active
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
                      <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white/80 px-3.5 py-2 text-sm font-medium text-rose-600 shadow-sm transition hover:border-rose-300 hover:bg-rose-50"
            >
              <span aria-hidden="true">→</span> Sign out
            </button>
          </div>
        </header>

        {switchError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800 shadow-sm"
          >
            {switchError}
          </div>
        )}

        {/* TASK-113 — workspace overview metric widgets */}
        <main className="mt-8">
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Active Services
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">0</p>
              <p className="mt-1 text-xs text-slate-500">No services connected yet</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Deployment Status
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">—</p>
              <p className="mt-1 text-xs text-slate-500">No deployments yet</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Team Members
              </p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900">1</p>
              <p className="mt-1 text-xs text-slate-500">
                You ({role ? role.charAt(0).toUpperCase() + role.slice(1) : 'member'}) — invite
                teammates to grow your workspace
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/70 p-8 shadow-xl shadow-indigo-100/60 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
              Active workspace
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold text-slate-900">
              Welcome back{email !== '—' ? `, ${email}` : ''}
            </h1>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white/60 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Organization ID
                </dt>
                <dd className="mt-1 font-mono text-sm text-slate-800">
                  {activeOrganizationId || 'Not set'}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/60 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Your role
                </dt>
                <dd className="mt-1 text-sm font-semibold capitalize text-slate-800">
                  {role || 'Not set'}
                </dd>
              </div>
            </dl>

            {meError && (
              <p
                role="status"
                className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
              >
                {meError}
              </p>
            )}
          </div>
        </main>

        {/* TASK-113 — Invite teammate modal (owner/admin) */}
        {showInvite && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Invite a teammate"
            onClick={() => setShowInvite(false)}
          >
            <div
              className="w-full max-w-md rounded-2xl border border-white/60 bg-white/90 p-6 shadow-2xl shadow-indigo-500/20 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Invite a teammate</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    They&apos;ll get an email with a secure invite link to join{' '}
                    <strong>{activeName}</strong>.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setShowInvite(false)}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={onInvite} className="mt-5 space-y-4" noValidate>
                <label className="block text-sm font-medium text-slate-600" htmlFor="invite-email">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full rounded-xl border border-slate-300 bg-white/80 px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                />

                <label className="block text-sm font-medium text-slate-600" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white/80 px-3 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                >
                  {INVITE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>

                {inviteError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
                  >
                    {inviteError}
                  </div>
                )}
                {inviteSuccess && (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
                  >
                    ✓ {inviteSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={inviteBusy}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {inviteBusy ? 'Sending…' : 'Send invitation'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}