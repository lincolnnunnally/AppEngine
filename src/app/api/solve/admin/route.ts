import { canAccessEngineOwner } from "@/lib/auth/access";
import { insertRow, updateOne } from "@/lib/solution-engine/db";
import { listAcceptanceChecks, markAcceptanceCheck } from "@/lib/solution-engine/first-attempt";
import { cleanText, handleCaught, jsonError, jsonOk, readJson, requireConfigured } from "@/lib/solution-engine/http";
import { loadOperatorCase, loadOperatorDashboard } from "@/lib/solution-engine/operator";
import { deliver, openConnection, pauseCase, respondToIntro, startBuild } from "@/lib/solution-engine/service";
import { getCaseById, isUuid, transitionCase } from "@/lib/solution-engine/state-machine";

export const dynamic = "force-dynamic";

async function guard() {
  if (!(await canAccessEngineOwner())) {
    return jsonError("Unauthorized", 401);
  }

  return requireConfigured();
}

export async function GET(request: Request) {
  const blocked = await guard();

  if (blocked) {
    return blocked;
  }

  const caseId = new URL(request.url).searchParams.get("caseId");

  try {
    if (caseId && isUuid(caseId)) {
      const theCase = await getCaseById(caseId);

      if (!theCase) {
        return jsonError("No such case.", 404);
      }

      return jsonOk({ case: theCase, ...(await loadOperatorCase(caseId)) });
    }

    return jsonOk({ dashboard: await loadOperatorDashboard() });
  } catch (caught) {
    return handleCaught(caught);
  }
}

type AdminBody = {
  action?: string;
  caseId?: string;
  buildRef?: string;
  artifactUrl?: string;
  walkthroughUrl?: string;
  stepIndex?: number;
  status?: string;
  evidence?: string;
  reason?: string;
  accept?: boolean;
  escalationId?: string;
  member?: {
    displayName?: string;
    email?: string;
    phone?: string;
    region?: string;
    problemClasses?: string[];
    stage?: string;
    story?: string;
    capacity?: number;
  };
  memberId?: string;
  active?: boolean;
};

export async function POST(request: Request) {
  const blocked = await guard();

  if (blocked) {
    return blocked;
  }

  const body = await readJson<AdminBody>(request);

  if (!body?.action) {
    return jsonError("Nothing to do.");
  }

  try {
    switch (body.action) {
      case "add-pool-member": {
        const member = body.member || {};
        const displayName = cleanText(member.displayName, 120);

        if (!displayName) {
          return jsonError("A name is required.");
        }

        const created = await insertRow("se_connection_pool", {
          display_name: displayName,
          contact_email: cleanText(member.email, 200) || null,
          contact_phone: cleanText(member.phone, 40) || null,
          region: cleanText(member.region, 120) || null,
          problem_classes: Array.isArray(member.problemClasses) ? member.problemClasses.slice(0, 8) : [],
          stage: member.stage === "same_stage" ? "same_stage" : "one_step_ahead",
          story: cleanText(member.story, 600) || null,
          capacity: Number.isFinite(Number(member.capacity)) ? Math.max(1, Number(member.capacity)) : 3
        });

        return jsonOk({ member: created }, 201);
      }

      case "toggle-pool-member": {
        if (!body.memberId || !isUuid(body.memberId)) {
          return jsonError("Which volunteer?");
        }

        const updated = await updateOne("se_connection_pool", `id=eq.${body.memberId}`, { active: Boolean(body.active) });
        return jsonOk({ member: updated });
      }

      case "ack-safety": {
        if (!body.escalationId || !isUuid(body.escalationId)) {
          return jsonError("Which escalation?");
        }

        const updated = await updateOne("se_safety_escalations", `id=eq.${body.escalationId}`, {
          acknowledged_at: new Date().toISOString()
        });

        return jsonOk({ escalation: updated });
      }

      default:
        break;
    }

    // Everything below is a case action.
    if (!body.caseId || !isUuid(body.caseId)) {
      return jsonError("Which case?");
    }

    const theCase = await getCaseById(body.caseId);

    if (!theCase) {
      return jsonError("No such case.", 404);
    }

    switch (body.action) {
      case "start-build":
        return jsonOk({ case: await startBuild(theCase, cleanText(body.buildRef, 200)) });

      // Marking an acceptance line proven. This — not anyone's judgement that it
      // "looks done" — is what eventually lets the case be delivered.
      case "check": {
        const checks = await listAcceptanceChecks(theCase.id);
        const target = checks.find((check) => check.step_index === Number(body.stepIndex));

        if (!target) {
          return jsonError("No such step.");
        }

        const status = body.status === "passing" ? "passing" : body.status === "failing" ? "failing" : "pending";
        await markAcceptanceCheck(target, status, cleanText(body.evidence, 500));

        return jsonOk(await loadOperatorCase(theCase.id));
      }

      case "deliver": {
        const artifactUrl = cleanText(body.artifactUrl, 500);
        const walkthroughUrl = cleanText(body.walkthroughUrl, 500);

        if (!artifactUrl) {
          return jsonError("Where does the person open it?");
        }

        if (!walkthroughUrl) {
          // §5: "Every delivery includes a walkthrough." Not optional.
          return jsonError("A delivery without a walkthrough isn't a delivery. Add the walkthrough link.");
        }

        return jsonOk({ case: await deliver(theCase, artifactUrl, walkthroughUrl) });
      }

      case "connect": {
        const result = await openConnection(theCase);

        if (!result.intro) {
          return jsonError(result.reason || "No match available yet.", 409);
        }

        return jsonOk({ case: result.theCase, intro: result.intro });
      }

      // The volunteer's answer, relayed by whoever spoke to them.
      case "match-response":
        return jsonOk(await respondToIntro(theCase, "match", Boolean(body.accept)));

      case "pause":
        return jsonOk({ case: await pauseCase(theCase, cleanText(body.reason, 200) || "paused by operator") });

      case "close":
        // Will refuse unless the connection rule is satisfied. That refusal is the
        // product working, not a bug.
        return jsonOk({ case: await transitionCase(theCase, "closed", { reason: "closed by operator", actor: "operator" }) });

      default:
        return jsonError("We don't know what to do with that.");
    }
  } catch (caught) {
    return handleCaught(caught);
  }
}
