import type { Role } from "./roles";

// The exact shape we expose from GET /api/auth/session.
//
// With the database-session strategy (@auth/pg-adapter), the object handed to
// the NextAuth `session` callback is the AdapterSession ROW — { sessionToken,
// userId, expires, ... } — merged with the user record. Returning that object
// wholesale serializes the raw `sessionToken` into the JSON response, so any
// page script (e.g. via XSS) could read it with fetch("/api/auth/session") and
// defeat the httpOnly session cookie. We rebuild a minimal object here instead
// of deleting known-bad keys: a whitelist guarantees no adapter/session-row
// field can leak now or if the adapter's row shape changes later.
export type ClientSession = {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: Role;
  };
  expires: string;
};

type SessionUserLike = {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: Role;
};

type AdapterUserLike = {
  id?: string;
  email?: string | null;
};

// Build the sanitized session response. `session.user` already carries the role
// resolved by the caller; `user` (the AdapterUser) is only used to fill in the
// user id/email when the session's user object omits them. Nothing else from the
// session row is read, so sessionToken/userId/id can never reach the client.
export function toClientSession(
  session: { user?: SessionUserLike | null; expires: string },
  user?: AdapterUserLike | null
): ClientSession {
  const sessionUser = session.user ?? {};

  return {
    user: {
      id: sessionUser.id ?? user?.id,
      name: sessionUser.name ?? null,
      email: sessionUser.email ?? user?.email ?? null,
      image: sessionUser.image ?? null,
      role: sessionUser.role
    },
    expires: session.expires
  };
}
