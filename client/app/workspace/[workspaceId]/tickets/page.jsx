'use client';

import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from '../../../_components/analyticsApi';
import JiraTaskList from '../../../_components/JiraTaskList';

export default function TicketsPage() {
  const params = useParams();
  const { data: session } = useSession();
  const organizationId = params?.workspaceId || session?.user?.activeOrganizationId;

  let stored = null;
  try { stored = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null; } catch {}
  const token = session?.accessToken || stored;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ticketsAnalytics', organizationId],
    queryFn: () => fetchDashboard(organizationId, 7, token),
    enabled: !!organizationId,
    staleTime: 15000,
  });

  const totals = data?.totals || {};
  const jiraTeam = (data?.team || []).filter((m) => (m.issuesCompleted || 0) > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tickets & Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">Jira issue flow and active task list.</p>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Loading tickets…</p>}
      {isError && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error?.message || 'Could not load ticket analytics.'}
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Issues Created</dt>
              <dd className="mt-1.5 text-3xl font-bold text-slate-900">{totals.jiraCreated ?? 0}</dd>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Issues Completed</dt>
              <dd className="mt-1.5 text-3xl font-bold text-emerald-600">{totals.jiraCompleted ?? 0}</dd>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Net Backlog</dt>
              <dd className={`mt-1.5 text-3xl font-bold ${(totals.jiraCreated - totals.jiraCompleted) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {(totals.jiraCreated ?? 0) - (totals.jiraCompleted ?? 0)}
              </dd>
            </div>
          </dl>

          {(jiraTeam.length > 0) && (
            <p className="text-xs text-slate-500">
              Completions this week by:{' '}
              {jiraTeam.map((m) => `${m.actor} (${m.issuesCompleted})`).join(', ')}
            </p>
          )}
        </>
      )}

      {/* Jira Tasks List */}
      <div className="pt-4 border-t border-slate-200">
        <JiraTaskList workspaceId={organizationId} />
      </div>
    </div>
  );
}