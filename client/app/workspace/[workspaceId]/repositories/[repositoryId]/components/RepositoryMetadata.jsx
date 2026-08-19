'use client';

import { Info } from 'lucide-react';
import { SectionTitle, Card, EmptyState, Badge } from './primitives';

/** Repository Metadata: secondary repo facts fetched from the live GitHub
 *  detail + languages payload that aren't already headline metrics in
 *  RepositoryOverview. Best-effort — renders an empty state when the detail
 *  payload is unavailable. No data is invented here. */
export default function RepositoryMetadata({ data }) {
  const gh = data?.github || {};
  const detail = gh.detail || {};
  const languages = Array.isArray(gh.languages) ? gh.languages : [];

  if (!detail || Object.keys(detail).length === 0) {
    return (
      <EmptyState
        icon={Info}
        title="No metadata available"
        hint="Repository metadata will appear here once GitHub sync is available."
      />
    );
  }

  const rows = [
    { label: 'Owner', value: detail.owner || '—' },
    { label: 'Default branch', value: detail.defaultBranch || '—' },
    {
      label: 'Size',
      value: detail.size != null ? `${detail.size.toLocaleString()} KB` : '—',
    },
    {
      label: 'Archived',
      value: detail.archived ? 'Yes' : 'No',
      highlight: !!detail.archived,
    },
    { label: 'Fork', value: detail.fork ? 'Yes' : 'No' },
    { label: 'Watchers', value: detail.watchersCount ?? '—' },
  ];

  return (
    <Card>
      <SectionTitle
        icon={Info}
        aside={<span className="text-[11px] text-slate-400">metadata</span>}
      >
        Repository Metadata
      </SectionTitle>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 px-5 pb-2 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {row.label}
            </p>
            <p
              className={`mt-0.5 truncate text-sm font-semibold text-slate-900 ${
                row.highlight ? 'text-rose-600' : ''
              }`}
              title={String(row.value)}
            >
              {row.value}
            </p>
          </div>
        ))}
      </div>

      {languages.length > 0 && (
        <div className="mt-4 border-t border-slate-100 px-5 pb-5 pt-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Languages
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {languages.map((lang) => (
              <Badge key={lang.name}>
                {lang.name} · {lang.percent}%
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
