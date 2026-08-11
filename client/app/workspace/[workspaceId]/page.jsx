'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import WorkspaceDashboard from '../../_components/WorkspaceDashboard';

/**
 * Workspace home — the dashboard UI routed through the workspace shell.
 * TASK-109: accounts provisioned with a temporary password (mustChangePassword)
 * are sent to the invitation landing to rotate their password first.
 */
export default function WorkspaceHomePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();



  return <WorkspaceDashboard />;
}