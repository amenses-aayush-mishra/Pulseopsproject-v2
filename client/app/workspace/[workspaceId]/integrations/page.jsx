'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Check, Copy, Search } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

// ─── Mini UI components ─────────────────────────────────────────────────────

function IntegrationCard({ icon, title, description, badge, topActions, action }) {
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
          <div className="shrink-0 flex flex-col items-end gap-2">
            {badge}
            {topActions}
          </div>
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

// The existing Disable button, relocated to the top of the integration cards.
function DisableButton({ onClick, disabled, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      Disable
    </button>
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
  const [syncSuccess, setSyncSuccess] = useState(null); // string message when present
  const [isConnected, setIsConnected] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [search, setSearch] = useState('');

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
        // Force GitHub to show the authorization/account-selection page instead
        // of silently connecting the browser's currently signed-in account.
        urlObj.searchParams.set('prompt', 'select_account');
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

  const handleDisable = async () => {
    setDisabling(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/github/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (res.ok) {
        setIsConnected(false);
        setRepos([]);
        setSelectedRepos([]);
        setSyncSuccess(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setConnectError(data?.error || 'Could not disable GitHub.');
      }
    } catch {
      setConnectError('Could not reach the server.');
    } finally {
      setDisabling(false);
    }
  };

  const toggleRepo = (id) =>
    setSelectedRepos((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  const handleSync = async () => {
    if (selectedRepos.length === 0) return;
    const importedIds = [...selectedRepos];
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/track-repositories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': workspaceId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repositoryIds: importedIds }),
      });
      if (res.ok) {
        // Hide only the just-imported repositories from the selection list so
        // they don't get imported again. They remain on the Repositories page.
        setRepos((prev) => prev.filter((repo) => !importedIds.includes(repo.id)));
        setSelectedRepos([]);
        const noun = importedIds.length === 1 ? 'repository' : 'repositories';
        setSyncSuccess(
          `Synced ${importedIds.length} ${noun} successfully.`
        );
      }
    } catch {
      /* swallow */
    } finally {
      setSyncing(false);
    }
  };

  const filteredRepos = repos.filter((repo) =>
    (repo.full_name || repo.name || '')
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  return (
    <IntegrationCard
      icon={<GitHubIcon />}
      title="GitHub"
      description="Sync repositories and track pull requests automatically."
      topActions={
        isConnected ? (
          <DisableButton onClick={handleDisable} disabled={disabling} loading={disabling} />
        ) : undefined
      }
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
            ) : (
              <>
                {syncSuccess && (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-sm font-medium text-emerald-800">
                    ✓ {syncSuccess}
                  </div>
                )}
                <div className="space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search repositories..."
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                  {filteredRepos.length === 0 && (
                    <p className="p-4 text-sm text-slate-400">No repositories found.</p>
                  )}
                  {filteredRepos.map((repo) => (
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
                <div className="flex items-center justify-end">
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
              </>
            )}
          </div>
        )
      }
    />
  );
}

// ─── Slack Integration Panel ──────────────────────────────────────────────────

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
<<<<<<< HEAD
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState(null); // string when present
   console.log('[SlackPanel] RENDER', {
  workspaceId,
  hasToken: Boolean(token),
  statusLoading,
  isConnected,
});
=======
  const [status, setStatus] = useState(null); // full status payload (scopes, counts, errors)
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId };
>>>>>>> feature/ai-summary-jira-backup

  const loadStatus = async () => {
    if (!token) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setIsConnected(Boolean(data.connected));
        setTeamName(data.teamName || '');
        setChannelName(data.channelName || '');
        setStatus(data);
      }
    } catch {
      // Ignore network errors for status check, mirrors GitHubPanel's loadStatus
    } finally {
      setStatusLoading(false);
    }
  };

  const loadConversations = async () => {
    if (!token) return null;
    setConvLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/workspace/${workspaceId}/slack/conversations`, { headers });
      if (res.ok) {
        const data = await res.json();
        const all = [
          ...(data.publicChannels || []),
          ...(data.privateChannels || []),
          ...(data.groupDMs || []),
          ...(data.directMessages || []),
        ];
        setConversations(all);
        return all;
      }
    } catch {
      // keep existing list
    } finally {
      setConvLoading(false);
    }
    return null;
  };

  useEffect(() => {
    if (!token) {
      setStatusLoading(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'slack') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // When connected (or after a sync round-trip) load the conversation list.
  useEffect(() => {
    if (isConnected && token) {
      loadConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, token]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/authorize`, { headers });
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

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/sync`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds: [] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncResult({ ok: false, message: data.error || 'Sync could not be started.' });
        return;
      }
      // Poll until no conversation is left in SYNCING (or a few attempts pass).
      let latest = null;
      for (let i = 0; i < 15; i += 1) {
        await new Promise((r) => setTimeout(r, 2500));
        const [statusData, convData] = await Promise.all([loadStatus(), loadConversations()]);
        if (convData) latest = convData;
        const stillSyncing = (latest || []).some((c) => c.syncStatus === 'SYNCING');
        if (!stillSyncing) break;
      }
      const failed = (latest || []).filter((c) => c.syncStatus === 'SYNC_ERROR');
      const synced = (latest || []).filter((c) => c.syncStatus === 'SYNCED');
      const errorCodes = {};
      for (const c of failed) {
        errorCodes[c.syncErrorCode || 'unknown'] = (errorCodes[c.syncErrorCode || 'unknown'] || 0) + 1;
      }
      let message;
      if (failed.length === 0) {
        message = `${synced.length} conversation(s) synced.`;
      } else if (errorCodes.not_in_channel) {
        message = `Invite the PulseOps bot to ${errorCodes.not_in_channel} private channel(s), then retry sync.`;
      } else if (errorCodes.missing_scope) {
        message = 'Slack permissions need updating. Reconnect Slack, then sync again.';
      } else if (errorCodes.invalid_auth || errorCodes.account_inactive) {
        message = 'Slack authorization has expired. Reconnect Slack.';
      } else {
        message = `${failed.length} conversation(s) require additional Slack access.`;
      }
      setSyncResult({ ok: failed.length === 0, message });
    } catch {
      setSyncResult({ ok: false, message: 'Sync could not be started. Could not reach server.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async (conversationId) => {
    if (retryingId) return;
    setRetryingId(conversationId);
    setSyncResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/sync`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds: [conversationId] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSyncResult({ ok: false, message: data.error || 'Retry could not be started.' });
        return;
      }
      // Poll until this specific conversation leaves SYNCING.
      for (let i = 0; i < 15; i += 1) {
        await new Promise((r) => setTimeout(r, 2500));
        const convData = await loadConversations();
        const target = (convData || []).find((c) => c.id === conversationId);
        if (!target || target.syncStatus !== 'SYNCING') break;
      }
      await Promise.all([loadStatus(), loadConversations()]);
      setSyncResult({ ok: true, message: 'Retry finished. Check the conversation status below.' });
    } catch {
      setSyncResult({ ok: false, message: 'Retry could not be started. Could not reach server.' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleTestMessage = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/test`, {
        method: 'POST',
        headers,
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
<<<<<<< HEAD
  const handleDisable = async () => {
    setDisabling(true);
    setDisableError(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/slack/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      if (res.ok) {
        setIsConnected(false);
        setTeamName('');
        setChannelName('');
        setTestResult(null);
      } else {
        const data = await res.json().catch(() => ({}));
        setDisableError(data?.error || 'Could not disable Slack.');
      }
    } catch {
      setDisableError('Could not reach the server.');
    } finally {
      setDisabling(false);
    }
  };


 
=======

  const badge = isConnected
    ? status && status.scopesHealthy === false ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
          <Loader2 className="h-3 w-3" /> Scopes outdated
        </span>
      ) : (
        <ConnectedBadge />
      )
    : undefined;

  const syncChip = (c) => {
    if (c.syncStatus === 'SYNCED') return <span className="text-xs font-medium text-emerald-600">✓ {c.messageCount || 0} msgs</span>;
    if (c.syncStatus === 'SYNCING') return <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Loader2 className="h-3 w-3 animate-spin" /> Syncing…</span>;
    if (c.syncStatus === 'SYNC_ERROR') {
      return (
        <span className="flex items-center gap-2">
          {retryingId === c.id ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600" />
          ) : (
            <button
              type="button"
              onClick={() => handleRetry(c.id)}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Retry
            </button>
          )}
          <span
            title={`${c.syncErrorCode ? `[${c.syncErrorCode}] ` : ''}${c.syncError || 'Sync error'}`}
            className="text-xs text-rose-600"
          >
            ⚠ Sync error
          </span>
        </span>
      );
    }
    return <span className="text-xs text-slate-400">Not synced</span>;
  };

>>>>>>> feature/ai-summary-jira-backup
  return (
    <IntegrationCard
      icon={<SlackIcon />}
      title="Slack"
<<<<<<< HEAD
      description="Connect a Slack channel to receive PulseOps notifications."
      badge={isConnected ? <ConnectedBadge /> : undefined}
      topActions={
        isConnected ? (
          <div className="flex flex-col items-end gap-2">
            {disableError && <p className="text-xs text-rose-600">{disableError}</p>}
            <DisableButton onClick={handleDisable} disabled={disabling} loading={disabling} />
          </div>
        ) : undefined
      }
=======
      description="Mirror Slack conversations into PulseOps and keep them synchronized in real time."
      badge={badge}
>>>>>>> feature/ai-summary-jira-backup
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
              {status?.authError && (
                <p className="mt-1 font-medium text-rose-600">
                  <span className="font-semibold text-slate-900">Authorization:</span>{' '}
                  {status.authError}
                </p>
              )}
            </div>

            {status && status.scopesHealthy === false && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-800">
                  Permissions need updating.
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Missing: {status.missingScopes?.join(', ') || 'unknown'}. Reconnect Slack to
                  grant the required scopes.
                </p>
                <button
                  type="button"
                  onClick={handleConnect}
                  disabled={connecting}
                  className="mt-2 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SlackIcon />}
                  Reconnect Slack
                </button>
              </div>
            )}

            <div className="rounded-lg border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">
                    Conversations ({conversations.length})
                  </h4>
                  {status?.conversationCount !== undefined && (
                    <p className="text-xs text-slate-500">
                      {status.syncedConversationCount} synced · {status.messageCount} messages
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadConversations}
                    disabled={convLoading}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
                  >
                    {convLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh list'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {syncing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {syncing ? 'Syncing…' : 'Sync Now'}
                  </button>
                </div>
              </div>

              {syncResult && (
                <div
                  role={syncResult.ok ? 'status' : 'alert'}
                  className={`border-b border-slate-100 px-4 py-2.5 text-xs font-medium ${
                    syncResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {syncResult.ok ? '✓ Sync complete. ' : '⚠ Sync partially failed. '}
                  {syncResult.message}
                </div>
              )}

              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {conversations.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-slate-400">
                    No conversations discovered yet. Click Sync Now after connecting.
                  </p>
                )}
                {conversations.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <a
                      href={`/workspace/${workspaceId}/channels/${c.id}`}
                      className="min-w-0 truncate text-sm font-medium text-slate-800 hover:text-indigo-600"
                    >
                      {c.conversationType === 'PUBLIC_CHANNEL' || c.conversationType === 'PRIVATE_CHANNEL'
                        ? `# ${c.name || c.id}`
                        : c.name || c.id}
                    </a>
                    {syncChip(c)}
                  </div>
                ))}
              </div>
            </div>

            {testResult && (
              <div
                role={testResult.ok ? 'status' : 'alert'}
                className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                  testResult.ok
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
<<<<<<< HEAD
  const webhookUrl = `${API_BASE}/api/webhooks/jira`;
  const [copied, setCopied] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disableMsg, setDisableMsg] = useState(null); // { ok: boolean, message: string }
=======
  const [statusLoading, setStatusLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [siteUrl, setSiteUrl] = useState('');
  const [cloudId, setCloudId] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [webhookRegistered, setWebhookRegistered] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  
  // Projects
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProjectKey, setSelectedProjectKey] = useState('');
  const [projectsError, setProjectsError] = useState('');
  
  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null); // { ok: boolean, message: string, synced: number }
  
  // Webhook
  const [webhookRegistering, setWebhookRegistering] = useState(false);
  const [webhookResult, setWebhookResult] = useState(null);
  const [webhookVerified, setWebhookVerified] = useState(false);
  
  // Issues preview
  const [issues, setIssues] = useState([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
>>>>>>> feature/ai-summary-jira-backup

  const headers = { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId };
  // Public webhook URL. Backend-provided (status/register-webhook) value is
  // authoritative. Fall back to a configured PUBLIC backend URL — never
  // localhost — because Jira Cloud cannot deliver to localhost.
  const [webhookUrl, setWebhookUrl] = useState(
    process.env.NEXT_PUBLIC_BACKEND_URL
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL.replace(/\/$/, '')}/api/webhooks/jira`
      : ''
  );

  const loadStatus = async () => {
    if (!token) return;
    setStatusLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/status`, { headers });
      if (res.ok) {
        const data = await res.json();
        setIsConnected(Boolean(data.connected));
        setSiteUrl(data.siteUrl || '');
        setCloudId(data.cloudId || '');
        setLastSyncAt(data.lastSyncAt || null);
        setWebhookRegistered(Boolean(data.webhookRegistered));
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      }
    } catch {
      // Ignore network errors for status check
    } finally {
      setStatusLoading(false);
    }
  };

  const loadProjects = async () => {
    if (!token || !isConnected) return;
    setProjectsLoading(true);
    setProjectsError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/projects`, { headers });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      } else {
        const data = await res.json().catch(() => ({}));
        setProjectsError(data.error || 'Failed to load projects.');
      }
    } catch {
      setProjectsError('Could not reach the server.');
    } finally {
      setProjectsLoading(false);
    }
  };

  const loadIssues = async (projectKey) => {
    if (!token || !projectKey) return;
    setIssuesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/issues?projectKey=${encodeURIComponent(projectKey)}&limit=10`, { headers });
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
      }
    } catch {
      // Ignore
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setStatusLoading(false);
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'jira') {
      window.history.replaceState({}, '', window.location.pathname);
    }
    loadStatus();
  }, [token]);

  useEffect(() => {
    if (isConnected) {
      loadProjects();
    }
  }, [isConnected]);

  useEffect(() => {
    if (selectedProjectKey) {
      loadIssues(selectedProjectKey);
    }
  }, [selectedProjectKey]);

  useEffect(() => {
    let intervalId;
    if (status?.syncStates?.some(s => s.status === 'syncing')) {
      intervalId = setInterval(() => {
        loadStatus();
        if (selectedProjectKey) loadIssues(selectedProjectKey);
      }, 3000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, selectedProjectKey]);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/auth`, { headers });
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

  const handleSync = async () => {
    if (!selectedProjectKey) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/sync`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: selectedProjectKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSyncResult({ ok: true, message: `Synced ${data.synced} issues from ${data.projectKey}.`, synced: data.synced });
        loadStatus(); // Refresh lastSyncAt
        loadIssues(selectedProjectKey);
      } else {
        setSyncResult({ ok: false, message: data.error || 'Sync failed.' });
      }
    } catch {
      setSyncResult({ ok: false, message: 'Could not reach the server.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleRegisterWebhook = async () => {
    if (!selectedProjectKey) return;
    setWebhookRegistering(true);
    setWebhookResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/register-webhook`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectKey: selectedProjectKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setWebhookResult({ ok: true, message: data.message || 'Webhook registered successfully.', webhookId: data.webhookId });
        setWebhookVerified(data.verified === true);
        if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
        loadStatus(); // Refresh webhook status
      } else {
        setWebhookResult({ ok: false, message: data.error || 'Webhook registration failed.' });
      }
    } catch {
      setWebhookResult({ ok: false, message: 'Could not reach the server.' });
    } finally {
      setWebhookRegistering(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      // Could add toast notification here
    });
  };

<<<<<<< HEAD
  const handleDisable = async () => {
    setDisabling(true);
    setDisableMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/jira/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'x-organization-id': workspaceId },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDisableMsg({
          ok: true,
          message: data?.message || 'Jira integration disabled.',
        });
      } else {
        setDisableMsg({ ok: false, message: data?.error || 'Could not disable Jira.' });
      }
    } catch {
      setDisableMsg({ ok: false, message: 'Could not reach the server.' });
    } finally {
      setDisabling(false);
    }
  };

  return (
    <IntegrationCard
      icon={<JiraIcon />}
      title="Jira"
      description="Track issues and receive updates when Jira issues are created or updated."
      badge={
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
          Webhook
        </span>
      }
      topActions={
        <div className="flex flex-col items-end gap-2">
          {disableMsg && (
            <div
              role={disableMsg.ok ? 'status' : 'alert'}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                disableMsg.ok
                  ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {disableMsg.message}
            </div>
          )}
          <DisableButton
            onClick={handleDisable}
            disabled={disabling || !token}
            loading={disabling}
          />
        </div>
      }
=======
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const badge = isConnected
    ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        <Check className="h-3 w-3" /> Connected
      </span>
    )
    : undefined;

  return (
    <IntegrationCard
      icon={<JiraIcon />}
      title="Jira Cloud"
      description="Sync Jira issues, track project progress, and receive real-time updates via webhooks."
      badge={badge}
>>>>>>> feature/ai-summary-jira-backup
      action={
        <div className="space-y-6">
          {/* Connection Status / Connect Button */}
          {statusLoading ? (
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
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <JiraIcon />}
                Connect Jira Cloud
              </button>
              <p className="text-xs text-slate-500">
                You&apos;ll be redirected to Atlassian to authorize PulseOps. Required scopes: read:jira-work, read:jira-user, manage:jira-webhook.
              </p>
            </div>
          ) : (
            <>
              {/* Connected Info */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Site:</span>
                  <span className="truncate max-w-xs font-mono text-xs bg-white px-2 py-1 rounded border">{siteUrl}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Cloud ID:</span>
                  <span className="truncate max-w-xs font-mono text-xs bg-white px-2 py-1 rounded border">{cloudId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Last Sync:</span>
                  <span>{formatDate(lastSyncAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">Webhook:</span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${webhookRegistered ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {webhookRegistered ? 'Registered' : 'Not Registered'}
                  </span>
                </div>
              </div>

              {/* Projects Selection */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-900">Select Project to Sync</h4>
                  <button
                    onClick={loadProjects}
                    disabled={projectsLoading}
                    className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    {projectsLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                {projectsError && <p className="text-sm text-rose-600">{projectsError}</p>}
                {projectsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                  </div>
                ) : projects.length === 0 ? (
                  <p className="text-sm text-slate-500">No projects found or Jira not connected.</p>
                ) : (
                  <select
                    value={selectedProjectKey}
                    onChange={(e) => setSelectedProjectKey(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">— Choose a project —</option>
                    {projects.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.key} — {p.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Sync Section */}
              {selectedProjectKey && (
                <div className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">Sync Issues</h4>
                    {status?.syncStates?.find(s => s.projectKey === selectedProjectKey)?.status === 'syncing' && (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <Loader2 className="h-3 w-3 animate-spin" /> Syncing in background...
                      </span>
                    )}
                  </div>
                  {status?.syncStates?.find(s => s.projectKey === selectedProjectKey) && (
                    <div className="text-xs text-slate-500 mb-2">
                      Synced {status.syncStates.find(s => s.projectKey === selectedProjectKey).issuesSynced} issues.
                      Status: <span className="font-medium text-slate-700 capitalize">{status.syncStates.find(s => s.projectKey === selectedProjectKey).status}</span>
                    </div>
                  )}
                  {syncResult && (
                    <div
                      role={syncResult.ok ? 'status' : 'alert'}
                      className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${syncResult.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
                    >
                      {syncResult.ok ? '✓ ' : '⚠ '}{syncResult.message}
                    </div>
                  )}
                  <button
                    onClick={handleSync}
                    disabled={syncing || !selectedProjectKey || status?.syncStates?.find(s => s.projectKey === selectedProjectKey)?.status === 'syncing'}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {(syncing || status?.syncStates?.find(s => s.projectKey === selectedProjectKey)?.status === 'syncing') ? <Loader2 className="h-4 w-4 animate-spin" /> : <Loader2 className="h-4 w-4" />}
                    {(syncing || status?.syncStates?.find(s => s.projectKey === selectedProjectKey)?.status === 'syncing') ? 'Syncing…' : 'Start Full Sync'}
                  </button>
                </div>
              )}

              {/* Webhook Registration */}
              {selectedProjectKey && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Webhook Registration</h4>
                  <p className="text-xs text-slate-500">
                    Register a webhook in Jira to receive real-time updates when issues are created, updated, or deleted.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-white px-3 py-2 text-xs text-slate-700 font-mono border border-slate-200">
                      {webhookUrl}
                    </code>
                    <button
                      onClick={copyWebhookUrl}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      title="Copy webhook URL"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </button>
                  </div>
                  {webhookResult && (
                    <div
                      role={webhookResult.ok ? 'status' : 'alert'}
                      className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${webhookResult.ok ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}
                    >
                      {webhookResult.ok ? '✓ ' : '⚠ '}{webhookResult.message}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRegisterWebhook}
                      disabled={webhookRegistering || !selectedProjectKey || webhookRegistered}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                    >
                      {webhookRegistering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Loader2 className="h-4 w-4" />}
                      {webhookRegistering ? 'Registering…' : webhookRegistered ? 'Webhook Active' : 'Register Webhook'}
                    </button>
                    {webhookVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <Check className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Supported events: <code className="rounded bg-slate-100 px-1 py-0.5">jira:issue_created</code>, <code className="rounded bg-slate-100 px-1 py-0.5">jira:issue_updated</code>, <code className="rounded bg-slate-100 px-1 py-0.5">jira:issue_deleted</code>.
                  </p>
                </div>
              )}

              {/* Recent Issues Preview */}
              {selectedProjectKey && issues.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-900">Recent Issues (last 10)</h4>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    {issuesLoading ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                        {issues.slice(0, 10).map((issue) => (
                          <div key={issue.jiraIssueId} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
                            <div className="min-w-0 flex-1">
                              <a
                                href={`${siteUrl}/browse/${issue.issueKey}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-slate-800 hover:text-indigo-600 truncate block"
                              >
                                {issue.issueKey}: {issue.summary}
                              </a>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                                  {issue.status}
                                </span>
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-indigo-50 text-indigo-700">
                                  {issue.issueType}
                                </span>
                                {issue.assignee && (
                                  <span className="truncate max-w-xs">👤 {issue.assignee.displayName}</span>
                                )}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-slate-400">
                              {formatDate(issue.updated)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
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
      <SlackPanel workspaceId={workspaceId} token={token}/>
      <JiraPanel workspaceId={workspaceId} token={token} />
    </div>
  );
}
