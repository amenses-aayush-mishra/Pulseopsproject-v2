import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

/**
 * TASK-110 — Edge-safe routing middleware.
 * Guards /workspace/* (workspace shell) and /dashboard (legacy entrypoint).
 * /select-workspace requires authentication; authenticated+workspace users
 * are redirected away from /login using the 3-case routing matrix.
 * /onboarding is intentionally NOT blocked for authenticated users with
 * existing workspaces so they can spin up an additional workspace.
 */
export async function middleware(req) {
  let token = null;
  try {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || '',
    });
  } catch (err) {
    // Session cookie cannot be verified — treat as unauthenticated.
    console.error('[middleware] getToken failed:', err.message);
  }

  const { pathname } = req.nextUrl;

  // D — /workspace/* guards (workspace shell, TASK-107).
  if (pathname.startsWith('/workspace')) {
    // Unauthenticated → /login, preserving the intended destination.
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `callbackUrl=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    // Signed in but no active workspace yet → onboarding.
    if (!token.activeOrganizationId) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      return NextResponse.redirect(url);
    }
    // RBAC: the requested workspace must be the session's active workspace
    // (membership is re-verified server-side by the layout + API).
    const segments = pathname.split('/').filter(Boolean);
    const requested = segments[1]; // /workspace/{workspaceId}/...
    if (requested && requested !== token.activeOrganizationId) {
      const url = req.nextUrl.clone();
      url.pathname = `/workspace/${token.activeOrganizationId}`;
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // A + B — /dashboard/*. Unauthenticated → /login; no workspace → /onboarding;
  // otherwise route into the workspace shell (dashboard lives at /workspace/[id]).
  if (pathname.startsWith('/dashboard')) {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `callbackUrl=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    if (!token.activeOrganizationId) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = `/workspace/${token.activeOrganizationId}`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  // E — /select-workspace guard.
  // Auth required; no workspaces at all → /onboarding to create first.
  if (pathname === '/select-workspace') {
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = `callbackUrl=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    const wCount = token.workspaceCount ?? (token.activeOrganizationId ? 1 : 0);
    if (wCount === 0) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // C — /login bypass guard for authenticated users with a workspace.
  // /onboarding is NOT blocked — existing users may add a 2nd workspace.
  if (pathname === '/login') {
    if (token && token.activeOrganizationId) {
      // Exception: allow /login when an explicit inviteToken is present so an
      // existing user can process a pending invitation.
      if (req.nextUrl.searchParams.get('inviteToken')) {
        return NextResponse.next();
      }
      const wCount = token.workspaceCount ?? 1;
      const url = req.nextUrl.clone();
      url.search = '';
      url.pathname =
        wCount > 1
          ? '/select-workspace'
          : `/workspace/${token.activeOrganizationId}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/workspace/:path*', '/dashboard/:path*', '/login', '/onboarding', '/select-workspace'],
};
