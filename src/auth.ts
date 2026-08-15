import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "@neondatabase/serverless";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { getAuthSecret } from "@/lib/auth/config";
import { resolveRoleForSessionUser } from "@/lib/auth/roles";
import { toClientSession } from "@/lib/auth/session";
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
  const production = process.env.NODE_ENV === "production";
  const sharedCookie = production
    ? { httpOnly: true, sameSite: "lax" as const, path: "/", secure: true, domain: ".unitedundergod.org" }
    : undefined;

  return {
    adapter: databaseUrl ? PostgresAdapter(new Pool({ connectionString: databaseUrl })) : undefined,
    secret: getAuthSecret(),
    trustHost: true,
    providers: buildProviders(databaseUrl),
    pages: { signIn: "/signin" },
    ...(sharedCookie
      ? {
          cookies: {
            sessionToken: { options: sharedCookie },
            callbackUrl: { options: sharedCookie },
            csrfToken: { options: sharedCookie }
          }
        }
      : {}),
    callbacks: {
      async session({ session, user }) {
        if (session.user) {
          session.user.role = await resolveRoleForSessionUser({
            id: user?.id,
            email: session.user.email || user?.email,
            role: user?.role
          });
        }
        // Return a whitelisted shape, never the raw `session` object. With the
        // database-session strategy that object is the AdapterSession row and
        // carries the sessionToken/userId, which must not reach the JSON body of
        // GET /api/auth/session (see src/lib/auth/session.ts).
        return toClientSession(session, user);
      }
    }
  };
});
