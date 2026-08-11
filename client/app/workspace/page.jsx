"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function BareWorkspacePage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/select-workspace');
  }, [router]);

  return null;
}
