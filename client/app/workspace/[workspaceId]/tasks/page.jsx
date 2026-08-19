'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, ExternalLink, CalendarDays, CheckSquare, User } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

// ─── Jira icon (matches the Integrations page) ────────────────────────────────

function JiraIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.571 11.571L5.714 5.714 0 0h24L11.571 11.571z" fill="#2684FF" />
      <path d="M5.714 18.286L11.57 12.43 17.43 18.286 11.571 24z" fill="#2684FF" />
      <path d="M5.714 5.714L0 11.429l5.714 5.714L11.43 11.43z" fill="#2684FF" opacity=".7" />
    </svg>
  );
}

// ─── Task card ───────────────────────────────────────────────────────────────

function TaskCard({ task }) {
  const updatedDate = task.updatedAt || task.createdAt
    ? new Date(task.updatedAt || task.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const hasUrl = Boolean(task.url && typeof task.url === 'string' && task.url.trim());

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-indigo-200 hover:shadow-md">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50">
              <JiraIcon />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 truncate">
                {task.title || 'Untitled Task'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-500 truncate">
                {task.key && (
                  <span className="font-mono font-medium text-slate-700">{task.key}</span>
                )}
                {task.key && task.projectKey && <span>•</span>}
                {task.projectKey && <span>{task.projectKey}</span>}
                {task.issueType && (
                  <>
                    {(task.key || task.projectKey) && <span>•</span>}
                    <span className="capitalize">{task.issueType}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {task.status && (
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                {task.status}
              </span>
            )}
            {task.priority && (
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-600/10">
                {task.priority}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <User className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Assignee:</span>
            <span className="font-medium text-slate-900 truncate">
              {task.assignee || 'Unassigned'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarDays className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500">Updated:</span>
            <span className="font-medium text-slate-900">{updatedDate}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end border-t border-slate-100 pt-5">
          {hasUrl ? (
            <a
              href={task.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
            >
              <ExternalLink className="h-4 w-4" />
              Open in Jira
            </a>
          ) : (
            <span className="text-xs text-slate-400">Jira URL unavailable</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TasksPage({ params }) {
  const { workspaceId } = params;
  const { data: session } = useSession();
  const token =
    session?.accessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || data?.error || `Failed to load tasks (${res.status}).`);
      }
      const data = await res.json();
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (err) {
      setError(err.message || 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && workspaceId) {
      loadTasks();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, workspaceId]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tasks</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tasks and issues synced into this workspace from your Jira integration.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button
            type="button"
            onClick={loadTasks}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm px-6 py-16 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <CheckSquare className="h-6 w-6 text-slate-500" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">No tasks yet</h2>
          <p className="mt-1 text-sm text-slate-500">
            Jira issues synced into this workspace will appear here. Connect Jira and sync a project from the Integrations page.
          </p>
          <Link
            href={`/workspace/${workspaceId}/integrations`}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Go to Integrations
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskCard key={task._id || task.key} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
