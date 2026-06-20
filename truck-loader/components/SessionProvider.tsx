'use client';

import { SessionProvider as NextAuthSessionProvider } from '@/lib/authClient';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
