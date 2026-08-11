'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

// Verification emails link here: `${FRONTEND_URL}/verify-email?token=...`.
// This page calls the Express API and routes the user on to /login.
const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const VERIFY_ENDPOINT = `${API_BASE}/api/auth/verify-email`;

const GRID_BG = {
  backgroundImage:
    'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = String(searchParams.get('token') || '').trim();
  const [state, setState] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Missing verification token. Please use the link from your email.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${VERIFY_ENDPOINT}?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setState('success');
          setMessage(data?.message || 'Email verified successfully.');
        } else {
          setState('error');
          setMessage(data?.message || `Verification failed (${res.status}).`);
        }
      } catch (err) {
        if (!cancelled) {
          setState('error');
          setMessage('Could not reach the verification service. Please try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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
          Email verification
        </h1>

        {state === 'verifying' && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
            <p className="text-sm text-slate-500">Verifying your email…</p>
          </div>
        )}

        {state === 'success' && (
          <div className="mt-6 space-y-4">
            <div
              role="status"
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
            >
              ✓ {message}
            </div>
            <a
              href="/login?verified=true"
              className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90"
            >
              Continue to login
            </a>
          </div>
        )}

        {state === 'error' && (
          <div className="mt-6 space-y-4">
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
            >
              {message}
            </div>
            <a
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-white hover:text-indigo-700"
            >
              Back to login
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
