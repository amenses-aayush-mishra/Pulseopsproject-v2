'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

// Email-OTP verification page. Reached from /register (redirect with
// ?email=...) or via the "resend verification code" link on /login. The
// 6-digit code is entered here — never carried in the URL.
const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const VERIFY_ENDPOINT = `${API_BASE}/api/auth/verify-email`;
const RESEND_ENDPOINT = `${API_BASE}/api/auth/resend-otp`;

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

// TASK-112 pattern — strip control characters, cap length before values reach
// form state, banners, or API payloads.
const sanitizeParam = (value, { maxLength = 255 } = {}) => {
  let out = String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  return out.slice(0, maxLength);
};

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

function VerifyEmailInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = sanitizeParam(searchParams.get('email'));

  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    if (busy) return;

    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError({ message: 'Enter the 6-digit code from your email.' });
      return;
    }
    if (!email) {
      setError({ message: 'Missing verification email. Please sign up again.' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(VERIFY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: trimmedOtp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data?.message || `Verification failed (${res.status}).` });
        return;
      }
      setVerified(true);
      setMessage(data?.message || 'Email verified successfully.');

      // Establish the authenticated session now (the verify-email response carries a
      // freshly minted standard auth token) and go straight to /onboarding —
      // the user never sees the sign-in page and never re-enters their password.
      try {
        const signInRes = await signIn('credentials', {
          redirect: false,
          email,
          verifiedToken: data?.token,
        });
        if (!signInRes?.ok || signInRes?.error) {
          setError({
            message: 'Email verified, but automatic sign-in failed. Please sign in to continue.',
          });
          return;
        }
        // Persist the session access token for API calls outside NextAuth.
        const sessionRes = await fetch('/api/auth/session');
        const sessionData = await sessionRes.json().catch(() => ({}));
        if (sessionData?.accessToken) {
          try {
            localStorage.setItem('pulseops_token', sessionData.accessToken);
          } catch (storageErr) {
            // storage disabled — onboarding is still gated by the NextAuth session.
          }
        }
        router.replace('/onboarding');
        return;
      } catch (autoSignInErr) {
        setError({
          message: 'Email verified, but automatic sign-in failed. Please sign in to continue.',
        });
        return;
      }
    } catch (err) {
      setError({ message: 'Could not reach the verification service. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setMessage('');
    if (busy) return;
    if (!email) {
      setError({ message: 'Missing verification email. Please sign up again.' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data?.message || `Resend failed (${res.status}).` });
        return;
      }
      setMessage(data?.message || 'A new verification code has been sent to your email.');
    } catch (err) {
      setError({ message: 'Could not reach the verification service. Please try again.' });
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
          Verify your email
        </h1>

        {verified ? (
          <div className="mt-6 space-y-4">
            <Banner kind="success">✓ {message}</Banner>
            {error && <Banner kind="error">{error.message}</Banner>}
            <p className="text-sm text-slate-500">
              Your email is verified. Continue to your workspace setup.
            </p>
            <a
              href="/login?verified=true"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90"
            >
              Continue to sign in
            </a>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-500">
              We sent a 6-digit verification code to{' '}
              <span className="font-semibold text-slate-700">{email || 'your email'}</span>.
              Enter it below to verify your account.
            </p>

            {error && <Banner kind="error">{error.message}</Banner>}
            {message && !error && <Banner kind="success">{message}</Banner>}

            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div className="relative">
                <input
                  id="verify-otp"
                  type="text"
                  name="otp"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={otp}
                  placeholder=" "
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="peer w-full rounded-xl border border-slate-300 bg-white/80 px-3.5 pb-2.5 pt-5 text-center text-xl font-bold tracking-[0.5em] text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200"
                />
                <label
                  htmlFor="verify-otp"
                  className="pointer-events-none absolute left-3.5 top-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[11px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-wide peer-focus:text-indigo-500"
                >
                  Verification code
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Verifying…' : 'Verify Email'}
              </button>
            </form>

            <div className="flex items-center justify-center gap-1 text-sm text-slate-500">
              Didn&apos;t get the code?
              <button
                type="button"
                onClick={onResend}
                disabled={busy}
                className="font-semibold text-indigo-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resend OTP
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push('/register')}
              disabled={busy}
              className="w-full rounded-xl border border-slate-300 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Back
            </button>

            <p className="text-center text-xs text-slate-400">
              <a href="/login" className="underline-offset-2 hover:underline">
                Back to sign in
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<VerifyEmailFallback />}>
      <VerifyEmailInner />
    </Suspense>
  );
}
