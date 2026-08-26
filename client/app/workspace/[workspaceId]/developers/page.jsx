'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { fetchDevelopers } from '../../../_components/analyticsApi';

const badge = {
  Healthy: 'bg-emerald-100 text-emerald-700',
  'At Risk': 'bg-amber-100 text-amber-700',
  Critical: 'bg-rose-100 text-rose-700',
};

export default function DevelopersPage() {
  const params = useParams();
  const { data: session } = useSession();
  const organizationId = params?.workspaceId || session?.user?.activeOrganizationId;
  const [search, setSearch] = useState('');

  let stored = null;
  try { stored = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null; } catch {}
  const token = session?.accessToken || stored;

  const { data: devs, isLoading, isError, error } = useQuery({
    queryKey: ['developers', organizationId],
    queryFn: () => fetchDevelopers(organizationId, 30, token),
    enabled: !!organizationId,
    staleTime: 20000,
  });

  const filtered = (devs || []).filter((d) =>
    String(d.actor).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Developers</h1>
      <p className="mt-1 text-sm text-slate-500">Activity across the last 30 days.</p>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search developers…"
        className="mt-4 w-full max-w-sm rounded-xl border border-slate-300 bg-white/80 px-3.5 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
      />

      {isLoading && <p className="mt-6 text-sm text-slate-500">Loading developers…</p>}
      {isError && (
        <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error?.message || 'Could not load developers.'}
        </p>
      )}

      {!isLoading && !isError && (
        <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white/70">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Developer</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Events</th>
                <th className="px-4 py-3">PRs Merged</th>
                <th className="px-4 py-3">PRs Opened</th>
                <th className="px-4 py-3">Issues Done</th>
                <th className="px-4 py-3">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.actor} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-semibold capitalize text-slate-800">{d.actor}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge[d.status] || 'bg-slate-100 text-slate-600'}`}>
                      {d.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{d.total}</td>
                  <td className="px-4 py-3">{d.prsMerged}</td>
                  <td className="px-4 py-3">{d.prsOpened}</td>
                  <td className="px-4 py-3">{d.issuesCompleted}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(d.lastActive).toLocaleDateString()}
                    {d.daysIdle === 0 ? ' · today' : ` · ${d.daysIdle}d ago`}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No developers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}