import { FactoryWelcome } from "@/components/intake/factory-welcome";
import { getPublicAccessMode, type PublicAccessMode } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

// Mode-aware landing for visitors who aren't (yet) admitted to the consumer
// surface. The copy tracks APP_ENGINE_PUBLIC_ACCESS so going public is a pure env
// flip: "owner" keeps the private soft-launch copy (current live behavior),
// "allowlist" shows an invited-access welcome, "public" shows the open welcome.
// No infrastructure jargon — consumer-facing brand is "AppEngine".
type SoftLaunchCopy = {
  kicker: string;
  titleLines: string[];
  body: string;
  cta: string;
};

const COPY: Record<PublicAccessMode, SoftLaunchCopy> = {
  owner: {
    kicker: "App Engine",
    titleLines: ["Snap pieces together.", "Get a working app."],
    body: "Describe a problem you want solved or a tool you want to build. We recommend a starter combination, show the cost up front, and publish a live website. Sign in to start.",
    cta: "Sign in"
  },
  allowlist: {
    kicker: "App Engine — app builder",
    titleLines: ["You're invited.", "Come start early."],
    body: "Describe a problem you want solved or a tool you want to build, and we build you a real, working app for it. If your email is on the early-access list, sign in to start.",
    cta: "Sign in"
  },
  public: {
    kicker: "App Engine — app builder",
    titleLines: ["Describe it.", "Snap it together."],
    body: "Tell us a problem you want solved or a tool you want to build. We pick a starter pack, show the price, and publish a live website you can open.",
    cta: "Sign in to start"
  }
};

export default function SoftLaunchPage() {
  const copy = COPY[getPublicAccessMode()];

  return (
    <div className="soft-launch">
      <FactoryWelcome kicker={copy.kicker} titleLines={copy.titleLines} body={copy.body} cta={copy.cta} />
    </div>
  );
}
