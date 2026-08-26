'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, Users, Activity } from 'lucide-react';
import { fetchDevelopers } from '../../../_components/analyticsApi';

const statusBadge = {
  Healthy: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'At Risk': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  Critical: 'bg-rose-50 text-rose-700 ring-rose-600/20',
};

export default function DevelopersPage() {
  const params = useParams();
  const { data: session } = useSession();
  const organizationId = params?.workspaceId || session?.user?.activeOrganizationId;
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(30);

  let stored = null;
  try { stored = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null; } catch {}
  const token = session?.accessToken || stored;

  const { data: devs, isLoading, isError, error } = useQuery({
    queryKey: ['developers', organizationId, days],
    queryFn: () => fetchDevelopers(organizationId, days, token),
    enabled: !!organizationId,
    staleTime: 20000,
  });

  const filtered = (devs || []).filter((d) =>
    String(d.actor).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Developer Health & Activity</h1>
          <p className="mt-1 text-sm text-slate-500">
            Per-developer contribution metrics, health status, and workload tracking.
          </p>
        </div>

        {/* Period Selector */}
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                days === d
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Last {d} days
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search developer names..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            Loading developer health metrics…
          </div>
        </div>
      )}

      {isError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm">
          {error?.message || 'Could not load developers.'}
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead>
                <tr className="bg-slate-50/70 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Developer</th>
                  <th className="px-5 py-3.5">Health Status</th>
                  <th className="px-5 py-3.5">Total Events</th>
                  <th className="px-5 py-3.5">PRs Merged</th>
                  <th className="px-5 py-3.5">PRs Opened</th>
                  <th className="px-5 py-3.5">Issues Done</th>
                  <th className="px-5 py-3.5">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((d) => (
                  <tr key={d.actor} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold uppercase text-white shadow-sm">
                          {String(d.actor).charAt(0)}
                        </span>
                        <span className="font-semibold capitalize text-slate-900">{d.actor}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${statusBadge[d.status] || 'bg-slate-100 text-slate-600'}`}>
                        {d.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{d.total}</td>
                    <td className="px-5 py-4 text-emerald-600 font-semibold">{d.prsMerged}</td>
                    <td className="px-5 py-4 text-indigo-600 font-semibold">{d.prsOpened}</td>
                    <td className="px-5 py-4 text-purple-600 font-semibold">{d.issuesCompleted}</td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {d.lastActive ? new Date(d.lastActive).toLocaleDateString() : '—'}
                      {d.daysIdle === 0 ? (
                        <span className="ml-1 text-emerald-600 font-semibold">· today</span>
                      ) : d.daysIdle ? (
                        <span className="ml-1 text-slate-400">· {d.daysIdle}d ago</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
                        <Users className="h-5 w-5" />
                      </div>
                      No active developer activity found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}