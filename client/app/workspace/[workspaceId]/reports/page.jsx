'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import AISummaryPanel from '../../../_components/AISummaryPanel';
import AnalyticsCards from '../../../_components/AnalyticsCards';

export default function ReportsPage() {
  const params = useParams();
  const organizationId = params?.workspaceId || null;
  const [days, setDays] = useState(7);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">
        AI-generated engineering health reports for this workspace.
      </p>

      {/* Period selector */}
      <div className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white/80 p-1">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              days === d ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {/* Metrics snapshot for the selected window */}
      <div className="mt-5">
        <AnalyticsCards organizationId={organizationId} />
      </div>

      {/* AI report generator + latest report */}
      <div className="mt-2">
        <AISummaryPanel organizationId={organizationId} />
      </div>
    </div>
  );
}