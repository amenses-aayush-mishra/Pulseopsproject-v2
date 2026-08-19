'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const VERIFY_OTP_ENDPOINT = `${API_BASE}/api/auth/verify-password-reset-otp`;
const RESET_ENDPOINT = `${API_BASE}/api/auth/reset-password`;
const RESEND_ENDPOINT = `${API_BASE}/api/auth/resend-password-otp`;

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

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const email = sanitizeParam(searchParams.get('email'));

  const [step, setStep] = useState('otp'); // 'otp' | 'password' | 'success'
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const verifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    if (busy) return;
    if (!email) {
      setError({ message: 'Missing email. Please request a reset code again.' });
      return;
    }
    const trimmedOtp = otp.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setError({ message: 'Enter the 6-digit code from your email.' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(VERIFY_OTP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: trimmedOtp }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data?.message || `Verification failed (${res.status}).` });
        return;
      }
      // Keep the one-time reset token in component state only — never in the URL.
      setResetToken(data?.resetToken || '');
      setOtp('');
      setStep('password');
    } catch (err) {
      setError({ message: 'Could not reach the authentication server. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    setError(null);
    setMessage('');
    if (busy) return;
    if (!email) {
      setError({ message: 'Missing email. Please request a reset code again.' });
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
      setError({ message: 'Could not reach the authentication server. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage('');
    if (busy) return;

    if (!newPassword || newPassword.length < 8) {
      setError({ message: 'Password must be at least 8 characters.' });
      return;
    }
    if (confirm !== newPassword) {
      setError({ message: 'Passwords do not match.' });
      return;
    }
    if (!email || !resetToken) {
      setError({ message: 'Reset session expired. Please request a new code.' });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(RESET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetToken, password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: data?.message || `Reset failed (${res.status}).` });
        return;
      }
      setNewPassword('');
      setConfirm('');
      setMessage(data?.message || 'Password changed successfully.');
      setStep('success');
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
        {step === 'success' ? (
          <div className="space-y-4">
            <h1 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              Password changed
            </h1>
            <Banner kind="success">✓ {message}</Banner>
            <p className="text-sm text-slate-500">
              Your password was updated. Sign in with your new password.
            </p>
            <a
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90"
            >
              Go to Login
            </a>
          </div>
        ) : step === 'password' ? (
          <div className="space-y-4">
            <h1 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              Set a new password
            </h1>
            <p className="text-sm text-slate-500">
              Resetting password for{' '}
              <span className="font-semibold text-slate-700">{email}</span>.
            </p>

            {error && <Banner kind="error">{error.message}</Banner>}
            {message && !error && <Banner kind="success">{message}</Banner>}

            <form onSubmit={resetPassword} className="space-y-4" noValidate>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type="password"
                  name="newPassword"
                  autoComplete="new-password"
                  value={newPassword}
                  placeholder=" "
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
                />
                <label htmlFor="reset-new-password" className={FLOAT_LABEL}>
                  New password
                </label>
              </div>
              <div className="relative">
                <input
                  id="reset-confirm"
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  value={confirm}
                  placeholder=" "
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
                />
                <label htmlFor="reset-confirm" className={FLOAT_LABEL}>
                  Confirm new password
                </label>
              </div>
              <p className="text-left text-xs text-slate-400">At least 8 characters.</p>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400">
              <a href="/login" className="underline-offset-2 hover:underline">
                Back to Login
              </a>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h1 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              Reset your password
            </h1>
            <p className="text-sm text-slate-500">
              Enter the 6-digit code sent to{' '}
              <span className="font-semibold text-slate-700">{email || 'your email'}</span>.
            </p>

            {error && <Banner kind="error">{error.message}</Banner>}
            {message && !error && <Banner kind="success">{message}</Banner>}

            <form onSubmit={verifyOtp} className="space-y-4" noValidate>
              <div className="relative">
                <input
                  id="reset-otp"
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
                  htmlFor="reset-otp"
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
                {busy ? 'Verifying…' : 'Verify Code'}
              </button>
            </form>

            <div className="flex items-center justify-center gap-1 text-sm text-slate-500">
              Didn&apos;t get the code?
              <button
                type="button"
                onClick={resendOtp}
                disabled={busy}
                className="font-semibold text-indigo-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resend OTP
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              <a href="/login" className="underline-offset-2 hover:underline">
                Back to Login
              </a>
            </p>
          </div>
        )}
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Fallback />}>
      <ResetPasswordInner />
    </Suspense>
  );
}