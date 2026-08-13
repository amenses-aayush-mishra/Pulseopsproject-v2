'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, ArrowLeft } from 'lucide-react';
import SlackPanel from './components/SlackPanel';
import GitHubPanel from './components/GitHubPanel';
import AiInsightsPanel from './components/AiInsightsPanel';
import GenerateReportCard from './components/GenerateReportCard';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

/**
 * Repository Intelligence Dashboard.
 * The flagship PulseOps screen — GitHub (live) + Slack (dummy) + AI (UI only)
 * on a single page, so an Engineering Manager never needs to switch tools.
 */
export default function RepositoryIntelligencePage({ params }) {
  const { workspaceId, repositoryId } = params;
  const { data: session } = useSession();
  const token =
    session?.accessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/repositories/${repositoryId}`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Failed to load repository (${res.status}).`);
      }
      setData(await res.json());
    } catch (err) {
      setError(err.message || 'Could not load repository intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && repositoryId) {
      load();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, repositoryId]);

  const repo = data?.repository;
  const backHref = `/workspace/${workspaceId}/repositories`;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
            aria-label="Back to repositories"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {repo?.name || 'Repository Intelligence'}
            </h1>
            <p className="text-sm text-slate-500">
              {repo?.fullName || 'Combining GitHub · Slack · Jira'}
            </p>
          </div>
        </div>
        {repo && (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
              repo.private
                ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
            }`}
          >
            {repo.private ? 'Private' : 'Public'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={load}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
            >
              Retry
            </button>
            <Link
              href={`/workspace/${workspaceId}/integrations`}
              className="rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
            >
              Go to Integrations
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-3 lg:h-[calc(100vh-13rem)]">
              <SlackPanel />
            </div>
            <div className="lg:col-span-6">
              <GitHubPanel data={data} />
            </div>
            <div className="lg:col-span-3 lg:h-[calc(100vh-13rem)]">
              <AiInsightsPanel />
            </div>
          </div>
          <GenerateReportCard />
        </>
      )}
    </div>
  );
}