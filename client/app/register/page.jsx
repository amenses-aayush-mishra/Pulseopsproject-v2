'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Backend API base. The spec-facing var is NEXT_PUBLIC_EXPRESS_API_URL; fall
// back to NEXT_PUBLIC_API_URL (used by /login, /onboarding, /dashboard) and
// then the local backend default port when no client .env exists.
const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const REGISTER_ENDPOINT = `${API_BASE}/api/auth/register`;

// TASK-112 pattern — strip control characters, cap length before values reach
// form state, banners, or API payloads. (React escapes JSX output too.)
const sanitizeParam = (value, { maxLength = 255 } = {}) => {
  let out = String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return out.slice(0, maxLength);
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

// TASK-113 — shared floating-label input styles (peer / placeholder-shown).
const FLOAT_INPUT =
  'peer w-full rounded-xl border bg-white/80 px-3.5 pb-2.5 pt-5 text-sm text-slate-900 outline-none transition-colors focus:ring-2';
const FLOAT_LABEL =
  'pointer-events-none absolute left-3.5 top-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-indigo-500';

function Banner({ kind, children }) {
  return (
    <div
      role={kind === 'success' ? 'status' : 'alert'}
      className={`rounded-xl border px-3 py-2.5 text-sm ${
        kind === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      {children}
    </div>
  );
}

function RegisterInner() {
  const searchParams = useSearchParams();
  // Prefill the email when arriving from an invite-locked /login
  // ("Don't have an account? Sign up" keeps ?orgEmail=…).
  const orgEmail = sanitizeParam(searchParams.get('orgEmail'));

  const [email, setEmail] = useState(() => (orgEmail ? orgEmail : ''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null); // { message, hasPendingInvite }
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const errors = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) errors.email = 'Email is required.';
    else if (!EMAIL_RE.test(trimmedEmail)) errors.email = 'Enter a valid email address.';
    if (!password) errors.password = 'Password is required.';
    else if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (!confirm) errors.confirm = 'Please confirm your password.';
    else if (confirm !== password) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (busy || success) return;
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch(REGISTER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data?.message || `Registration failed (${res.status}).` });
        return;
      }
      setSuccess({
        message:
          data?.message || 'Account registered! Please check your email for a verification link.',
        hasPendingInvite: Boolean(data?.hasPendingInvite),
      });
    } catch (err) {
      setError({ message: 'Could not reach the authentication server. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-6 text-slate-900">
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
          <div className="mb-6 text-center">
            <h1 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              PulseOps
            </h1>
            <p className="mt-1 text-sm text-slate-500">Create your account</p>
          </div>

          {success ? (
            <div className="space-y-3">
              <Banner kind="success">{success.message}</Banner>
              {success.hasPendingInvite && (
                <p className="text-sm text-slate-500">
                  You also have a pending organization invitation — after verifying your email,
                  sign in with the invited address.
                </p>
              )}
              <a
                href="/login"
                className="block w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90"
              >
                Go to Sign In
              </a>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              {error && (
                <div className="mb-4">
                  <Banner kind="error">{error.message}</Banner>
                </div>
              )}

              <div className="mb-4">
                <div className="relative">
                  <input
                    id="register-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    placeholder=" "
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
                  />
                  <label htmlFor="register-email" className={FLOAT_LABEL}>
                    Email
                  </label>
                </div>
                {fieldErrors.email && (
                  <p className="mt-1.5 text-xs text-rose-600">{fieldErrors.email}</p>
                )}
              </div>

              <div className="mb-4">
                <div className="relative">
                  <input
                    id="register-password"
                    type="password"
                    name="password"
                    autoComplete="new-password"
                    value={password}
                    placeholder=" "
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
                  />
                  <label htmlFor="register-password" className={FLOAT_LABEL}>
                    Password
                  </label>
                </div>
                <p className="mt-1.5 text-xs text-slate-400">At least 8 characters.</p>
                {fieldErrors.password && (
                  <p className="mt-1.5 text-xs text-rose-600">{fieldErrors.password}</p>
                )}
              </div>

              <div className="mb-4">
                <div className="relative">
                  <input
                    id="register-confirm"
                    type="password"
                    name="confirm"
                    autoComplete="new-password"
                    value={confirm}
                    placeholder=" "
                    onChange={(e) => setConfirm(e.target.value)}
                    className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
                  />
                  <label htmlFor="register-confirm" className={FLOAT_LABEL}>
                    Confirm password
                  </label>
                </div>
                {fieldErrors.confirm && (
                  <p className="mt-1.5 text-xs text-rose-600">{fieldErrors.confirm}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Creating account…' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <a
            href="/login"
            className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

function RegisterFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterInner />
    </Suspense>
  );
}

