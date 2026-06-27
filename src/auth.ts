import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "@neondatabase/serverless";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { getAuthSecret } from "@/lib/auth/config";
import { resolveRoleForSessionUser } from "@/lib/auth/roles";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

// Providers are built from configured credentials, so each one is dormant until
// its env vars exist — adding the keys (and, for the magic-link, a database) turns
// it on with no code change. Consumer-friendly options first (Google, email link);
// GitHub stays as a secondary/owner option.
function buildProviders(databaseUrl?: string) {
  const providers = [];

  if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({ clientId: process.env.AUTH_GOOGLE_ID, clientSecret: process.env.AUTH_GOOGLE_SECRET })
    );
  }

  // Passwordless email magic-link. Requires the database adapter (it stores the
  // verification token), so it only activates when a database URL is also present.
  if (databaseUrl && process.env.AUTH_RESEND_KEY && process.env.EMAIL_FROM) {
    providers.push(Resend({ apiKey: process.env.AUTH_RESEND_KEY, from: process.env.EMAIL_FROM }));
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const databaseUrl = getConfiguredDatabaseUrl();

  return {
    adapter: databaseUrl ? PostgresAdapter(new Pool({ connectionString: databaseUrl })) : undefined,
    secret: getAuthSecret(),
    providers: buildProviders(databaseUrl),
    pages: { signIn: "/signin" },
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
