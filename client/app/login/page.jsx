'use client';
import { signIn, useSession } from 'next-auth/react';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

// Backend API base. In dev (no client .env), Next does not inline
// NEXT_PUBLIC_API_URL, so fall back to the local backend default port.
const API_BASE = process.env.NEXT_PUBLIC_EXPRESS_API_URL || 'http://localhost:5000';
const LOGIN_ENDPOINT = `${API_BASE}/api/auth/login`;

// TASK-112: query-parameter / XSS guard — strip control characters, enforce
// type + length caps BEFORE values reach form state, rendered banners, or API
// payloads. (React escapes JSX output too; this is defense-in-depth.)
const sanitizeParam = (value, { alphanumeric = false, maxLength = 255 } = {}) => {
  let out = String(value == null ? '' : value)
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  if (alphanumeric) out = out.replace(/[^A-Za-z0-9]/g, '');
  return out.slice(0, maxLength);
};

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

function LockedBanner({ orgEmail }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-xl border border-indigo-300/60 bg-indigo-50/80 px-3 py-2.5 text-sm text-indigo-800"
    >
      <span aria-hidden="true">🔒</span>
      <span>
        <strong>Locked to invited email:</strong> {orgEmail}
      </span>
    </div>
  );
}

function ErrorBanner({ error, email }) {
  if (!error) return null;
  const isMismatch = error.code === 'INVITATION_EMAIL_MISMATCH';
  const isUnverified = error.code === 'EMAIL_NOT_VERIFIED';
  return (
    <div
      role="alert"
      className={`rounded-xl border px-3 py-2.5 text-sm ${
        isMismatch
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : isUnverified
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      {isMismatch
        ? `This invitation is locked to a different email. Sign in with the exact invited address (${error.message}).`
        : error.message}
      {isUnverified && (
        <div className="mt-2">
          <a
            href={`/verify-email?email=${encodeURIComponent(email || '')}`}
            className="font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            Resend verification code
          </a>
        </div>
      )}
    </div>
  );
}

const OAUTH_ERROR_MESSAGES = {
  Configuration:
    'Single sign-on is not configured in this environment. Please sign in with email & password.',
  // A GET /api/auth/signin/google (direct hit or providers not yet loaded
  // client-side) redirects here with ?error=<provider-id> for a missing provider.
  google:
    'Google Single Sign-On is not configured in this environment. Please sign in with email & password.',
  github:
    'GitHub Single Sign-On is not configured in this environment. Please sign in with email & password.',
  OAuthSignin:
    'Single sign-on could not complete. Please try again or sign in with email & password.',
  OAuthCallback:
    'Single sign-on could not complete. Please try again or sign in with email & password.',
  OAuthCreateAccount:
    'Could not create a single sign-on account. Please try again or sign in with email & password.',
  AccessDenied:
    'You were not authorized to sign in. Please try again or sign in with email & password.',
};

function NextAuthErrorBanner({ code }) {
  if (!code) return null;
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
    >
      {OAUTH_ERROR_MESSAGES[code] || 'Sign-in failed. Please try again.'}
    </div>
  );
}

function LoginInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  // TASK-112: sanitize URL params before they reach state/banners/payloads.
  const orgEmail = sanitizeParam(searchParams.get('orgEmail'), { maxLength: 255 });
  const inviteToken = sanitizeParam(searchParams.get('inviteToken'), {
    alphanumeric: true,
    maxLength: 128,
  });
  const verified = searchParams.get('verified') === 'true';

  const [tab, setTab] = useState('credentials');
  const [email, setEmail] = useState(() => (orgEmail ? orgEmail : ''));
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const locked = Boolean(orgEmail);

  // Tracks whether a post-login redirect is already in flight from onSubmit.
  // Prevents the session useEffect from firing a second, conflicting redirect.
  const redirectedRef = useRef(false);

  // Issue 2 — runtime truth for which OAuth providers the NextAuth handler
  // actually exposes (mirrors the guarded provider list in the auth route).
  // null = still loading; SSO buttons fail-open until the check resolves, and
  // the signIn() try/catch (plus pages.error) are the backstops.
  const [oauthProviders, setOauthProviders] = useState(null);
  // NextAuth redirects failed SSO to pages.error → /login?error=<code>.
  const oauthErrorParam = sanitizeParam(searchParams.get('error'), {
    alphanumeric: true,
    maxLength: 64,
  });

  useEffect(() => {
    if (locked) setEmail(orgEmail);
  }, [orgEmail, locked]);

  useEffect(() => {
    fetch('/api/auth/providers')
      .then((res) => res.json())
      .then((body) => setOauthProviders(body && typeof body === 'object' ? body : {}))
      .catch(() => setOauthProviders({}));
  }, []);

  const missingOAuth = oauthProviders
    ? ['google', 'github'].filter((p) => !oauthProviders[p])
    : [];
  const providerLabel = (provider) => (provider === 'google' ? 'Google' : 'GitHub');

  // Auto-redirect already-authenticated users (e.g. OAuth session hydrated
  // after an OAuth sign-in round-trip). Skip entirely if:
  //   - session is loading or unauthenticated
  //   - form is submitting (busy) — avoids races with credential logins
  //   - a manual redirect from onSubmit is already in flight
 useEffect(() => {
  if (status === 'loading' || busy) return;

  if (redirectedRef.current) return; // manual redirect already in progress

  // If this is an invitation login, DO NOT redirect based on
  // an existing authenticated session.
  const searchParams = new URLSearchParams(window.location.search);
  const orgEmail =
    searchParams.get('orgEmail') || searchParams.get('email');
  const inviteToken =
    searchParams.get('inviteToken') || searchParams.get('token');

  const isInvitationLogin = Boolean(orgEmail || inviteToken);

  if (isInvitationLogin) {
    return;
  }

  // Normal login flow
  if (status === 'unauthenticated') return;

  if (status === 'authenticated' && session?.user) {
    const u = session.user;

    const wCount = u.workspaceCount ?? (u.hasWorkspace ? 1 : 0);

    redirectedRef.current = true;

    if (wCount === 0) {
      window.location.href = '/onboarding';
    } else if (wCount === 1) {
      const wsId =
        u.activeOrganizationId ||
        (u.workspaces?.[0]?.id ?? null);

      window.location.href = wsId
        ? `/workspace/${wsId}`
        : '/onboarding';
    } else {
      // 2+ workspaces — land in the active workspace shell; workspace
      // switching is available there via the dashboard switcher.
      const wsId = u.activeOrganizationId || (u.workspaces?.[0]?.id ?? null);
      window.location.href = wsId ? `/workspace/${wsId}` : '/onboarding';
    }
  }
}, [status, session, router, busy]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (busy) return;
    setBusy(true);
    try {
      const payload = { email: email.trim(), password };
      if (inviteToken) payload.inviteToken = inviteToken;

      const result = await signIn('credentials', {
        redirect: false,
        ...payload
      });

      if (!result?.ok) {
        // NextAuth only surfaces the backend message (custom `code` is lost in
        // the credentials redirect), so map the deterministic unverified-account
        // message back to its code to drive the amber banner + resend-OTP link.
        const msg = result?.error || 'Login failed.';
        setError({
          message: msg,
          code: msg.includes('Email not verified') ? 'EMAIL_NOT_VERIFIED' : undefined,
        });
        return;
      }

      // 1. Fetch hydrated NextAuth session to execute deterministic routing
      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();
      const user = sessionData?.user || {};

      // 2. Store token for components bypassing NextAuth (legacy)
      if (sessionData?.accessToken) {
        try { localStorage.setItem('pulseops_token', sessionData.accessToken); } catch { /* private mode */ }
      }

      // Mark that we are handling the redirect from here; suppresses
      // the session useEffect redirect to avoid a double-navigate race.
      redirectedRef.current = true;

      // 3. DETERMINISTIC REDIRECT MATRIX
      const { hasWorkspace, activeOrganizationId, isInvitedUser } = user;

      if (isInvitedUser || orgEmail) {
  // Invitation login: route to the invited workspace.
  // The authenticated account is now the account that just logged in.
  const targetOrg = activeOrganizationId || searchParams.get('workspaceId');

  if (targetOrg) {
    window.location.href = `/workspace/${targetOrg}/invitations`;
  } else {
    window.location.href = activeOrganizationId
      ? `/workspace/${activeOrganizationId}`
      : '/onboarding';
  }
} else if (hasWorkspace) {
        // CASE 1: Existing User -> land in the active workspace shell (the
        // dashboard switcher provides workspace switching from there).
        const wsId = activeOrganizationId || user.workspaces?.[0]?.id;
        window.location.href = wsId ? `/workspace/${wsId}` : '/onboarding';
      } else {
        // CASE 3: New User -> Route to Onboarding
        window.location.href = '/onboarding';
      }
    } catch (err) {
      redirectedRef.current = false; // allow retry
      setError({ message: 'Could not reach the authentication server. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const onOAuth = async (provider) => {
    setError(null);
    // Issue 2 — block the signIn() call (and the redirect to the NextAuth error
    // page) entirely when the provider is not configured in this environment.
    if (oauthProviders && !oauthProviders[provider]) {
      setError({
        message: `${providerLabel(provider)} Single Sign-On is not configured in this environment. Please sign in with email & password.`,
      });
      return;
    }
    try {
      // Preserve the invite context across the OAuth round trip so the login
      // flow resumes with the org email + invite token intact.
      const cb = new URL(window.location.href);
      if (orgEmail) cb.searchParams.set('orgEmail', orgEmail);
      if (inviteToken) cb.searchParams.set('inviteToken', inviteToken);
      await signIn(provider, {
        callbackUrl: '/workspace',
        ...(orgEmail ? { email: orgEmail } : {}),
      });
    } catch (err) {
      setError({
        message: `${providerLabel(provider)} Single Sign-On could not complete. Please sign in with email & password.`,
      });
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
            <p className="mt-1 text-sm text-slate-500">
              Sign in to your workspace{locked ? ' with your invitation' : ''}
            </p>
          </div>

          {/* Tab switcher: hide SSO tab when locked to an invited email */}
          <div
            role="tablist"
            aria-label="Sign-in method"
            className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100/80 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'credentials'}
              onClick={() => setTab('credentials')}
              className={`rounded-lg px-3 py-2 text-sm transition-all ${
                tab === 'credentials'
                  ? 'bg-white font-semibold text-indigo-700 shadow-sm'
                  : 'font-medium text-slate-500 hover:text-slate-700'
              }`}
            >
              Email &amp; password
            </button>
            {/* Hide SSO tab when email is locked to an invitation */}
            {!locked && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'oauth'}
                onClick={() => setTab('oauth')}
                className={`rounded-lg px-3 py-2 text-sm transition-all ${
                  tab === 'oauth'
                    ? 'bg-white font-semibold text-indigo-700 shadow-sm'
                    : 'font-medium text-slate-500 hover:text-slate-700'
                }`}
              >
                Single sign-on
              </button>
            )}
          </div>

          {oauthErrorParam && <NextAuthErrorBanner code={oauthErrorParam} />}
          {verified && !error && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
            >
              ✓ Email verified successfully. You can now sign in.
            </div>
          )}
          {locked && (
            <div className="mb-4">
              <LockedBanner orgEmail={orgEmail.trim()} />
            </div>
          )}
          <div className="mb-4">
            <ErrorBanner error={error} email={email} />
          </div>

          {tab === 'credentials' ? (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  readOnly={locked}
                  placeholder=" "
                  onChange={(e) => setEmail(e.target.value)}
                  className={`${FLOAT_INPUT} ${
                    locked
                      ? 'cursor-not-allowed border-indigo-300 bg-indigo-50/60 text-indigo-900 focus:ring-indigo-300'
                      : 'border-slate-300 focus:border-indigo-400 focus:ring-indigo-200'
                  }`}
                />
                <label htmlFor="login-email" className={FLOAT_LABEL}>
                  Work email
                </label>
              </div>
              {locked && (
                <p className="mt-1.5 text-xs text-indigo-600">
                  Email is locked to this invitation. Missing one?{' '}
                  <a href="/login" className="underline underline-offset-2">
                    Sign in with another email
                  </a>
                </p>
              )}


              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  placeholder=" "
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${FLOAT_INPUT} border-slate-300 focus:border-indigo-400 focus:ring-indigo-200`}
                />
                <label htmlFor="login-password" className={FLOAT_LABEL}>
                  Password
                </label>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {missingOAuth.length > 0 && (
                <div
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
                >
                  {missingOAuth.length === 2
                    ? 'Google / GitHub Single Sign-On is not configured in this environment. Please sign in with email & password.'
                    : `${providerLabel(missingOAuth[0])} Single Sign-On is not configured in this environment. Please sign in with email & password.`}
                </div>
              )}
              <p className="text-sm text-slate-500">
                Continue with Google or GitHub. Your organization and invitation
                are linked to this account automatically.
              </p>
              <button
                type="button"
                onClick={() => onOAuth('google')}
                disabled={busy || Boolean(oauthProviders && !oauthProviders.google)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white disabled:opacity-60"
              >
                <span aria-hidden="true">G</span> Google
              </button>
              <button
                type="button"
                onClick={() => onOAuth('github')}
                disabled={busy || Boolean(oauthProviders && !oauthProviders.github)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white/80 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-white disabled:opacity-60"
              >
                <span aria-hidden="true">G</span> GitHub
              </button>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Don&apos;t have an account?{' '}
          <a
            href={locked ? `/register?orgEmail=${encodeURIComponent(orgEmail)}` : '/register'}
            className="font-semibold text-indigo-600 underline-offset-2 hover:underline"
          >
            Sign up
          </a>
        </p>

        <p className="mt-3 text-center text-xs text-slate-400">
          By continuing you agree to the PulseOps terms of service.
        </p>
      </div>
    </div>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-400">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-500" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginInner />
    </Suspense>
  );
}

