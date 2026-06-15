import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "@neondatabase/serverless";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { getAuthSecret } from "@/lib/auth/config";
import { resolveRoleForSessionUser } from "@/lib/auth/roles";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

const providers = [
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? [
        GitHub({
          clientId: process.env.AUTH_GITHUB_ID,
          clientSecret: process.env.AUTH_GITHUB_SECRET
        })
      ]
    : []),
  ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET
        })
      ]
    : [])
];

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const databaseUrl = getConfiguredDatabaseUrl();

  return {
    adapter: databaseUrl ? PostgresAdapter(new Pool({ connectionString: databaseUrl })) : undefined,
    secret: getAuthSecret(),
    providers,
    callbacks: {
      async session({ session, user }) {
        if (session.user) {
          session.user.role = await resolveRoleForSessionUser({
            id: user?.id,
            email: session.user.email || user?.email,
            role: user?.role
          });
        }
        return session;
      }
    }
  };
});
