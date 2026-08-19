'use client';

import {
  Avatar,
  Badge,
  SectionTitle,
  Card,
  EmptyState,
} from './primitives';

/** Contributors: avatar, name, contribution count, contribution % (only if
 * reliably calculable), progress-bar visualization. GitHub already supplies
 * per-contributor commit counts, so % = (individual / total) × 100 rounded.
 * Progress bar is thin and subtle, consistent with PulseOps. */
export default function Contributors({ data }) {
  const contributors = data?.github?.contributors || [];

  if (contributors.length === 0) {
    return <EmptyState icon={null} title="No contributor data available" />;
  }

  // Total = sum of all contributors' contribution counts from the same list.
  // We already computed this in the backend (contributionPercent) but it's
  // recalculated here defensively.
  const total = contributors.reduce(
    (sum, c) => sum + (c.contributions || 0),
    0
  );

  const rendered = contributors.map((c) => {
    const percent = total > 0 ? Math.round(((c.contributions || 0) / total) * 100) : 0;
    const barPercent = percent; // 0–100 for inline bar styling

    return (
      <div
        key={c.login || c.avatarUrl}
        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:border-indigo-100 hover:bg-slate-50 hover:shadow-sm"
      >
        <Avatar url={c.avatarUrl} name={c.login} size="h-9 w-9" />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-800">
            {c.login}
          </p>
          <p className="text-[11px] text-slate-500">{c.contributions} commits</p>
        </div>

        {/* Thin progress bar */}
        <div className="w-24 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-colors duration-200 bg-emerald-600 ${
              barPercent >= 50 ? 'from-emerald-500 to-emerald-400' : barPercent > 0 ? 'from-violet-500 to-violet-400' : 'hidden'}
            }`}
            style={{ width: `${barPercent}%` }}
          />
        </div>

        {percent > 0 && (
          <span className="text-[11px] text-slate-500 ml-2">{percent}%</span>
        )}
      </div>
    );
  });

  return (
    <Card>
      <SectionTitle
        icon={null}
        aside={<span className="text-[11px] text-slate-400">
          {contributors.length} contributors
        </span>}
      >
        Contributors
      </SectionTitle>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rendered}
      </div>

      {contributors.length === 0 && (
        <div className="col-span-full">
          <EmptyState icon={null} title="No contributor data available" />
        </div>
      )}
    </Card>
  );
}
