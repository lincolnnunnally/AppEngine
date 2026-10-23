// Auth.js profile() for GitHub. The /user payload and an unverified primary
// address are not proof the person controls that inbox. GET /user/emails and
// keep only verified:true, preferring a verified primary. No verified email
// rejects the sign-in (the caller throws, and Auth.js does not open a session).

export type GithubUserProfile = {
  id: string | number;
  name?: string | null;
  login?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

export type GithubEmail = {
  email?: string | null;
  primary?: boolean;
  verified?: boolean;
};

const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

export function selectVerifiedGithubEmail(emails: readonly GithubEmail[] | null | undefined): string | null {
  if (!emails) {
    return null;
  }

  const verified: Array<{ email: string; primary: boolean }> = [];

  for (const entry of emails) {
    if (entry?.verified !== true) {
      continue;
    }

    const email = entry.email?.trim().toLowerCase();

    if (!email) {
      continue;
    }

    verified.push({ email, primary: entry.primary === true });
  }

  return (verified.find((entry) => entry.primary) ?? verified[0])?.email ?? null;
}

export async function githubProfile(
  profile: GithubUserProfile,
  tokens: { access_token?: string | null },
  fetchImpl: typeof fetch = fetch
) {
  const accessToken = tokens?.access_token?.trim();

  if (!accessToken) {
    throw new Error("GitHub sign-in requires a verified email");
  }

  const response = await fetchImpl(GITHUB_EMAILS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "app-engine"
    }
  });

  if (!response.ok) {
    throw new Error("GitHub sign-in requires a verified email");
  }

  const body = (await response.json()) as unknown;
  // profile.email is intentionally unused: GitHub will put an unverified
  // address there, and that address must not become the session user.
  const email = selectVerifiedGithubEmail(Array.isArray(body) ? body : []);

  if (!email) {
    throw new Error("GitHub sign-in requires a verified email");
  }

  return {
    id: String(profile.id),
    name: profile.name ?? profile.login ?? email,
    email,
    image: profile.avatar_url ?? null
  };
}
