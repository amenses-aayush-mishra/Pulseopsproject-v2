'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';

const ROLES = ['developer', 'techlead', 'admin'];

const ROLE_COLORS = {
  owner: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  admin: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  techlead: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  developer: 'bg-slate-50 text-slate-700 ring-slate-600/20',
};

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset capitalize ${
        ROLE_COLORS[role] || ROLE_COLORS.developer
      }`}
    >
      {role}
    </span>
  );
}

export default function InvitationsPage({ params }) {
  const { workspaceId } = params;
  const { data: session } = useSession();
  // Credentials logins store the JWT in localStorage; NextAuth OAuth sessions
  // expose it as session.accessToken. Fall back to localStorage for creds users.
  const token =
    session?.accessToken ||
    (typeof window !== 'undefined' ? localStorage.getItem('pulseops_token') : null);

  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [inviteOrgEmail, setInviteOrgEmail] = useState('');
  const [invitePersonalEmail, setInvitePersonalEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('developer');
  const [sending, setSending] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [inviteError, setInviteError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'x-organization-id': workspaceId,
        'Content-Type': 'application/json',
      };
      const [membersRes] = await Promise.all([
        fetch(`${API_BASE}/api/organizations/members`, { headers }),
      ]);
      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(data.members || []);
        setInvitations(data.invitations || []);
      }
    } catch (e) {
      setError('Failed to load workspace members.');
    } finally {
      setLoading(false);
    }
  }, [token, workspaceId]);

  useEffect(() => {
    if (token) fetchData();
  }, [fetchData, token]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteError('');
    setInviteResult(null);
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/organizations/invite`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': workspaceId,
          'Content-Type': 'application/json',
        },
        // Send as { email } — backend accepts email / orgEmail / personalEmail
        body: JSON.stringify({ email: inviteOrgEmail.trim() || invitePersonalEmail.trim(), name: inviteName.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data?.message || 'Failed to send invitation.');
      } else {
        setInviteResult(data);
        setInviteOrgEmail('');
        setInvitePersonalEmail('');
        setInviteName('');
        fetchData();
      }
    } catch {
      setInviteError('Could not reach the server. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    if (!inviteResult?.inviteUrl) return;
    navigator.clipboard.writeText(inviteResult.inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };


  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team & Invitations</h1>
        <p className="mt-2 text-sm text-slate-500">
          Manage workspace members and invite new teammates.
        </p>
      </div>

      {/* Invite form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Invite a teammate</h2>
        <form onSubmit={handleInvite} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="email"
              required
              placeholder="Organization Email (e.g., colleague@company.com)"
              value={inviteOrgEmail}
              onChange={(e) => setInviteOrgEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
            <input
              type="email"
              required
              placeholder="Personal Email (e.g., colleague@gmail.com)"
              value={invitePersonalEmail}
              onChange={(e) => setInvitePersonalEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
            <input
              type="text"
              placeholder="Name (Optional)"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 capitalize"
            >
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="self-end inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
          >
            {sending ? 'Sending…' : 'Send Invite'}
          </button>
        </form>

        {inviteError && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {inviteError}
          </div>
        )}

        {inviteResult && (
          <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 space-y-2">
            <p className="font-medium">✓ Invitation sent!</p>
            {inviteResult.tempPassword && (
              <div>
                <p className="text-emerald-700">Temporary password (share securely):</p>
                <div className="mt-1 rounded bg-white border border-emerald-200 px-3 py-2 font-mono text-lg font-bold tracking-widest text-slate-800">
                  {inviteResult.tempPassword}
                </div>
                <p className="mt-1 text-xs text-emerald-600">
                  The invitee will be required to change this on first login.
                </p>
              </div>
            )}
            {inviteResult.inviteUrl && (
              <p className="text-xs text-emerald-700 break-all">
                <span className="font-medium">Login link: </span>
                <a
                  href={inviteResult.inviteUrl}
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {inviteResult.inviteUrl}
                </a>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Active members</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
          </div>
        ) : error ? (
          <p className="p-6 text-sm text-rose-600">{error}</p>
        ) : members.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No members found.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.userId || m._id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.name || m.email || 'Unknown'}</p>
                  {m.email && m.name && (
                    <p className="text-xs text-slate-500 mt-0.5">{m.email}</p>
                  )}
                </div>
                <RoleBadge role={m.role} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Pending invitations
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                {invitations.length}
              </span>
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <li key={inv._id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{inv.email}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <RoleBadge role={inv.role} />
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                    Pending
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
