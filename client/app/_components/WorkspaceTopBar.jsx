'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Check, User, Plus, LogOut, ChevronDown, Building2 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const ME_ENDPOINT = `${API_BASE}/api/auth/me`;
const SWITCH_ENDPOINT = `${API_BASE}/api/organizations/switch-org`;

export default function WorkspaceTopBar({ workspaceId, role }) {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [me, setMe] = useState(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState(null);

  const userEmail = session?.user?.email || '—';
  const userName = session?.user?.name || userEmail.split('@')[0];
  const userRole = role || session?.user?.role || 'member';

  // Fetch available organizations for switching
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
        if (!cancelled && res.ok) {
          setMe(data);
        }
      } catch {
        // Fallback to session data
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.accessToken, status]);

  const organizations = me?.availableOrganizations || session?.user?.workspaces || [];
  const activeOrg = me?.activeOrganization || organizations.find((o) => o.id === workspaceId) || null;
  const activeName = activeOrg?.name || 'Current Workspace';

  const onSwitchWorkspace = useCallback(
    async (orgId, orgRole) => {
      if (!orgId || orgId === workspaceId) {
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
        router.push(`/workspace/${data.activeOrganizationId || orgId}`);
        router.refresh();
      } catch {
        setSwitchError('Could not reach workspace service.');
      } finally {
        setSwitching(false);
      }
    },
    [workspaceId, session?.accessToken, update, router]
  );

  const onSignOut = async () => {
    try {
      localStorage.removeItem('pulseops_token');
      sessionStorage.clear();
    } catch { }
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-2xs sm:px-6 lg:px-8 z-30 relative">
      {/* Left: Current Workspace Switcher */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 hidden sm:inline-block">
          Current Workspace
        </span>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowSwitcher((v) => !v);
              setShowProfileMenu(false);
              setSwitchError(null);
            }}
            disabled={switching}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 hover:bg-white text-xs font-bold text-slate-800 transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 text-white text-[10px] font-extrabold">
              {activeName[0]?.toUpperCase() || 'W'}
            </span>
            <span className="max-w-[160px] truncate">{activeName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showSwitcher && (
            <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-slate-200/90 bg-white py-2 shadow-xl z-50">
              <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                Workspaces
              </div>
              <div className="max-h-48 overflow-y-auto py-1">
                {organizations.map((org) => {
                  const orgId = org.id || org._id;
                  const selected = orgId === workspaceId;
                  return (
                    <button
                      key={orgId}
                      type="button"
                      disabled={switching}
                      onClick={() => onSwitchWorkspace(orgId, org.role)}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs text-left transition-colors ${selected
                          ? 'bg-indigo-50/80 font-bold text-indigo-700'
                          : 'text-slate-700 hover:bg-slate-50 font-medium'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{org.name}</span>
                      </div>
                      {selected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
                {organizations.length === 0 && (
                  <div className="px-3.5 py-2 text-xs text-slate-400 italic">No other workspaces</div>
                )}
              </div>

              {/* Action: Create Workspace ONLY */}
              <div className="pt-1.5 mt-1 border-t border-slate-100 px-2">
                <Link
                  href="/onboarding"
                  onClick={() => setShowSwitcher(false)}
                  className="flex items-center justify-center gap-1.5 w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 py-1.5 rounded-lg hover:bg-indigo-50/60 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Single Profile Icon Button ONLY */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowProfileMenu((v) => !v);
            setShowSwitcher(false);
          }}
          className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center hover:bg-slate-800 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="User profile menu"
        >
          {userName[0]?.toUpperCase() || 'U'}
        </button>

        {showProfileMenu && (
          <div className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xl z-50 space-y-3">
            <div className="border-b border-slate-100 pb-2.5">
              <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{userEmail}</p>
              <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1 h-1 rounded-full bg-indigo-600"></span>
                {userRole}
              </div>
            </div>

            <div className="space-y-1">
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
  );
}
