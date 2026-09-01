import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../../../lib/authOptions';
import WorkspaceSidebar from '../../_components/WorkspaceSidebar';
import WorkspaceTopBar from '../../_components/WorkspaceTopBar';

// ThemeProvider from next-themes is now at the root layout (app/layout.js).
// The old per-workspace ThemeProvider is removed to avoid nesting conflicts.

export default async function WorkspaceLayout({ children, params }) {
  const workspaceId = params?.workspaceId;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/workspace/${workspaceId}`)}`);
  }
  const user = session.user as any;
  if (!user.activeOrganizationId) {
    redirect('/onboarding');
  }

  if (user.activeOrganizationId !== workspaceId) {
    redirect(`/workspace/${user.activeOrganizationId}`);
  }

  const role = user.role || 'member';

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] selection:bg-indigo-100 selection:text-indigo-900 dark:selection:bg-indigo-900/40 dark:selection:text-indigo-100">
      {/* Responsive Sidebar */}
      <WorkspaceSidebar workspaceId={workspaceId} role={role} />

      {/* Main Content Container padded for fixed sidebar */}
      <div className="pl-16 md:pl-64 flex flex-col min-h-screen transition-all duration-300">
        {/* Top Bar Navigation */}
        <WorkspaceTopBar workspaceId={workspaceId} role={role} />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}