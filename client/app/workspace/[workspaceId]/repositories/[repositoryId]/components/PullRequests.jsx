'use client';

import { ExternalLink } from 'lucide-react';
import {
  SectionTitle,
  Card,
  EmptyState,
} from './primitives';

/** Pull Requests: title, number, status (open/merged/closed, visually distinct),
 * author + avatar, created/updated dates, review status, comment/review count,
 * labels, source/target branch — each field only if the API provides it.
 * Clickable → GitHub PR. */
export default function PullRequests({ data }) {
  const { recent = [], open = 0, merged = 0, closed = 0 } =
    data?.github?.pullRequests || { recent: [], open: 0, merged: 0, closed: 0 };

  if (recent.length === 0 && open === 0 && merged === 0 && closed === 0) {
    return <EmptyState icon={null} title="No pull request data available" />;
  }

  const rendered = recent.map((pr) => {
    const mergedFlag = !!pr.merged;
    const openFlag = pr.state === 'open';
    const closedFlag = pr.state === 'closed' && !mergedFlag;

    return (
      <li
        key={pr.number}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            mergedFlag ? 'bg-violet-500' : openFlag ? 'bg-emerald-500' : 'bg-rose-400'
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800">{pr.title}</p>
          <p className="text-[11px] text-slate-500">
            #{pr.number} {pr.authorLogin ? ` · ${pr.authorLogin}` : ''}
          </p>
        </div>

        {/* Status badge + labels */}
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${mergedFlag ? 'bg-violet-50 text-violet-700' : openFlag ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
          >
            {mergedFlag ? 'merged' : openFlag ? 'open' : 'closed'}
          </span>
          {pr.labels && pr.labels.length > 0 && (
            <span className="flex gap-1">
              {pr.labels.map((l) => (
                <span
                  key={l.name}
                  className={`inline-flex items-center rounded-full px-1.5 py-0.25 text-[9px] font-medium ${l.color ? `bg-${l.color}-200 text-${l.color}-800` : 'bg-slate-300 text-slate-600'}`}
                >
                  {l.name}
                </span>
              ))}
            </span>
          )}
        </div>

        {/* Review & comment counts (optional but available) */}
        {pr.commentCount !== null && (
          <span className="mt-1 text-xs text-slate-400">💬 {pr.commentCount}</span>
        )}
        {pr.reviewCommentCount !== null && (
          <span className="mt-1 text-xs text-slate-400">👁 {pr.reviewCommentCount}</span>
        )}

        {/* Head/base refs (optional) */}
        {pr.headRef && (
          <span className="mt-1 text-xs text-slate-400">from {pr.headRef}</span>
        )}
        {pr.baseRef && (
          <span className="mt-1 text-xs text-slate-400">into {pr.baseRef}</span>
        )}

        {pr.htmlUrl && (
          <a
            href={pr.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-indigo-600"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View PR
          </a>
        )}
      </li>
    );
  });

  // Fallback stat cards when no recent PRs are rendered
  const statsRendered = () => {
    if (recent.length > 0) return null;
    return (
      <div className="mt-4 grid grid-cols-3 gap-3">
        <PrStat label="Open" value={open} badgeClass="bg-emerald-50 text-emerald-700" />
        <PrStat label="Merged" value={merged} badgeClass="bg-violet-50 text-violet-700" />
        <PrStat label="Closed" value={closed} badgeClass="bg-rose-50 text-rose-700" />
      </div>
    );
  };

  return (
    <Card>
      <SectionTitle icon={null} aside={<span className="text-[11px] text-slate-400">pull requests</span>}>
        Pull Requests
      </SectionTitle>

      <ul className="mt-4 space-y-1">{rendered}</ul>

      {/* Summary stats when there are no recent PRs in the slice */}
      {recent.length === 0 && statsRendered()}

      {recent.length === 0 && (
        <EmptyState icon={null} title="No pull request data available" />
      )}
    </Card>
  );
}

/** PrStat helper (kept local for this component only — it's the same as in
 * GitHubPanel.jsx but we reuse the same design tokens.) */
function PrStat({ label, value, badgeClass }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-2 py-3">
      <span className="text-lg font-bold text-slate-900">{value}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>{label}</span>
    </div>
  );
}