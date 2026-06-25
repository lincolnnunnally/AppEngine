import Link from "next/link";
import { getPublicAccessMode, type PublicAccessMode } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

// Mode-aware landing for visitors who aren't (yet) admitted to the consumer
// surface. The copy tracks APP_ENGINE_PUBLIC_ACCESS so going public is a pure env
// flip: "owner" keeps the private soft-launch copy (current live behavior),
// "allowlist" shows an invited-access welcome, "public" shows the open welcome.
// No infrastructure jargon — consumer-facing brand is "We Succeed".
type SoftLaunchCopy = {
  kicker: string;
  title: string;
  body: string;
  cta: string;
};

const COPY: Record<PublicAccessMode, SoftLaunchCopy> = {
  owner: {
    kicker: "we-succeed.org",
    title: "Owner-only soft launch",
    body: "Opportunity is in a controlled preview right now. Lincoln can sign in to review the two-door entry point and run the app privately before public access opens.",
    cta: "Owner sign in"
  },
  allowlist: {
    kicker: "We Succeed",
    title: "You're invited in early",
    body: "We Succeed is opening to a small group first. If your email is on the early-access list, sign in to bring a problem you want solved — or something you'd like to build.",
    cta: "Sign in"
  },
  public: {
    kicker: "We Succeed",
    title: "Every problem has an opportunity inside it",
    body: "Bring a problem you want solved, or something you'd like to build. We'll turn it into a real, live starter you can sign in and shape from there.",
    cta: "Sign in to begin"
  }
};

export default function SoftLaunchPage() {
  const copy = COPY[getPublicAccessMode()];

  return (
    <main className="soft-launch">
      <section className="soft-launch-panel">
        <p className="soft-launch-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
        <Link className="soft-launch-action" href="/api/auth/signin?callbackUrl=%2F">
          {copy.cta}
        </Link>
      </section>
    </main>
  );
}
