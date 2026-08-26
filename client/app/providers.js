'use client';

// Client boundary for next-auth + TanStack Query — must live in its own
// 'use client' module: importing SessionProvider/QueryClientProvider directly
// into the server layout makes Next treat it as a Server Component ("React
// Context is unavailable in Server Components").
import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function Providers({ children }) {
  // One QueryClient per mount (avoids sharing cache state across SSR requests).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionProvider>
  );
}