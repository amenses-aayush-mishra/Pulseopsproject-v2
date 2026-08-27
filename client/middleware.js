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
    const activeWs = token.activeOrganizationId || (Array.isArray(token.workspaces) && token.workspaces[0]?.id) || null;
    // Signed in but no active workspace yet → onboarding.
    if (!activeWs) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      return NextResponse.redirect(url);
    }
    // RBAC: the requested workspace must belong to the session
    const segments = pathname.split('/').filter(Boolean);
    const requested = segments[1]; // /workspace/{workspaceId}/...
    const userWorkspaces = Array.isArray(token.workspaces) ? token.workspaces.map((w) => w.id) : [];
    if (requested && requested !== activeWs && !userWorkspaces.includes(requested)) {
      const url = req.nextUrl.clone();
      url.pathname = `/workspace/${activeWs}`;
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
    const activeWs = token.activeOrganizationId || (Array.isArray(token.workspaces) && token.workspaces[0]?.id) || null;
    if (!activeWs) {
      const url = req.nextUrl.clone();
      url.pathname = '/onboarding';
      url.search = '';
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = `/workspace/${activeWs}`;
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
    const activeWs = token.activeOrganizationId || (Array.isArray(token.workspaces) && token.workspaces[0]?.id) || null;
    const wCount = token.workspaceCount ?? (activeWs ? 1 : 0);
    if (wCount === 0 && !activeWs) {
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
    if (token) {
      const activeWs = token.activeOrganizationId || (Array.isArray(token.workspaces) && token.workspaces[0]?.id) || null;
      if (activeWs) {
        if (req.nextUrl.searchParams.get('inviteToken')) {
          return NextResponse.next();
        }
        const url = req.nextUrl.clone();
        url.search = '';
        url.pathname = `/workspace/${activeWs}`;
        return NextResponse.redirect(url);
      }
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/workspace/:path*', '/dashboard/:path*', '/login', '/onboarding', '/select-workspace'],
};
