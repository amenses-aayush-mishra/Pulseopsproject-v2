'use client';

import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboard } from './analyticsApi';

/**
 * AnalyticsCards — live dashboard widgets fed by GET /api/analytics/dashboard:
 * Org Health Score, KPI cards with week-over-week trends, Team health list and
 * Risks & alerts. Replaces the earlier static stub cards.
 */
export default function AnalyticsCards({ organizationId }) {
  const { data: session } = useSession();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analyticsDashboard', organizationId],
    queryFn: () => {
      let stored = null;
      try { stored = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null; } catch {}
      const bearer = session?.accessToken || stored;
      return fetchDashboard(organizationId, 7, bearer);
    },
    enabled: !!organizationId,
    refetchInterval: 60000,
    staleTime: 15000,
  });

  if (isLoading) {
    return (
      <div className="mb-6 rounded-2xl border border-white/60 bg-white/70 p-6 text-sm text-slate-500 shadow-sm backdrop-blur-xl">
        Computing workspace analytics…
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="status"
        className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
      >
        {error?.message || 'Analytics unavailable right now.'}
      </div>
    );
  }
  if (!data) return null;

  const { healthScore, healthLabel, kpis, team, risks, totals } = data;
  const scoreColor =
    healthScore >= 75 ? 'text-emerald-600' :
    healthScore >= 55 ? 'text-indigo-600' :
    healthScore >= 35 ? 'text-amber-600' : 'text-rose-600';

  const trend = (pct) => {
    if (pct > 0) return <span className="text-xs font-semibold text-emerald-600">▲ {pct}%</span>;
    if (pct < 0) return <span className="text-xs font-semibold text-rose-600">▼ {Math.abs(pct)}%</span>;
    return <span className="text-xs font-medium text-slate-400">—</span>;
  };

  const statusBadge = (status) => {
    const map = {
      Healthy: 'bg-emerald-100 text-emerald-700',
      'At Risk': 'bg-amber-100 text-amber-700',
      Critical: 'bg-rose-100 text-rose-700',
    };
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[status] || 'bg-slate-100 text-slate-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Health score + KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Org Health Score
          </p>
          <p className={`mt-1.5 text-4xl font-extrabold ${scoreColor}`}>{healthScore}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {healthLabel} · last {data.windowDays} days
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {totals.activeDevelopers} active devs · {totals.slackMessages} Slack msgs
          </p>
        </div>

        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{k.label}</p>
              {trend(k.changePct)}
            </div>
            <p className="mt-1.5 text-2xl font-bold text-slate-900">{k.current}</p>
            <p className="mt-1 text-xs text-slate-500">vs {k.previous} previous period</p>
          </div>
        ))}
      </div>
      {/* Team health + risks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Team health</h3>
          <ul className="mt-3 space-y-2">
            {(team || []).map((m) => (
              <li
                key={m.actor}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white/60 px-3 py-2"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-[11px] font-bold uppercase text-white">
                    {String(m.actor).charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold capitalize leading-tight text-slate-800">{m.actor}</p>
                    <p className="text-[11px] text-slate-500">
                      {m.prsMerged} merged · {m.issuesCompleted} done · {m.total} events
                    </p>
                  </div>
                </div>
                {statusBadge(m.status)}
              </li>
            ))}
            {(!team || team.length === 0) && (
              <li className="px-1 py-2 text-sm text-slate-500">No developer activity in this period yet.</li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm shadow-indigo-100/50 backdrop-blur-xl">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-600">Risks &amp; alerts</h3>
          <ul className="mt-3 space-y-2">
            {(risks || []).map((r, i) => (
              <li
                key={i}
                className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-800"
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
