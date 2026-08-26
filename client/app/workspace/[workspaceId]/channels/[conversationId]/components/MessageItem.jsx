'use client';

import { MessageSquare, Bot, Info, Loader2 } from 'lucide-react';
import AttachmentCard from './AttachmentCard';

/** Replace Slack <@U123> and <#C123|name> tokens + linkify URLs. */
function formatText(text, usersMap) {
  let value = text || '';

  value = value.replace(/<@([UWB][A-Z0-9]+)(\|[^>]*)?>/g, (_, id, alias) => {
    const known = usersMap[id];
    const label = known ? `@${known}` : alias ? alias.slice(1) : `@${id.slice(0, 6)}`;
    return `<span class="font-semibold text-indigo-600">${label}</span>`;
  });

  value = value.replace(/<#([CGS][A-Z0-9]+)(\|[^>]*)?>/g, (_, _id, alias) => {
    return `<span class="font-semibold text-slate-600">#${alias ? alias.slice(1) : 'channel'}</span>`;
  });

  value = value.replace(
    /(\bhttps?:\/\/[^\s<]+[^\s<.,;:!?])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-indigo-600 underline hover:text-indigo-700">$1</a>'
  );

  value = value.replace(/`([^`]+)`/g, (_, code) => `<code class="rounded bg-slate-100 px-1 py-0.5 font-mono text-[12px] text-rose-600">${code}</code>`);

  return value;
}

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-teal-500',
  'bg-cyan-500',
];

function initialsOf(name) {
  return (name || '?')
    .split(/\s+/)
    .map((w) => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatClock(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ReactionPill({ name, reaction }) {
  const emoji = name;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
      title={(reaction.users || []).join(', ')}
    >
      {emoji} {reaction.count}
    </span>
  );
}

export default function MessageItem({
  message,
  usersMap,
  workspaceId,
  conversationId,
  threadOpen,
  onToggleThread,
  replies = [],
  repliesLoading = false,
}) {
  if (message.deletedAt) {
    return (
      <div className="px-4 py-2 text-sm italic text-slate-400">
        <span className="mr-1.5">⊘</span>This message was deleted.
      </div>
    );
  }

  const isSystem = message.messageType === 'system';
  const isBot = message.messageType === 'bot';
  const colorIdx = (message.author?.id?.length || 0) % AVATAR_COLORS.length;
  const reactions = message.reactions && typeof message.reactions === 'object' ? message.reactions : {};

  return (
    <div className="group flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
      {message.author?.avatarUrl ? (
        <img
          src={message.author.avatarUrl}
          alt={message.author.name}
          className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
          loading="lazy"
        />
      ) : (
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${AVATAR_COLORS[colorIdx]}`}
        >
          {initialsOf(message.author?.name)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-slate-900">
            {message.author?.name || 'Unknown'}
          </span>
          {isBot && (
            <span className="inline-flex items-center gap-0.5 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600">
              <Bot className="h-3 w-3" /> bot
            </span>
          )}
          {isSystem && (
            <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Info className="h-3 w-3" /> system
            </span>
          )}
          <span className="text-[11px] text-slate-400">
            {message.timestamp ? formatClock(message.timestamp) : message.slackMessageTs}
          </span>
          {message.editedAt && <span className="text-[11px] italic text-slate-400">(edited)</span>}
        </div>

        {message.text ? (
          <div
            className="mt-0.5 break-words text-[13px] leading-relaxed text-slate-700"
            dangerouslySetInnerHTML={{ __html: formatText(message.text, usersMap) }}
          />
        ) : (
          <p className="mt-0.5 text-[13px] italic text-slate-400">(message with no text)</p>
        )}

        {Object.keys(reactions).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {Object.entries(reactions).map(([name, reaction]) => (
              <ReactionPill key={name} name={name} reaction={reaction} />
            ))}
          </div>
        )}

        {(message.attachments || []).map((att) => (
          <AttachmentCard key={att.id} attachment={att} />
        ))}

        {message.replyCount > 0 && (
          <button
            type="button"
            onClick={onToggleThread}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
          >
            <MessageSquare className="h-3 w-3" />
            {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}

        {threadOpen && (
          <div className="mt-3 space-y-3 border-l-2 border-slate-200 pl-3">
            {repliesLoading ? (
              <div className="flex items-center gap-2 px-2 py-2 text-xs text-slate-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading replies…
              </div>
            ) : replies.length === 0 ? (
              <p className="px-2 py-2 text-xs text-slate-400">No replies.</p>
            ) : (
              replies.map((reply) => (
                <MessageItem
                  key={reply.slackMessageTs}
                  message={reply}
                  usersMap={usersMap}
                  workspaceId={workspaceId}
                  conversationId={conversationId}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}