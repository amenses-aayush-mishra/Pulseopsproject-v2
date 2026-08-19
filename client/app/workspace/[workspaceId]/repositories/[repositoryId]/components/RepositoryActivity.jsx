'use client';

import {
  Activity as ActivityIcon,
  GitCommit,
  Users,
  GitPullRequest,
  AlertCircle,
} from 'lucide-react';
import { SectionTitle, Card, EmptyState } from './primitives';

/** Repository Activity: a compact summary of recent, live GitHub activity —
 *  commits in the last 7 days, contributors, open pull requests, open issues,
 *  plus a languages breakdown. All values come straight from the existing
 *  backend response (github.activity / github.detail / github.languages); no
 *  data is invented here. Best-effort: renders an empty state when no activity
 *  is available. */
export default function RepositoryActivity({ data }) {
  const gh = data?.github || {};
  const activity = gh.activity || {};
  const detail = gh.detail || {};
  const languages = Array.isArray(gh.languages) ? gh.languages : [];

  const commitsLast7d = activity.commitsLast7d ?? 0;
  const contributorCount = activity.contributorCount ?? 0;
  const openPullRequests = activity.openPullRequests ?? 0;
  const openIssues = detail.openIssuesCount ?? 0;

  const hasSignal =
    commitsLast7d > 0 ||
    contributorCount > 0 ||
    openPullRequests > 0 ||
    openIssues > 0;

  if (!hasSignal && languages.length === 0) {
    return (
      <EmptyState
        icon={ActivityIcon}
        title="No activity data available"
        hint="Recent GitHub activity will appear here once commits are detected."
      />
    );
  }

  const stats = [
    { label: 'Commits (7d)', value: commitsLast7d, icon: GitCommit },
    { label: 'Contributors', value: contributorCount, icon: Users },
    { label: 'Open PRs', value: openPullRequests, icon: GitPullRequest },
    { label: 'Open issues', value: openIssues, icon: AlertCircle },
  ];

  return (
    <Card>
      <SectionTitle
        icon={ActivityIcon}
        aside={<span className="text-[11px] text-slate-400">last 7 days</span>}
      >
        Repository Activity
      </SectionTitle>

      <div className="mt-4 grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2.5 rounded-xl bg-slate-50 px-3 py-3"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200/70">
              <s.icon className="h-4 w-4 text-indigo-500" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                {s.value}
              </div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {languages.length > 0 && (
        <div className="mt-4 border-t border-slate-100 px-5 pb-5 pt-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Languages
          </p>
          <div className="mt-3 space-y-3">
            {languages.map((lang) => (
              <div key={lang.name}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[13px] font-medium text-slate-700">
                    {lang.name}
                  </span>
                  <span className="text-[13px] font-semibold text-slate-900">
                    {lang.percent}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${lang.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
