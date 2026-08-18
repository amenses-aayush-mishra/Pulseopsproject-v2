'use client';

import { ExternalLink } from 'lucide-react';
import { SectionTitle, Card, EmptyState } from './primitives';

export default function Issues({ data }) {
  const issues = data?.github?.issues || [];

  if (issues.length === 0) {
    return <EmptyState icon={ExternalLink} title="No issue data available" />;
  }

  const rendered = issues.map((i) => (
    <div
      key={i.number}
      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition-all hover:border-indigo-100 hover:bg-slate-50"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-slate-800">{i.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          #{i.number} {i.authorLogin && ` · ${i.authorLogin}`}
        </p>
      </div>
      {i.htmlUrl && (
        <a
          href={i.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-slate-300 transition-colors hover:text-indigo-600 text-[10px]"
        >
          <ExternalLink className="h-3 w-3" />
          View
        </a>
      )}
    </div>
  ));

  return (
    <Card>
      <SectionTitle
        icon={ExternalLink}
        aside={<span className="text-[11px] text-slate-400">issues</span>}>
        Issues
      </SectionTitle>
      <div className="mt-3 space-y-1">{rendered}</div>
    </Card>
  );
}
