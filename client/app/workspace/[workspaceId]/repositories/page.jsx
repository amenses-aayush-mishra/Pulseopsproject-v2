'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, ExternalLink, GitBranch, CalendarDays, BookOpen, ChevronRight } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

// ─── GitHub icon (matches the Integrations page) ─────────────────────────────

function GitHubIcon() {
  return (
    <svg className="h-6 w-6 text-slate-700" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Repository card ─────────────────────────────────────────────────────────

function RepositoryCard({ repo, workspaceId, onRemove }) {
  const router = useRouter();
  const importedDate = repo.createdAt
    ? new Date(repo.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const openDashboard = () => {
    if (repo._id) {
      router.push(`/workspace/${workspaceId}/repositories/${repo._id}`);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDashboard();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openDashboard}
      onKeyDown={onKeyDown}
      className="group relative cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-indigo-200 hover:shadow-md"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <GitHubIcon />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">{repo.name}</h3>
              <p className="text-sm text-slate-500 mt-0.5 truncate">
                {repo.fullName || repo.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                repo.private
                  ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                  : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
              }`}
            >
              {repo.private ? 'Private' : 'Public'}
            </span>
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(repo);
                }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <GitBranch className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Default branch:</span>
            <span className="font-medium text-slate-900">{repo.defaultBranch || 'main'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Imported:</span>
            <span className="font-medium text-slate-900">{importedDate}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-5">
          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
            View dashboard <ChevronRight className="h-3.5 w-3.5" />
          </span>
          {repo.htmlUrl ? (
            <a
              href={repo.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <ExternalLink className="h-4 w-4" />
              Open on GitHub
            </a>
          ) : (
            <span className="text-xs text-slate-400">Repository URL unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
}
// ─── Page ────────────────────────────────────────────────────────────────────

export default function RepositoriesPage({ params }) {
  const { workspaceId } = params;
  const { data: session } = useSession();
  const token =
    session?.accessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null);

  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null); // repo _id currently being removed

  const removeRepository = async (repo) => {
    if (!repo?._id || removing) return;
    setRemoving(repo._id);
    try {
      const res = await fetch(`${API_BASE}/api/repositories/${repo._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || `Failed to remove repository (${res.status}).`);
      }
      // Remove from the displayed list immediately; the GitHub repo itself is
      // untouched and becomes selectable again on the Integrations page.
      setRepositories((prev) => prev.filter((r) => r._id !== repo._id));
    } catch (err) {
      setError(err.message || 'Could not remove repository.');
    } finally {
      setRemoving(null);
    }
  };

  const loadRepositories = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/repositories`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || `Failed to load repositories (${res.status}).`);
      }
      const data = await res.json();
      setRepositories(Array.isArray(data?.repositories) ? data.repositories : []);
    } catch (err) {
      setError(err.message || 'Could not load repositories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && workspaceId) {
      loadRepositories();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, workspaceId]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Repositories</h1>
        <p className="mt-2 text-sm text-slate-500">
          Repositories imported into this workspace from your GitHub integration.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button
            type="button"
            onClick={loadRepositories}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : repositories.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <BookOpen className="h-6 w-6 text-slate-500" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">No repositories imported</h2>
          <p className="mt-1 text-sm text-slate-500">
            Connect GitHub and import repositories from the Integrations page.
          </p>
          <Link
            href={`/workspace/${workspaceId}/integrations`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Go to Integrations
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {repositories.map((repo) => (
            <RepositoryCard
              key={repo._id || repo.name}
              repo={repo}
              workspaceId={workspaceId}
              onRemove={removeRepository}
            />
          ))}
        </div>
      )}
    </div>
  );
}