'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Check, BookOpen, ChevronRight } from 'lucide-react';

// Backend API base — mirror of the dashboard / sidebar / repositories pages.
const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const ME_ENDPOINT = `${API_BASE}/api/auth/me`;
const SWITCH_ENDPOINT = `${API_BASE}/api/organizations/switch-org`;
const REPOS_ENDPOINT = `${API_BASE}/api/repositories`;

export default function WorkspacesPage({ params }) {
  const { workspaceId } = params;
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState(null);
  const [switching, setSwitching] = useState(null); // org id currently being switched to
  const [switchError, setSwitchError] = useState(null);
  const [repos, setRepos] = useState([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [reposError, setReposError] = useState('');

  const token =
    session?.accessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null);

  const activeOrganizationId = session?.user?.activeOrganizationId || null;

  // Load the available workspaces from the existing /api/auth/me source.
  useEffect(() => {
    let cancelled = false;
    if (!token) return undefined;

    (async () => {
      try {
        const res = await fetch(ME_ENDPOINT, {
          headers: { Authorization: `Bearer ${token.trim()}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setMe(data);
          setMeError(null);
        } else {
          setMeError(data?.message || `Could not load workspaces (${res.status}).`);
        }
      } catch {
        if (!cancelled) setMeError('Could not reach the workspace service.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, status]);

  // Load repositories for the current (active) workspace from the existing
  // /api/repositories endpoint — same data the Repositories page uses.
  useEffect(() => {
    let cancelled = false;
    if (!token || !workspaceId) return;
    setReposLoading(true);
    setReposError('');

    (async () => {
      try {
        const res = await fetch(REPOS_ENDPOINT, {
          headers: { Authorization: `Bearer ${token.trim()}`, 'x-organization-id': workspaceId },
        });
        if (cancelled) return;
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setReposError(data?.message || data?.error || `Failed to load repositories (${res.status}).`);
          setRepos([]);
          return;
        }
        const data = await res.json();
        setRepos(Array.isArray(data?.repositories) ? data.repositories : []);
      } catch {
        if (!cancelled) {
          setReposError('Could not load repositories.');
          setRepos([]);
        }
      } finally {
        if (!cancelled) setReposLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, workspaceId]);

  // Reuses the exact workspace-switching facility used by the top dropdown and
  // the sidebar: POST /api/organizations/switch-org -> session update -> refresh.
  // After a successful switch we navigate to the new workspace's Workspaces page
  // so the active indicator and repository list reflect the new active workspace.
  const switchWorkspace = async (orgId, orgRole) => {
    if (!orgId || orgId === activeOrganizationId) return;
    setSwitching(orgId);
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
          ...(bearer ? { Authorization: `Bearer ${String(bearer).trim()}` } : {}),
        },
        body: JSON.stringify({ targetOrganizationId: orgId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setSwitchError(
          data?.message || 'Forbidden. You are not an active member of this organization.'
        );
        return;
      }
      if (!res.ok) {
        setSwitchError(data?.message || `Could not switch workspace (${res.status}).`);
        return;
      }
      const nextOrgId = data.activeOrganizationId || orgId;
      if (data.token) {
        try {
          localStorage.setItem('pulseops_token', data.token);
        } catch (storageErr) {
          // the NextAuth session is still synced below.
        }
      }
      await update({
        accessToken: data.token,
        activeOrganizationId: nextOrgId,
        role: data.role || orgRole,
      });
      router.push(`/workspace/${nextOrgId}/workspaces`);
      router.refresh();
    } catch {
      setSwitchError('Could not reach the workspace server. Please try again.');
    } finally {
      setSwitching(null);
    }
  };
if (status === 'loading') {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  const organizations = me?.availableOrganizations || [];
  // Active workspace always at the top; the rest follow in their original order.
  const sortedOrganizations = [...organizations].sort((a, b) => {
    if (a.id === activeOrganizationId) return -1;
    if (b.id === activeOrganizationId) return 1;
    return 0;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Workspaces</h1>
          <p className="mt-2 text-sm text-slate-500">
            Manage the workspaces you belong to and their repositories.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/onboarding')}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-500/25 transition-opacity hover:opacity-90"
        >
          <span aria-hidden="true">＋</span> Create workspace
        </button>
      </div>

      {meError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {meError}
        </div>
      )}
      {switchError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {switchError}
        </div>
      )}

      {/* ─── Workspaces ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Workspaces
        </h2>
        <div className="mt-3 space-y-3">
          {sortedOrganizations.map((org) => {
            const isActive = org.id === activeOrganizationId;
            return (
              <button
                key={org.id}
                type="button"
                disabled={switching}
                onClick={() => switchWorkspace(org.id, org.role)}
                className={`flex w-full items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4 text-left shadow-sm transition ${
                  isActive
                    ? 'border-indigo-300 ring-2 ring-indigo-100'
                    : 'border-slate-200 hover:border-indigo-200 hover:shadow-md'
                }`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${
                      isActive
                        ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600'
                        : 'bg-slate-300'
                    }`}
                  >
                    {(org.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{org.name}</p>
                    <p className="text-xs capitalize text-slate-500">{org.role || 'member'}</p>
                  </div>
                </div>
                {isActive ? (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Active
                  </span>
                ) : (
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-400">
                    {switching === org.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        Switch <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </>
                    )}
                  </span>
                )}
              </button>
            );
          })}
          {sortedOrganizations.length === 0 && !meError && (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-sm text-slate-500">No workspaces yet.</p>
              <button
                type="button"
                onClick={() => router.push('/onboarding')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                <span aria-hidden="true">＋</span> Create workspace
              </button>
            </div>
          )}
        </div>
      </section>
{/* ─── Repositories of the active workspace ───────────────────── */}
      <section>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Repositories
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Repositories belonging to the currently active workspace.
            </p>
          </div>
          <Link
            href={`/workspace/${workspaceId}/repositories`}
            className="shrink-0 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            View all
          </Link>
        </div>

        {reposLoading ? (
          <div className="mt-3 flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-slate-300" />
          </div>
        ) : reposError ? (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            {reposError}
          </div>
        ) : repos.length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
              <BookOpen className="h-6 w-6 text-slate-500" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              No repositories imported
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Import repositories for this workspace from the Integrations page.
            </p>
            <Link
              href={`/workspace/${workspaceId}/integrations`}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              Go to Integrations
            </Link>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {repos.map((repo) => (
              <Link
                key={repo._id}
                href={`/workspace/${workspaceId}/repositories/${repo._id}`}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                  <BookOpen className="h-5 w-5 text-slate-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{repo.name}</p>
                  <p className="truncate text-xs text-slate-500">{repo.fullName || repo.name}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    repo.private
                      ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                  }`}
                >
                  {repo.private ? 'Private' : 'Public'}
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-indigo-600"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}