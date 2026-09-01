'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Info, X } from 'lucide-react';
import { fetchDashboard, recomputeAnalytics } from './analyticsApi';

/**
 * AnalyticsCards — live dashboard widgets fed by GET /api/analytics/dashboard:
 * Org Health Score, KPI cards with week-over-week trends, Team health list and
 * Risks & alerts. Includes deterministic health score breakdown modal and refresh button.
 */
export default function AnalyticsCards({ organizationId }) {
  const { data: session } = useSession();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  let stored = null;
  try { stored = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null; } catch {}
  const bearer = session?.accessToken || stored;

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery({
    queryKey: ['analyticsDashboard', organizationId],
    queryFn: () => fetchDashboard(organizationId, 7, bearer),
    enabled: !!organizationId,
    refetchInterval: 20000,
    staleTime: 10000,
  });

  const handleRefresh = async () => {
    if (refreshing || !organizationId) return;
    setRefreshing(true);
    try {
      await recomputeAnalytics(organizationId, bearer);
      await refetch();
    } catch (e) {
      console.error('Refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mb-6 rounded-2xl border border-white/60 dark:border-[var(--border)] bg-white/70 dark:bg-[var(--surface)] p-6 text-sm text-slate-500 dark:text-[var(--text-secondary)] shadow-sm backdrop-blur-xl">
        Computing workspace analytics…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="status"
        className="mb-6 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-200"
      >
        {error?.message || 'Analytics unavailable right now.'}
      </div>
    );
  }
  if (!data) return null;

  const { healthScore, healthLabel, healthScoreBreakdown, kpis, team, risks, totals } = data;
  const scoreColor =
    healthScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' :
    healthScore >= 55 ? 'text-indigo-600 dark:text-indigo-400' :
    healthScore >= 35 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';

  const trend = (pct) => {
    if (pct > 0) return <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">▲ {pct}%</span>;
    if (pct < 0) return <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">▼ {Math.abs(pct)}%</span>;
    return <span className="text-xs font-medium text-slate-400 dark:text-[var(--text-muted)]">—</span>;
  };

  const statusBadge = (status) => {
    const map = {
      Healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
      'At Risk': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
      Critical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400',
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
        {status}
      </span>
    );
  };

  const bd = healthScoreBreakdown || {};

  return (
    <div className="mb-6 space-y-4">
      {/* Header controls with Refresh Button */}
      <div className="flex justify-end items-center">
        <button
          onClick={handleRefresh}
          disabled={refreshing || isRefetching}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-[var(--text-primary)] shadow-2xs hover:bg-slate-50 dark:hover:bg-[var(--surface-subtle)] transition-all disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 ${refreshing || isRefetching ? 'animate-spin' : ''}`} />
          {refreshing || isRefetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Health score + KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Clickable Health Score Card */}
        <div
          onClick={() => setShowBreakdown(true)}
          className="group relative rounded-2xl border border-white/60 dark:border-[var(--border)] bg-white/70 dark:bg-[var(--surface)] p-5 shadow-sm shadow-indigo-100/50 dark:shadow-none backdrop-blur-xl cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 transition-all"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-[var(--text-muted)]">
              Org Health Score
            </p>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 opacity-80 group-hover:opacity-100">
              <Info className="h-3.5 w-3.5" /> Breakdown
            </span>
          </div>
          <p className={`mt-1.5 text-4xl font-extrabold ${scoreColor}`}>{healthScore}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-[var(--text-secondary)]">
            {healthLabel} · last {data.windowDays} days
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-[var(--text-secondary)]">
            {totals.activeDevelopers} active devs · {totals.slackMessages} Slack msgs
          </p>
        </div>

        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-white/60 dark:border-[var(--border)] bg-white/70 dark:bg-[var(--surface)] p-5 shadow-sm shadow-indigo-100/50 dark:shadow-none backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-[var(--text-muted)]">{k.label}</p>
              {trend(k.changePct)}
            </div>
            <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-[var(--text-primary)]">{k.current}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[var(--text-secondary)]">vs {k.previous} previous period</p>
          </div>
        ))}
      </div>

      {/* Health Score Breakdown Modal */}
      {showBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-[var(--border)] bg-white dark:bg-[var(--surface-elevated)] p-6 shadow-xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[var(--text-primary)]">Org Health Score Breakdown</h3>
                <p className="text-xs text-slate-500 dark:text-[var(--text-secondary)] mt-0.5">
                  Total Score: <span className="font-bold text-indigo-600 dark:text-indigo-400">{healthScore}/100</span> ({healthLabel})
                </p>
              </div>
              <button
                onClick={() => setShowBreakdown(false)}
                className="rounded-lg p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-[var(--surface-subtle)] hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                ['PR Velocity', bd.prVelocity?.score, bd.prVelocity?.max, bd.prVelocity?.value, bd.prVelocity?.description],
                ['Review Speed & Efficiency', bd.avgReviewTime?.score, bd.avgReviewTime?.max, bd.avgReviewTime?.value, bd.avgReviewTime?.description],
                ['Ticket Resolution Rate', bd.ticketResolution?.score, bd.ticketResolution?.max, bd.ticketResolution?.value, bd.ticketResolution?.description],
                ['Communication & Collaboration', bd.commsActivity?.score, bd.commsActivity?.max, bd.commsActivity?.value, bd.commsActivity?.description],
              ].map(([label, score, max, value, desc]) => (
                <div key={label} className="rounded-xl border border-slate-100 dark:border-[var(--border-subtle)] bg-slate-50/70 dark:bg-[var(--surface-subtle)] p-3.5">
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-900 dark:text-[var(--text-primary)]">
                    <span>{label}</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold">{score ?? 0} / {max ?? 25}</span>
                  </div>
                  <div className="mt-1 flex justify-between items-center text-xs text-slate-500 dark:text-[var(--text-secondary)]">
                    <span>{desc}</span>
                    <span className="font-medium text-slate-700 dark:text-[var(--text-primary)]">{value}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${Math.round(((score || 0) / (max || 25)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}

              {/* Penalties item */}
              <div className="rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-900/20 p-3.5">
                <div className="flex justify-between items-center text-sm font-semibold text-rose-900 dark:text-rose-200">
                  <span>Deductions & Penalties</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{bd.penalties?.total ?? 0} pts</span>
                </div>
                <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">
                  Stale tickets ({bd.penalties?.staleTickets ?? 0} pts) · Quiet days ({bd.penalties?.zeroActivityDays ?? 0} pts)
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowBreakdown(false)}
                className="rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-xs font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white transition-colors"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team health + risks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/60 dark:border-[var(--border)] bg-white/70 dark:bg-[var(--surface)] p-5 shadow-sm shadow-indigo-100/50 dark:shadow-none backdrop-blur-xl">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Team health</h3>
          <ul className="mt-3 space-y-2">
            {(team || []).map((m) => (
              <li
                key={m.actor}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-[var(--border-subtle)] bg-white/60 dark:bg-[var(--surface-subtle)] px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[11px] font-bold uppercase text-white">
                    {String(m.actor).charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold capitalize leading-tight text-slate-800 dark:text-[var(--text-primary)]">{m.actor}</p>
                    <p className="text-[11px] text-slate-500 dark:text-[var(--text-secondary)]">
                      {m.prsMerged} merged · {m.issuesCompleted} done · {m.total} events
                    </p>
                  </div>
                </div>
                {statusBadge(m.status)}
              </li>
            ))}
            {(!team || team.length === 0) && (
              <li className="px-1 py-2 text-sm text-slate-500 dark:text-[var(--text-muted)]">No developer activity in this period yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/60 dark:border-[var(--border)] bg-white/70 dark:bg-[var(--surface)] p-5 shadow-sm shadow-indigo-100/50 dark:shadow-none backdrop-blur-xl">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Risks &amp; alerts</h3>
          <ul className="mt-3 space-y-2">
            {(risks || []).map((r, i) => (
              <li
                key={i}
                className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/80 dark:bg-amber-900/20 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
              >
                ⚠️ {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
