'use client';

import { Suspense, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const FORGOT_ENDPOINT = `${API_BASE}/api/auth/forgot-password`;

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

// TASK-113 shared floating-label input styles.
const FLOAT_INPUT =
  'peer w-full rounded-xl border bg-white/80 px-3.5 pb-2.5 pt-5 text-sm text-slate-900 outline-none transition-colors focus:ring-2';
const FLOAT_LABEL =
  'pointer-events-none absolute left-3.5 top-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-indigo-500';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
    >
      {error.message}
    </div>
  );
}

function ForgotPasswordInner() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (busy) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setError({ message: 'Enter a valid email address.' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(FORGOT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data?.message || `Request failed (${res.status}).` });
        return;
      }
      // Only the email rides in the URL — never the OTP or password.
      router.push(`/reset-password?email=${encodeURIComponent(trimmedEmail)}`);
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

      <div className="relative w-full max-w-md rounded-3xl border border-white/60 bg-white/70 p-8 text-center shadow-xl shadow-indigo-500/10 backdrop-blur-xl">
        <h1 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
          Forgot your password?
        </h1>
        <p className="mt-3 text-sm text-slate-500">
          Enter your account email and we&apos;ll send you a code to reset your password.
        </p>

        {error && (
          <div className="mt-6">
            <ErrorBanner error={error} />
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div className="relative">
            <input
              id="forgot-email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              placeholder=" "
              onChange={(e) => setEmail(e.target.value)}
              className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
            />
            <label htmlFor="forgot-email" className={FLOAT_LABEL}>
              Email
            </label>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Sending…' : 'Send Reset Code'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          <a href="/login" className="font-semibold text-indigo-600 underline-offset-2 hover:underline">
            Back to Login
          </a>
        </p>
      </div>
    </div>
  );
}

function Fallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
