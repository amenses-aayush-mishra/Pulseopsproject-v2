'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// TASK-109 — invitation landing for temporary passwords. An owner/admin can
// pre-provision an account with a temp password (POST /api/organizations/invite
// with tempPassword). That user logs in with the temp password, lands here
// (mustChangePassword = true), rotates it via POST /api/auth/change-password,
// and is then routed into the workspace. The form is also available voluntarily
// to any password user.

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const CHANGE_PASSWORD_ENDPOINT = `${API_BASE}/api/auth/change-password`;

export default function InvitationLandingPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mustChange, setMustChange] = useState(false);

  const workspaceId = params?.workspaceId;

  useEffect(() => {
    if (status === 'authenticated') {
      setMustChange(session?.user?.mustChangePassword === true);
    }
  }, [status, session?.user?.mustChangePassword]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <a
          href="/login"
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90"
        >
          Sign in to continue
        </a>
      </div>
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (busy) return;
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      const bearer = session?.accessToken;
      const res = await fetch(CHANGE_PASSWORD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bearer ? { Authorization: `Bearer ${bearer.trim()}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message || `Password change failed (${res.status}).`);
        return;
      }
      if (data.token) {
        try {
          localStorage.setItem('pulseops_token', data.token);
        } catch (storageErr) {
          // storage disabled — the NextAuth session below is still refreshed
        }
      }
      setSuccess('Password updated successfully.');
      await update({
        accessToken: data.token,
        mustChangePassword: false,
        activeOrganizationId:
          data?.user?.activeOrganizationId ||
          session?.user?.activeOrganizationId ||
          workspaceId,
        role: data?.user?.role || session?.user?.role,
      });
      // Navigate only after the NextAuth session reflects mustChangePassword=false
      // so the workspace page / middleware never bounce the user back here.
      router.replace(`/workspace/${workspaceId}`);
      router.refresh();
    } catch (err) {
      setError('Could not reach the password service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-indigo-100/60 backdrop-blur-xl">
        <h1 className="text-xl font-semibold text-slate-900">
          {mustChange ? 'Set your password' : 'Change password'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {mustChange
            ? 'Your account was provisioned with a temporary password. Set a new one to continue into the workspace.'
            : 'Update the password you use to sign in to this workspace.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
            >
              ✓ {success}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  );
}
