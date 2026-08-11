'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// TASK-107 — the dashboard UI now lives inside the workspace shell at
// /workspace/[workspaceId]. This route is a compatibility redirect so legacy
// bookmarks and the middleware's /dashboard guard converge on the shell.
export default function DashboardRedirectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || !session?.user) {
      router.replace('/login');
    } else if (session.user.activeOrganizationId) {
      router.replace(`/workspace/${session.user.activeOrganizationId}`);
    } else {
      router.replace('/onboarding');
    }
  }, [status, session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
      Redirecting to your workspace…
    </div>
  );
}
