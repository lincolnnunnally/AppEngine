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
    body: "We Succeed builds real, working apps from a problem or idea you describe. It's in a controlled preview right now — Lincoln can sign in to run it privately before public access opens.",
    cta: "Owner sign in"
  },
  allowlist: {
    kicker: "We Succeed — app builder",
    title: "You're invited in early",
    body: "Describe a problem you want solved or a tool you want to build, and We Succeed builds you a real, working app for it. If your email is on the early-access list, sign in to start.",
    cta: "Sign in"
  },
  public: {
    kicker: "We Succeed — app builder",
    title: "Describe it. We build the app.",
    body: "Tell us a problem you want solved or a tool you want to build, and we build you a real, working app for it — live, online, ready to sign into. The first version is a working starter you then improve with us.",
    cta: "Sign in to start"
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
        <Link className="soft-launch-action" href="/signin">
          {copy.cta}
        </Link>
      </section>
    </main>
  );
}
