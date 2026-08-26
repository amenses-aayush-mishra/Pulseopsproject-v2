'use client';

import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../../../_components/analyticsApi';

export default function AnalyticsPage() {
  const params = useParams();
  const { data: session } = useSession();
  const organizationId = params?.workspaceId || session?.user?.activeOrganizationId;

  let stored = null;
  try { stored = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null; } catch {}
  const token = session?.accessToken || stored;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analyticsOverview', organizationId],
    queryFn: () => fetchDashboard(organizationId, 7, token),
    enabled: !!organizationId,
    refetchInterval: 60000,
    staleTime: 15000,
  });

  const totals = data?.totals || {};

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
      <p className="mt-1 text-sm text-slate-500">Activity totals across sources for the last 7 days.</p>

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading analytics…</p>}
      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error?.message || 'Could not load analytics.'}
        </p>
      )}

      {!isLoading && !isError && (
        <>
          {/* Simple source bars */}
          <div className="mt-5 space-y-3">
            {[
              ['GitHub', totals.prsMerged + totals.prsOpened + totals.prsClosed + (totals.pushes || 0)],
              ['Slack', totals.slackMessages],
              ['Jira', totals.jiraCreated + totals.jiraCompleted],
            ].map(([label, n]) => {
              const max = Math.max(1, ...[totals.prsMerged + totals.prsOpened + totals.prsClosed + (totals.pushes || 0), totals.slackMessages, totals.jiraCreated + totals.jiraCompleted]);
              return (
                <div key={label}>
                  <div className="flex justify-between text-xs font-medium text-slate-500">
                    <span>{label}</span><span>{n} events</span>
                  </div>
                  <div className="mt-1 h-2.5 w-full rounded-full bg-slate-200/70">
                    <div
                      className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      style={{ width: `${Math.round((n / max) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals grid */}
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ['PRs Merged', totals.prsMerged],
              ['PRs Opened', totals.prsOpened],
              ['PRs Closed', totals.prsClosed],
              ['Pushes', totals.pushes],
              ['Jira Created', totals.jiraCreated],
              ['Jira Completed', totals.jiraCompleted],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-xl">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-1 text-2xl font-bold text-slate-900">{value ?? 0}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-xs text-slate-400">
            Active developers this week: {totals.activeDevelopers ?? 0}
          </p>
        </>
      )}
    </div>
  );
}