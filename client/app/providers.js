'use client';

// Client boundary for next-auth — must live in its own 'use client' module:
// importing SessionProvider directly into the server layout makes Next treat
// it as a Server Component ("React Context is unavailable in Server
// Components").
import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}