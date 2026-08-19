'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Check, Copy } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

// ─── Mini UI components ─────────────────────────────────────────────────────

function IntegrationCard({ icon, title, description, badge, action }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              {icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{description}</p>
            </div>
          </div>
          <div className="shrink-0">{badge}</div>
        </div>
        {action && <div className="mt-6 border-t border-slate-100 pt-6">{action}</div>}
      </div>
    </div>
  );
}

function ConnectedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
      <Check className="h-3 w-3" /> Connected
    </span>
  );
}

// ─── GitHub icon ─────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg className="h-6 w-6 text-slate-700" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
    </svg>
  );
}

// ─── Slack icon ───────────────────────────────────────────────────────────────

function SlackIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" fill="#E01E5A" />
    </svg>
  );
}

// ─── Jira icon ────────────────────────────────────────────────────────────────

function JiraIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11.571 11.571L5.714 5.714 0 0h24L11.571 11.571z" fill="#2684FF" />
      <path d="M5.714 18.286L11.57 12.43 17.43 18.286 11.571 24z" fill="#2684FF" />
      <path d="M5.714 5.714L0 11.429l5.714 5.714L11.43 11.43z" fill="#2684FF" opacity=".7" />
    </svg>
  );
}

// ─── GitHub Integration Panel ─────────────────────────────────────────────────

function GitHubPanel({ workspaceId, token }) {
  const [connecting, setConnecting] = useState(false);
  const [repos, setRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState('');

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/status`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setIsConnected(true);
          loadRepos();
        }
      }
    } catch {
      // Ignore network errors for status check to prevent red alerts
    }
  };

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'github') {
      setIsConnected(true);
      loadRepos();
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      loadStatus();
    }
  }, [token]);

  const loadRepos = async () => {
    setLoadingRepos(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/repositories`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        setRepos(data);
      } else {
        const data = await res.json();
        setConnectError(data?.error || 'Failed to load repositories.');
      }
    } catch {
      setConnectError('Could not load repositories from GitHub.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/connect`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      const data = await res.json();
      if (data.url) {
        const redirectUri = encodeURIComponent('http://localhost:5000/api/integrations/github/callback');
        const urlObj = new URL(data.url);
        urlObj.searchParams.set('redirect_uri', decodeURIComponent(redirectUri));
        window.location.href = urlObj.toString();
      } else {
        setConnectError(data.error || 'Could not initiate GitHub connection.');
        setConnecting(false);
      }
    } catch {
      setConnectError('Could not reach the server.');
      setConnecting(false);
    }
  };

  const toggleRepo = (id) =>
    setSelectedRepos((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const handleSync = async () => {
    if (selectedRepos.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/track-repositories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryIds: selectedRepos }),
      });
      if (res.ok) setSyncSuccess(true);
    } catch {
      /* swallow */
    } finally {
      setSyncing(false);
    }
  };

  return (
    <IntegrationCard
      icon={<GitHubIcon />}
      title="GitHub"
      description="Sync repositories and track pull requests automatically."
      badge={isConnected ? <ConnectedBadge /> : undefined}
      action={
        !isConnected ? (
          <div className="space-y-3">
            {connectError && (
              <p className="text-sm text-rose-600">{connectError}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitHubIcon />}
              Connect GitHub
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">Select repositories to track</h4>
              <button
                onClick={loadRepos}
                className="text-xs text-indigo-600 hover:underline"
              >
                Refresh
              </button>
            </div>
            {connectError && <p className="text-sm text-rose-600">{connectError}</p>}
            {loadingRepos ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : syncSuccess ? (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-sm font-medium text-emerald-800">
                ✓ Synced {selectedRepos.length} {selectedRepos.length === 1 ? 'repository' : 'repositories'} successfully.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {repos.length === 0 && (
                    <p className="p-4 text-sm text-slate-400">No repositories found.</p>
                  )}
                  {repos.map((repo) => (
                    <label
                      key={repo.id}
                      className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRepos.includes(repo.id)}
                        onChange={() => toggleRepo(repo.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate flex items-center gap-2">
                          {repo.full_name || repo.name}
                          {repo.private && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">Private</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Updated {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleSync}
                    disabled={selectedRepos.length === 0 || syncing}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
                    Import Selected ({selectedRepos.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      }
    />
  );
}

// ─── Slack Integration Panel ──────────────────────────────────────────────────
//
// Phase 3: OAuth connect + status + test message. `token` here is strictly
// the existing PulseOps application bearer token (identical to what
// GitHubPanel receives) — the backend never returns any Slack credential
// (webhook URL, decrypted or otherwise) in any response this panel reads.

function SlackPanel({ workspaceId, token }) {
  const [statusLoading, setStatusLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok: boolean, message: string }
  console.log('[SlackPanel] RENDER', {
    workspaceId,
    hasToken: Boolean(token),
    statusLoading,
    isConnected,
  });

  const loadStatus = async () => {
    setStatusLoading(true);
    console.log('[SlackPanel] loadStatus START');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/status`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      console.log('[SlackPanel] status response', res.status);
      if (res.ok) {
        const data = await res.json();
        setIsConnected(Boolean(data.connected));
        setTeamName(data.teamName || '');
        setChannelName(data.channelName || '');
      }
    } catch (error) {
      // Ignore network errors for status check, mirrors GitHubPanel's loadStatus
      console.error('[SlackPanel] status error', error);
    } finally {
      console.log('[SlackPanel] loadStatus FINALLY → false');
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    console.log('[SlackPanel] EFFECT RUN');
    if (!token) {
      console.log('[SlackPanel] NO TOKEN');
      setStatusLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'slack') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      console.log('[SlackPanel] UNMOUNT / EFFECT CLEANUP');
    };
  }, [token]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/authorize`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setConnectError(data.error || 'Could not initiate Slack connection.');
        setConnecting(false);
      }
    } catch {
      setConnectError('Could not reach the server.');
      setConnecting(false);
    }
  };

  const handleTestMessage = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/test`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestResult({ ok: true, message: data.message || 'Test message sent to Slack.' });
      } else {
        setTestResult({ ok: false, message: data.error || 'Failed to send test message.' });
      }
    } catch {
      setTestResult({ ok: false, message: 'Could not reach the server.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <IntegrationCard
      icon={<SlackIcon />}
      title="Slack"
      description="Connect a Slack channel to receive PulseOps notifications."
      badge={isConnected ? <ConnectedBadge /> : undefined}
      action={
        statusLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
          </div>
        ) : !isConnected ? (
          <div className="space-y-3">
            {connectError && <p className="text-sm text-rose-600">{connectError}</p>}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlackIcon />}
              Connect Slack
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Workspace:</span>{' '}
                {teamName || '—'}
              </p>
              <p className="mt-1">
                <span className="font-medium text-slate-900">Channel:</span>{' '}
                {channelName ? `#${channelName}` : '—'}
              </p>
            </div>

            {testResult && (
              <div
                role={testResult.ok ? 'status' : 'alert'}
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${testResult.ok
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}
              >
                {testResult.ok ? '✓ ' : ''}
                {testResult.message}
              </div>
            )}

            <button
              onClick={handleTestMessage}
              disabled={testing}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {testing && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Test Message
            </button>
          </div>
        )
      }
    />
  );
}

// ─── Jira Integration Panel ───────────────────────────────────────────────────

function JiraPanel({ workspaceId, token }) {
  const [connecting, setConnecting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [webhookUrl, setWebhookUrl] = useState(`${API_BASE}/api/webhooks/jira`);
  const [copied, setCopied] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/status`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.connected) {
          setIsConnected(true);
          if (data.siteName) setSiteName(data.siteName);
          if (data.siteUrl) setSiteUrl(data.siteUrl);
          if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
          loadProjects();
        }
      }
    } catch {
      // Ignore network errors for status check to prevent red alerts
    }
  };

  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'jira') {
      setIsConnected(true);
      loadStatus();
      loadProjects();
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      loadStatus();
    }
  }, [token]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/projects`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        const data = await res.json();
        setConnectError(data?.error || 'Failed to load Jira projects.');
      }
    } catch {
      setConnectError('Could not load projects from Jira.');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/connect`, {
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setConnectError(data.error || 'Could not initiate Jira connection.');
        setConnecting(false);
      }
    } catch {
      setConnectError('Could not reach the server.');
      setConnecting(false);
    }
  };

  const toggleProject = (key) =>
    setSelectedProjects((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );

  const handleSync = async () => {
    if (selectedProjects.length === 0) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectKeys: selectedProjects }),
      });
      if (res.ok) setSyncSuccess(true);
    } catch {
      /* swallow */
    } finally {
      setSyncing(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <IntegrationCard
      icon={<JiraIcon />}
      title="Jira"
      description="Sync projects, track issues, and receive automated event updates."
      badge={isConnected ? <ConnectedBadge /> : undefined}
      action={
        !isConnected ? (
          <div className="space-y-3">
            {connectError && (
              <p className="text-sm text-rose-600">{connectError}</p>
            )}
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <JiraIcon />}
              Connect Jira
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {siteName && (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-600">
                <span>Site: <strong className="text-slate-900 font-semibold">{siteName}</strong></span>
                {siteUrl && (
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Open site ↗
                  </a>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-900">Select Jira projects to track</h4>
                <button
                  onClick={loadProjects}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Refresh
                </button>
              </div>
              {connectError && <p className="text-sm text-rose-600">{connectError}</p>}
              {loadingProjects ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                </div>
              ) : syncSuccess ? (
                <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-sm font-medium text-emerald-800">
                  ✓ Synced issues from {selectedProjects.length} {selectedProjects.length === 1 ? 'project' : 'projects'} successfully.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden max-h-60 overflow-y-auto">
                    {projects.length === 0 && (
                      <p className="p-4 text-sm text-slate-400">No Jira projects found.</p>
                    )}
                    {projects.map((proj) => (
                      <label
                        key={proj.id || proj.key}
                        className="flex cursor-pointer items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedProjects.includes(proj.key)}
                          onChange={() => toggleProject(proj.key)}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate flex items-center gap-2">
                            {proj.name}
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 font-mono">
                              {proj.key}
                            </span>
                          </p>
                          {proj.projectTypeKey && (
                            <p className="text-xs text-slate-500 mt-0.5 capitalize">
                              {proj.projectTypeKey} project
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSync}
                      disabled={selectedProjects.length === 0 || syncing}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
                      Sync Selected ({selectedProjects.length})
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Organization Webhook URL</p>
              <p className="text-xs text-slate-500">
                To stream real-time issue updates, copy this webhook URL into your Jira site or project settings under <strong>Webhooks</strong>:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 font-mono">
                  {webhookUrl}
                </code>
                <button
                  onClick={copyWebhook}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage({ params }) {
  const { workspaceId } = params;
  const { data: session } = useSession();
  const token =
    session?.accessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Integrations</h1>
        <p className="mt-2 text-sm text-slate-500">
          Connect third-party tools to automate your engineering workflow.
        </p>
      </div>

      <GitHubPanel workspaceId={workspaceId} token={token} />
      <SlackPanel workspaceId={workspaceId} token={token} />
      <JiraPanel workspaceId={workspaceId} token={token} />
    </div>
  );
}
