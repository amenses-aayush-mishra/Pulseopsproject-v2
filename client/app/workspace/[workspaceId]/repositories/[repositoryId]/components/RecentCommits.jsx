'use client';

import { ExternalLink } from 'lucide-react';
import {
  formatAgo,
  GitHubIcon,
  Avatar,
  SectionTitle,
  Card,
  Skeleton,
  EmptyState,
} from './primitives';

/** Recent Commits: message, short SHA, author + avatar, date, branch,
 * files changed/additions+deletions if available. Clickable rows → GitHub
 * commit URL. Limit = 8 (matches backend slice). */
export default function RecentCommits({ data }) {
  const commits = data?.github?.commits || [];

  if (commits.length === 0) {
    return <EmptyState icon={GitHubIcon} title="No recent commits available" />;
  }

  const rendered = commits.slice(0, 8).map((c) => {
    const shortSha = c.sha ? c.sha.slice(0, 7) : null;
    const htmlUrl = c.htmlUrl || null;
    const branch = c.branch || null;
    const { sha, message, authorName, authorLogin, avatarUrl, date, additions, deletions } = c;

    return (
      <li
        key={sha}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
      >
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400"
        />
        <div className="min-w-0 flex-1 pb-1">
          <p className="text-[13px] font-medium text-slate-800">{message}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {authorName} {authorLogin && ` · ${authorLogin}`}
            <span className="mx-1.5 text-slate-300">·</span>
            {formatAgo(date)}
          </p>
        </div>
        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 font-mono text-[11px] text-slate-400 transition-colors hover:text-indigo-600"
          >
            {shortSha}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {branch && (
          <span className="mt-1 text-xs text-slate-400">• {branch}</span>
        )}
      </li>
    );
  });

  return (
    <Card>
      <SectionTitle
        icon={GitBranch}
        aside={<span className="text-[11px] text-slate-400">{commits.length} commits</span>}
      >
        Recent Commits
      </SectionTitle>

      <ol className="mt-3 space-y-3">{rendered}</ol>

      {commits.length === 0 && (
        <EmptyState icon={GitHubIcon} title="No recent commits available" />
      )}
    </Card>
  );
}
