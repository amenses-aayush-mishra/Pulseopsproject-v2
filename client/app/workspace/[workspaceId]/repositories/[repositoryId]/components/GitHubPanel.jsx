'use client';

import {
  Star,
  GitFork,
  GitBranch,
  Users,
  GitPullRequest,
  CalendarDays,
  Clock,
  ExternalLink,
  ShieldAlert,
  Activity as ActivityIcon,
} from 'lucide-react';

function GitHubIcon() {
  return (
    <svg className="h-6 w-6 text-slate-700" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  );
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatAgo(ts) {
  if (!ts) return '';
  const mins = Math.max(1, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function Avatar({ url, name, size = 'h-8 w-8', textClass = 'text-[11px]' }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || 'contributor'}
        referrerPolicy="no-referrer"
        className={`${size} shrink-0 rounded-full object-cover ring-2 ring-slate-100`}
      />
    );
  }
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  return (
    <span
      className={`${size} ${textClass} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white ring-2 ring-slate-100`}
    >
      {initials}
    </span>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
      {children}
    </span>
  );
}

function SectionTitle({ icon: Icon, children, aside }) {
  return (
    <div className="flex items-center justify-between px-5 pt-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icon className="h-4 w-4 text-slate-400" />
        {children}
      </h3>
      {aside}
    </div>
  );
}

function Metric({ title, value, icon }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-slate-200/70">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900" title={String(value)}>
          {value}
        </div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      </div>
    </div>
  );
}
export default function GitHubPanel({ data }) {
  const repo = data?.repository || {};
  const gh = data?.github || {};
  const detail = gh.detail;
  const commits = gh.commits || [];
  const latest = commits[0];
  const rest = commits.slice(1);
  const contributors = gh.contributors || [];
  const prs = gh.pullRequests || { open: 0, merged: 0, closed: 0, recent: [] };
  const activity = gh.activity || { commitsLast7d: 0, contributorCount: 0 };
  const openUrl = repo.htmlUrl || detail?.htmlUrl;

  return (
    <section className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Repo identity */}
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <GitHubIcon />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900">
              {repo.name || detail?.name}
            </h2>
            <p className="truncate text-sm text-slate-500">
              {repo.fullName || detail?.fullName}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
              repo.private ?? detail?.private
                ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
            }`}
          >
            {(repo.private ?? detail?.private) ? 'Private' : 'Public'}
          </span>
          {openUrl && (
            <a
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              GitHub
            </a>
          )}
        </div>
      </div>

      {/* Info chips */}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <Badge>
          <GitBranch className="h-3.5 w-3.5" /> {repo.defaultBranch || detail?.defaultBranch || 'main'}
        </Badge>
        {detail?.language && <Badge>{detail.language}</Badge>}
      </div>

      {/* Key metrics strip */}
      <div className="mx-5 mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
        <Metric title="Stars" value={detail?.stargazersCount ?? '—'} icon={<Star className="h-4 w-4 text-amber-500" />} />
        <Metric title="Forks" value={detail?.forksCount ?? '—'} icon={<GitFork className="h-4 w-4 text-sky-500" />} />
        <Metric title="Created" value={formatDate(detail?.createdAt)} icon={<CalendarDays className="h-4 w-4 text-indigo-500" />} />
        <Metric title="Updated" value={formatDate(detail?.updatedAt)} icon={<Clock className="h-4 w-4 text-emerald-500" />} />
      </div>

      {/* Activity summary */}
      <div className="mx-5 mt-4 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
          <ActivityIcon className="h-4 w-4 text-indigo-600" />
        </div>
        <p className="text-[13px] text-slate-700">
          <span className="font-semibold text-slate-900">{activity.commitsLast7d} commits</span>{' '}
          in the last 7 days from{' '}
          <span className="font-semibold text-slate-900">{activity.contributorCount}</span>{' '}
          contributors.
          {!gh.detail && (
            <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
              <ShieldAlert className="h-3.5 w-3.5" /> Live GitHub sync unavailable
            </span>
          )}
        </p>
      </div>

      {/* Featured latest commit */}
      <div className="border-t border-slate-100 px-5 pb-5 pt-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          Latest Commit
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
            Featured
          </span>
        </h3>
        {latest ? (
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="flex items-start gap-3">
              <Avatar url={latest.avatarUrl} name={latest.authorName} size="h-9 w-9" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-slate-900">{latest.message}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {latest.authorName}
                  <span className="mx-1.5 text-slate-300">·</span>
                  {formatAgo(latest.date)}
                </p>
                {latest.htmlUrl && (
                  <a
                    href={latest.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-indigo-600 hover:text-indigo-700"
                  >
                    {latest.shortSha} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyNote>No commit data available right now.</EmptyNote>
        )}
      </div>

      {/* Featured + recent commits timeline */}
      <div className="border-t border-slate-100 px-5 pb-2 pt-5">
        <SectionTitle
          icon={GitBranch}
          aside={<span className="text-[11px] text-slate-400">{commits.length} commits</span>}
        >
          Recent Commits
        </SectionTitle>
        <ol className="mt-3 space-y-3">
          {rest.map((commit) => (
            <li key={commit.sha} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-[13px] font-medium text-slate-800">{commit.message}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {commit.authorName}
                  <span className="mx-1.5 text-slate-300">·</span>
                  {formatAgo(commit.date)}
                </p>
              </div>
              {commit.htmlUrl && (
                <a
                  href={commit.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 font-mono text-[11px] text-slate-400 transition-colors hover:text-indigo-600"
                >
                  {commit.shortSha}
                </a>
              )}
            </li>
          ))}
        </ol>
        {commits.length === 0 && <EmptyNote>No recent commits available.</EmptyNote>}
      </div>

      {/* Contributors */}
      <div className="border-t border-slate-100 px-5 pb-2 pt-5">
        <SectionTitle
          icon={Users}
          aside={<span className="text-[11px] text-slate-400">{contributors.length} contributors</span>}
        >
          Contributors
        </SectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {contributors.map((c) => (
            <div
              key={c.login || c.avatarUrl}
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:border-indigo-100 hover:bg-slate-50 hover:shadow-sm"
            >
              <Avatar url={c.avatarUrl} name={c.login} size="h-9 w-9" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-slate-800">{c.login}</p>
                <p className="text-[11px] text-slate-500">{c.contributions} commits</p>
              </div>
            </div>
          ))}
          {contributors.length === 0 && (
            <div className="col-span-full">
              <EmptyNote>No contributor data available.</EmptyNote>
            </div>
          )}
        </div>
      </div>

      {/* Pull requests overview */}
      <div className="border-t border-slate-100 px-5 pb-5 pt-5">
        <SectionTitle icon={GitPullRequest} aside={<span className="text-[11px] text-slate-400">pull requests</span>}>
          Pull Requests
        </SectionTitle>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <PrStat label="Open" value={prs.open} badgeClass="bg-emerald-50 text-emerald-700" />
          <PrStat label="Merged" value={prs.merged} badgeClass="bg-violet-50 text-violet-700" />
          <PrStat label="Closed" value={prs.closed} badgeClass="bg-rose-50 text-rose-700" />
        </div>
        <ul className="mt-4 space-y-1">
          {prs.recent.map((pr) => (
            <li
              key={pr.number}
              className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  pr.merged ? 'bg-violet-500' : pr.state === 'open' ? 'bg-emerald-500' : 'bg-rose-400'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-slate-800">{pr.title}</p>
                <p className="text-[11px] text-slate-500">
                  #{pr.number}
                  {pr.authorLogin ? ` · ${pr.authorLogin}` : ''}
                </p>
              </div>
              {pr.htmlUrl && (
                <a
                  href={pr.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 transition-colors hover:text-indigo-600"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
          {prs.recent.length === 0 && <EmptyNote>No pull request data available.</EmptyNote>}
        </ul>
      </div>
    </section>
  );
}

function PrStat({ label, value, badgeClass }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-2 py-3">
      <span className="text-lg font-bold text-slate-900">{value}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>{label}</span>
    </div>
  );
}

function EmptyNote({ children }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}