'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// Backend API base — mirror of /login (no client .env exists, so fall back to
// the local backend default port).
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

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

// TASK-113 — floating-label input styles (peer / placeholder-shown).
const FLOAT_INPUT =
  'peer w-full rounded-xl border bg-white/80 px-3.5 pb-2.5 pt-5 text-sm text-slate-900 outline-none transition-colors focus:ring-2';
const FLOAT_LABEL =
  'pointer-events-none absolute left-3.5 top-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-indigo-500';

const STEPS = [
  { num: 1, label: 'Account' },
  { num: 2, label: 'Organization' },
  { num: 3, label: 'Done' },
];

function Stepper({ current }) {
  return (
    <ol className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((step) => {
        const active = step.num === current;
        const done = step.num < current;
        return (
          <li key={step.num} className="flex items-center gap-2">
            {step.num > 1 && (
              <span
                className={`h-px w-6 sm:w-10 ${active || done ? 'bg-indigo-300' : 'bg-slate-200'}`}
              />
            )}
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                active
                  ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-300'
                  : done
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-300 text-white'
                }`}
              >
                {done ? '✓' : step.num}
              </span>
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
    >
      {error.message}
    </div>
  );
}

function NoSessionBanner() {
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
    >
      No active session found on this device. Please{' '}
      <a href="/login" className="font-semibold underline underline-offset-2">
        sign in
      </a>{' '}
      first, then complete onboarding for your workspace.
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const { status, update } = useSession();

  const [name, setName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [primaryFocus, setPrimaryFocus] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(null);
  const [tokenReady, setTokenReady] = useState(false);

  useEffect(() => {
    try {
      setToken(localStorage.getItem('pulseops_token') || null);
    } catch (storageErr) {
      setToken(null);
    } finally {
      setTokenReady(true);
    }
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedFocus = primaryFocus.trim();
    if (!trimmedName) {
      setError({ message: 'Organization name is required.' });
      return;
    }
    if (!teamSize) {
      setError({ message: 'Please select a team size.' });
      return;
    }
    if (!trimmedFocus) {
      setError({ message: 'Primary focus is required.' });
      return;
    }
    if (busy) return;
    setBusy(true);

    try {
      const res = await fetch(ONBOARD_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
        },
        body: JSON.stringify({ name: trimmedName, teamSize, primaryFocus: trimmedFocus }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError({
          message: data?.message || `Onboarding failed (${res.status}). Please try again.`,
          code: data?.code,
        });
        return;
      }

      // 1) Refresh the stored client JWT FIRST — never navigate on a stale token.
      if (data && data.token) {
        try {
          localStorage.setItem('pulseops_token', data.token);
          setToken(data.token);
        } catch (storageErr) {
          // storage disabled — proceed; navigation is still gated by NextAuth.
        }
      }

      // 2) Sync the NextAuth session cookie so route guards (middleware) see the
      //    new activeOrganizationId/role BEFORE the redirect.
      if (status === 'authenticated' && data && data.organization && data.organization._id) {
        try {
          await update({
            accessToken: data.token,
            activeOrganizationId: data.organization._id,
            role: 'owner',
            // Refresh workspace counts so session reflects the new workspace.
            hasWorkspace: true,
            workspaceCount: 1,
            workspaces: [{ id: data.organization._id, name: data.organization.name || '', role: 'owner' }],
          });
        } catch (sessionErr) {
          // Non-fatal: token was already refreshed; navigation still proceeds.
        }
      }

      // 3) Navigate directly into the new workspace — skip /dashboard bounce.
      const newWorkspaceId = data?.organization?._id;
      if (newWorkspaceId) {
        router.replace(`/workspace/${newWorkspaceId}`);
      } else {
        router.replace('/dashboard');
      }
    } catch (err) {
      setError({ message: 'Could not reach the authentication server. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 text-slate-900">
      {/* subtle grid + glow backdrop */}
      <div aria-hidden="true" className="absolute inset-0" style={GRID_BG} />
      <div
        aria-hidden="true"
        className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-300/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/60 bg-white/70 p-8 shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
          <div className="mb-7 text-center">
            <h1 className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              Set up your workspace
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create your organization to start collaborating
            </p>
          </div>

          <Stepper current={2} />

          <ErrorBanner error={error} />
          {tokenReady && !token && <NoSessionBanner />}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="relative">
              <input
                id="onboard-name"
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=" "
                autoComplete="organization"
                className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
              />
              <label htmlFor="onboard-name" className={FLOAT_LABEL}>
                Organization name <span className="text-rose-500">*</span>
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">
                Team size <span className="text-rose-500">*</span>
              </span>
              <select
                name="teamSize"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white/80 px-3 py-2.5 text-sm outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
              >
                <option value="" disabled>
                  Select a range…
                </option>
                {TEAM_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>

            <div className="relative">
              <input
                id="onboard-focus"
                type="text"
                name="primaryFocus"
                list="focus-options"
                value={primaryFocus}
                onChange={(e) => setPrimaryFocus(e.target.value)}
                placeholder=" "
                className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
              />
              <label htmlFor="onboard-focus" className={FLOAT_LABEL}>
                Primary focus <span className="text-rose-500">*</span>
              </label>
              <datalist id="focus-options">
                {FOCUS_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <span className="mt-1 block text-xs text-slate-400">
                Pick a suggestion or type your own.
              </span>
            </div>

            <button
              type="submit"
              disabled={busy || (tokenReady && !token)}
              className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'Creating workspace…' : 'Create Organization'}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          By creating an organization you agree to the PulseOps terms of service.
        </p>
      </div>
    </div>
  );
};