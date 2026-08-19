'use client';

import { ExternalLink } from 'lucide-react';
import {
  formatAgo,
  GitHubIcon,
  Avatar,
  Badge,
  SectionTitle,
  Card,
  EmptyState,
} from './primitives';
/** Latest Commit: message, SHA, author + avatar, date, branch, files changed,
 * additions/deletions. Clickable → GitHub commit URL if available. */
export default function LatestCommit({ data }) {
  const latest = data?.github?.latestCommit || data?.github?.latest;

  if (!latest) {
    return <EmptyState icon={GitHubIcon} title="No commit data available" />;
  }

  const filesCount = latest?.files?.length || 0;

  const {
    shortSha,
    message,
    authorName,
    avatarUrl,
    date,
  } = latest;

  const detectedCommitType = getCommitType(message);

  const htmlUrl = latest?.htmlUrl || null;

  return (
    <Card>
      <SectionTitle
        icon={GitHubIcon}
        aside={
          <span className="text-[11px] text-slate-400">
            Latest commit
          </span>
        }
      >
        Latest Commit
      </SectionTitle>

      {/* Author + SHA */}
      <div className="flex items-start gap-3 px-5 pt-4">
        <Avatar
          url={avatarUrl}
          name={authorName}
          size="h-10 w-10"
        />

        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-slate-900">
            {message}
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            {authorName}{' '}
            {commitTypeBadge(detectedCommitType)}
            <span className="mx-1.5 text-slate-300">·</span>
            {formatAgo(date)}
          </p>

          {/* Branch label */}
          <div className="mt-2 text-xs text-slate-400">
            Branch: {latest.branch || 'main'}
          </div>

          {/* File stats */}
          {filesCount > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              {filesCount} file
              {filesCount !== 1 ? 's' : ''} changed

              {latest.additions > 0 && (
                <span className="text-emerald-600">
                  +{latest.additions}
                </span>
              )}

              {latest.deletions > 0 && (
                <span className="text-rose-600">
                  -{latest.deletions}
                </span>
              )}
            </div>
          )}

          {/* SHA clickable link */}
          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 font-mono text-[11px] text-indigo-600 hover:text-indigo-700"
            >
              {shortSha}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* File details meta */}
      {filesCount > 0 && (
        <div className="mt-4 border-t border-slate-100 px-5 pt-4">
          <p className="text-xs text-slate-400">
            {filesCount} file{filesCount !== 1 ? 's' : ''} changed
            {latest.additions > 0 &&
              ` · +${latest.additions} additions`}
            {latest.deletions > 0 &&
              ` · -${latest.deletions} deletions`}
          </p>
        </div>
      )}
    </Card>
  );
}

/**
 * Detect conventional commit type from the commit message.
 * Examples:
 * feat: add login
 * fix(auth): resolve session issue
 * docs: update README
 */
function getCommitType(message) {
  if (!message) return null;

  const match = message.match(
    /^(feat|fix|docs|style|refactor|test|chore|build|ci|perf|revert)(?:\([^)]+\))?!?:/i
  );

  return match ? match[1].toLowerCase() : null;
}

/** Small badge for the detected commit type. */
function commitTypeBadge(type) {
  if (!type) return null;

  return (
    <Badge
      className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700"
    >
      {type}
    </Badge>
  );
}