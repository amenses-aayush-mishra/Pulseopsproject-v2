'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { X, Loader2, Plus } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const ONBOARD_ENDPOINT = `${API_BASE}/api/organizations/onboard`;

const TEAM_SIZES = ['1-10', '11-50', '51-200', '200+'];
const FOCUS_OPTIONS = [
  'Web App Development',
  'AI/ML Solutions',
  'SaaS Infrastructure',
  'Mobile Applications',
  'Data & Analytics',
  'Other',
];

const FLOAT_INPUT =
  'peer w-full rounded-xl border border-slate-200/80 bg-white px-3.5 pb-2 pt-5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 placeholder-transparent';
const FLOAT_LABEL =
  'pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-indigo-600';

/**
 * CreateWorkspaceModal — shared component for creating a new workspace.
 * Calls POST /api/organizations/onboard (same API as /onboarding page).
 * On success: updates session, stores token, navigates to the new workspace.
 *
 * Props:
 *   open      {boolean}  — whether the modal is visible
 *   onClose   {function} — called when the modal should close
 */
export default function CreateWorkspaceModal({ open, onClose }) {
  const router = useRouter();
  const { data: session, status, update } = useSession();

  const [name, setName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [primaryFocus, setPrimaryFocus] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const handleClose = () => {
    if (busy) return;
    setName('');
    setTeamSize('');
    setPrimaryFocus('');
    setError(null);
    onClose();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedFocus = primaryFocus.trim();
    if (!trimmedName) { setError('Workspace name is required.'); return; }
    if (!teamSize) { setError('Please select a team size.'); return; }
    if (!trimmedFocus) { setError('Primary focus is required.'); return; }
    if (busy) return;
    setBusy(true);

    try {
      let storedToken = null;
      try { storedToken = localStorage.getItem('pulseops_token'); } catch {}
      const activeToken = session?.accessToken || storedToken;

      const res = await fetch(ONBOARD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken.trim()}` } : {}),
        },
        body: JSON.stringify({ name: trimmedName, teamSize, primaryFocus: trimmedFocus }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || `Could not create workspace (${res.status}). Please try again.`);
        return;
      }

      // Persist the new token
      if (data?.token) {
        try { localStorage.setItem('pulseops_token', data.token); } catch {}
      }

      // Update the NextAuth session so middleware & top bar see the new workspace
      if (status === 'authenticated' && data?.organization?._id) {
        try {
          await update({
            accessToken: data.token,
            activeOrganizationId: data.organization._id,
            role: 'owner',
            hasWorkspace: true,
            workspaceCount: (session?.user?.workspaceCount ?? 0) + 1,
            workspaces: [
              ...(Array.isArray(session?.user?.workspaces) ? session.user.workspaces : []),
              { id: data.organization._id, name: data.organization.name || trimmedName, role: 'owner' },
            ],
          });
        } catch {}
      }

      const newId = data?.organization?._id;
      handleClose();
      if (newId) {
        router.push(`/workspace/${newId}`);
        router.refresh();
      }
    } catch {
      setError('Could not reach the workspace service. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      {/* Panel */}
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Create workspace</h2>
              <p className="text-[11px] text-slate-500">Set up a new workspace for your team.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs text-rose-800"
            >
              {error}
            </div>
          )}

          {/* Workspace name */}
          <div className="relative">
            <input
              id="cw-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              autoComplete="off"
              disabled={busy}
              className={FLOAT_INPUT}
            />
            <label htmlFor="cw-name" className={FLOAT_LABEL}>
              Workspace Name
            </label>
          </div>

          {/* Team size */}
          <div className="relative">
            <select
              id="cw-size"
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200/80 bg-white px-3.5 pb-2 pt-5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none"
            >
              <option value="" disabled hidden></option>
              {TEAM_SIZES.map((s) => (
                <option key={s} value={s}>{s} people</option>
              ))}
            </select>
            <label
              htmlFor="cw-size"
              className="pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600"
            >
              Team Size
            </label>
          </div>

          {/* Primary focus */}
          <div className="relative">
            <select
              id="cw-focus"
              value={primaryFocus}
              onChange={(e) => setPrimaryFocus(e.target.value)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200/80 bg-white px-3.5 pb-2 pt-5 text-sm text-slate-900 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 appearance-none"
            >
              <option value="" disabled hidden></option>
              {FOCUS_OPTIONS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <label
              htmlFor="cw-focus"
              className="pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600"
            >
              Primary Focus
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create workspace'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
