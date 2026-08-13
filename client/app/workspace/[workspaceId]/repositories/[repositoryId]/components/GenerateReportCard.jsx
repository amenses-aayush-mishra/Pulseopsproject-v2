'use client';

import { useState } from 'react';
import { FileText, CheckCircle2 } from 'lucide-react';

/**
 * Bottom section — Generate AI Report.
 * UI only for now: the button shows a placeholder toast. In Phase 2 this will
 * combine GitHub activity, Slack communication and Jira progress into one
 * executive repository report.
 */
export default function GenerateReportCard() {
  const [toast, setToast] = useState(false);

  const handleGenerate = () => {
    setToast(true);
    window.setTimeout(() => setToast(false), 3200);
  };

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-[1px] shadow-lg">
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 px-6 py-8 sm:px-10">
        <div className="flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight text-white">
              <FileText className="h-5 w-5" />
              Generate AI Repository Report
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-indigo-100">
              An intelligent executive summary that combines GitHub activity,
              Slack communication and Jira progress into one clear view of
              repository health — ready to share with your team and stakeholders.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="shrink-0 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition-all hover:bg-indigo-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-white/60"
          >
            Generate Report
          </button>
        </div>
      </div>

      {toast && (
        <div
          role="status"
          className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl bg-white px-5 py-3 shadow-2xl ring-1 ring-slate-200"
        >
          <CheckCircle2 className="h-5 w-5 text-violet-600" />
          <p className="text-sm font-semibold text-slate-800">
            AI Repository Reports will be available in Phase 2.
          </p>
        </div>
      )}
    </section>
  );
}