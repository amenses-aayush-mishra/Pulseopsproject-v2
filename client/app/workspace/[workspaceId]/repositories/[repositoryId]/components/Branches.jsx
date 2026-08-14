'use client';

import { GitBranch, ExternalLink } from 'lucide-react';
import {
  SectionTitle,
  Card,
  EmptyState,
} from './primitives';

/** Branches: name, default-branch indicator, last commit SHA/message/date.
 * Fetched via one API call: /repos/{fullName}/branches. Each entry shows only
 * name + default + SHA — avoiding per-branch commit details (which would need
 * N+1 over-fetch). */
export default function Branches({ data }) {
  const branches = data?.github?.branches || [];

  if (branches.length === 0) {
    return <EmptyState icon={GitBranch} title="No branch data available" />;
  }

  const defaultBranch = data?.repository?.defaultBranch || 'main';
  const rendered = branches.map((b) => {
    const isDefault = b.name === defaultBranch;
    const htmlUrl = b.commit?.html_url || null;

    return (
      <div
        key={b.name}
        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition-all hover:border-indigo-100 hover:bg-slate-50"
      >
        <GitBranch
          className={`
            h-4 w-4 text-slate-400 shrink-0
            ${isDefault ? 'text-emerald-600' : ''}
          `}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-slate-800">
            {b.name}
            {isDefault && (
              <span className="ml-1 text-[10px] font-medium text-emerald-600">(default)</span>
            )}
          </p>
          {b.sha && (
            <p className="mt-0.5 text-xs text-slate-400">{b.sha.slice(0, 7)}</p>
          )}
        </div>

        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1 text-slate-300 transition-colors hover:text-indigo-600 text-[10px]"
          >
            <ExternalLink className="h-3 w-3" />
            View
          </a>
        )}
      </div>
    );
  });

  return (
    <Card>
      <SectionTitle
        icon={GitBranch}
        aside={<span className="text-[11px] text-slate-400">{branches.length} branches</span>}
      >
        Branches
      </SectionTitle>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rendered}
      </div>

      {branches.length === 0 && (
        <EmptyState icon={GitBranch} title="No branch data available" />
      )}
    </Card>
  );
}
