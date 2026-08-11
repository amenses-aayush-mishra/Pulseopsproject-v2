import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../api/auth/[...nextauth]/route';
import ThemeProvider from '../../theme/ThemeProvider';
import WorkspaceSidebar from '../../_components/WorkspaceSidebar';

/**
 * TASK-107/109 — workspace shell layout.
 * Server-rendered RBAC guard: only an authenticated user whose session points
 * at this exact organization may view the shell (the edge middleware mirrors
 * this check for /workspace/*). The shell chrome (sidebar + theme engine)
 * wraps every page beneath /workspace/[workspaceId].
 */
export default async function WorkspaceLayout({ children, params }) {
  const workspaceId = params?.workspaceId;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/workspace/${workspaceId}`)}`);
  }
  if (!session.user.activeOrganizationId) {
    redirect('/onboarding');
  }
  // RBAC: this user is not a member of the requested workspace — send them to
  // the workspace they actually belong to (or onboarding if none).
  if (session.user.activeOrganizationId !== workspaceId) {
    redirect(`/workspace/${session.user.activeOrganizationId}`);
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50">
        <WorkspaceSidebar
          workspaceId={workspaceId}
          role={session.user.role || null}
        />
        <main className="ml-64 min-h-screen">{children}</main>
      </div>
    </ThemeProvider>
  );
}