import NextAuth from "next-auth";
import PostgresAdapter from "@auth/pg-adapter";
import { Pool } from "@neondatabase/serverless";
import { headers } from "next/headers";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { getAuthSecret } from "@/lib/auth/config";
import { normalizeSignInEmail, resolveAuthEmailFrom } from "@/lib/auth/email";
import { hostFromHeader, isAllowedAuthOrigin, sessionCookieDomainForHost } from "@/lib/auth/hosts";
import { resolveRoleForSessionUser } from "@/lib/auth/roles";
import { toClientSession } from "@/lib/auth/session";
import { getConfiguredDatabaseUrl } from "@/lib/engine/local-mode";

// Two production hosts share this deploy. A pinned AUTH_URL makes every
// callback (and the verify-request page) jump to the factory — which drops
// the PKCE cookie issued on the desk and 500s the login.
function unpinAuthUrl() {
  process.env.AUTH_TRUST_HOST = "true";
  if (!process.env.APP_ENGINE_PUBLIC_ORIGIN && process.env.AUTH_URL) {
    process.env.APP_ENGINE_PUBLIC_ORIGIN = process.env.AUTH_URL;
  }
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
}

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
  const emailFrom = resolveAuthEmailFrom();
  if (databaseUrl && process.env.AUTH_RESEND_KEY && emailFrom) {
    providers.push(
      Resend({
        apiKey: process.env.AUTH_RESEND_KEY,
        from: emailFrom,
        normalizeIdentifier(identifier) {
          return normalizeSignInEmail(identifier) ?? identifier;
        }
      })
    );
  }

  if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
    providers.push(
      GitHub({ clientId: process.env.AUTH_GITHUB_ID, clientSecret: process.env.AUTH_GITHUB_SECRET })
    );
  }

  return providers;
}

async function sessionCookies() {
  if (process.env.NODE_ENV !== "production") {
    return undefined;
  }

  let host = "";

  try {
    host = hostFromHeader((await headers()).get("host"));
  } catch {
    host = "";
  }

  // Share the session across factory + desk on unitedundergod.org. Leftover-preview
  // and other Vercel hosts must stay host-only — a pinned .unitedundergod.org
  // Domain is rejected by the browser on *.vercel.app and the magic-link session
  // never sticks.
  const domain = sessionCookieDomainForHost(host);

  return {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: true,
        ...(domain ? { domain } : {})
      }
    }
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(async () => {
  unpinAuthUrl();
  const databaseUrl = getConfiguredDatabaseUrl();
  const sessionCookie = await sessionCookies();

  return {
    adapter: databaseUrl ? PostgresAdapter(new Pool({ connectionString: databaseUrl })) : undefined,
    secret: getAuthSecret(),
    trustHost: true,
    providers: buildProviders(databaseUrl),
    pages: { signIn: "/signin", verifyRequest: "/signin/check-email", error: "/signin" },
    ...(sessionCookie ? { cookies: sessionCookie } : {}),
    callbacks: {
      async redirect({ url, baseUrl }) {
        try {
          const target = new URL(url, baseUrl);
          if (target.origin === new URL(baseUrl).origin || isAllowedAuthOrigin(target.origin)) {
            return `${target.origin}${target.pathname}${target.search}${target.hash}`;
          }
        } catch {
          // Fall through to the request origin.
        }
        return baseUrl;
      },
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
