"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function BareWorkspacePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

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

  return null;
}
