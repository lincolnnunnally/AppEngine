import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { hasEmailSignIn, hasGithubProvider, hasGoogleProvider } from "@/lib/auth/access";

// Signed-in identity readout for auth diagnostics: shows the caller their own
// session email + resolved role and which providers are live, so "signed in
// but not owner" stops looking identical to "login is broken". No secrets:
// session token and env values never appear in the response.
export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ signedIn: false, providers: activeProviders() }, { status: 401 });
  }

  return NextResponse.json({
    signedIn: true,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role || "customer",
    providers: activeProviders()
  });
}

function activeProviders() {
  return {
    google: hasGoogleProvider(),
    emailLink: hasEmailSignIn(),
    github: hasGithubProvider()
  };
}
