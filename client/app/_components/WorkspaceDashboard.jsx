import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  GitBranch,
  MessageSquare,
  Shield,
  Layers,
  Check,
  Plus,
  ArrowRight,
  ChevronRight,
  LogOut,
  Activity,
  Zap,
  Lock,
  User,
  ListTodo,
  Settings,
  SlidersHorizontal,
  FolderKanban,
  FileText,
  BarChart,
  Users,
  Puzzle
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const ME_ENDPOINT = `${API_BASE}/api/auth/me`;
const SWITCH_ENDPOINT = `${API_BASE}/api/organizations/switch-org`;
const INVITE_ENDPOINT = `${API_BASE}/api/organizations/invite`;
const REPOS_ENDPOINT = `${API_BASE}/api/organizations/repositories`;
const SLACK_CHANNELS_ENDPOINT = `${API_BASE}/api/slack/channels`;

const INVITE_ROLES = [
  { value: 'developer', label: 'Developer' },
  { value: 'maintainer', label: 'Maintainer' },
  { value: 'admin', label: 'Admin' },
  { value: 'viewer', label: 'Viewer' },
];

export default function WorkspaceDashboard() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [slackChannels, setSlackChannels] = useState([]);
  const [slackLoading, setSlackLoading] = useState(true);

  const [switching, setSwitching] = useState(false);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [switchError, setSwitchError] = useState(null);

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('developer');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  const activeOrganizationId = session?.user?.activeOrganizationId || null;
  const role = session?.user?.role || null;
  const userEmail = session?.user?.email || '—';
  const userName = session?.user?.name || userEmail.split('@')[0];

  // Load user profile & organizations
  useEffect(() => {
    let cancelled = false;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null;
    const bearer = session?.accessToken || storedToken;
    if (!bearer) return undefined;

    (async () => {
      try {
        const res = await fetch(ME_ENDPOINT, {
          headers: { Authorization: `Bearer ${bearer.trim()}` },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setMe(data);
        } else {
          setMeError(data?.message || `Could not load workspace context (${res.status}).`);
        }
      } catch {
        if (!cancelled) setMeError('Could not reach the workspace service.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, session?.accessToken]);

  // Load Repositories overview count
  useEffect(() => {
    let cancelled = false;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null;
    const bearer = session?.accessToken || storedToken;

    (async () => {
      setReposLoading(true);
      try {
        const res = await fetch(REPOS_ENDPOINT, {
          headers: {
            ...(bearer ? { Authorization: `Bearer ${bearer.trim()}` } : {}),
          },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && Array.isArray(data)) {
          setRepositories(data);
        } else if (res.ok && Array.isArray(data?.repositories)) {
          setRepositories(data.repositories);
        } else {
          setRepositories([]);
        }
      } catch {
        if (!cancelled) setRepositories([]);
      } finally {
        if (!cancelled) setReposLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, activeOrganizationId]);

  // Load Slack Channels summary
  useEffect(() => {
    let cancelled = false;
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null;
    const bearer = session?.accessToken || storedToken;

    (async () => {
      setSlackLoading(true);
      try {
        const res = await fetch(SLACK_CHANNELS_ENDPOINT, {
          headers: {
            ...(bearer ? { Authorization: `Bearer ${bearer.trim()}` } : {}),
          },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && Array.isArray(data?.channels)) {
          setSlackChannels(data.channels);
        } else {
          setSlackChannels([]);
        }
      } catch {
        if (!cancelled) setSlackChannels([]);
      } finally {
        if (!cancelled) setSlackLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, activeOrganizationId]);

  const onSwitchWorkspace = useCallback(
    async (orgId, orgRole) => {
      if (!orgId || orgId === activeOrganizationId) {
        setShowSwitcher(false);
        return;
      }
      setSwitching(true);
      setSwitchError(null);
      try {
        let storedToken = null;
        try {
          storedToken = localStorage.getItem('pulseops_token');
        } catch { }
        const bearer = session?.accessToken || storedToken;

        const res = await fetch(SWITCH_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(bearer ? { Authorization: `Bearer ${bearer.trim()}` } : {}),
          },
          body: JSON.stringify({ targetOrganizationId: orgId }),
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 403) {
          setSwitchError(data?.message || 'Forbidden. You are not an active member of this organization.');
          return;
        }
        if (!res.ok) {
          setSwitchError(data?.message || `Could not switch workspace (${res.status}).`);
          return;
        }

        if (data.token) {
          try {
            localStorage.setItem('pulseops_token', data.token);
          } catch { }
        }

        await update({
          accessToken: data.token,
          activeOrganizationId: data.activeOrganizationId || orgId,
          role: data.role || orgRole,
        });

        setShowSwitcher(false);
        router.refresh();
      } catch {
        setSwitchError('Could not reach the workspace server. Please try again.');
      } finally {
        setSwitching(false);
      }
    },
    [activeOrganizationId, session?.accessToken, update, router]
  );

  const onSignOut = async () => {
    try {
      localStorage.removeItem('pulseops_token');
      sessionStorage.clear();
    } catch { }
    await signOut({ callbackUrl: '/login' });
  };

  const onInvite = async (e) => {
    e.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    if (inviteBusy) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteError('Enter a valid email address.');
      return;
    }
    setInviteBusy(true);
    try {
      let storedToken = null;
      try {
        storedToken = localStorage.getItem('pulseops_token');
      } catch { }
      const bearer = session?.accessToken || storedToken;
      const res = await fetch(INVITE_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer.trim()}` } : {}),
        },
        body: JSON.stringify({ email, role: inviteRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInviteError(data?.message || `Invitation failed (${res.status}).`);
        return;
      }
      setInviteSuccess(`Invitation sent to ${email}.`);
      setInviteEmail('');
      setTimeout(() => setShowInvite(false), 900);
    } catch {
      setInviteError('Could not reach the invitation service. Please try again.');
    } finally {
      setInviteBusy(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAFC]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm font-semibold text-slate-700">Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAFAFC] p-6">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-8 text-center shadow-md">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Not signed in</h1>
          <p className="mt-2 text-sm text-slate-500">Please sign in to access your PulseOps workspace.</p>
          <a
            href="/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            Sign in
          </a>
        </div>
      </div>
    );
  }

  const organizations = me?.availableOrganizations || [];
  const activeName = me?.activeOrganization?.name || 'Primary Workspace';
  const canInvite = role === 'owner' || role === 'admin';
  const base = activeOrganizationId ? `/workspace/${activeOrganizationId}` : '';

  const overviewCards = [
    {
      title: 'Projects & Workspaces',
      description: 'Manage projects, switch workspace context, and inspect imported repositories.',
      href: `${base}/projects`,
      icon: FolderKanban,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      title: 'Tasks',
      description: 'View real Jira issues, track status, priority, assignees, and project progress.',
      href: `${base}/tasks`,
      icon: ListTodo,
      color: 'from-indigo-500 to-purple-600',
    },
    {
      title: 'Reports',
      description: 'AI-generated engineering health summaries, executive reports, and recommendations.',
      href: `${base}/reports`,
      icon: FileText,
      color: 'from-purple-500 to-pink-600',
    },
    {
      title: 'Analytics',
      description: 'Organization health score, KPI trends, risks & alerts, and source event distribution.',
      href: `${base}/analytics`,
      icon: BarChart,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      title: 'Developers',
      description: 'Per-developer health status, contribution metrics, and workload overview.',
      href: `${base}/developers`,
      icon: Users,
      color: 'from-amber-500 to-orange-600',
    },
    {
      title: 'Integrations',
      description: 'Connect and configure Jira, GitHub, Slack, webhooks, and sync controls.',
      href: `${base}/integrations`,
      icon: Puzzle,
      color: 'from-rose-500 to-red-600',
    },
  ];

  return (
    <div className="h-screen bg-[#FAFAFC] text-slate-900 flex flex-col overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">

      {/* ---------------- 1. TOP BAR (Height ~56px) ---------------- */}
      <header className="h-14 px-5 sm:px-8 bg-[#FAFAFC] border-b border-slate-200/80 flex items-center justify-between shrink-0">

        {/* Left: PulseOps Wordmark + Workspace Switcher */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="h-7 w-7 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
              <div className="flex items-center gap-0.5">
                <span className="w-0.5 h-3 bg-white rounded-full"></span>
                <span className="w-0.5 h-4 bg-white rounded-full"></span>
                <span className="w-0.5 h-3 bg-white rounded-full"></span>
              </div>
            </div>
            <span className="text-base font-bold text-slate-900 tracking-tight">PulseOps</span>
          </Link>

          <span className="text-slate-300 text-xs">/</span>

          {/* Workspace Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowSwitcher((v) => !v);
                setSwitchError(null);
              }}
              disabled={switching || !organizations.length}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:border-slate-300 transition-all shadow-2xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              <span className="max-w-[150px] truncate">{activeName}</span>
              <span className="text-[10px] text-slate-400 font-normal">▼</span>
            </button>

            {showSwitcher && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl z-50">
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Switch Workspace
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {organizations.map((org) => {
                    const selected = org.id === activeOrganizationId;
                    return (
                      <button
                        key={org.id}
                        type="button"
                        disabled={switching}
                        onClick={() => onSwitchWorkspace(org.id, org.role)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${selected
                          ? 'bg-indigo-50 font-bold text-indigo-700'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                          }`}
                      >
                        <span className="truncate">{org.name}</span>
                        {selected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <div className="pt-1.5 mt-1 border-t border-slate-100 px-2">
                  <Link
                    href="/onboarding"
                    className="block text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 py-1 rounded-md hover:bg-indigo-50/60"
                  >
                    + Create New Workspace
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Profile Avatar Icon Button ONLY */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowProfileMenu((v) => !v)}
            className="w-8 h-8 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center hover:bg-slate-800 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="User profile menu"
          >
            {userName[0]?.toUpperCase() || 'U'}
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xl z-50 space-y-3">
              <div className="border-b border-slate-100 pb-2.5">
                <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{userEmail}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold capitalize">
                  <span className="w-1 h-1 rounded-full bg-indigo-600"></span>
                  {role || 'Member'}
                </div>
              </div>

              <div className="space-y-1">
                {canInvite && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowInvite(true);
                      setInviteError(null);
                      setInviteSuccess(null);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-400" />
                    Invite Teammate
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>

      </header>

      {/* ---------------- 2. MAIN DASHBOARD BODY (Refined 125% Scale at 100% Zoom) ---------------- */}
      <main className="py-4 px-5 sm:px-8 max-w-7xl mx-auto w-full space-y-4 overflow-hidden">

        {switchError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
            {switchError}
          </div>
        )}

        {/* ------------ SECTION 1: HIGH-LEVEL ANALYTICAL METRICS ROW ------------ */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">

          {/* KPI 1: Codebase Health */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Codebase Velocity</span>
              <GitBranch className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {reposLoading ? '…' : repositories.length}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {repositories.length > 0
                ? `${repositories.filter((r) => r.private).length} Private • ${repositories.filter((r) => !r.private).length} Public`
                : 'No repositories connected'}
            </p>
          </div>

          {/* KPI 2: Communication Sync */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Communication Stream</span>
              <MessageSquare className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {slackLoading ? '…' : slackChannels.length}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {slackChannels.length > 0 ? 'Live channel sync active' : 'No channels connected'}
            </p>
          </div>

          {/* KPI 3: Access & Team */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Active Member</span>
              <User className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
              1
            </div>
            <p className="text-xs text-slate-500 truncate">
              Role: <span className="font-semibold text-slate-700 capitalize">{role || 'Owner'}</span>
            </p>
          </div>

          {/* KPI 4: Security Status */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>Security State</span>
              <Shield className="w-4 h-4 text-slate-700" />
            </div>
            <div className="text-2xl font-extrabold text-indigo-600 tracking-tight">
              100%
            </div>
            <p className="text-xs text-slate-500 truncate">
              TLS 1.3 • AES-256 Encrypted
            </p>
          </div>

        </section>

        {/* ------------ SECTION 2: 2-COLUMN ANALYTICS & HUB MATRIX ------------ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-start">

          {/* ------------ LEFT COLUMN (65% Width): Workspace Demo Analytics & Insights ------------ */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">

            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Workspace Activity Analytics</h2>
                  <p className="text-xs text-slate-500">Cross-tool engineering velocity &amp; activity insights</p>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                  Demo Metrics
                </span>
              </div>

              {/* Demo Analytical Widgets Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5">

                {/* Demo Widget 1: Weekly Commit & PR Trend */}
                <div className="p-3.5 rounded-xl border border-slate-200/70 bg-[#FAFAFC] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Commit Velocity
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      +14.2%
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-slate-900">34 Commits</span>
                    <span className="text-xs text-slate-500">this week</span>
                  </div>

                  {/* Mini Activity Sparkline / Bar Graph */}
                  <div className="flex items-end gap-1.5 h-7 pt-1">
                    {[35, 60, 45, 80, 55, 90, 70].map((h, i) => (
                      <div
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`flex-1 rounded-xs transition-all ${i === 5 ? 'bg-indigo-600' : 'bg-slate-200'
                          }`}
                        title={`Day ${i + 1}: ${h}% activity`}
                      />
                    ))}
                  </div>
                </div>

                {/* Demo Widget 2: Task & Build Success Rate */}
                <div className="p-3.5 rounded-xl border border-slate-200/70 bg-[#FAFAFC] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Build Reliability
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      Optimal
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-extrabold text-slate-900">99.4%</span>
                    <span className="text-xs text-slate-500">CI/CD uptime</span>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-500 h-2 rounded-full w-[99%]" />
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>18 Passes</span>
                      <span>0 Failures</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Recent Activity Timeline Preview */}
              <div className="p-3 rounded-xl border border-slate-200/60 bg-[#FAFAFC] space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Recent Pulse Stream
                </span>
                <div className="space-y-1 text-xs text-slate-700">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <strong className="text-slate-900">main</strong> branch build passed cleanly
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">12m ago</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      PR #42 merged: <span className="text-slate-600 truncate">Authentication shell redesign</span>
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">1h ago</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Quick Operations Matrix Shortcuts */}
            <div className="pt-3 mt-2 border-t border-slate-100 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-500">Quick Navigation:</span>
              <div className="flex items-center gap-1.5">
                <Link
                  href={`/workspace/${activeOrganizationId}/repositories`}
                  className="px-3 py-1 rounded-md border border-slate-200 bg-[#FAFAFC] hover:bg-white text-xs font-semibold text-slate-700 transition-colors"
                >
                  Repositories
                </Link>
                <Link
                  href={`/workspace/${activeOrganizationId}/communication`}
                  className="px-3 py-1 rounded-md border border-slate-200 bg-[#FAFAFC] hover:bg-white text-xs font-semibold text-slate-700 transition-colors"
                >
                  Communication
                </Link>
                <Link
                  href={`/workspace/${activeOrganizationId}/integrations`}
                  className="px-3 py-1 rounded-md border border-slate-200 bg-[#FAFAFC] hover:bg-white text-xs font-semibold text-slate-700 transition-colors"
                >
                  Integrations
                </Link>
                <Link
                  href={`/workspace/${activeOrganizationId}/settings`}
                  className="px-3 py-1 rounded-md border border-slate-200 bg-[#FAFAFC] hover:bg-white text-xs font-semibold text-slate-700 transition-colors"
                >
                  Settings
                </Link>
              </div>
            </div>

          </div>

          {/* ------------ RIGHT COLUMN (35% Width): Integration Health & Tenant Context ------------ */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">

            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Integration Health</h3>
                <span className="text-[10px] font-bold text-slate-500">SYSTEM STATE</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-[#FAFAFC] border border-slate-200/60 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-800">GitHub</span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    {repositories.length > 0 ? 'Active' : 'Ready'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-[#FAFAFC] border border-slate-200/60 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-800">Slack</span>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {slackChannels.length > 0 ? 'Connected' : 'Setup Required'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-xl bg-[#FAFAFC] border border-slate-200/60 text-xs sm:text-sm">
                  <span className="font-semibold text-slate-800">Jira</span>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    Available
                  </span>
                </div>
              </div>
            </div>

            {/* Tenant Security & Ownership */}
            <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Workspace ID:</span>
                <code className="font-mono text-xs text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                  {activeOrganizationId ? activeOrganizationId.slice(0, 10) + '…' : 'Standard'}
                </code>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Data Privacy:</span>
                <span className="text-emerald-700 font-semibold">100% Private</span>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* ---------------- 3. INVITE MODAL ---------------- */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowInvite(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Invite a teammate</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  They will receive an invitation to join <strong>{activeName}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={onInvite} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1" htmlFor="invite-email">
                  Work Email Address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  autoComplete="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="w-full rounded-xl border border-slate-300/80 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-700 mb-1" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {INVITE_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {inviteError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800">
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-900">
                  ✓ {inviteSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={inviteBusy}
                className="w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm px-4 py-3 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {inviteBusy ? 'Sending invitation…' : 'Send Invitation'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}