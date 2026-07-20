import NextAuth, { DefaultSession, DefaultUser } from 'next-auth';
import { JWT as DefaultJWT } from 'next-auth/jwt';

export type AppRole = 'admin' | 'member';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      companyId: string;
      companyName: string;
      role: AppRole;
    } & DefaultSession['user'];
  }

  interface User extends DefaultUser {
    companyId: string;
    companyName: string;
    role: AppRole;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    companyId: string;
    companyName: string;
    role: AppRole;
  }
}
