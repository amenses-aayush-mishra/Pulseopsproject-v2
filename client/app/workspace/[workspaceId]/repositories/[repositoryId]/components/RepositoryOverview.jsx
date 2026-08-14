'use client';

import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  formatDate,
  formatAgo,
  GitHubIcon,
  Avatar,
  Badge,
  SectionTitle,
  Card,
  EmptyState,
} from './primitives';

/** Repository Overview: name, owner, full name, description, public/private,
 * default branch, URL, created/updated/pushed dates, language, license,
 * topics, stars, forks, watchers, open issues, size, "Open on GitHub". */
export default function RepositoryOverview({ data }) {
  const repo = data?.repository || {};
  const gh = data?.github || {};
  const detail = gh.detail || {};

  // Prefer the new shape from the backend; fall back to the legacy repo fields.
  const name = repo.name || detail?.name || '—';
  const fullName = repo.fullName || detail?.fullName || `${name}/?repo`;
  const description = repo.description || detail?.description || '—';
  const htmlUrl = repo.htmlUrl || detail?.htmlUrl || '#';
  const isPrivate =
    repo.private ?? detail?.private ? 'Private' : 'Public';
  const defaultBranch = repo.defaultBranch || detail?.defaultBranch || 'main';
  const createdAt = repo.importedAt || detail?.createdAt || null;
  const updatedAt = detail?.updatedAt || null;
  const pushedAt = detail?.pushedAt || null;
  const language = detail?.language || null;
  const license = detail?.license || null;
  const topics = Array.isArray(detail?.topics) ? detail.topics : [];
  const stargazersCount = detail?.stargazersCount ?? 0;
  const forksCount = detail?.forksCount ?? 0;
  const watchersCount = detail?.watchersCount ?? 0;
  const openIssuesCount = detail?.openIssuesCount ?? 0;

  return (
    <Card>
      <SectionTitle
        icon={GitHubIcon}
        aside={
          <span className="text-[11px] text-slate-400">
            {stargazersCount} ⭐ · {forksCount} 🍴 · {watchersCount} 👁️
          </span>
        }
      >
        Repository
      </SectionTitle>

      {/* Basic info row */}
      <div className="grid grid-cols-2 gap-3 px-5 pt-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Full name</p>
          <p className="truncate text-sm font-semibold text-slate-900" title={fullName}>
            {fullName}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Private</p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${
              isPrivate === 'Private'
                ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
                : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
            }`}
          >
            {isPrivate}
          </span>
        </div>
        {language && (
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Language</p>
            <Badge>{language}</Badge>
          </div>
        )}
        {license && (
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">License</p>
            <Badge>{typeof license === 'object' ? license.spdx_id || license.name : license}</Badge>
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">Topics</p>
          {topics.map((t) => (
            <span
              key={t}
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100/50 mr-1 mb-1`}
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Dates / stats row */}
      <div className="flex flex-wrap items-center gap-3 px-5 pt-3 sm:gap-4">
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <GitHubIcon className="h-3.5 w-3.5" /> Created
          <span>{formatDate(createdAt)}</span>
        </div>
        {pushedAt && (
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <GitHubIcon className="h-3.5 w-3.5" /> Pushed
            <span>{formatDate(pushedAt)}</span>
          </div>
        )}
        {updatedAt && (
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <GitHubIcon className="h-3.5 w-3.5" /> Updated
            <span>{formatDate(updatedAt)}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <GitHubIcon className="h-3.5 w-3.5" /> Stars
          <span>{stargazersCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <GitHubIcon className="h-3.5 w-3.5" /> Forks
          <span>{forksCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <GitHubIcon className="h-3.5 w-3.5" /> Open issues
          <span>{openIssuesCount}</span>
        </div>
      </div>

      {/* "Open on GitHub" button */}
      <div className="px-5 pt-4 text-right">
        <a
          href={htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open on GitHub
        </a>
      </div>
    </Card>
  );
}
