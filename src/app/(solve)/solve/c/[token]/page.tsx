import Link from "next/link";
import CaseFlow, { type CaseBundle } from "@/components/solve/case-flow";
import { isSolutionEngineConfigured } from "@/lib/solution-engine/db";
import {
  toPublicAcceptance,
  toPublicAssumptions,
  toPublicCase,
  toPublicCovenant,
  toPublicFollowUp,
  toPublicIntro,
  toPublicMessages
} from "@/lib/solution-engine/public-view";
import { loadPublicCase } from "@/lib/solution-engine/service";

export const dynamic = "force-dynamic";

// The token in the URL is the whole credential. No login, nothing to remember, and
// nothing on this page that isn't theirs.
export default async function SolveCasePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isSolutionEngineConfigured()) {
    return (
      <main className="se-wrap">
        <h1>Back in a minute.</h1>
        <p className="se-lede">This isn&rsquo;t available right this second. Try again shortly.</p>
      </main>
    );
  }

  const bundle = await loadPublicCase(token);

  if (!bundle) {
    return (
      <main className="se-wrap">
        <h1>We couldn&rsquo;t find that.</h1>
        <p className="se-lede">The link might be mistyped, or it might belong to a different device.</p>
        <Link className="se-button" href="/solve">
          Start again
        </Link>
      </main>
    );
  }

  const initial: CaseBundle = {
    case: toPublicCase(bundle.theCase),
    messages: toPublicMessages(bundle.messages),
    covenant: toPublicCovenant(bundle.covenant, bundle.commitments),
    intro: toPublicIntro(bundle.intro, bundle.matchName),
    followUp: toPublicFollowUp(bundle.followUp),
    assumptions: toPublicAssumptions(bundle.assumptions),
    acceptance: toPublicAcceptance(bundle.acceptance)
  };

  return (
    <main className="se-wrap">
      <CaseFlow initial={initial} />

      <p className="se-footer">
        Keep this link &mdash; it&rsquo;s how you get back here. There&rsquo;s no account to sign into.
      </p>
    </main>
  );
}
