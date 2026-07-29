import { answerCommitment, listCommitments } from "@/lib/solution-engine/covenant";
import { cleanText, clientKey, handleCaught, jsonError, jsonOk, readJson, requireConfigured, throttle } from "@/lib/solution-engine/http";
import {
  toPublicAcceptance,
  toPublicAssumptions,
  toPublicCase,
  toPublicCovenant,
  toPublicFollowUp,
  toPublicIntro,
  toPublicMessages
} from "@/lib/solution-engine/public-view";
import {
  acceptOffer,
  confirmReflection,
  declineOffer,
  loadPublicCase,
  provideContact,
  refuseCovenant,
  replyToCase,
  respondToIntro,
  reviseBeforeBuild,
  signCovenant,
  submitFollowUp
} from "@/lib/solution-engine/service";
import { getCovenant } from "@/lib/solution-engine/covenant";
import { getCaseByToken } from "@/lib/solution-engine/state-machine";

export const dynamic = "force-dynamic";

function bundleResponse(bundle: NonNullable<Awaited<ReturnType<typeof loadPublicCase>>>) {
  return {
    case: toPublicCase(bundle.theCase),
    messages: toPublicMessages(bundle.messages),
    covenant: toPublicCovenant(bundle.covenant, bundle.commitments),
    intro: toPublicIntro(bundle.intro, bundle.matchName),
    followUp: toPublicFollowUp(bundle.followUp),
    assumptions: toPublicAssumptions(bundle.assumptions),
    acceptance: toPublicAcceptance(bundle.acceptance)
  };
}

// The token IS the credential. It is unguessable, it is the only thing a person
// has to keep, and there is nothing to sign up for — which is the point (§3).
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const unconfigured = requireConfigured();

  if (unconfigured) {
    return unconfigured;
  }

  const { token } = await params;

  try {
    const bundle = await loadPublicCase(token);

    if (!bundle) {
      return jsonError("We couldn't find that. Check the link, or start again.", 404);
    }

    return jsonOk(bundleResponse(bundle));
  } catch (caught) {
    return handleCaught(caught);
  }
}

type ActionBody = {
  action?: string;
  text?: string;
  confirmed?: boolean;
  correction?: string;
  name?: string;
  email?: string;
  phone?: string;
  channel?: string;
  region?: string;
  postalCode?: string;
  accept?: boolean;
  periodIndex?: number;
  status?: string;
  note?: string;
  stillWorking?: boolean;
  stillMeeting?: boolean;
  testimony?: string;
  assumptionId?: string;
  correctedTo?: string;
  checkStepIndex?: number;
  description?: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const unconfigured = requireConfigured();

  if (unconfigured) {
    return unconfigured;
  }

  if (!throttle(`case:${clientKey(request)}`, 40, 60_000)) {
    return jsonError("Slow down a moment.", 429);
  }

  const { token } = await params;
  const body = await readJson<ActionBody>(request);

  if (!body?.action) {
    return jsonError("Nothing to do.");
  }

  try {
    const theCase = await getCaseByToken(token);

    if (!theCase) {
      return jsonError("We couldn't find that. Check the link, or start again.", 404);
    }

    // A safety-escalated case does not go back into the solution flow (§4d). The
    // only thing on its screen is a list of people who can actually help.
    if (theCase.safety_flagged && body.action !== "refresh") {
      return jsonError("This conversation has stopped here on purpose. Please use the numbers on the screen.", 409);
    }

    switch (body.action) {
      case "reply": {
        const text = cleanText(body.text);

        if (text.length < 1) {
          return jsonError("Say something and I'll pick it up from there.");
        }

        await replyToCase(theCase, text);
        break;
      }

      case "reflection": {
        await confirmReflection(theCase, Boolean(body.confirmed), cleanText(body.correction));
        break;
      }

      case "contact": {
        const email = cleanText(body.email, 200);

        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
          return jsonError("That email doesn't look right.");
        }

        await provideContact(theCase, {
          name: cleanText(body.name, 120),
          email,
          phone: cleanText(body.phone, 40),
          channel: body.channel === "phone" ? "phone" : "email",
          region: cleanText(body.region, 120),
          postalCode: cleanText(body.postalCode, 16)
        });
        break;
      }

      // Correcting a default or rewriting a line of the walkthrough, while the
      // offer is still on the table. This is the whole point of the first-attempt
      // spine: the correction that would otherwise stop a build mid-flight costs
      // one tap here instead.
      case "revise": {
        await reviseBeforeBuild(theCase, {
          assumptionId: cleanText(body.assumptionId, 64) || undefined,
          correctedTo: cleanText(body.correctedTo, 500) || undefined,
          checkStepIndex: Number(body.checkStepIndex) || undefined,
          description: cleanText(body.description, 300) || undefined
        });
        break;
      }

      case "accept-offer": {
        const withContact = await getCaseByToken(token);

        if (!withContact?.contact_email && !withContact?.contact_phone) {
          return jsonError("We need one way to reach you before we start.");
        }

        await acceptOffer(withContact);
        break;
      }

      case "decline-offer": {
        await declineOffer(theCase);
        break;
      }

      case "sign-covenant": {
        await signCovenant(theCase);
        break;
      }

      case "refuse-covenant": {
        await refuseCovenant(theCase);
        break;
      }

      case "commitment": {
        const covenant = await getCovenant(theCase.id);

        if (!covenant) {
          return jsonError("There's nothing to check off yet.");
        }

        const commitments = await listCommitments(theCase.id);
        const target = commitments.find((commitment) => commitment.period_index === Number(body.periodIndex));

        if (!target) {
          return jsonError("We couldn't find that week.");
        }

        const status = body.status === "kept" ? "kept" : body.status === "shrunk" ? "shrunk" : "missed";
        await answerCommitment(target, status, cleanText(body.note, 500));
        break;
      }

      case "intro": {
        await respondToIntro(theCase, "person", Boolean(body.accept));
        break;
      }

      case "follow-up": {
        await submitFollowUp(theCase, {
          stillWorking: Boolean(body.stillWorking),
          stillMeeting: Boolean(body.stillMeeting),
          testimony: cleanText(body.testimony, 2000)
        });
        break;
      }

      case "refresh":
        break;

      default:
        return jsonError("We don't know what to do with that.");
    }

    const bundle = await loadPublicCase(token);

    if (!bundle) {
      return jsonError("We couldn't find that.", 404);
    }

    return jsonOk(bundleResponse(bundle));
  } catch (caught) {
    return handleCaught(caught);
  }
}
