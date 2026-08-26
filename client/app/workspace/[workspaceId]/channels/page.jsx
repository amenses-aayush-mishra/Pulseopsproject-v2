'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function ChannelsRedirectPage({ params }) {
  const { workspaceId } = params;
  const router = useRouter();

  useEffect(() => {
    if (workspaceId) {
      router.push(`/workspace/${workspaceId}/communication`);
    }
  }, [workspaceId, router]);

  return null;
}